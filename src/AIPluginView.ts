import { App, Notice, Modal, TextComponent, TFile, View, ItemView, Menu, WorkspaceLeaf } from "obsidian";
import { TitleSuggestion } from "./titleSuggester";
import { ChatMessage } from "./aiChat";

interface AtomicNote {
  title: string;
  content: string;
}

interface SearchResult {
  file: {
    basename: string;
  };
  similarity: number;
  relevantContent?: string;
}

interface Concepts {
  keywords: string[];
  relevance: number[];
}

export const AI_PLUGIN_VIEW_TYPE = "ai-plugin-view";



export class AIPluginView extends ItemView {
  // Core properties
  private plugin: any; // Your plugin instance
  private activeTab: 'organize' | 'analyze' | 'enhance' | 'chat' | 'inbox';
  private chatHistory: HTMLElement;
  private chatInput: HTMLTextAreaElement;
  private chatEl: HTMLElement;
  private inputEl: HTMLTextAreaElement;
  private appendTarget: 'current' | 'specific' = 'current';
  private selectedInboxPath: string = '';

  // UI state
  private loading: boolean = false;
  private error: string | null = null;
  private lastUpdate: number = Date.now();

  private indexingStatus: HTMLElement;
  private selectedNote: TFile | null = null;
  private isIndexing: boolean = false;

  constructor(leaf: WorkspaceLeaf, plugin: any) {
    super(leaf);
    this.plugin = plugin;
    this.activeTab = 'organize';
  }

  // Required View interface implementations
  getViewType(): string {
    return AI_PLUGIN_VIEW_TYPE;
  }

  getDisplayText(): string {
    return "AI Assistant";
  }

  getIcon(): string {
    return "brain"; // Or whatever icon you want to use
  }

  async onOpen(): Promise<void> {
    await this.initializeView();
    await this.startInitialIndexing();
    this.plugin.aiChat.addMessageListener(this.updateChatMessages.bind(this));


  }

  async onClose(): Promise<void> {
    // Cleanup code here
    this.containerEl.empty();
    this.plugin.aiChat.removeMessageListener(this.updateChatMessages.bind(this));

  }

  // inserting here
  private createNoteSelector(container: HTMLElement): void {
    const selectorContainer = container.createDiv('ai-plugin-note-selector-container');
    
    const activeNote = this.app.workspace.getActiveFile();
    const noteName = activeNote ? activeNote.basename : 'Select a note';
    
    const selectorButton = selectorContainer.createEl('button', {
      cls: 'ai-plugin-button ai-plugin-note-button',
      text: noteName
    });

    const icon = selectorButton.createSpan('ai-plugin-button-icon');
    icon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon lucide-file-text"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><line x1="10" y1="9" x2="8" y2="9"></line></svg>`;

    selectorButton.addEventListener('click', (event) => {
      const menu = new Menu();
      
      // Add option for current active file
      const activeFile = this.app.workspace.getActiveFile();
      if (activeFile) {
        menu.addItem((item) => {
          item
            .setTitle(activeFile.basename)
            .setIcon('file-text')
            .onClick(() => this.selectNote(activeFile));
        });
      }

      // Add recent files
      const recentFiles = this.app.workspace.getLastOpenFiles()
        .slice(0, 5)
        .map(path => this.app.vault.getAbstractFileByPath(path))
        .filter((file): file is TFile => file instanceof TFile);

      if (recentFiles.length > 0) {
        menu.addSeparator();
        recentFiles.forEach(file => {
          menu.addItem((item) => {
            item
              .setTitle(file.basename)
              .setIcon('clock')
              .onClick(() => this.selectNote(file));
          });
        });
      }

      // Add option to browse all files
      menu.addSeparator();
      menu.addItem((item) => {
        item
          .setTitle('Browse all notes...')
          .setIcon('search')
          .onClick(() => this.showFileBrowser());
      });

      menu.showAtMouseEvent(event);
    });
  }

  private async selectNote(file: TFile): Promise<void> {
    this.selectedNote = file;
    const leaf = this.app.workspace.getLeaf();
    await leaf.openFile(file);
    this.updateNoteSelector();
    await this.ensureNoteIndexed(file);
  }

  private updateNoteSelector(): void {
    const selectorButton = this.containerEl.querySelector('.ai-plugin-note-button');
    if (selectorButton && this.selectedNote) {
      selectorButton.textContent = this.selectedNote.basename;
    }
  }

