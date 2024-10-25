import { TFile, Vault } from 'obsidian';

interface NotePathRule {
  criteria: string;
  targetPath: string;
}

export class NotePathManager {
  private vault: Vault;
  private rules: NotePathRule[];

  constructor(vault: Vault, rules: NotePathRule[]) {
    this.vault = vault;
    this.rules = rules;
  }

  async getSuggestedPath(file: TFile): Promise<string | null> {
    const content = await this.vault.read(file);
    const frontmatter = this.extractFrontmatter(content);
    
    for (const rule of this.rules) {
      if (await this.matchesCriteria(content, frontmatter, rule.criteria)) {
        const targetPath = this.formatTargetPath(rule.targetPath, file, frontmatter);
        return targetPath;
      }
    }

    return null;
  }

  async checkAndMoveNote(file: TFile) {
    const suggestedPath = await this.getSuggestedPath(file);
    if (suggestedPath && file.path !== suggestedPath) {
      await this.moveNote(file, suggestedPath);
    }
  }

  async moveNote(file: TFile, newPath: string) {
    try {
      // Ensure the target directory exists
      const targetDir = newPath.substring(0, newPath.lastIndexOf('/'));
      if (targetDir) {
        await this.ensureDirectory(targetDir);
      }

      // Move the file
      await this.vault.rename(file, newPath);
    } catch (error) {
      console.error('Failed to move note:', error);
      throw new Error('Failed to move note');
    }
  }

  private async ensureDirectory(path: string) {
    const dirs = path.split('/');
    let currentPath = '';
    
    for (const dir of dirs) {
      currentPath += (currentPath ? '/' : '') + dir;
      if (!(await this.vault.adapter.exists(currentPath))) {
        await this.vault.createFolder(currentPath);
      }
    }
  }

  private async matchesCriteria(content: string, frontmatter: any, criteria: string): Promise<boolean> {
    // Support for different types of criteria
    if (criteria.startsWith('tag:')) {
      const tag = criteria.substring(4);
      return frontmatter?.tags?.includes(tag) || content.includes(`#${tag}`);
    }
    
    if (criteria.startsWith('category:')) {
      const category = criteria.substring(9);
      return frontmatter?.category === category;
    }
    
    if (criteria.startsWith('regex:')) {
      const regex = new RegExp(criteria.substring(6));
      return regex.test(content);
    }
    
    if (criteria.startsWith('path:')) {
      const pathPattern = criteria.substring(5);
      return this.matchPathPattern(pathPattern, content);
    }

    // Default to simple content matching
    return content.includes(criteria);
  }

  private matchPathPattern(pattern: string, content: string): boolean {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    return regex.test(content);
  }

  private extractFrontmatter(content: string): any {
    const frontmatterRegex = /^---\n([\s\S]*?)\n---/;
    const match = content.match(frontmatterRegex);
    
    if (match) {
      try {
        return JSON.parse(`{${match[1]}}`);
      } catch {
        // If JSON parsing fails, try YAML-style parsing
        const frontmatter: any = {};
        const lines = match[1].split('\n');
        for (const line of lines) {
          const [key, ...values] = line.split(':');
          if (key && values.length) {
            frontmatter[key.trim()] = values.join(':').trim();
          }
        }
        return frontmatter;
      }
    }
    
    return {};
  }

  private formatTargetPath(targetPath: string, file: TFile, frontmatter: any): string {
    return targetPath
      .replace(/{title}/g, file.basename)
      .replace(/{category}/g, frontmatter.category || 'uncategorized')
      .replace(/{date}/g, this.formatDate(frontmatter.date || new Date()))
      .replace(/{type}/g, frontmatter.type || 'note');
  }

  private formatDate(date: Date | string): string {
    const d = new Date(date);
    return `${d.getFullYear()}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')}`;
  }
}