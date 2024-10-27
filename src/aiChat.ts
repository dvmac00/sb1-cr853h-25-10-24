import { App, TFile } from 'obsidian';
import { ModelManager } from './modelManager';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  isResponse?: boolean;
}

export interface ChatContext {
  file: TFile;
  content: string;
  selection?: string;
}

export class AIChat {
  private app: App;
  private modelManager: ModelManager;
  private messages: ChatMessage[] = [];
  private messageListeners: ((messages: ChatMessage[]) => void)[] = [];
  private context: ChatContext | null = null;
  private contextListeners: ((context: ChatContext | null) => void)[] = [];
  private typingListeners: ((isTyping: boolean) => void)[] = [];

  constructor(app: App, modelManager: ModelManager) {
    this.app = app;
    this.modelManager = modelManager;
    this.addInitialGreeting();
  }

  private addInitialGreeting() {
    this.messages = [{
      role: 'assistant',
      content: 'Hello! How can I help you today?',
      isResponse: false
    }];
  }

  getMessages(): ChatMessage[] {
    return this.messages;
  }

  getContext(): ChatContext | null {
    return this.context;
  }

  addMessageListener(callback: (messages: ChatMessage[]) => void) {
    this.messageListeners.push(callback);
  }

  removeMessageListener(callback: (messages: ChatMessage[]) => void) {
    this.messageListeners = this.messageListeners.filter(cb => cb !== callback);
  }

  addContextListener(callback: (context: ChatContext | null) => void) {
    this.contextListeners.push(callback);
  }

  removeContextListener(callback: (context: ChatContext | null) => void) {
    this.contextListeners = this.contextListeners.filter(cb => cb !== callback);
  }

  addTypingListener(callback: (isTyping: boolean) => void) {
    this.typingListeners.push(callback);
  }

  removeTypingListener(callback: (isTyping: boolean) => void) {
    this.typingListeners = this.typingListeners.filter(cb => cb !== callback);
  }

  private notifyListeners() {
    this.messageListeners.forEach(callback => callback(this.messages));
    this.contextListeners.forEach(callback => callback(this.context));
  }

  private notifyTypingListeners(isTyping: boolean) {
    this.typingListeners.forEach(callback => callback(isTyping));
  }

  async setContext(file: TFile, selection?: string) {
    try {
      const content = await this.app.vault.read(file);
      this.context = {
        file,
        content: selection || content,
        selection
      };
      
      this.messages.push({
        role: 'assistant',
        content: `I'm now using "${file.basename}" as context for our conversation.` + (selection ? " I'll focus on the selected portion." : ""),
        isResponse: false
      });
      
      this.notifyListeners();
    } catch (error) {
      console.error('Error setting context:', error);
      throw error;
    }
  }

  clearContext() {
    this.context = null;
    this.messages.push({
      role: 'assistant',
      content: 'Context cleared. How else can I help you?',
      isResponse: false
    });
    this.notifyListeners();
  }

  private formatPromptWithContext(userInput: string): string {
    if (!this.context) {
      return `${userInput}\n\nPlease format your response in markdown.`;
    }

    return `Context from note "${this.context.file.basename}":
\`\`\`
${this.context.content}
\`\`\`

User query: ${userInput}

Please consider the above context when responding and format your response in markdown.`;
  }

  async sendMessage(content: string): Promise<string> {
    try {
      // Add user message
      this.messages.push({ role: 'user', content });
      this.notifyListeners();

      // Show typing indicator
      this.notifyTypingListeners(true);

      // Generate response using context if available
      const prompt = this.formatPromptWithContext(content);
      const response = await this.modelManager.generateText(prompt);
      
      // Hide typing indicator
      this.notifyTypingListeners(false);

      // Add AI response
      this.messages.push({ 
        role: 'assistant', 
        content: response,
        isResponse: true
      });
      this.notifyListeners();

      return response;
    } catch (error) {
      console.error('Error generating response:', error);
      this.notifyTypingListeners(false);
      const errorMessage = 'Sorry, I encountered an error while processing your request.';
      this.messages.push({ 
        role: 'assistant', 
        content: errorMessage,
        isResponse: true
      });
      this.notifyListeners();
      throw error;
    }
  }

  async appendToNote(content: string, targetFile: TFile) {
    try {
      const currentContent = await this.app.vault.read(targetFile);
      const newContent = `${currentContent}\n\n${content}`;
      await this.app.vault.modify(targetFile, newContent);
    } catch (error) {
      console.error('Error appending to note:', error);
      throw error;
    }
  }

  clearMessages() {
    this.messages = [];
    this.context = null;
    this.addInitialGreeting();
    this.notifyListeners();
  }
}