  private async showFileBrowser(): Promise<void> {
    const modal = new FileBrowserModal(this.app, (file) => this.selectNote(file));
    modal.open();
  }

  private async startInitialIndexing(): Promise<void> {
    const activeFile = this.app.workspace.getActiveFile();
    if (activeFile) {
      await this.ensureNoteIndexed(activeFile);
    }
  }

  private async ensureNoteIndexed(file: TFile): Promise<void> {
    if (this.isIndexing) return;

    this.isIndexing = true;
    this.updateIndexingStatus('Indexing...');

    try {
      await this.plugin.embeddingManager.getEmbeddingsForFile(file);
      this.updateIndexingStatus('Indexed');
    } catch (error) {
      this.updateIndexingStatus('Indexing failed');
      new Notice('Failed to index note: ' + error.message);
    } finally {
      this.isIndexing = false;
    }
  }

  private updateIndexingStatus(status: string): void {
    if (this.indexingStatus) {
      this.indexingStatus.empty();
      
      const icon = this.indexingStatus.createSpan('ai-plugin-status-icon');
      icon.innerHTML = this.isIndexing ? 
        `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon lucide-loader"><line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line><line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line></svg>` :
        `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon lucide-check-circle"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`;
      
      const text = this.indexingStatus.createSpan('ai-plugin-status-text');
      text.textContent = status;
    }
  }

  // Custom initialization
  private async initializeView(): Promise<void> {
    const container = this.containerEl.createDiv('ai-plugin-container');

    // Status bar for indexing
    this.indexingStatus = container.createDiv('ai-plugin-status-bar');
    this.updateIndexingStatus('Ready');

    // Note selector
    const noteSelector = container.createDiv('ai-plugin-note-selector');
    this.createNoteSelector(noteSelector);

    // Navigation tabs
    const navContainer = container.createDiv('ai-plugin-nav');
    this.createNavigationTabs(navContainer);

    // Main content area
    const contentContainer = container.createDiv('ai-plugin-content');
    await this.drawActiveTab(contentContainer);

    // Initialize event listeners
    this.registerDomEvents();
  }

  private createNavigationTabs(navContainer: HTMLElement): void {
    const tabs: Array<{id: typeof this.activeTab, icon: string, label: string}> = [
      { id: 'organize', icon: 'folder', label: 'Organize' },
      { id: 'analyze', icon: 'search', label: 'Analyze' },
      { id: 'enhance', icon: 'edit', label: 'Enhance' },
      { id: 'chat', icon: 'message-circle', label: 'Chat' },
      { id: 'inbox', icon: 'inbox', label: 'Inbox' }
    ];

    tabs.forEach(tab => {
      const tabEl = navContainer.createDiv(`ai-plugin-tab ${this.activeTab === tab.id ? 'active' : ''}`);
      tabEl.setAttribute('data-tab', tab.id);
      
      const icon = tabEl.createSpan('ai-plugin-tab-icon');
      icon.addClass(tab.icon);
      
      tabEl.createSpan('ai-plugin-tab-label', (el) => {
        el.textContent = tab.label;
      });

      tabEl.addEventListener('click', () => this.switchTab(tab.id));
    });
  }

  private async switchTab(tabId: typeof this.activeTab): Promise<void> {
    this.activeTab = tabId;
    
    // Update tab UI
    this.containerEl.findAll('.ai-plugin-tab').forEach(tab => {
      tab.classList.toggle('active', tab.getAttribute('data-tab') === tabId);
    });

    // Redraw content
    const contentContainer = this.containerEl.querySelector('.ai-plugin-content');
    if (contentContainer) {
      await this.drawActiveTab(contentContainer as HTMLElement);
    }
  }

  private registerDomEvents(): void {
    // Global event listeners
    this.registerEvent(
      this.app.workspace.on('file-open', () => {
        this.updateViewForCurrentFile();
      })
    );

    this.registerEvent(
      this.app.vault.on('modify', () => {
        this.updateViewForCurrentFile();
      })
    );
  }

  private async updateViewForCurrentFile(): Promise<void> {
    const file = this.app.workspace.getActiveFile();
    if (!file) return;

    // Update relevant UI elements based on current file
    if (this.activeTab === 'analyze' || this.activeTab === 'enhance') {
      const contentContainer = this.containerEl.querySelector('.ai-plugin-content');
      if (contentContainer) {
        await this.drawActiveTab(contentContainer as HTMLElement);
      }
    }
  }

