import { App } from 'obsidian';
import { ModelManager } from './modelManager';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export class AIChat {
  private app: App;
  private modelManager: ModelManager;
  private messages: ChatMessage[] = [];
  private messageListeners: ((messages: ChatMessage[]) => void)[] = [];

  constructor(app: App, modelManager: ModelManager) {
    this.app = app;
    this.modelManager = modelManager;
    this.addInitialGreeting();
  }

  private addInitialGreeting() {
    this.messages = [{
      role: 'assistant',
      content: 'Hello! How can I help you today?'
    }];
  }

  getMessages(): ChatMessage[] {
    return this.messages;
  }

  addMessageListener(callback: (messages: ChatMessage[]) => void) {
    this.messageListeners.push(callback);
  }

  removeMessageListener(callback: (messages: ChatMessage[]) => void) {
    this.messageListeners = this.messageListeners.filter(cb => cb !== callback);
  }

  private notifyListeners() {
    this.messageListeners.forEach(callback => callback(this.messages));
  }

  async sendMessage(content: string): Promise<string> {
    try {
      // Add user message
      this.messages.push({ role: 'user', content });
      this.notifyListeners();

      // Get AI response
      const response = await this.modelManager.generateText(content);
      
      // Add AI response
      this.messages.push({ role: 'assistant', content: response });
      this.notifyListeners();

      return response;
    } catch (error) {
      console.error('Error generating response:', error);
      const errorMessage = 'Sorry, I encountered an error while processing your request.';
      this.messages.push({ role: 'assistant', content: errorMessage });
      this.notifyListeners();
      throw error;
    }
  }

  async appendToNote(content: string, targetFile: any) {
    try {
      if (targetFile) {
        const currentContent = await this.app.vault.read(targetFile);
        const newContent = `${currentContent}\n\n${content}`;
        await this.app.vault.modify(targetFile, newContent);
      }
    } catch (error) {
      console.error('Error appending to note:', error);
      throw error;
    }
  }

  clearMessages() {
    this.messages = [];
    this.addInitialGreeting();
    this.notifyListeners();
  }
}

// import { App, Modal } from 'obsidian';
// import { ModelManager } from './modelManager';

// export class AIChat {
//   private app: App;
//   private modelManager: ModelManager;
//   private messages: { role: 'user' | 'assistant', content: string }[] = [];
//   private onMessageCallback?: (messages: { role: 'user' | 'assistant', content: string }[]) => void;

//   constructor(app: App, modelManager: ModelManager) {
//     this.app = app;
//     this.modelManager = modelManager;
//   }

//   setOnMessageCallback(callback: (messages: { role: 'user' | 'assistant', content: string }[]) => void) {
//     this.onMessageCallback = callback;
//   }

//   getMessages() {
//     return this.messages;
//   }

//   async sendMessage(content: string): Promise<string> {
//     // Add user message
//     this.messages.push({ role: 'user', content });

//     try {
//       // Get AI response
//       const response = await this.modelManager.generateText(content);
      
//       // Add AI response
//       this.messages.push({ role: 'assistant', content: response });

//       // Notify listeners
//       if (this.onMessageCallback) {
//         this.onMessageCallback(this.messages);
//       }

//       return response;
//     } catch (error) {
//       console.error('Error generating response:', error);
//       const errorMessage = 'Sorry, I encountered an error while processing your request.';
//       this.messages.push({ role: 'assistant', content: errorMessage });
      
//       if (this.onMessageCallback) {
//         this.onMessageCallback(this.messages);
//       }

//       throw error;
//     }
//   }

//   // async sendMessage(content: string): Promise<void> {
//   //   // Add user message
//   //   this.messages.push({ role: 'user', content });

//   //   try {
//   //     // Get AI response
//   //     const response = await this.modelManager.generateText(content);
      
//   //     // Add AI response
//   //     this.messages.push({ role: 'assistant', content: response });

