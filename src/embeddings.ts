import { TFile, Vault } from 'obsidian';
import { DatabaseManager } from './db';
import { ModelManager } from './modelManager';

export interface Embedding {
  id: string;
  vector: number[];
  file: string;
  chunk: string;
  timestamp: number;
}

export class EmbeddingManager {
  private vault: Vault;
  private modelManager: ModelManager;
  private databaseManager: DatabaseManager;
  private cacheExpiration: number;
  private readonly CHUNK_SIZE = 512;
  private readonly CHUNK_OVERLAP = 128;

  constructor(vault: Vault, modelManager: ModelManager, databaseManager: DatabaseManager, cacheExpiration: number) {
    this.vault = vault;
    this.modelManager = modelManager;
    this.databaseManager = databaseManager;
    this.cacheExpiration = cacheExpiration;
  }

  async generateEmbedding(text: string): Promise<number[]> {
    return this.modelManager.generateEmbedding(text);
  }

  async generateEmbeddingsForFile(file: TFile): Promise<Embedding[]> {
    const content = await this.vault.read(file);
    const chunks = this.chunkContent(content);
    const embeddings: Embedding[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const vector = await this.generateEmbedding(chunks[i]);
      embeddings.push({
        id: `${file.path}-${i}`,
        vector,
        file: file.path,
        chunk: chunks[i],
        timestamp: Date.now(),
      });
    }

    await this.databaseManager.deleteEmbeddingsForFile(file.path);
    await this.databaseManager.storeEmbeddings(embeddings);
    return embeddings;
  }

  async getEmbeddingsForFile(file: TFile): Promise<Embedding[]> {
    const storedEmbeddings = await this.databaseManager.getEmbeddingsForFile(file.path);
    if (storedEmbeddings.length > 0 && this.isEmbeddingValid(storedEmbeddings[0])) {
      return storedEmbeddings;
    }
    return this.generateEmbeddingsForFile(file);
  }

  private chunkContent(content: string): string[] {
    const words = content.split(/\s+/);
    const chunks: string[] = [];
    let currentChunk: string[] = [];
    let currentLength = 0;

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      currentChunk.push(word);
      currentLength += word.length + 1; // +1 for space

      if (currentLength >= this.CHUNK_SIZE) {
        chunks.push(currentChunk.join(' '));
        // Move back by overlap amount
        const overlapWords = currentChunk.slice(-Math.floor(this.CHUNK_OVERLAP / 5));
        currentChunk = overlapWords;
        currentLength = overlapWords.join(' ').length;
      }
    }

    if (currentChunk.length > 0) {
      chunks.push(currentChunk.join(' '));
    }

    return chunks.map(chunk => this.cleanChunk(chunk));
  }

  private cleanChunk(chunk: string): string {
    // Remove markdown syntax
    return chunk
      .replace(/[#*_`~]/g, '')
      .replace(/\[\[([^\]]+)\]\]/g, '$1') // Replace [[wiki links]] with just the text
      .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1') // Replace [links](url) with just the text
      .trim();
  }

  private isEmbeddingValid(embedding: Embedding): boolean {
    return Date.now() - embedding.timestamp < this.cacheExpiration;
  }
}