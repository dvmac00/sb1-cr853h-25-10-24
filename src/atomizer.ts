import { TFile, Vault } from 'obsidian';
import { ModelManager } from './modelManager';

interface AtomicNote {
  title: string;
  content: string;
  tags: string[];
  references: string[];
}

export class Atomizer {
  private vault: Vault;
  private modelManager: ModelManager;
  private readonly MIN_CHUNK_SIZE = 100;
  private readonly MAX_CHUNK_SIZE = 2000;

  constructor(vault: Vault, modelManager: ModelManager) {
    this.vault = vault;
    this.modelManager = modelManager;
  }

  async atomizeNote(file: TFile): Promise<AtomicNote[]> {
    const content = await this.vault.read(file);
    const { sections, references } = this.parseContent(content);
    const atomicNotes: AtomicNote[] = [];

    for (const section of sections) {
      if (section.length < this.MIN_CHUNK_SIZE) continue;
      
      const conceptPrompt = `Extract the main concept from this text section and return it as a single, concise phrase:\n\n${section}`;
      const concept = await this.modelManager.generateText(conceptPrompt);
      
      const analysisPrompt = `Analyze this text about "${concept}" and generate:
1. A clear title (as a string)
2. Relevant tags (as a JSON array)
3. A well-structured note (as a string)
Format the response as a JSON object with "title", "tags", and "content" fields.

Text to analyze:
${section}`;

      const response = await this.modelManager.generateText(analysisPrompt);
      const analysis = JSON.parse(response);

      atomicNotes.push({
        title: this.sanitizeTitle(analysis.title),
        content: this.formatContent(analysis.content, file.basename),
        tags: analysis.tags,
        references: references
      });
    }

    return atomicNotes;
  }

  private parseContent(content: string): { sections: string[], references: string[] } {
    const references = new Set<string>();
    const sections: string[] = [];
    let currentSection = '';

    // Remove YAML frontmatter
    content = content.replace(/^---\n[\s\S]*?\n---\n/, '');

    // Split into sections by headers
    const lines = content.split('\n');
    for (const line of lines) {
      if (line.match(/^#{1,6}\s/)) {
        if (currentSection) {
          sections.push(currentSection.trim());
        }
        currentSection = line + '\n';
      } else {
        currentSection += line + '\n';
        
        // Extract references
        const wikiLinks = line.match(/\[\[(.*?)\]\]/g);
        if (wikiLinks) {
          wikiLinks.forEach(link => {
            references.add(link.slice(2, -2).split('|')[0]);
          });
        }
        
        const mdLinks = line.match(/\[([^\]]+)\]\(([^\)]+)\)/g);
        if (mdLinks) {
          mdLinks.forEach(link => {
            const match = link.match(/\[([^\]]+)\]\(([^\)]+)\)/);
            if (match) references.add(match[1]);
          });
        }
      }
    }

    if (currentSection) {
      sections.push(currentSection.trim());
    }

    return {
      sections: this.balanceSections(sections),
      references: Array.from(references)
    };
  }

  private balanceSections(sections: string[]): string[] {
    const balanced: string[] = [];
    let currentSection = '';

    for (const section of sections) {
      if (currentSection.length + section.length <= this.MAX_CHUNK_SIZE) {
        currentSection += (currentSection ? '\n\n' : '') + section;
      } else {
        if (currentSection) balanced.push(currentSection);
        currentSection = section;
      }
    }

    if (currentSection) balanced.push(currentSection);
    return balanced;
  }

  private sanitizeTitle(title: string): string {
    return title
      .replace(/[/\\?%*:|"<>]/g, '-')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase();
  }

  private formatContent(content: string, sourceNote: string): string {
    const timestamp = new Date().toISOString().split('T')[0];
    return `---
created: ${timestamp}
source: [[${sourceNote}]]
tags: ${this.formatTags(this.extractTags(content))}
---

${content}`;
  }

  private extractTags(content: string): string[] {
    const tags = new Set<string>();
    const tagRegex = /#([a-zA-Z0-9_-]+)/g;
    let match;
    
    while ((match = tagRegex.exec(content)) !== null) {
      tags.add(match[1]);
    }
    
    return Array.from(tags);
  }

  private formatTags(tags: string[]): string {
    return tags.map(tag => `#${tag}`).join(' ');
  }
}