  // Add loading state management
  protected setLoading(loading: boolean): void {
    this.loading = loading;
    const container = this.containerEl.querySelector('.ai-plugin-content');
    if (container) {
      container.toggleClass('loading', loading);
    }
  }

  // Error handling
  protected setError(error: string | null): void {
    this.error = error;
    if (error) {
      new Notice(error);
    }
  }

  // State management
  protected async saveState(): Promise<void> {
    await this.plugin.saveData({
      activeTab: this.activeTab,
      selectedInboxPath: this.selectedInboxPath,
      appendTarget: this.appendTarget,
      lastUpdate: this.lastUpdate
    });
  }

  protected async loadState(): Promise<void> {
    const data = await this.plugin.loadData();
    if (data) {
      this.activeTab = data.activeTab || 'organize';
      this.selectedInboxPath = data.selectedInboxPath || '';
      this.appendTarget = data.appendTarget || 'current';
      this.lastUpdate = data.lastUpdate || Date.now();
    }
  }
  
  // end of setup

  private async drawActiveTab(container: HTMLElement): Promise<void> {
    container.empty();

    switch (this.activeTab) {
      case 'organize':
        this.drawOrganizeTab(container);
        break;
      case 'analyze':
        this.drawAnalyzeTab(container);
        break;
      case 'enhance':
        this.drawEnhanceTab(container);
        break;
      case 'chat':
        this.drawChatTab(container);
        break;
      case 'inbox':
        this.drawInboxTab(container);
        break;
    }
  }

  private createActionButton(container: HTMLElement, text: string, icon: string, onClick: () => void): void {
    const button = container.createEl('button', {
      cls: 'ai-plugin-button',
      text: text
    });
    // Add icon if provided
    if (icon) {
      button.prepend(this.createIcon(icon));
    }
    button.addEventListener('click', onClick);
  }

  private createIcon(name: string): HTMLElement {
    const icon = document.createElement('span');
    icon.classList.add('icon', name);
    return icon;
  }

  private async getActiveFileContent(): Promise<{ file: any; content: string } | null> {
    const file = this.app.workspace.getActiveFile();
    if (!file) {
      new Notice('No active file');
      return null;
    }
    const content = await this.app.vault.read(file);
    return { file, content };
  }

  private drawOrganizeTab(container: HTMLElement): void {
    const section = container.createDiv('ai-plugin-section');
    section.createEl('h3', { text: 'Organize Notes' });

    const actionsDiv = section.createDiv('ai-plugin-actions');
    
    this.createActionButton(actionsDiv, 'Suggest Location', 'folder-plus', async () => {
      const fileData = await this.getActiveFileContent();
      if (!fileData) return;
      
      const suggestedPath = await this.plugin.notePathManager.getSuggestedPath(fileData.file);
      if (suggestedPath) {
        new PreviewModal(this.app, {
          original: fileData.file.path,
          modified: suggestedPath,
          type: 'path'
        }, async (accepted) => {
          if (accepted) {
            await this.plugin.notePathManager.moveNote(fileData.file, suggestedPath);
            new Notice('File moved successfully');
          }
        }).open();
      } else {
        new Notice('No location suggestion available');
      }
    });

    this.createActionButton(actionsDiv, 'Atomize Note', 'scissors', async () => {
      const fileData = await this.getActiveFileContent();
      if (!fileData) return;

      try {
        const atomicNotes = await this.plugin.atomizer.atomizeNote(fileData.file);
        new AtomicNotesPreviewModal(this.app, atomicNotes, async (accepted) => {
          if (accepted) {
            for (const note of atomicNotes) {
              await this.app.vault.create(`${note.title}.md`, note.content);
            }
            new Notice(`Created ${atomicNotes.length} atomic notes`);
          }
        }).open();
      } catch (error) {
        new Notice(`Error atomizing note: ${error.message}`);
      }
    });
  }

  private drawAnalyzeTab(container: HTMLElement): void {
    const section = container.createDiv('ai-plugin-section');
    section.createEl('h3', { text: 'Analyze Content' });

    const actionsDiv = section.createDiv('ai-plugin-actions');
    
    this.createActionButton(actionsDiv, 'Find Similar Notes', 'search', async () => {
      const fileData = await this.getActiveFileContent();
      if (!fileData) return;

      const results = await this.plugin.vaultQuerier.queryVault(fileData.content, {
        limit: 5,
        includeContent: true
      });

      new SimilarNotesModal(this.app, results).open();
    });

    this.createActionButton(actionsDiv, 'Extract Key Concepts', 'book-open', async () => {
      const fileData = await this.getActiveFileContent();
      if (!fileData) return;

      const concepts = await this.plugin.nlpManager.performTask({
        type: 'keywords',
        options: { minScore: 0.5 }
      }, fileData.content);

      new ConceptsModal(this.app, concepts.result).open();
    });
  }

