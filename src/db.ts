import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { Embedding } from './embeddings';

interface AIPluginDB extends DBSchema {
  embeddings: {
    key: string;
    value: Embedding;
    indexes: { 'by-file': string; 'by-chunk': [string, string] };
  };
}

export class DatabaseManager {
  private db: IDBPDatabase<AIPluginDB>;

  async init() {
    this.db = await openDB<AIPluginDB>('ai-plugin-db', 1, {
      upgrade(db) {
        const embeddingsStore = db.createObjectStore('embeddings', { keyPath: 'id' });
        embeddingsStore.createIndex('by-file', 'file');
        embeddingsStore.createIndex('by-chunk', ['file', 'chunk']);
      },
    });
  }

  async storeEmbeddings(embeddings: Embedding[]) {
    const tx = this.db.transaction('embeddings', 'readwrite');
    for (const embedding of embeddings) {
      await tx.store.put(embedding);
    }
    await tx.done;
  }

  async getEmbeddingsForFile(file: string): Promise<Embedding[]> {
    return this.db.getAllFromIndex('embeddings', 'by-file', file);
  }

  async getEmbeddingForChunk(file: string, chunk: string): Promise<Embedding | undefined> {
    return this.db.getFromIndex('embeddings', 'by-chunk', [file, chunk]);
  }

  async getAllEmbeddings(): Promise<Embedding[]> {
    return this.db.getAll('embeddings');
  }

  async deleteEmbeddingsForFile(file: string) {
    const tx = this.db.transaction('embeddings', 'readwrite');
    const index = tx.store.index('by-file');
    let cursor = await index.openCursor(file);

    while (cursor) {
      await cursor.delete();
      cursor = await cursor.continue();
    }

    await tx.done;
  }
}