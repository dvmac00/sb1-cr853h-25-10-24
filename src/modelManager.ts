import axios, { AxiosInstance } from 'axios';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export enum ModelProvider {
  Ollama = 'ollama',
  OpenAI = 'openai',
}

export interface ModelConfig {
  provider: ModelProvider;
  model?: string;
  endpoint: string;
  apiKey?: string;
  modelPreferences?: string[];
}

interface OllamaHealth {
  isRunning: boolean;
  endpoint: string;
}

export class ModelManager {
  static OLLAMA_PREFERRED_MODELS = [];
  private config: ModelConfig;
  private httpClient: AxiosInstance;
  private static DEFAULT_OLLAMA_ENDPOINT = 'http://localhost:11434';
  private static DEFAULT_MODEL_PREFERENCES = ['mistral', 'llama2', 'neural-chat'];

  constructor(config?: Partial<ModelConfig>) {
    this.config = {
      provider: ModelProvider.Ollama,
      endpoint: ModelManager.DEFAULT_OLLAMA_ENDPOINT,
      modelPreferences: ModelManager.DEFAULT_MODEL_PREFERENCES,
      ...config
    };
    
    this.httpClient = axios.create({
      timeout: 30000,
      headers: this.getHeaders(),
    });
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.config.provider === ModelProvider.OpenAI && this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }

