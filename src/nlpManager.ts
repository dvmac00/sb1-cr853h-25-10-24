import { ModelManager } from './modelManager';

interface NLPTask {
  type: 'sentiment' | 'summary' | 'keywords' | 'entities' | 'topics' | 'custom';
  options?: Record<string, any>;
}

interface NLPResult {
  task: string;
  result: any;
  confidence?: number;
}

export class NLPManager {
  private modelManager: ModelManager;
  private readonly MAX_CHUNK_SIZE = 1000;

  constructor(modelManager: ModelManager) {
    this.modelManager = modelManager;
  }

  async performTask(task: NLPTask, text: string): Promise<NLPResult> {
    const chunks = this.chunkText(text);
    const results = await Promise.all(chunks.map(chunk => this.processChunk(task, chunk)));
    return this.aggregateResults(task, results);
  }

  private chunkText(text: string): string[] {
    if (text.length <= this.MAX_CHUNK_SIZE) return [text];

    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    const chunks: string[] = [];
    let currentChunk = '';

    for (const sentence of sentences) {
      if (currentChunk.length + sentence.length <= this.MAX_CHUNK_SIZE) {
        currentChunk += sentence;
      } else {
        if (currentChunk) chunks.push(currentChunk);
        currentChunk = sentence;
      }
    }

    if (currentChunk) chunks.push(currentChunk);
    return chunks;
  }

  private async processChunk(task: NLPTask, text: string): Promise<any> {
    const prompt = this.createPrompt(task, text);
    const response = await this.modelManager.generateText(prompt);
    
    try {
      return JSON.parse(response);
    } catch {
      return { error: 'Failed to parse response', raw: response };
    }
  }

  private createPrompt(task: NLPTask, text: string): string {
    const prompts: Record<string, string> = {
      sentiment: `Analyze the sentiment of the following text. Return a JSON object with "sentiment" (positive/negative/neutral), "score" (0-1), and "keywords" (array of influential words):\n\n${text}`,
      summary: `Summarize the following text in a concise way. Return a JSON object with "summary" (string) and "keyPoints" (array):\n\n${text}`,
      keywords: `Extract key phrases and topics from the following text. Return a JSON object with "keywords" (array) and "relevance" (array of scores 0-1):\n\n${text}`,
      entities: `Extract named entities from the following text. Return a JSON object with "entities" (array of objects with "text", "type", and "confidence"):\n\n${text}`,
      topics: `Identify main topics and themes in the following text. Return a JSON object with "topics" (array) and "hierarchy" (object showing topic relationships):\n\n${text}`,
    };

    if (task.type === 'custom' && task.options?.prompt) {
      return task.options.prompt.replace('{text}', text);
    }

    return prompts[task.type] || prompts.keywords;
  }

  private aggregateResults(task: NLPTask, results: any[]): NLPResult {
    switch (task.type) {
      case 'sentiment':
        return this.aggregateSentiment(results);
      case 'summary':
        return this.aggregateSummary(results);
      case 'keywords':
        return this.aggregateKeywords(results);
      case 'entities':
        return this.aggregateEntities(results);
      case 'topics':
        return this.aggregateTopics(results);
      default:
        return {
          task: task.type,
          result: results[0]
        };
    }
  }

  private aggregateSentiment(results: any[]): NLPResult {
    const scores = results.map(r => r.score);
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    const keywords = new Set(results.flatMap(r => r.keywords));

    return {
      task: 'sentiment',
      result: {
        sentiment: avgScore > 0.6 ? 'positive' : avgScore < 0.4 ? 'negative' : 'neutral',
        score: avgScore,
        keywords: Array.from(keywords)
      },
      confidence: Math.min(...results.map(r => r.confidence || 1))
    };
  }

  private aggregateSummary(results: any[]): NLPResult {
    const keyPoints = new Set(results.flatMap(r => r.keyPoints));
    
    return {
      task: 'summary',
      result: {
        summary: results[0].summary,
        keyPoints: Array.from(keyPoints)
      }
    };
  }

  private aggregateKeywords(results: any[]): NLPResult {
    const keywordMap = new Map<string, number>();
    
    results.forEach(r => {
      r.keywords.forEach((kw: string, i: number) => {
        const score = r.relevance[i] || 1;
        keywordMap.set(kw, (keywordMap.get(kw) || 0) + score);
      });
    });

    const sortedKeywords = Array.from(keywordMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    return {
      task: 'keywords',
      result: {
        keywords: sortedKeywords.map(([kw]) => kw),
        relevance: sortedKeywords.map(([, score]) => score / results.length)
      }
    };
  }

  private aggregateEntities(results: any[]): NLPResult {
    const entityMap = new Map<string, { type: string, confidence: number, count: number }>();
    
    results.forEach(r => {
      r.entities.forEach((entity: any) => {
        const key = `${entity.text}|${entity.type}`;
        const existing = entityMap.get(key);
        if (existing) {
          existing.confidence += entity.confidence;
          existing.count += 1;
        } else {
          entityMap.set(key, { 
            type: entity.type, 
            confidence: entity.confidence,
            count: 1
          });
        }
      });
    });

    const entities = Array.from(entityMap.entries()).map(([key, value]) => ({
      text: key.split('|')[0],
      type: value.type,
      confidence: value.confidence / value.count
    }));

    return {
      task: 'entities',
      result: { entities }
    };
  }

  private aggregateTopics(results: any[]): NLPResult {
    const topics = new Set(results.flatMap(r => r.topics));
    const hierarchy = results[0].hierarchy;

    return {
      task: 'topics',
      result: {
        topics: Array.from(topics),
        hierarchy
      }
    };
  }
}