//   //     // Notify listeners
//   //     if (this.onMessageCallback) {
//   //       this.onMessageCallback(this.messages);
//   //     }

//   //     return response;
//   //   } catch (error) {
//   //     console.error('Error generating response:', error);
//   //     const errorMessage = 'Sorry, I encountered an error while processing your request.';
//   //     this.messages.push({ role: 'assistant', content: errorMessage });
      
//   //     if (this.onMessageCallback) {
//   //       this.onMessageCallback(this.messages);
//   //     }

//   //     throw error;
//   //   }
//   // }

//   clearMessages() {
//     this.messages = [];
//     if (this.onMessageCallback) {
//       this.onMessageCallback(this.messages);
//     }
//   }

//   openChatWindow() {
//     const modal = new AIChatModal(this.app, this);
//     modal.open();
//   }
// }

// class AIChatModal extends Modal {
//   private aiChat: AIChat;
//   private inputEl: HTMLTextAreaElement;
//   private chatEl: HTMLElement;
//   private currentMessageEl: HTMLElement | null = null;

//   constructor(app: App, aiChat: AIChat) {
//     super(app);
//     this.aiChat = aiChat;
//   }

//   onOpen() {
//     const { contentEl } = this;
//     contentEl.empty();
//     contentEl.addClass('ai-plugin-modal');

//     // Chat header
//     const headerEl = contentEl.createDiv('ai-plugin-chat-header');
//     headerEl.createEl('h2', { text: 'AI Chat' });

//     // Chat container
//     this.chatEl = contentEl.createDiv('ai-plugin-chat');
//     this.chatEl.addClass('ai-plugin-chat-messages');

//     // Input container
//     const inputContainer = contentEl.createDiv('ai-plugin-chat-input-container');
    
//     // Textarea
//     this.inputEl = inputContainer.createEl('textarea', {
//       cls: 'ai-plugin-chat-input',
//       attr: { 
//         placeholder: 'Type your message...',
//         rows: '3'
//       }
//     });

//     // Send button
//     const sendButton = inputContainer.createEl('button', {
//       text: 'Send',
//       cls: 'ai-plugin-chat-send'
//     });
//     sendButton.addEventListener('click', () => this.sendMessage());

//     // Handle Enter key
//     this.inputEl.addEventListener('keydown', (e) => {
//       if (e.key === 'Enter' && !e.shiftKey) {
//         e.preventDefault();
//         this.sendMessage();
//       }
//     });

//     // Set up message listener
//     this.aiChat.setOnMessageCallback((messages) => this.updateChat(messages));

//     // Display existing messages
//     this.updateChat(this.aiChat.getMessages());

//     // Add initial greeting if no messages
//     if (this.aiChat.getMessages().length === 0) {
//       this.addMessageToChat('assistant', 'Hello! How can I help you today?');
//     }
//   }

//   private async sendMessage() {
//     const content = this.inputEl.value.trim();
//     if (!content) return;

//     // Clear input
//     this.inputEl.value = '';

//     try {
//       // Show typing indicator
//       const typingEl = this.addTypingIndicator();

//       // Send message
//       await this.aiChat.sendMessage(content);

//       // Remove typing indicator
//       typingEl.remove();
//     } catch (error) {
//       console.error('Error sending message:', error);
//     }
//   }

//   private updateChat(messages: { role: 'user' | 'assistant', content: string }[]) {
//     this.chatEl.empty();
//     messages.forEach(msg => this.addMessageToChat(msg.role, msg.content));
//   }

//   private addMessageToChat(role: 'user' | 'assistant', content: string) {
//     const messageEl = this.chatEl.createDiv('ai-plugin-chat-message');
//     messageEl.addClass(role);

//     const bubbleEl = messageEl.createDiv('ai-plugin-chat-bubble');
//     bubbleEl.setText(content);

//     this.chatEl.scrollTop = this.chatEl.scrollHeight;
//   }

