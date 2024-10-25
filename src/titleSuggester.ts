import { App, TFile } from 'obsidian';
import { ModelManager } from './modelManager';
import { SearchOptions, VaultQuerier } from './vaultQuerier';

export interface TitleSuggestion {
  title: string;
  confidence: number;
  alternates: string[];
  tags: string[];
  category?: string;
}

export class TitleSuggester {
  private app: App;
  private modelManager: ModelManager;
  private vaultQuerier: VaultQuerier;
  private readonly MIN_CONTENT_LENGTH = 50;
  private readonly MAX_TITLE_LENGTH = 100;
  private readonly SIMILARITY_THRESHOLD = 0.8;

  constructor(app: App, modelManager: ModelManager, vaultQuerier: VaultQuerier) {
    this.app = app;
    this.modelManager = modelManager;
    this.vaultQuerier = vaultQuerier;
  }

  async suggestTitle(file: TFile): Promise<TitleSuggestion> {
    const content = await this.app.vault.read(file);
    if (content.length < this.MIN_CONTENT_LENGTH) {
      throw new Error('Content too short for meaningful title suggestion');
    }

    const { frontmatter, mainContent } = this.extractFrontmatter(content);
    const existingTitles = await this.getExistingTitles();
    const similarNotes = await this.findSimilarNotes(file);
    
    const suggestion = await this.generateTitleSuggestion(
      mainContent,
      frontmatter,
      existingTitles,
      similarNotes
    );

    return this.validateAndRefineTitle(suggestion, existingTitles);
  }

  private extractFrontmatter(content: string): { frontmatter: any; mainContent: string } {
    const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!match) {
      return { frontmatter: {}, mainContent: content };
    }

    try {
      const frontmatter = this.parseFrontmatter(match[1]);
      return { frontmatter, mainContent: match[2] };
    } catch (error) {
      console.error('Error parsing frontmatter:', error);
      return { frontmatter: {}, mainContent: content };
    }
  }

  private parseFrontmatter(yaml: string): any {
    const frontmatter: any = {};
    const lines = yaml.split('\n');
    
    for (const line of lines) {
      const [key, ...values] = line.split(':');
      if (key && values.length) {
        const value = values.join(':').trim();
        frontmatter[key.trim()] = value.startsWith('[') ? 
          value.slice(1, -1).split(',').map(v => v.trim()) : 
          value;
      }
    }

    return frontmatter;
  }

  private async getExistingTitles(): Promise<Set<string>> {
    const files = this.app.vault.getMarkdownFiles();
    return new Set(files.map(file => file.basename.toLowerCase()));
  }

  private async findSimilarNotes(file: TFile): Promise<string[]> {
    const searchOptions: SearchOptions = {
      limit: 5 // Replace 'limit' with the actual property name expected by SearchOptions
    };
    const similarNotes = await this.vaultQuerier.queryVault(await this.app.vault.read(file), searchOptions);
    return similarNotes.map(result => result.file.basename);
  }

  private async generateTitleSuggestion(
    content: string,
    frontmatter: any,
    existingTitles: Set<string>,
    similarNotes: string[]
  ): Promise<TitleSuggestion> {
    const context = {
      tags: frontmatter.tags || [],
      category: frontmatter.category,
      similarTitles: similarNotes
    };

    const prompt = `Generate a title suggestion for the following content. Return a JSON object with:
- title: The main title suggestion
- confidence: A score from 0-1 indicating confidence
- alternates: Array of 2-3 alternative titles
- tags: Suggested tags
- category: Optional category

Context:
${JSON.stringify(context)}

Content:
${content.slice(0, 1000)}`;

    const response = await this.modelManager.generateText(prompt);
    return JSON.parse(response);
  }

  private validateAndRefineTitle(
    suggestion: TitleSuggestion,
    existingTitles: Set<string>
  ): TitleSuggestion {
    // Ensure title meets length requirements
    suggestion.title = this.truncateTitle(suggestion.title);
    suggestion.alternates = suggestion.alternates.map(title => this.truncateTitle(title));

    // Check for duplicates
    if (existingTitles.has(suggestion.title.toLowerCase())) {
      const uniqueTitle = this.makeUnique(suggestion.title, existingTitles);
      suggestion.alternates.unshift(suggestion.title);
      suggestion.title = uniqueTitle;
      suggestion.confidence *= 0.9; // Reduce confidence for modified titles
    }

    // Validate and clean tags
    suggestion.tags = this.cleanTags(suggestion.tags);

    return suggestion;
  }

  private truncateTitle(title: string): string {
    if (title.length <= this.MAX_TITLE_LENGTH) return title;
    
    // Try to truncate at a word boundary
    const truncated = title.slice(0, this.MAX_TITLE_LENGTH);
    const lastSpace = truncated.lastIndexOf(' ');
    return lastSpace > 0 ? truncated.slice(0, lastSpace) : truncated;
  }

  private makeUnique(title: string, existingTitles: Set<string>): string {
    let counter = 1;
    let uniqueTitle = title;
    
    while (existingTitles.has(uniqueTitle.toLowerCase())) {
      uniqueTitle = `${title} ${counter}`;
      counter++;
    }
    
    return uniqueTitle;
  }

  private cleanTags(tags: string[]): string[] {
    return tags
      .map(tag => tag.toLowerCase()
        .replace(/[^\w-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, ''))
      .filter(tag => tag.length > 0)
      .filter((tag, index, self) => self.indexOf(tag) === index);
  }
}