    return headers;
  }

  async initialize(): Promise<void> {
    if (this.config.provider === ModelProvider.Ollama) {
      const health = await this.checkOllamaHealth();
      
      if (!health.isRunning) {
        await this.startOllamaService();
        // Wait for Ollama to start and validate it's running
        await this.waitForOllamaReady();
      }

      // Update endpoint if different from default
      if (health.endpoint !== this.config.endpoint) {
        this.config.endpoint = health.endpoint;
      }

      // Ensure we have at least one preferred model available
      await this.ensureModelAvailable();
    }
  }

  private async checkOllamaHealth(): Promise<OllamaHealth> {
    try {
      await this.httpClient.get(`${this.config.endpoint}/api/tags`);
      return { isRunning: true, endpoint: this.config.endpoint };
    } catch (error) {
      return { isRunning: false, endpoint: this.config.endpoint };
    }
  }

  private async startOllamaService(): Promise<void> {
    try {
      await execAsync('ollama serve');
    } catch (error) {
      throw new Error('Failed to start Ollama service. Please ensure Ollama is installed.');
    }
  }

  private async waitForOllamaReady(maxAttempts = 10, interval = 1000): Promise<void> {
    for (let i = 0; i < maxAttempts; i++) {
      const health = await this.checkOllamaHealth();
      if (health.isRunning) return;
      await new Promise(resolve => setTimeout(resolve, interval));
    }
    throw new Error('Ollama service failed to start in time');
  }

  private async ensureModelAvailable(): Promise<void> {
    try {
      const availableModels = await this.getAvailableModels();
      
      // Check if current model is available
      if (this.config.model && availableModels.includes(this.config.model)) {
        return;
      }
  
      // Try to find and download a preferred model
      for (const model of ModelManager.OLLAMA_PREFERRED_MODELS) {
        if (availableModels.includes(model)) {
          this.config.model = model;
          return;
        }
        
        const downloaded = await this.downloadOllamaModel(model);
        if (downloaded) {
          this.config.model = model;
          return;
        }
      }
  
      // If no models are available or downloadable, set a default model or handle the error
      console.error('No suitable model available and failed to download preferred models');
      // Set a default model or take other appropriate action
      // this.config.model = 'default-model'; // Example: set a default model
    } catch (error) {
      console.error('Error ensuring model availability:', error);
      // Handle the error without throwing, to prevent plugin failure
      // this.config.model = 'default-model'; // Example: set a default model
    }
  }

  // private async ensureModelAvailable(): Promise<void> {
  //   const availableModels = await this.getAvailableModels();
    
  //   // Check if current model is available
  //   if (this.config.model && availableModels.includes(this.config.model)) {
  //     return;
  //   }

  //   // Try to find and download a preferred model
  //   for (const model of ModelManager.OLLAMA_PREFERRED_MODELS) {
  //     if (availableModels.includes(model)) {
  //       this.config.model = model;
  //       return;
  //     }
      
  //     const downloaded = await this.downloadOllamaModel(model);
  //     if (downloaded) {
  //       this.config.model = model;
  //       return;
  //     }
  //   }

  //   throw new Error('No suitable model available and failed to download preferred models');
  // }

  async getAvailableModels(): Promise<string[]> {
    try {
      switch (this.config.provider) {
        case ModelProvider.Ollama:
          const response = await this.httpClient.get(`${this.config.endpoint}/api/tags`);
          return response.data.models?.map((model: { name: string }) => model.name) || [];
          
        case ModelProvider.OpenAI:
          return ['gpt-3.5-turbo', 'gpt-4'];
          
        default:
          return [];
      }
    } catch (error) {
      console.error('Failed to fetch available models:', error);
      return [];
    }
  }

  async downloadOllamaModel(modelName: string): Promise<boolean> {
    try {
      await this.httpClient.post(`${this.config.endpoint}/api/pull`, {
        name: modelName,
      });
      return true;
    } catch (error) {
      console.error(`Failed to download model ${modelName}:`, error);
      return false;
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    try {
      switch (this.config.provider) {
        case ModelProvider.Ollama:
          const ollamaResponse = await this.httpClient.post(
            `${this.config.endpoint}/api/embeddings`,
            { model: this.config.model, prompt: text }
          );
          return ollamaResponse.data.embedding;

        case ModelProvider.OpenAI:
          const openAIResponse = await this.httpClient.post(
            'https://api.openai.com/v1/embeddings',
            { model: 'text-embedding-ada-002', input: text }
          );
          return openAIResponse.data.data[0].embedding;

        default:
          throw new Error('Unsupported model provider');
      }
    } catch (error) {
      console.error('Failed to generate embedding:', error);
      throw error;
    }
  }

  async generateText(prompt: string, options: {
    temperature?: number;
    maxTokens?: number;
    stream?: boolean;
    onProgress?: (text: string) => void;
  } = {}): Promise<string> {
    try {
      switch (this.config.provider) {
        case ModelProvider.Ollama:
          return await this.generateOllamaText(prompt, options);
        case ModelProvider.OpenAI:
          return await this.generateOpenAIText(prompt, options);
        default:
          throw new Error('Unsupported model provider');
      }
    } catch (error) {
      console.error('Failed to generate text:', error);
      throw error;
    }
  }

  private async generateOllamaText(prompt: string, options: {
    temperature?: number;
    maxTokens?: number;
    stream?: boolean;
    onProgress?: (text: string) => void;
  }): Promise<string> {
    const { temperature = 0.7, maxTokens, stream = false, onProgress } = options;

    const response = await this.httpClient.post(
      `${this.config.endpoint}/api/generate`,
      {
        model: this.config.model,
        prompt,
        stream,
        options: {
          temperature,
          num_predict: maxTokens,
        },
      },
      { responseType: stream ? 'stream' : 'json' }
    );

    if (!stream) {
      return response.data.response;
    }

    let fullResponse = '';
    for await (const chunk of response.data) {
      const lines = chunk.toString('utf8').split('\n');
      for (const line of lines) {
        if (line.trim()) {
          try {
            const data = JSON.parse(line);
            if (data.response) {
              fullResponse += data.response;
              onProgress?.(fullResponse);
            }
            if (data.done) {
              return fullResponse.trim();
            }
          } catch (err) {
            console.error('Error parsing JSON:', err);
          }
        }
      }
    }
    return fullResponse.trim();
  }

  private async generateOpenAIText(prompt: string, options: {
    temperature?: number;
    maxTokens?: number;
    stream?: boolean;
    onProgress?: (text: string) => void;
  }): Promise<string> {
    const { temperature = 0.7, maxTokens, stream = false, onProgress } = options;

    const response = await this.httpClient.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: this.config.model,
        messages: [{ role: 'user', content: prompt }],
        temperature,
        max_tokens: maxTokens,
        stream,
      },
      { responseType: stream ? 'stream' : 'json' }
    );

    if (!stream) {
      return response.data.choices[0].message.content.trim();
    }

    let fullResponse = '';
    for await (const chunk of response.data) {
      const line = chunk.toString().trim();
      if (line.startsWith('data: ')) {
        try {
          const data = JSON.parse(line.slice(6));
          if (data.choices[0]?.delta?.content) {
            fullResponse += data.choices[0].delta.content;
            onProgress?.(fullResponse);
          }
        } catch (err) {
          console.error('Error parsing JSON:', err);
        }
      }
    }
    return fullResponse.trim();
  }
}



// import axios from 'axios';

// export enum ModelProvider {
//   Ollama = 'ollama',
//   OpenAI = 'openai',
// }

// export class ModelManager {
//   private provider: ModelProvider;
//   private model: string;
//   private endpoint: string;

//   constructor(provider: ModelProvider, model: string, endpoint: string) {
//     this.provider = provider;
//     this.model = model;
//     this.endpoint = endpoint;
//   }

