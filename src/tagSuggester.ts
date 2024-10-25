import { TFile } from 'obsidian';
import { ModelManager } from './modelManager';

export class TagSuggester {
  private modelManager: ModelManager;

  constructor(modelManager: ModelManager) {
    this.modelManager = modelManager;
  }

  async suggestTags(file: TFile, content: string): Promise<string[]> {
    const prompt = `Suggest relevant tags for the following note content. Return the tags as a JSON array of strings, without any symbols:

${content}`;

    try {
      const response = await this.modelManager.generateText(prompt);
      const suggestedTags = JSON.parse(response);
      return Array.isArray(suggestedTags) ? suggestedTags : [];
    } catch (error) {
      console.error('Error suggesting tags:', error);
      throw new Error('Failed to suggest tags');
    }
  }

  // This method is no longer needed as we're adding tags directly to the frontmatter
  // formatTagsAsList(tags: string[]): string {
  //   return tags.join(', ');
  // }
}