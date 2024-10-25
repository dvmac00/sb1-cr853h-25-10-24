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

  private drawOrganizeTab(container: HTMLElement): void {
    const section = container.createDiv('ai-plugin-section');
    section.createEl('h3', { text: 'Organize Notes' });

    // File organization actions
    const actionsDiv = section.createDiv('ai-plugin-actions');
    
    this.createActionButton(actionsDiv, 'Suggest Location', 'folder-plus', async () => {
      const file = this.app.workspace.getActiveFile();
      if (!file) {
        new Notice('No active file');
        return;
      }
      
      const suggestedPath = await this.plugin.notePathManager.getSuggestedPath(file);
      if (suggestedPath) {
        const modal = new PreviewModal(this.app, {
          original: file.path,
          modified: suggestedPath,
          type: 'path'
        }, async (accepted) => {
          if (accepted) {
            await this.plugin.notePathManager.moveNote(file, suggestedPath);
            new Notice('File moved successfully');
          }
        });
        modal.open();
      } else {
        new Notice('No location suggestion available');
      }
    });

    this.createActionButton(actionsDiv, 'Atomize Note', 'scissors', async () => {
      const file = this.app.workspace.getActiveFile();
      if (!file) {
        new Notice('No active file');
        return;
      }

      try {
        const atomicNotes = await this.plugin.atomizer.atomizeNote(file);
        const modal = new AtomicNotesPreviewModal(this.app, atomicNotes, async (accepted) => {
          if (accepted) {
            for (const note of atomicNotes) {
              await this.app.vault.create(`${note.title}.md`, note.content);
            }
            new Notice(`Created ${atomicNotes.length} atomic notes`);
          }
        });
        modal.open();
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
      const file = this.app.workspace.getActiveFile();
      if (!file) {
        new Notice('No active file');
        return;
      }

      const content = await this.app.vault.read(file);
      const results = await this.plugin.vaultQuerier.queryVault(content, {
        limit: 5,
        includeContent: true
      });

      const modal = new SimilarNotesModal(this.app, results);
      modal.open();
    });

    this.createActionButton(actionsDiv, 'Extract Key Concepts', 'book-open', async () => {
      const file = this.app.workspace.getActiveFile();
      if (!file) {
        new Notice('No active file');
        return;
      }

      const content = await this.app.vault.read(file);
      const concepts = await this.plugin.nlpManager.performTask({
        type: 'keywords',
        options: { minScore: 0.5 }
      }, content);

      const modal = new ConceptsModal(this.app, concepts.result);
      modal.open();
    });
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

  private drawChatTab(container: HTMLElement): void {
    const section = container.createDiv('ai-plugin-section');
    section.createEl('h3', { text: 'AI Chat' });

    // Chat history
    this.chatHistory = section.createDiv('ai-plugin-chat-history');

    // Append options
    const appendOptions = section.createDiv('ai-plugin-append-options');
    const appendSelect = appendOptions.createEl('select', { cls: 'ai-plugin-select' });
    appendSelect.createEl('option', { text: 'Append to current note', value: 'current' });
    appendSelect.createEl('option', { text: 'Append to specific note', value: 'specific' });
    appendSelect.value = this.appendTarget;
    appendSelect.addEventListener('change', () => {
      this.appendTarget = appendSelect.value;
      if (this.appendTarget === 'specific') {
        this.showNoteSelector();
      }
    });

    // Chat input area
    const inputArea = section.createDiv('ai-plugin-chat-input');
    this.chatInput = inputArea.createEl('textarea', {
      cls: 'ai-plugin-textarea',
      attr: { placeholder: 'Type your message...' }
    });

    const sendButton = inputArea.createEl('button', {
      cls: 'ai-plugin-button',
      text: 'Send'
    });
    sendButton.addEventListener('click', () => this.sendChatMessage());

    // Handle Enter key
    this.chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendChatMessage();
      }
    });
  }

  private drawInboxTab(container: HTMLElement): void {
    const section = container.createDiv('ai-plugin-section');
    section.createEl('h3', { text: 'Inbox Processing' });

    // Inbox folder selection
    const folderSelect = section.createDiv('ai-plugin-folder-select');
    folderSelect.createEl('label', { text: 'Select Inbox Folder' });
    const input = new TextComponent(folderSelect);
    input.setValue(this.selectedInboxPath);
    input.onChange(value => this.selectedInboxPath = value);

    // Processing options
    const optionsDiv = section.createDiv('ai-plugin-inbox-options');
    this.createProcessingOption(optionsDiv, 'Clean Text');
    this.createProcessingOption(optionsDiv, 'Suggest Titles');
    this.createProcessingOption(optionsDiv, 'Add Tags');
    this.createProcessingOption(optionsDiv, 'Move Files');

    // Process button
    const processButton = section.createEl('button', {
      cls: 'ai-plugin-button',
      text: 'Process Inbox'
    });
    processButton.addEventListener('click', () => this.processInbox());
  }
}

class AtomicNotesPreviewModal extends Modal {
  private notes: any[];
  private onConfirm: (accepted: boolean) => void;

  constructor(app: App, notes: any[], onConfirm: (accepted: boolean) => void) {
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
    const acceptBtn = actions.createEl('button', {
      cls: 'ai-plugin-button',
      text: 'Create Notes'
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

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}

class SimilarNotesModal extends Modal {
  private results: any[];

  constructor(app: App, results: any[]) {
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

class ConceptsModal extends Modal {
  private concepts: any;

  constructor(app: App, concepts: any) {
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

export { AIPluginView, AI_PLUGIN_VIEW_TYPE };