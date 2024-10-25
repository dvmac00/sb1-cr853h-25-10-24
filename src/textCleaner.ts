import { ModelManager } from './modelManager';

interface CleaningOptions {
  fixGrammar: boolean;
  fixSpelling: boolean;
  improvePunctuation: boolean;
  improveFormatting: boolean;
  preserveLinks: boolean;
  preserveFrontmatter: boolean;
  ignoreExcalidraw: boolean;
}

export class TextCleaner {
  private modelManager: ModelManager;
  private readonly DEFAULT_OPTIONS: CleaningOptions = {
    fixGrammar: true,
    fixSpelling: true,
    improvePunctuation: true,
    improveFormatting: true,
    preserveLinks: true,
    preserveFrontmatter: true,
    ignoreExcalidraw: false
  };

  constructor(modelManager: ModelManager) {
    this.modelManager = modelManager;
  }

  async cleanText(text: string, options: Partial<CleaningOptions> = {}): Promise<string> {
    const finalOptions = { ...this.DEFAULT_OPTIONS, ...options };
    const { frontmatter, content } = this.separateFrontmatter(text);
    
    // Handle Excalidraw content if needed
    const { cleanContent, excalidrawBlocks } = finalOptions.ignoreExcalidraw ? 
      this.extractExcalidrawBlocks(content) : { cleanContent: content, excalidrawBlocks: [] };
    
    // Preserve links and special syntax before cleaning
    const { text: processedText, markers } = finalOptions.preserveLinks ? 
      this.preserveSpecialSyntax(cleanContent) : { text: cleanContent, markers: [] };

    const sections = this.splitIntoSections(processedText);
    const cleanedSections = await Promise.all(
      sections.map(section => this.cleanSection(section, finalOptions))
    );

    // Restore preserved elements and combine sections
    let cleanedText = cleanedSections.join('\n\n');
    cleanedText = this.restoreSpecialSyntax(cleanedText, markers);

    // Restore Excalidraw blocks if they were extracted
    if (finalOptions.ignoreExcalidraw) {
      cleanedText = this.restoreExcalidrawBlocks(cleanedText, excalidrawBlocks);
    }

    // Reconstruct the document
    return finalOptions.preserveFrontmatter && frontmatter ? 
      `${frontmatter}\n\n${cleanedText}` : cleanedText;
  }

  private extractExcalidrawBlocks(text: string): { cleanContent: string; excalidrawBlocks: Array<{ placeholder: string; content: string }> } {
    const excalidrawBlocks: Array<{ placeholder: string; content: string }> = [];
    let cleanContent = text;

    // Match Excalidraw JSON blocks
    const excalidrawRegex = /```json excalidraw\n([\s\S]*?)```/g;
    let match;
    let index = 0;

    while ((match = excalidrawRegex.exec(text)) !== null) {
      const placeholder = `EXCALIDRAW_BLOCK_${index}`;
      excalidrawBlocks.push({
        placeholder,
        content: match[0]
      });
      cleanContent = cleanContent.replace(match[0], placeholder);
      index++;
    }

    return { cleanContent, excalidrawBlocks };
  }

  private restoreExcalidrawBlocks(text: string, blocks: Array<{ placeholder: string; content: string }>): string {
    let restoredText = text;
    blocks.forEach(block => {
      restoredText = restoredText.replace(block.placeholder, block.content);
    });
    return restoredText;
  }

  private separateFrontmatter(text: string): { frontmatter: string | null; content: string } {
    const match = text.match(/^(---\n[\s\S]*?\n---\n)([\s\S]*)$/);
    if (match) {
      return { frontmatter: match[1], content: match[2] };
    }
    return { frontmatter: null, content: text };
  }

  private preserveSpecialSyntax(text: string): { text: string; markers: Array<{ id: string; content: string }> } {
    const markers: Array<{ id: string; content: string }> = [];
    let processedText = text;

    // Preserve various Markdown elements
    const syntaxPatterns = [
      { pattern: /\[\[([^\]]+)\]\]/g, prefix: 'WIKILINK' },
      { pattern: /\[([^\]]+)\]\(([^\)]+)\)/g, prefix: 'MDLINK' },
      { pattern: /`[^`]+`/g, prefix: 'CODE' },
      { pattern: /```[\s\S]*?```/g, prefix: 'CODEBLOCK' },
      { pattern: /\$\$[\s\S]*?\$\$/g, prefix: 'MATH' },
      { pattern: /\$[^$\n]+\$/g, prefix: 'INLINEMATH' }
    ];

    syntaxPatterns.forEach(({ pattern, prefix }) => {
      processedText = processedText.replace(pattern, (match) => {
        const id = `${prefix}_${markers.length}`;
        markers.push({ id, content: match });
        return id;
      });
    });

    return { text: processedText, markers };
  }

  private restoreSpecialSyntax(text: string, markers: Array<{ id: string; content: string }>): string {
    let restoredText = text;
    markers.forEach(({ id, content }) => {
      restoredText = restoredText.replace(id, content);
    });
    return restoredText;
  }

  private splitIntoSections(text: string): string[] {
    return text.split(/(?:\n\n|\r\n\r\n)/).filter(section => section.trim());
  }

  private async cleanSection(section: string, options: CleaningOptions): Promise<string> {
    const prompt = this.createCleaningPrompt(section, options);
    try {
      const cleanedSection = await this.modelManager.generateText(prompt);
      return this.postProcessSection(cleanedSection, options);
    } catch (error) {
      console.error('Error cleaning section:', error);
      return section; // Return original section if cleaning fails
    }
  }

  private createCleaningPrompt(section: string, options: CleaningOptions): string {
    const tasks = [
      options.fixGrammar && 'Fix any grammatical errors',
      options.fixSpelling && 'Correct spelling mistakes',
      options.improvePunctuation && 'Improve punctuation',
      options.improveFormatting && 'Enhance formatting and structure'
    ].filter(Boolean).join(', ');

    return `Improve the following text by ${tasks}. Maintain the original meaning and tone. Return only the cleaned text:

${section}`;
  }

  private postProcessSection(section: string, options: CleaningOptions): string {
    let processed = section;

    if (options.improveFormatting) {
      // Ensure consistent line endings
      processed = processed.replace(/\r\n/g, '\n');
      
      // Fix spacing around punctuation
      processed = processed
        .replace(/\s+([.,!?;:])/g, '$1')
        .replace(/([.,!?;:])\s*/g, '$1 ')
        .replace(/\s+/g, ' ');

      // Ensure proper spacing around markdown elements
      processed = processed
        .replace(/(\*\*|__)(.*?)\1/g, ' $1$2$1 ') // Bold
        .replace(/(\*|_)(.*?)\1/g, ' $1$2$1 ') // Italic
        .trim();
    }

    return processed;
  }
}