import axios from 'axios';

export enum ModelProvider {
  Ollama = 'ollama',
  OpenAI = 'openai',
}

export class ModelManager {
  private provider: ModelProvider;
  private model: string;
  private endpoint: string;

  constructor(provider: ModelProvider, model: string, endpoint: string) {
    this.provider = provider;
    this.model = model;
    this.endpoint = endpoint;
  }

  setProvider(provider: ModelProvider) {
    this.provider = provider;
  }

  setModel(model: string) {
    this.model = model;
  }

  setEndpoint(endpoint: string) {
    this.endpoint = endpoint;
  }

  async getAvailableModels(): Promise<string[]> {
    switch (this.provider) {
      case ModelProvider.Ollama:
        return this.getOllamaModels();
      case ModelProvider.OpenAI:
        return ['gpt-3.5-turbo', 'gpt-4'];
      default:
        return [];
    }
  }

  private async getOllamaModels(): Promise<string[]> {
    try {
      const response = await axios.get(`${this.endpoint}/api/tags`);
      if (response.data && Array.isArray(response.data.models)) {
        return response.data.models.map((model: { name: string }) => model.name);
      } else {
        console.error('Unexpected response format from Ollama API:', response.data);
        return [];
      }
    } catch (error) {
      console.error('Failed to fetch Ollama models:', error);
      return [];
    }
  }

  async downloadOllamaModel(modelName: string): Promise<boolean> {
    try {
      await axios.post(`${this.endpoint}/api/pull`, { name: modelName });
      return true;
    } catch (error) {
      console.error(`Failed to download Ollama model ${modelName}:`, error);
      return false;
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    switch (this.provider) {
      case ModelProvider.Ollama:
        return this.generateOllamaEmbedding(text);
      case ModelProvider.OpenAI:
        return this.generateOpenAIEmbedding(text);
      default:
        throw new Error('Unsupported model provider');
    }
  }

  async generateText(prompt: string): Promise<string> {
    switch (this.provider) {
      case ModelProvider.Ollama:
        return this.generateOllamaText(prompt);
      case ModelProvider.OpenAI:
        return this.generateOpenAIText(prompt);
      default:
        throw new Error('Unsupported model provider');
    }
  }

  private async generateOllamaEmbedding(text: string): Promise<number[]> {
    try {
      const response = await axios.post(`${this.endpoint}/api/embeddings`, {
        model: this.model,
        prompt: text,
      });
      return response.data.embedding;
    } catch (error) {
      console.error('Failed to generate Ollama embedding:', error);
      throw error;
    }
  }

  private async generateOpenAIEmbedding(text: string): Promise<number[]> {
    try {
      const response = await axios.post('https://api.openai.com/v1/embeddings', {
        model: 'text-embedding-ada-002',
        input: text,
      }, {
        headers: {
          'Authorization': `Bearer ${this.endpoint}`,
          'Content-Type': 'application/json',
        },
      });
      return response.data.data[0].embedding;
    } catch (error) {
      console.error('Failed to generate OpenAI embedding:', error);
      throw error;
    }
  }

  private async generateOllamaText(prompt: string): Promise<string> {
    try {
      const response = await axios.post(`${this.endpoint}/api/generate`, {
        model: this.model,
        prompt: prompt,
        stream: true,
      }, {
        responseType: 'stream'
      });

      let fullResponse = '';
      for await (const chunk of response.data) {
        const lines = chunk.toString('utf8').split('\n');
        for (const line of lines) {
          if (line.trim() !== '') {
            try {
              const data = JSON.parse(line);
              if (data.response) {
                fullResponse += data.response;
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
    } catch (error) {
      console.error('Failed to generate Ollama text:', error);
      throw error;
    }
  }

  private async generateOpenAIText(prompt: string): Promise<string> {
    try {
      const response = await axios.post('https://api.openai.com/v1/chat/completions', {
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
      }, {
        headers: {
          'Authorization': `Bearer ${this.endpoint}`,
          'Content-Type': 'application/json',
        },
      });
      return response.data.choices[0].message.content.trim();
    } catch (error) {
      console.error('Failed to generate OpenAI text:', error);
      throw error;
    }
  }
}