  private drawChatTab(container: HTMLElement): void {
    const section = container.createDiv('ai-plugin-section');

    // Header
    const headerEl = section.createDiv('ai-plugin-chat-header');
    headerEl.createEl('h3', { text: 'AI Chat' });
    const modelInfo = headerEl.createDiv('ai-plugin-model-info');
    modelInfo.setText(`Using model: ${this.plugin.modelManager.getCurrentModel()}`);

    // Append options
    const appendOptions = section.createDiv('ai-plugin-append-options');
    const appendSelect = appendOptions.createEl('select', { cls: 'ai-plugin-select' });
    appendSelect.createEl('option', { text: 'Append to current note', value: 'current' });
    appendSelect.createEl('option', { text: 'Append to specific note', value: 'specific' });
    appendSelect.value = this.appendTarget;
    appendSelect.addEventListener('change', () => {
      this.appendTarget = appendSelect.value as 'current' | 'specific';
      if (this.appendTarget === 'specific') {
        new Notice('Note selection will be implemented soon');
      }
    });

    // Chat messages
    this.chatEl = section.createDiv('ai-plugin-chat-messages');
    this.updateChatMessages(this.plugin.aiChat.getMessages());

    // Input area
    const inputContainer = section.createDiv('ai-plugin-chat-input-container');
    this.inputEl = inputContainer.createEl('textarea', {
      cls: 'ai-plugin-chat-input',
      attr: { 
        placeholder: 'Type your message...',
        rows: '3'
      }
    });

    const sendButton = inputContainer.createEl('button', {
      text: 'Send',
      cls: 'ai-plugin-chat-send'
    });
    sendButton.addEventListener('click', () => this.handleSendMessage());

    this.inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.handleSendMessage();
      }
    });
  }

  private async handleSendMessage() {
    const content = this.inputEl.value.trim();
    if (!content) return;

    this.inputEl.value = '';
    const typingEl = this.addTypingIndicator();

    try {
      const response = await this.plugin.aiChat.sendMessage(content);
      typingEl.remove();

      if (this.appendTarget === 'current') {
        const activeFile = this.app.workspace.getActiveFile();
        if (activeFile) {
          await this.plugin.aiChat.appendToNote(response, activeFile);
          new Notice('Response appended to current note');
        }
      }
    } catch (error) {
      typingEl.remove();
      new Notice('Failed to send message');
      console.error('Chat error:', error);
    }
  }

  private updateChatMessages(messages: ChatMessage[]) {
    if (!this.chatEl) return;
    
    this.chatEl.empty();
    messages.forEach(msg => this.addMessageToChat(msg.role, msg.content));
    this.chatEl.scrollTop = this.chatEl.scrollHeight;
  }

  private addMessageToChat(role: 'user' | 'assistant', content: string) {
    const messageEl = this.chatEl.createDiv('ai-plugin-chat-message');
    messageEl.addClass(role);
    const bubbleEl = messageEl.createDiv('ai-plugin-chat-bubble');
    bubbleEl.setText(content);
  }

  private addTypingIndicator(): HTMLElement {
    const messageEl = this.chatEl.createDiv('ai-plugin-chat-message assistant');
    const bubbleEl = messageEl.createDiv('ai-plugin-chat-bubble');
    bubbleEl.createDiv('ai-plugin-typing-indicator');
    this.chatEl.scrollTop = this.chatEl.scrollHeight;
    return messageEl;
  }

  // private async enhanceCurrentNote(type: 'clean' | 'title' | 'tags' | 'all'): Promise<void> {
  //   const fileData = await this.getActiveFileContent();
  //   console.log(fileData);
  //   console.log(type);
  //   console.log(this.plugin);
  //   if (!fileData) return;

  //   try {
  //     const result = await this.plugin.enhancer.enhance(fileData.content, type);
  //     // Handle the enhancement result
  //     new Notice('Note enhanced successfully');
  //   } catch (error) {
  //     new Notice(`Error enhancing note: ${error.message}`);
  //   }
  // }

  private async enhanceCurrentNote(type: 'clean' | 'title' | 'tags' | 'all'): Promise<void> {
    const file = this.app.workspace.getActiveFile();
    if (!file) {
      new Notice('No active file');
      return;
    }

    const content = await this.app.vault.read(file);
    let result: { content: any; title: any; tags: any; };

    try {
      switch (type) {
        case 'clean':
          result = await this.plugin.textCleaner.cleanText(content);
          break;
        case 'title':
          result = await this.plugin.titleSuggester.suggestTitle(file);
          break;
        case 'tags':
          result = await this.plugin.tagSuggester.suggestTags(file, content);
          break;
        case 'all':
          const [cleanContent, titleSuggestion, tags] = await Promise.all([
            this.plugin.textCleaner.cleanText(content),
            this.plugin.titleSuggester.suggestTitle(file),
            this.plugin.tagSuggester.suggestTags(file, content)
          ]);
          result = {
            content: cleanContent,
            title: titleSuggestion.title,
            tags
          };
          break;
      }

      // Show preview modal with the changes
      new EnhancementPreviewModal(this.app, {
        original: content,
        enhanced: result,
        type
      }, async (accepted) => {
        if (accepted) {
          await this.applyEnhancements(file, result, type);
          new Notice('Note enhanced successfully');
        }
      }).open();
    } catch (error) {
      console.error('Error enhancing note:', error);
      new Notice('Failed to enhance note');
    }
  }

  private async applyEnhancements(file: TFile, result: any, type: string): Promise<void> {
    let content = await this.app.vault.read(file);
    
    switch (type) {
      case 'clean':
        await this.app.vault.modify(file, result);
        break;
      
      case 'title':
        await this.app.vault.rename(file, `${result.title}.md`);
        break;
      
      case 'tags':
        const frontmatter = this.extractFrontmatter(content);
        frontmatter.tags = result;
        content = this.updateFrontmatter(content, frontmatter);
        await this.app.vault.modify(file, content);
        break;
      
      case 'all':
        await this.app.vault.rename(file, `${result.title}.md`);
        const allFrontmatter = this.extractFrontmatter(content);
        allFrontmatter.tags = result.tags;
        content = this.updateFrontmatter(result.content, allFrontmatter);
        await this.app.vault.modify(file, content);
        break;
    }
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

  private updateFrontmatter(content: string, frontmatter: any): string {
    const yaml = Object.entries(frontmatter)
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n');
    
    const existingFrontmatter = content.match(/^---\n[\s\S]*?\n---\n/);
    if (existingFrontmatter) {
      return content.replace(existingFrontmatter[0], `---\n${yaml}\n---\n`);
    }
    
    return `---\n${yaml}\n---\n\n${content}`;
  }

  private drawEnhanceTab(container: HTMLElement): void {
    const section = container.createDiv('ai-plugin-section');
    section.createEl('h3', { text: 'Enhance Note' });

    const actionsDiv = section.createDiv('ai-plugin-actions');
    
    this.createActionButton(actionsDiv, 'Clean Text', 'edit-3', () => {
      this.enhanceCurrentNote('clean');
    });

    this.createActionButton(actionsDiv, 'Suggest Title', 'type', () => {
      this.enhanceCurrentNote('title');
    });

    this.createActionButton(actionsDiv, 'Suggest Tags', 'tag', () => {
      this.enhanceCurrentNote('tags');
    });

    this.createActionButton(actionsDiv, 'Enhance All', 'zap', () => {
      this.enhanceCurrentNote('all');
    });
  }

  // private async sendChatMessage(): Promise<void> {
  //   if (!this.chatInput?.value?.trim()) return;

  //   const message = this.chatInput.value;
  //   this.chatInput.value = '';
    
  //   try {
  //     const response = await this.plugin.chatManager.sendMessage(message);
  //     this.appendChatMessage(message, 'user');
  //     this.appendChatMessage(response, 'assistant');
  //   } catch (error) {
  //     new Notice(`Chat error: ${error.message}`);
  //   }
  // }

  // private appendChatMessage(message: string, type: 'user' | 'assistant'): void {
  //   const messageDiv = this.chatHistory.createDiv(`ai-plugin-chat-message ${type}`);
  //   messageDiv.createEl('p', { text: message });
  // }

  // private drawChatTab(container: HTMLElement): void {
  //   const section = container.createDiv('ai-plugin-section');
  //   section.createEl('h3', { text: 'AI Chat' });

  //   this.chatHistory = section.createDiv('ai-plugin-chat-history');

  //   const appendOptions = section.createDiv('ai-plugin-append-options');
  //   const appendSelect = appendOptions.createEl('select', { cls: 'ai-plugin-select' });
  //   appendSelect.createEl('option', { text: 'Append to current note', value: 'current' });
  //   appendSelect.createEl('option', { text: 'Append to specific note', value: 'specific' });
  //   appendSelect.value = this.appendTarget;
  //   appendSelect.addEventListener('change', (e) => {
  //     const target = (e.target as HTMLSelectElement).value as 'current' | 'specific';
  //     this.appendTarget = target;
  //     if (target === 'specific') {
  //       this.showNoteSelector();
  //     }
  //   });

  //   const inputArea = section.createDiv('ai-plugin-chat-input');
  //   this.chatInput = inputArea.createEl('textarea', {
  //     cls: 'ai-plugin-textarea',
  //     attr: { placeholder: 'Type your message...' }
  //   });

  //   this.createActionButton(inputArea, 'Send', 'paper-plane', () => this.sendChatMessage());

  //   this.chatInput.addEventListener('keydown', (e) => {
  //     if (e.key === 'Enter' && !e.shiftKey) {
  //       e.preventDefault();
  //       this.sendChatMessage();
  //     }
  //   });
  // }

  

  private createProcessingOption(container: HTMLElement, label: string): void {
    const option = container.createDiv('ai-plugin-processing-option');
    const checkbox = option.createEl('input', {
      type: 'checkbox',
      cls: 'ai-plugin-checkbox'
    });
    option.createEl('label', { text: label });
  }

  private async processInbox(): Promise<void> {
    if (!this.selectedInboxPath) {
      new Notice('Please select an inbox folder');
      return;
    }

    try {
      await this.plugin.inboxProcessor.processFolder(this.selectedInboxPath);
      new Notice('Inbox processing completed');
    } catch (error) {
      new Notice(`Error processing inbox: ${error.message}`);
    }
  }

  private drawInboxTab(container: HTMLElement): void {
    const section = container.createDiv('ai-plugin-section');
    section.createEl('h3', { text: 'Inbox Processing' });

    const folderSelect = section.createDiv('ai-plugin-folder-select');
    folderSelect.createEl('label', { text: 'Select Inbox Folder' });
    const input = new TextComponent(folderSelect);
    input.setValue(this.selectedInboxPath);
    input.onChange(value => this.selectedInboxPath = value);

    const optionsDiv = section.createDiv('ai-plugin-inbox-options');
    this.createProcessingOption(optionsDiv, 'Clean Text');
    this.createProcessingOption(optionsDiv, 'Suggest Titles');
    this.createProcessingOption(optionsDiv, 'Add Tags');
    this.createProcessingOption(optionsDiv, 'Move Files');

    this.createActionButton(section, 'Process Inbox', 'inbox', () => this.processInbox());
  }

  private async showNoteSelector(): Promise<void> {
    // Implement note selection functionality
    new Notice('Note selection not implemented');
  }
}