//   setProvider(provider: ModelProvider) {
//     this.provider = provider;
//   }

//   setModel(model: string) {
//     this.model = model;
//   }

//   setEndpoint(endpoint: string) {
//     this.endpoint = endpoint;
//   }

//   async getAvailableModels(): Promise<string[]> {
//     switch (this.provider) {
//       case ModelProvider.Ollama:
//         return this.getOllamaModels();
//       case ModelProvider.OpenAI:
//         return ['gpt-3.5-turbo', 'gpt-4'];
//       default:
//         return [];
//     }
//   }

//   private async getOllamaModels(): Promise<string[]> {
//     try {
//       const response = await axios.get(`${this.endpoint}/api/tags`);
//       if (response.data && Array.isArray(response.data.models)) {
//         return response.data.models.map((model: { name: string }) => model.name);
//       } else {
//         console.error('Unexpected response format from Ollama API:', response.data);
//         return [];
//       }
//     } catch (error) {
//       console.error('Failed to fetch Ollama models:', error);
//       return [];
//     }
//   }

//   async downloadOllamaModel(modelName: string): Promise<boolean> {
//     try {
//       await axios.post(`${this.endpoint}/api/pull`, { name: modelName });
//       return true;
//     } catch (error) {
//       console.error(`Failed to download Ollama model ${modelName}:`, error);
//       return false;
//     }
//   }

//   async generateEmbedding(text: string): Promise<number[]> {
//     switch (this.provider) {
//       case ModelProvider.Ollama:
//         return this.generateOllamaEmbedding(text);
//       case ModelProvider.OpenAI:
//         return this.generateOpenAIEmbedding(text);
//       default:
//         throw new Error('Unsupported model provider');
//     }
//   }

//   async generateText(prompt: string): Promise<string> {
//     switch (this.provider) {
//       case ModelProvider.Ollama:
//         return this.generateOllamaText(prompt);
//       case ModelProvider.OpenAI:
//         return this.generateOpenAIText(prompt);
//       default:
//         throw new Error('Unsupported model provider');
//     }
//   }

//   private async generateOllamaEmbedding(text: string): Promise<number[]> {
//     try {
//       const response = await axios.post(`${this.endpoint}/api/embeddings`, {
//         model: this.model,
//         prompt: text,
//       });
//       return response.data.embedding;
//     } catch (error) {
//       console.error('Failed to generate Ollama embedding:', error);
//       throw error;
//     }
//   }

//   private async generateOpenAIEmbedding(text: string): Promise<number[]> {
//     try {
//       const response = await axios.post('https://api.openai.com/v1/embeddings', {
//         model: 'text-embedding-ada-002',
//         input: text,
//       }, {
//         headers: {
//           'Authorization': `Bearer ${this.endpoint}`,
//           'Content-Type': 'application/json',
//         },
//       });
//       return response.data.data[0].embedding;
//     } catch (error) {
//       console.error('Failed to generate OpenAI embedding:', error);
//       throw error;
//     }
//   }

//   private async generateOllamaText(prompt: string): Promise<string> {
//     try {
//       const response = await axios.post(`${this.endpoint}/api/generate`, {
//         model: this.model,
//         prompt: prompt,
//         stream: true,
//       }, {
//         responseType: 'stream'
//       });

//       let fullResponse = '';
//       for await (const chunk of response.data) {
//         const lines = chunk.toString('utf8').split('\n');
//         for (const line of lines) {
//           if (line.trim() !== '') {
//             try {
//               const data = JSON.parse(line);
//               if (data.response) {
//                 fullResponse += data.response;
//               }
//               if (data.done) {
//                 return fullResponse.trim();
//               }
//             } catch (err) {
//               console.error('Error parsing JSON:', err);
//             }
//           }
//         }
//       }
//       return fullResponse.trim();
//     } catch (error) {
//       console.error('Failed to generate Ollama text:', error);
//       throw error;
//     }
//   }

//   private async generateOpenAIText(prompt: string): Promise<string> {
//     try {
//       const response = await axios.post('https://api.openai.com/v1/chat/completions', {
//         model: this.model,
//         messages: [{ role: 'user', content: prompt }],
//       }, {
//         headers: {
//           'Authorization': `Bearer ${this.endpoint}`,
//           'Content-Type': 'application/json',
//         },
//       });
//       return response.data.choices[0].message.content.trim();
//     } catch (error) {
//       console.error('Failed to generate OpenAI text:', error);
//       throw error;
//     }
//   }
// }