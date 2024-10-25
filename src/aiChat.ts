import { App, Modal, Setting } from 'obsidian';
import { ModelManager } from './modelManager';

export class AIChat {
  private app: App;
  private modelManager: ModelManager;

  constructor(app: App, modelManager: ModelManager) {
    this.app = app;
    this.modelManager = modelManager;
  }

  openChatWindow() {
    const modal = new AIChatModal(this.app, this.modelManager);
    modal.open();
  }
}

class AIChatModal extends Modal {
  private modelManager: ModelManager;
  private messages: { role: 'user' | 'assistant', content: string }[] = [];
  private inputEl: HTMLTextAreaElement;
  private chatEl: HTMLElement;
  private currentMessageEl: HTMLElement | null = null;

  constructor(app: App, modelManager: ModelManager) {
    super(app);
    this.modelManager = modelManager;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('ai-plugin-modal');

    contentEl.createEl('h2', { text: 'AI Chat' });

    this.chatEl = contentEl.createDiv('ai-plugin-chat');

    this.inputEl = contentEl.createEl('textarea', { cls: 'ai-plugin-input' });

    const buttonContainer = contentEl.createDiv('ai-plugin-button-container');
    const sendButton = buttonContainer.createEl('button', { text: 'Send', cls: 'ai-plugin-button' });
    sendButton.addEventListener('click', () => this.sendMessage());
  }

  async sendMessage() {
    const userMessage = this.inputEl.value.trim();
    if (!userMessage) return;

    this.addMessageToChat('user', userMessage);
    this.inputEl.value = '';

    this.messages.push({ role: 'user', content: userMessage });

    try {
      this.currentMessageEl = this.createMessageElement('assistant', '');
      const response = await this.modelManager.generateText(this.formatPrompt());
      if (this.currentMessageEl) {
        this.currentMessageEl.querySelector('.ai-plugin-chat-content')!.textContent = response;
      }
      this.messages.push({ role: 'assistant', content: response });
    } catch (error) {
      console.error('Error generating response:', error);
      this.addMessageToChat('assistant', 'Sorry, I encountered an error while processing your request.');
    } finally {
      this.currentMessageEl = null;
    }
  }

  private addMessageToChat(role: 'user' | 'assistant', content: string) {
    this.createMessageElement(role, content);
  }

  private createMessageElement(role: 'user' | 'assistant', content: string): HTMLElement {
    const messageEl = this.chatEl.createDiv('ai-plugin-chat-message');
    messageEl.addClass(role);

    const roleEl = messageEl.createDiv('ai-plugin-chat-role');
    roleEl.textContent = role === 'user' ? 'You:' : 'AI:';

    const contentEl = messageEl.createDiv('ai-plugin-chat-content');
    contentEl.textContent = content;

    this.chatEl.scrollTop = this.chatEl.scrollHeight;
    return messageEl;
  }

  private formatPrompt(): string {
    return this.messages.map(msg => `${msg.role}: ${msg.content}`).join('\n');
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}