export class AtomicNotesPreviewModal extends Modal {
  private notes: AtomicNote[];
  private onConfirm: (accepted: boolean) => void;

  constructor(app: App, notes: AtomicNote[], onConfirm: (accepted: boolean) => void) {
    super(app);
    this.notes = notes;
    this.onConfirm = onConfirm;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('ai-plugin-preview-modal');

    const content = contentEl.createDiv('ai-plugin-preview-content');
    
    this.notes.forEach((note, index) => {
      const notePreview = content.createDiv('ai-plugin-note-preview');
      notePreview.createEl('h4', { text: `Note ${index + 1}: ${note.title}` });
      notePreview.createEl('pre', { text: note.content });
    });

    const actions = contentEl.createDiv('ai-plugin-preview-actions');
    this.createActionButton(actions, 'Create Notes', () => {
      this.onConfirm(true);
      this.close();
    });

    this.createActionButton(actions, 'Cancel', () => {
      this.onConfirm(false);
      this.close();
    });
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }

  private createActionButton(container: HTMLElement, text: string, onClick: () => void): void {
    const button = container.createEl('button', {
      cls: 'ai-plugin-button',
      text: text
    });
    button.addEventListener('click', onClick);
  }
}

export class SimilarNotesModal extends Modal {
  private results: SearchResult[];

