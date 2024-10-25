import { App, Modal, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { AIPluginView, AI_PLUGIN_VIEW_TYPE, AtomicNotesPreviewModal, ConceptsModal, SimilarNotesModal, TagSuggestionModal, TitleSuggestionModal } from './src/AIPluginView';
import { ModelManager, ModelProvider } from './src/modelManager';
import { DatabaseManager } from './src/db';
import { EmbeddingManager } from './src/embeddings';
import { VaultQuerier } from './src/vaultQuerier';
import { Atomizer } from './src/atomizer';
import { NLPManager } from './src/nlpManager';
import { TextCleaner } from './src/textCleaner';
import { TagSuggester } from './src/tagSuggester';
import { TitleSuggester } from './src/titleSuggester';
import { NotePathManager } from './src/notePathManager';
import { AIChat } from './src/aiChat';

interface AIPluginSettings {
  modelProvider: ModelProvider;
  modelName: string;
  endpoint: string;
  apiKey: string;
  embeddingCacheExpiration: number;
  defaultInboxPath: string;
  pathRules: { criteria: string; targetPath: string }[];
}

const DEFAULT_SETTINGS: AIPluginSettings = {
  modelProvider: ModelProvider.Ollama,
  modelName: 'llama2',
  endpoint: 'http://localhost:11434',
  apiKey: '',
  embeddingCacheExpiration: 7 * 24 * 60 * 60 * 1000, // 7 days
  defaultInboxPath: 'inbox',
  pathRules: []
};

export default class AIPlugin extends Plugin {
  settings: AIPluginSettings;
  modelManager: ModelManager;
  databaseManager: DatabaseManager;
  embeddingManager: EmbeddingManager;
  vaultQuerier: VaultQuerier;
  atomizer: Atomizer;
  nlpManager: NLPManager;
  textCleaner: TextCleaner;
  tagSuggester: TagSuggester;
  titleSuggester: TitleSuggester;
  notePathManager: NotePathManager;
  aiChat: AIChat;

  async onload() {
    await this.loadSettings();
    this.initializeManagers();

    this.registerView(
      AI_PLUGIN_VIEW_TYPE,
      (leaf) => new AIPluginView(leaf, this)
    );

    this.addRibbonIcon('bot', 'AI Assistant', () => {
      this.activateView();
    });

    this.addCommand({
      id: 'open-ai-assistant',
      name: 'Open AI Assistant',
      callback: () => {
        this.activateView();
      }
    });

    this.addCommand({
      id: 'suggest-note-location',
      name: 'Suggest Note Location',
      editorCallback: async (editor) => {
        const file = this.app.workspace.getActiveFile();
        if (file) {
          const suggestedPath = await this.notePathManager.getSuggestedPath(file);
          if (suggestedPath) {
            new PreviewModal(this.app, {
              original: file.path,
              modified: suggestedPath,
              type: 'path'
            }, async (accepted) => {
              if (accepted) {
                await this.notePathManager.moveNote(file, suggestedPath);
              }
            }).open();
          }
        }
      }
    });

    this.addCommand({
      id: 'atomize-note',
      name: 'Atomize Note',
      editorCallback: async (editor) => {
        const file = this.app.workspace.getActiveFile();
        if (file) {
          const atomicNotes = await this.atomizer.atomizeNote(file);
          new AtomicNotesPreviewModal(this.app, atomicNotes, async (accepted) => {
            if (accepted) {
              for (const note of atomicNotes) {
                await this.app.vault.create(`${note.title}.md`, note.content);
              }
            }
          }).open();
        }
      }
    });

    this.addCommand({
      id: 'find-similar-notes',
      name: 'Find Similar Notes',
      editorCallback: async (editor) => {
        const file = this.app.workspace.getActiveFile();
        if (file) {
          const content = await this.app.vault.read(file);
          const results = await this.vaultQuerier.queryVault(content, {
            limit: 5,
            includeContent: true
          });
          new SimilarNotesModal(this.app, results).open();
        }
      }
    });

    this.addCommand({
      id: 'extract-concepts',
      name: 'Extract Key Concepts',
      editorCallback: async (editor) => {
        const file = this.app.workspace.getActiveFile();
        if (file) {
          const content = await this.app.vault.read(file);
          const concepts = await this.nlpManager.performTask({
            type: 'keywords',
            options: { minScore: 0.5 }
          }, content);
          new ConceptsModal(this.app, concepts.result).open();
        }
      }
    });

    this.addCommand({
      id: 'clean-note',
      name: 'Clean Note',
      editorCallback: async (editor) => {
        const content = editor.getValue();
        const cleanedContent = await this.textCleaner.cleanText(content);
        editor.setValue(cleanedContent);
      }
    });

    this.addCommand({
      id: 'suggest-tags',
      name: 'Suggest Tags',
      editorCallback: async (editor) => {
        const file = this.app.workspace.getActiveFile();
        if (file) {
          const content = await this.app.vault.read(file);
          const suggestedTags = await this.tagSuggester.suggestTags(file, content);
          new TagSuggestionModal(this.app, suggestedTags, async (accepted) => {
            if (accepted) {
              // Implementation for applying tags
            }
          }).open();
        }
      }
    });

    this.addCommand({
      id: 'suggest-title',
      name: 'Suggest Title',
      editorCallback: async (editor) => {
        const file = this.app.workspace.getActiveFile();
        if (file) {
          const suggestedTitle = await this.titleSuggester.suggestTitle(file);
          new TitleSuggestionModal(this.app, suggestedTitle, async (accepted) => {
            if (accepted) {
              // Implementation for applying title
            }
          }).open();
        }
      }
    });

    this.addCommand({
      id: 'open-ai-chat',
      name: 'Open AI Chat',
      callback: () => {
        this.aiChat.openChatWindow();
      }
    });

    this.addSettingTab(new AIPluginSettingTab(this.app, this));
  }

  private initializeManagers() {
    this.modelManager = new ModelManager(
      this.settings.modelProvider,
      this.settings.modelName,
      this.settings.endpoint
    );

    this.databaseManager = new DatabaseManager();
    this.databaseManager.init();

    this.embeddingManager = new EmbeddingManager(
      this.app.vault,
      this.modelManager,
      this.databaseManager,
      this.settings.embeddingCacheExpiration
    );

    this.vaultQuerier = new VaultQuerier(
      this.app.vault,
      this.embeddingManager,
      this.databaseManager
    );

    this.atomizer = new Atomizer(this.app.vault, this.modelManager);
    this.nlpManager = new NLPManager(this.modelManager);
    this.textCleaner = new TextCleaner(this.modelManager);
    this.tagSuggester = new TagSuggester(this.modelManager);
    this.titleSuggester = new TitleSuggester(this.app, this.modelManager, this.vaultQuerier);
    this.notePathManager = new NotePathManager(this.app.vault, this.settings.pathRules);
    this.aiChat = new AIChat(this.app, this.modelManager);
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
    this.initializeManagers();
  }

  // async activateView() {
  //   const { workspace } = this.app;
    
  //   let leaf = workspace.getLeavesOfType(AI_PLUGIN_VIEW_TYPE)[0];
    
  //   if (!leaf) {
  //     leaf = workspace.getRightLeaf(false);
  //     await leaf.setViewState({
  //       type: AI_PLUGIN_VIEW_TYPE,
  //       active: true,
  //     });
  //   }
    
  //   workspace.revealLeaf(leaf);
  // }

  async activateView() {
    try {
        const { workspace } = this.app;
        
        // First try to find existing view
        let leaf = workspace.getLeavesOfType(AI_PLUGIN_VIEW_TYPE)[0];
        
        if (!leaf) {
            // Get right leaf, explicitly handle null case
            const rightLeaf = workspace.getRightLeaf(true);
            
            if (!rightLeaf) {
                console.error("Failed to create right leaf");
                return;
            }
            
            leaf = rightLeaf;
            await leaf.setViewState({
                type: AI_PLUGIN_VIEW_TYPE,
                active: true,
            });
        }
        
        workspace.revealLeaf(leaf);
    } catch (error) {
        console.error("Error activating view:", error);
    }
}

  onunload() {
    this.app.workspace.detachLeavesOfType(AI_PLUGIN_VIEW_TYPE);
  }
}

class PreviewModal extends Modal {
  private preview: { original: string; modified: string; type: string };
  private onConfirm: (accepted: boolean) => void;

  constructor(app: App, preview: { original: string; modified: string; type: string }, onConfirm: (accepted: boolean) => void) {
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
    modifiedDiv.createEl('h4', { text: 'Suggested' });
    modifiedDiv.createEl('pre', { text: this.preview.modified });

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

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}

class AIPluginSettingTab extends PluginSettingTab {
  plugin: AIPlugin;

  constructor(app: App, plugin: AIPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl('h2', { text: 'AI Plugin Settings' });

    new Setting(containerEl)
      .setName('Model Provider')
      .setDesc('Select the AI model provider')
      .addDropdown(dropdown => dropdown
        .addOption(ModelProvider.Ollama, 'Ollama')
        .addOption(ModelProvider.OpenAI, 'OpenAI')
        .setValue(this.plugin.settings.modelProvider)
        .onChange(async (value: ModelProvider) => {
          this.plugin.settings.modelProvider = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Model Name')
      .setDesc('Enter the model name')
      .addText(text => text
        .setPlaceholder('llama2')
        .setValue(this.plugin.settings.modelName)
        .onChange(async (value) => {
          this.plugin.settings.modelName = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Endpoint')
      .setDesc('Enter the API endpoint')
      .addText(text => text
        .setPlaceholder('http://localhost:11434')
        .setValue(this.plugin.settings.endpoint)
        .onChange(async (value) => {
          this.plugin.settings.endpoint = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('API Key')
      .setDesc('Enter your API key (if required)')
      .addText(text => text
        .setPlaceholder('Enter your API key')
        .setValue(this.plugin.settings.apiKey)
        .onChange(async (value) => {
          this.plugin.settings.apiKey = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Embedding Cache Expiration')
      .setDesc('Number of days to cache embeddings')
      .addText(text => text
        .setPlaceholder('7')
        .setValue(String(this.plugin.settings.embeddingCacheExpiration / (24 * 60 * 60 * 1000)))
        .onChange(async (value) => {
          const days = parseInt(value) || 7;
          this.plugin.settings.embeddingCacheExpiration = days * 24 * 60 * 60 * 1000;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Default Inbox Path')
      .setDesc('Path for new notes')
      .addText(text => text
        .setPlaceholder('inbox')
        .setValue(this.plugin.settings.defaultInboxPath)
        .onChange(async (value) => {
          this.plugin.settings.defaultInboxPath = value;
          await this.plugin.saveSettings();
        }));
  }
}