//   private addTypingIndicator(): HTMLElement {
//     const messageEl = this.chatEl.createDiv('ai-plugin-chat-message assistant');
//     const bubbleEl = messageEl.createDiv('ai-plugin-chat-bubble');
//     bubbleEl.createDiv('ai-plugin-typing-indicator');
//     this.chatEl.scrollTop = this.chatEl.scrollHeight;
//     return messageEl;
//   }

//   onClose() {
//     const { contentEl } = this;
//     contentEl.empty();
//     this.aiChat.setOnMessageCallback(undefined);
//   }
// }

// import { App, Modal, Setting } from 'obsidian';
// import { ModelManager } from './modelManager';

// export class AIChat {
//   private app: App;
//   private modelManager: ModelManager;

//   constructor(app: App, modelManager: ModelManager) {
//     this.app = app;
//     this.modelManager = modelManager;
//   }

//   openChatWindow() {
//     const modal = new AIChatModal(this.app, this.modelManager);
//     modal.open();
//   }
// }

// class AIChatModal extends Modal {
//   private modelManager: ModelManager;
//   private messages: { role: 'user' | 'assistant', content: string }[] = [];
//   private inputEl: HTMLTextAreaElement;
//   private chatEl: HTMLElement;
//   private currentMessageEl: HTMLElement | null = null;

//   constructor(app: App, modelManager: ModelManager) {
//     super(app);
//     this.modelManager = modelManager;
//   }

//   onOpen() {
//     const { contentEl } = this;
//     contentEl.empty();
//     contentEl.addClass('ai-plugin-modal');

//     contentEl.createEl('h2', { text: 'AI Chat' });

//     this.chatEl = contentEl.createDiv('ai-plugin-chat');

//     this.inputEl = contentEl.createEl('textarea', { cls: 'ai-plugin-input' });

//     const buttonContainer = contentEl.createDiv('ai-plugin-button-container');
//     const sendButton = buttonContainer.createEl('button', { text: 'Send', cls: 'ai-plugin-button' });
//     sendButton.addEventListener('click', () => this.sendMessage());
//   }

//   async sendMessage() {
//     const userMessage = this.inputEl.value.trim();
//     if (!userMessage) return;

//     this.addMessageToChat('user', userMessage);
//     this.inputEl.value = '';

//     this.messages.push({ role: 'user', content: userMessage });

//     try {
//       this.currentMessageEl = this.createMessageElement('assistant', '');
//       const response = await this.modelManager.generateText(this.formatPrompt());
//       if (this.currentMessageEl) {
//         this.currentMessageEl.querySelector('.ai-plugin-chat-content')!.textContent = response;
//       }
//       this.messages.push({ role: 'assistant', content: response });
//     } catch (error) {
//       console.error('Error generating response:', error);
//       this.addMessageToChat('assistant', 'Sorry, I encountered an error while processing your request.');
//     } finally {
//       this.currentMessageEl = null;
//     }
//   }

//   private addMessageToChat(role: 'user' | 'assistant', content: string) {
//     this.createMessageElement(role, content);
//   }

//   private createMessageElement(role: 'user' | 'assistant', content: string): HTMLElement {
//     const messageEl = this.chatEl.createDiv('ai-plugin-chat-message');
//     messageEl.addClass(role);

//     const roleEl = messageEl.createDiv('ai-plugin-chat-role');
//     roleEl.textContent = role === 'user' ? 'You:' : 'AI:';

//     const contentEl = messageEl.createDiv('ai-plugin-chat-content');
//     contentEl.textContent = content;

//     this.chatEl.scrollTop = this.chatEl.scrollHeight;
//     return messageEl;
//   }

//   private formatPrompt(): string {
//     return this.messages.map(msg => `${msg.role}: ${msg.content}`).join('\n');
//   }

//   onClose() {
//     const { contentEl } = this;
//     contentEl.empty();
//   }
// }