  constructor(app: App, results: SearchResult[]) {
    super(app);
    this.results = results;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('ai-plugin-similar-notes-modal');

    const content = contentEl.createDiv('ai-plugin-similar-notes-content');
    
    this.results.forEach(result => {
      const noteDiv = content.createDiv('ai-plugin-similar-note');
      noteDiv.createEl('h4', { text: result.file.basename });
      noteDiv.createEl('div', { 
        text: `Similarity: ${(result.similarity * 100).toFixed(1)}%`,
        cls: 'ai-plugin-similarity-score'
      });
      if (result.relevantContent) {
        noteDiv.createEl('pre', { text: result.relevantContent });
      }
    });
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}

export class ConceptsModal extends Modal {
  private concepts: Concepts;

  constructor(app: App, concepts: Concepts) {
    super(app);
    this.concepts = concepts;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('ai-plugin-concepts-modal');

    const content = contentEl.createDiv('ai-plugin-concepts-content');
    
    if (this.concepts.keywords) {
      const keywordsDiv = content.createDiv('ai-plugin-keywords');
      keywordsDiv.createEl('h4', { text: 'Key Concepts' });
      
      this.concepts.keywords.forEach((keyword: string, index: number) => {
        const score = this.concepts.relevance[index];
        const keywordDiv = keywordsDiv.createDiv('ai-plugin-keyword');
        keywordDiv.createEl('span', { text: keyword });
        keywordDiv.createEl('span', { 
          text: `${(score * 100).toFixed(1)}%`,
          cls: 'ai-plugin-keyword-score'
        });
      });
    }
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}

export class TagSuggestionModal extends Modal {
  private suggestedTags: string[];

