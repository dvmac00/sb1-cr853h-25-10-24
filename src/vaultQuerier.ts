import { TFile, Vault } from 'obsidian';
import { EmbeddingManager, Embedding } from './embeddings';
import { DatabaseManager } from './db';

export interface SearchResult {
  file: TFile;
  similarity: number;
  relevantContent?: string;
  matchingChunks?: string[];
}

export interface SearchOptions {
  limit?: number;
  threshold?: number;
  includeContent?: boolean;
  searchType?: 'semantic' | 'hybrid' | 'exact';
  categories?: string[];
  tags?: string[];
  dateRange?: {
    start?: Date;
    end?: Date;
  };
}

export class VaultQuerier {
  private vault: Vault;
  private embeddingManager: EmbeddingManager;
  private databaseManager: DatabaseManager;
  private readonly DEFAULT_LIMIT = 5;
  private readonly DEFAULT_THRESHOLD = 0.7;
  private readonly CONTEXT_WINDOW = 100;

  constructor(vault: Vault, embeddingManager: EmbeddingManager, databaseManager: DatabaseManager) {
    this.vault = vault;
    this.embeddingManager = embeddingManager;
    this.databaseManager = databaseManager;
  }

  async queryVault(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    const {
      limit = this.DEFAULT_LIMIT,
      threshold = this.DEFAULT_THRESHOLD,
      includeContent = false,
      searchType = 'semantic',
      categories = [],
      tags = [],
      dateRange
    } = options;

    let results: SearchResult[] = [];

    switch (searchType) {
      case 'semantic':
        results = await this.semanticSearch(query, limit, threshold);
        break;
      case 'hybrid':
        results = await this.hybridSearch(query, limit, threshold);
        break;
      case 'exact':
        results = await this.exactSearch(query, limit);
        break;
    }

    // Apply filters
    results = await this.filterResults(results, { categories, tags, dateRange });

    // Include relevant content if requested
    if (includeContent) {
      results = await this.enrichResults(results, query);
    }

    return results;
  }

  private async semanticSearch(query: string, limit: number, threshold: number): Promise<SearchResult[]> {
    const queryEmbedding = await this.embeddingManager.generateEmbedding(query);
    const allEmbeddings = await this.databaseManager.getAllEmbeddings();
    
    const results = new Map<string, SearchResult>();
    
    for (const embedding of allEmbeddings) {
      const similarity = this.cosineSimilarity(queryEmbedding, embedding.vector);
      if (similarity < threshold) continue;

      const file = this.vault.getAbstractFileByPath(embedding.file) as TFile;
      if (!file) continue;

      const existing = results.get(file.path);
      if (!existing || existing.similarity < similarity) {
        results.set(file.path, {
          file,
          similarity,
          matchingChunks: [embedding.chunk]
        });
      } else {
        existing.matchingChunks?.push(embedding.chunk);
      }
    }

    return Array.from(results.values())
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
  }

  private async hybridSearch(query: string, limit: number, threshold: number): Promise<SearchResult[]> {
    const [semanticResults, exactResults] = await Promise.all([
      this.semanticSearch(query, limit * 2, threshold),
      this.exactSearch(query, limit * 2)
    ]);

    const combined = new Map<string, SearchResult>();

    // Combine and normalize scores
    for (const result of [...semanticResults, ...exactResults]) {
      const existing = combined.get(result.file.path);
      if (!existing || existing.similarity < result.similarity) {
        combined.set(result.file.path, result);
      }
    }

    return Array.from(combined.values())
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
  }

  private async exactSearch(query: string, limit: number): Promise<SearchResult[]> {
    const results: SearchResult[] = [];
    const files = this.vault.getMarkdownFiles();
    const queryTerms = query.toLowerCase().split(/\s+/);

    for (const file of files) {
      const content = await this.vault.read(file);
      const contentLower = content.toLowerCase();
      
      let matchCount = 0;
      for (const term of queryTerms) {
        const regex = new RegExp(term, 'gi');
        const matches = contentLower.match(regex);
        if (matches) {
          matchCount += matches.length;
        }
      }

      if (matchCount > 0) {
        results.push({
          file,
          similarity: matchCount / (content.length / 100), // Normalize by content length
          relevantContent: this.extractRelevantContent(content, query)
        });
      }
    }

    return results
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
  }

  private async filterResults(
    results: SearchResult[],
    filters: { categories?: string[]; tags?: string[]; dateRange?: { start?: Date; end?: Date } }
  ): Promise<SearchResult[]> {
    const filtered = [];

    for (const result of results) {
      const content = await this.vault.read(result.file);
      const frontmatter = this.extractFrontmatter(content);
      
      if (this.matchesFilters(frontmatter, filters)) {
        filtered.push(result);
      }
    }

    return filtered;
  }

  private async enrichResults(results: SearchResult[], query: string): Promise<SearchResult[]> {
    return Promise.all(results.map(async result => {
      const content = await this.vault.read(result.file);
      return {
        ...result,
        relevantContent: this.extractRelevantContent(content, query)
      };
    }));
  }

  private cosineSimilarity(vec1: number[], vec2: number[]): number {
    const dotProduct = vec1.reduce((sum, val, i) => sum + val * vec2[i], 0);
    const mag1 = Math.sqrt(vec1.reduce((sum, val) => sum + val * val, 0));
    const mag2 = Math.sqrt(vec2.reduce((sum, val) => sum + val * val, 0));
    return dotProduct / (mag1 * mag2);
  }

  private extractFrontmatter(content: string): any {
    const match = content.match(/^---\n([\s\S]*?)\n---/);
    if (!match) return {};

    try {
      const frontmatter: any = {};
      const lines = match[1].split('\n');
      for (const line of lines) {
        const [key, ...values] = line.split(':');
        if (key && values.length) {
          frontmatter[key.trim()] = values.join(':').trim();
        }
      }
      return frontmatter;
    } catch {
      return {};
    }
  }

  private matchesFilters(
    frontmatter: any,
    filters: { categories?: string[]; tags?: string[]; dateRange?: { start?: Date; end?: Date } }
  ): boolean {
    const { categories, tags, dateRange } = filters;

    if (categories?.length && !categories.includes(frontmatter.category)) {
      return false;
    }

    if (tags?.length) {
      const noteTags = (frontmatter.tags || '').split(',').map((t: string) => t.trim());
      if (!tags.some(tag => noteTags.includes(tag))) {
        return false;
      }
    }

    if (dateRange) {
      const noteDate = new Date(frontmatter.date);
      if (dateRange.start && noteDate < dateRange.start) return false;
      if (dateRange.end && noteDate > dateRange.end) return false;
    }

    return true;
  }

  private extractRelevantContent(content: string, query: string): string {
    const lines = content.split('\n');
    const queryTerms = query.toLowerCase().split(/\s+/);
    let bestMatch = { score: 0, index: 0 };

    for (let i = 0; i < lines.length; i++) {
      const windowText = lines.slice(i, i + 3).join(' ').toLowerCase();
      let score = 0;
      
      for (const term of queryTerms) {
        if (windowText.includes(term)) {
          score += 1;
        }
      }

      if (score > bestMatch.score) {
        bestMatch = { score, index: i };
      }
    }

    const start = Math.max(0, bestMatch.index - 1);
    const end = Math.min(lines.length, bestMatch.index + 4);
    return lines.slice(start, end).join('\n');
  }
}