  constructor(app: App, suggestedTags: string[], callback: (accepted: boolean) => void) {
    super(app);
    this.suggestedTags = suggestedTags;
    // ... implementation for the modal ...
  }

  // ... additional methods or logic for TagSuggestionModal ...
}

export class TitleSuggestionModal extends Modal {
  private suggestedTitle: TitleSuggestion;

  constructor(app: App, suggestedTitle: TitleSuggestion, callback: (accepted: boolean) => void) {
    super(app);
    this.suggestedTitle = suggestedTitle;
    // ... implementation for the modal ...
  }
}

interface PreviewOptions {
  original: string;
  modified: string;
  type: 'path' | 'content';
}

export class PreviewModal extends Modal {
  private options: PreviewOptions;
  private onConfirm: (accepted: boolean) => void;

  constructor(app: App, options: PreviewOptions, onConfirm: (accepted: boolean) => void) {
    super(app);
    this.options = options;
    this.onConfirm = onConfirm;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('ai-plugin-preview-modal');

    // Header
    const header = contentEl.createEl('h3', {
      text: this.options.type === 'path' ? 'Suggested File Location' : 'Preview Changes'
    });

    // Preview content
    const content = contentEl.createDiv('ai-plugin-preview-content');

    // Original section
    const originalSection = content.createDiv('ai-plugin-preview-section');
    originalSection.createEl('h4', { text: 'Original' });
    originalSection.createEl('pre', { 
      text: this.options.original,
      cls: 'ai-plugin-preview-text'
    });

    // Modified section
    const modifiedSection = content.createDiv('ai-plugin-preview-section');
    modifiedSection.createEl('h4', { text: 'Modified' });
    modifiedSection.createEl('pre', { 
      text: this.options.modified,
      cls: 'ai-plugin-preview-text'
    });

    // Highlight differences if it's content preview
    if (this.options.type === 'content') {
      this.highlightDifferences(
        originalSection.querySelector('pre')!, 
        modifiedSection.querySelector('pre')!
      );
    }

    // Action buttons
    const actions = contentEl.createDiv('ai-plugin-preview-actions');
    
    // Accept button
    const acceptBtn = actions.createEl('button', {
      cls: 'ai-plugin-button mod-cta',
      text: this.options.type === 'path' ? 'Move File' : 'Accept Changes'
    });
    acceptBtn.addEventListener('click', () => {
      this.onConfirm(true);
      this.close();
    });

    // Cancel button
    const cancelBtn = actions.createEl('button', {
      cls: 'ai-plugin-button',
      text: 'Cancel'
    });
    cancelBtn.addEventListener('click', () => {
      this.onConfirm(false);
      this.close();
    });
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }

  private highlightDifferences(originalEl: HTMLElement, modifiedEl: HTMLElement) {
    const originalText = originalEl.textContent || '';
    const modifiedText = modifiedEl.textContent || '';
    
    // Simple difference highlighting
    // In a real implementation, you might want to use a proper diff algorithm
    const originalWords = originalText.split(/\s+/);
    const modifiedWords = modifiedText.split(/\s+/);
    
    let originalHtml = '';
    let modifiedHtml = '';
    
    const maxLen = Math.max(originalWords.length, modifiedWords.length);
    
    for (let i = 0; i < maxLen; i++) {
      const originalWord = originalWords[i] || '';
      const modifiedWord = modifiedWords[i] || '';
      
      if (originalWord !== modifiedWord) {
        originalHtml += originalWord ? `<span class="ai-plugin-deleted">${originalWord}</span> ` : '';
        modifiedHtml += modifiedWord ? `<span class="ai-plugin-added">${modifiedWord}</span> ` : '';
      } else {
        originalHtml += `${originalWord} `;
        modifiedHtml += `${modifiedWord} `;
      }
    }
    
    originalEl.innerHTML = originalHtml.trim();
    modifiedEl.innerHTML = modifiedHtml.trim();
  }
}

export class FileBrowserModal extends Modal {
  private onSelect: (file: TFile) => void;
  private searchInput: TextComponent;
  private results: HTMLElement;

  constructor(app: App, onSelect: (file: TFile) => void) {
    super(app);
    this.onSelect = onSelect;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('ai-plugin-file-browser-modal');

    // Search input
    this.searchInput = new TextComponent(contentEl)
      .setPlaceholder('Search notes...')
      .onChange(this.updateSearch.bind(this));

    // Results container
    this.results = contentEl.createDiv('ai-plugin-file-browser-results');
    this.updateSearch('');
  }

  private async updateSearch(query: string) {
    this.results.empty();
    const files = this.app.vault.getMarkdownFiles();
    const filtered = query ? 
      files.filter(file => file.basename.toLowerCase().includes(query.toLowerCase())) :
      files;

    filtered.slice(0, 50).forEach(file => {
      const item = this.results.createDiv('ai-plugin-file-browser-item');
      item.setText(file.basename);
      item.addEventListener('click', () => {
        this.onSelect(file);
        this.close();
      });
    });
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}

interface EnhancementPreview {
  original: string;
  enhanced: any;
  type: string;
}

export class EnhancementPreviewModal extends Modal {
  private preview: EnhancementPreview;
  private onConfirm: (accepted: boolean) => void;

  constructor(app: App, preview: EnhancementPreview, onConfirm: (accepted: boolean) => void) {
    super(app);
    this.preview = preview;
    this.onConfirm = onConfirm;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('ai-plugin-preview-modal');

    const content = contentEl.createDiv('ai-plugin-preview-content');
    
    const originalDiv = content.createDiv('ai-plugin-preview-original');
    originalDiv.createEl('h4', { text: 'Current' });
    originalDiv.createEl('pre', { text: this.preview.original });

    const modifiedDiv = content.createDiv('ai-plugin-preview-modified');
    modifiedDiv.createEl('h4', { text: 'Enhanced' });
    
    if (typeof this.preview.enhanced === 'string') {
      modifiedDiv.createEl('pre', { text: this.preview.enhanced });
    } else {
      const enhancedContent = this.formatEnhancedContent(this.preview.enhanced, this.preview.type);
      modifiedDiv.createEl('pre', { text: enhancedContent });
    }

    const actions = contentEl.createDiv('ai-plugin-preview-actions');
    const acceptBtn = actions.createEl('button', {
      cls: 'ai-plugin-button',
      text: 'Accept'
    });
    acceptBtn.addEventListener('click', () => {
      this.onConfirm(true);
      this.close();
    });

    const rejectBtn = actions.createEl('button', {
      cls: 'ai-plugin-button',
      text: 'Cancel'
    });
    rejectBtn.addEventListener('click', () => {
      this.onConfirm(false);
      this.close();
    });
  }

  private formatEnhancedContent(enhanced: any, type: string): string {
    switch (type) {
      case 'title':
        return `New Title: ${enhanced.title}\nConfidence: ${(enhanced.confidence * 100).toFixed(1)}%\n\nAlternatives:\n${enhanced.alternates.join('\n')}`;
      case 'tags':
        return `Suggested Tags:\n${enhanced.join(', ')}`;
      case 'all':
        return `Title: ${enhanced.title}\nTags: ${enhanced.tags.join(', ')}\n\nContent:\n${enhanced.content}`;
      default:
        return JSON.stringify(enhanced, null, 2);
    }
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}