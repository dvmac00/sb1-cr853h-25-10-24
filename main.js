/*
THIS IS A GENERATED/BUNDLED FILE BY ESBUILD
if you want to view the source, please visit the github repository of this plugin
*/

// main.ts
var SimilarNotesModal = class extends Modal {
  constructor(app, results) {
    super(app);
    this.results = results;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("ai-plugin-modal");
    contentEl.createEl("h2", { text: "Similar Notes" });
    const content = contentEl.createDiv("ai-plugin-similar-notes-content");
    this.results.forEach((result) => {
      const noteDiv = content.createDiv("ai-plugin-similar-note");
      noteDiv.createEl("h4", { text: result.file.basename });
      noteDiv.createEl("div", {
        text: `Similarity: ${(result.similarity * 100).toFixed(1)}%`,
        cls: "ai-plugin-similarity-score"
      });
      if (result.relevantContent) {
        noteDiv.createEl("pre", { text: result.relevantContent });
      }
    });
  }
  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
};
var ConceptsModal = class extends Modal {
  constructor(app, concepts) {
    super(app);
    this.concepts = concepts;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("ai-plugin-modal");
    contentEl.createEl("h2", { text: "Key Concepts" });
    const content = contentEl.createDiv("ai-plugin-concepts-content");
    if (this.concepts.keywords) {
      const keywordsDiv = content.createDiv("ai-plugin-keywords");
      keywordsDiv.createEl("h4", { text: "Key Concepts" });
      this.concepts.keywords.forEach((keyword, index) => {
        const score = this.concepts.relevance[index];
        const keywordDiv = keywordsDiv.createDiv("ai-plugin-keyword");
        keywordDiv.createEl("span", { text: keyword });
        keywordDiv.createEl("span", {
          text: `${(score * 100).toFixed(1)}%`,
          cls: "ai-plugin-keyword-score"
        });
      });
    }
  }
  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsibWFpbi50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLy8gQWRkIHRoZXNlIGNsYXNzZXMgYWZ0ZXIgdGhlIE5vdGVTZWxlY3Rvck1vZGFsIGNsYXNzXG5cbmNsYXNzIFNpbWlsYXJOb3Rlc01vZGFsIGV4dGVuZHMgTW9kYWwge1xuICBwcml2YXRlIHJlc3VsdHM6IGFueVtdO1xuXG4gIGNvbnN0cnVjdG9yKGFwcDogQXBwLCByZXN1bHRzOiBhbnlbXSkge1xuICAgIHN1cGVyKGFwcCk7XG4gICAgdGhpcy5yZXN1bHRzID0gcmVzdWx0cztcbiAgfVxuXG4gIG9uT3BlbigpIHtcbiAgICBjb25zdCB7IGNvbnRlbnRFbCB9ID0gdGhpcztcbiAgICBjb250ZW50RWwuZW1wdHkoKTtcbiAgICBjb250ZW50RWwuYWRkQ2xhc3MoJ2FpLXBsdWdpbi1tb2RhbCcpO1xuXG4gICAgY29udGVudEVsLmNyZWF0ZUVsKCdoMicsIHsgdGV4dDogJ1NpbWlsYXIgTm90ZXMnIH0pO1xuICAgIFxuICAgIGNvbnN0IGNvbnRlbnQgPSBjb250ZW50RWwuY3JlYXRlRGl2KCdhaS1wbHVnaW4tc2ltaWxhci1ub3Rlcy1jb250ZW50Jyk7XG4gICAgXG4gICAgdGhpcy5yZXN1bHRzLmZvckVhY2gocmVzdWx0ID0+IHtcbiAgICAgIGNvbnN0IG5vdGVEaXYgPSBjb250ZW50LmNyZWF0ZURpdignYWktcGx1Z2luLXNpbWlsYXItbm90ZScpO1xuICAgICAgbm90ZURpdi5jcmVhdGVFbCgnaDQnLCB7IHRleHQ6IHJlc3VsdC5maWxlLmJhc2VuYW1lIH0pO1xuICAgICAgbm90ZURpdi5jcmVhdGVFbCgnZGl2JywgeyBcbiAgICAgICAgdGV4dDogYFNpbWlsYXJpdHk6ICR7KHJlc3VsdC5zaW1pbGFyaXR5ICogMTAwKS50b0ZpeGVkKDEpfSVgLFxuICAgICAgICBjbHM6ICdhaS1wbHVnaW4tc2ltaWxhcml0eS1zY29yZSdcbiAgICAgIH0pO1xuICAgICAgaWYgKHJlc3VsdC5yZWxldmFudENvbnRlbnQpIHtcbiAgICAgICAgbm90ZURpdi5jcmVhdGVFbCgncHJlJywgeyB0ZXh0OiByZXN1bHQucmVsZXZhbnRDb250ZW50IH0pO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgb25DbG9zZSgpIHtcbiAgICBjb25zdCB7IGNvbnRlbnRFbCB9ID0gdGhpcztcbiAgICBjb250ZW50RWwuZW1wdHkoKTtcbiAgfVxufVxuXG5jbGFzcyBDb25jZXB0c01vZGFsIGV4dGVuZHMgTW9kYWwge1xuICBwcml2YXRlIGNvbmNlcHRzOiBhbnk7XG5cbiAgY29uc3RydWN0b3IoYXBwOiBBcHAsIGNvbmNlcHRzOiBhbnkpIHtcbiAgICBzdXBlcihhcHApO1xuICAgIHRoaXMuY29uY2VwdHMgPSBjb25jZXB0cztcbiAgfVxuXG4gIG9uT3BlbigpIHtcbiAgICBjb25zdCB7IGNvbnRlbnRFbCB9ID0gdGhpcztcbiAgICBjb250ZW50RWwuZW1wdHkoKTtcbiAgICBjb250ZW50RWwuYWRkQ2xhc3MoJ2FpLXBsdWdpbi1tb2RhbCcpO1xuXG4gICAgY29udGVudEVsLmNyZWF0ZUVsKCdoMicsIHsgdGV4dDogJ0tleSBDb25jZXB0cycgfSk7XG4gICAgXG4gICAgY29uc3QgY29udGVudCA9IGNvbnRlbnRFbC5jcmVhdGVEaXYoJ2FpLXBsdWdpbi1jb25jZXB0cy1jb250ZW50Jyk7XG4gICAgXG4gICAgaWYgKHRoaXMuY29uY2VwdHMua2V5d29yZHMpIHtcbiAgICAgIGNvbnN0IGtleXdvcmRzRGl2ID0gY29udGVudC5jcmVhdGVEaXYoJ2FpLXBsdWdpbi1rZXl3b3JkcycpO1xuICAgICAga2V5d29yZHNEaXYuY3JlYXRlRWwoJ2g0JywgeyB0ZXh0OiAnS2V5IENvbmNlcHRzJyB9KTtcbiAgICAgIFxuICAgICAgdGhpcy5jb25jZXB0cy5rZXl3b3Jkcy5mb3JFYWNoKChrZXl3b3JkOiBzdHJpbmcsIGluZGV4OiBudW1iZXIpID0+IHtcbiAgICAgICAgY29uc3Qgc2NvcmUgPSB0aGlzLmNvbmNlcHRzLnJlbGV2YW5jZVtpbmRleF07XG4gICAgICAgIGNvbnN0IGtleXdvcmREaXYgPSBrZXl3b3Jkc0Rpdi5jcmVhdGVEaXYoJ2FpLXBsdWdpbi1rZXl3b3JkJyk7XG4gICAgICAgIGtleXdvcmREaXYuY3JlYXRlRWwoJ3NwYW4nLCB7IHRleHQ6IGtleXdvcmQgfSk7XG4gICAgICAgIGtleXdvcmREaXYuY3JlYXRlRWwoJ3NwYW4nLCB7IFxuICAgICAgICAgIHRleHQ6IGAkeyhzY29yZSAqIDEwMCkudG9GaXhlZCgxKX0lYCxcbiAgICAgICAgICBjbHM6ICdhaS1wbHVnaW4ta2V5d29yZC1zY29yZSdcbiAgICAgICAgfSk7XG4gICAgICB9KTtcbiAgICB9XG4gIH1cblxuICBvbkNsb3NlKCkge1xuICAgIGNvbnN0IHsgY29udGVudEVsIH0gPSB0aGlzO1xuICAgIGNvbnRlbnRFbC5lbXB0eSgpO1xuICB9XG59Il0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7O0FBRUEsc0NBQWdDLE1BQU07QUFBQSxFQUdwQyxZQUFZLEtBQVUsU0FBZ0I7QUFDcEMsVUFBTTtBQUNOLFNBQUssVUFBVTtBQUFBO0FBQUEsRUFHakIsU0FBUztBQUNQLFVBQU0sRUFBRSxjQUFjO0FBQ3RCLGNBQVU7QUFDVixjQUFVLFNBQVM7QUFFbkIsY0FBVSxTQUFTLE1BQU0sRUFBRSxNQUFNO0FBRWpDLFVBQU0sVUFBVSxVQUFVLFVBQVU7QUFFcEMsU0FBSyxRQUFRLFFBQVEsWUFBVTtBQUM3QixZQUFNLFVBQVUsUUFBUSxVQUFVO0FBQ2xDLGNBQVEsU0FBUyxNQUFNLEVBQUUsTUFBTSxPQUFPLEtBQUs7QUFDM0MsY0FBUSxTQUFTLE9BQU87QUFBQSxRQUN0QixNQUFNLGVBQWdCLFFBQU8sYUFBYSxLQUFLLFFBQVE7QUFBQSxRQUN2RCxLQUFLO0FBQUE7QUFFUCxVQUFJLE9BQU8saUJBQWlCO0FBQzFCLGdCQUFRLFNBQVMsT0FBTyxFQUFFLE1BQU0sT0FBTztBQUFBO0FBQUE7QUFBQTtBQUFBLEVBSzdDLFVBQVU7QUFDUixVQUFNLEVBQUUsY0FBYztBQUN0QixjQUFVO0FBQUE7QUFBQTtBQUlkLGtDQUE0QixNQUFNO0FBQUEsRUFHaEMsWUFBWSxLQUFVLFVBQWU7QUFDbkMsVUFBTTtBQUNOLFNBQUssV0FBVztBQUFBO0FBQUEsRUFHbEIsU0FBUztBQUNQLFVBQU0sRUFBRSxjQUFjO0FBQ3RCLGNBQVU7QUFDVixjQUFVLFNBQVM7QUFFbkIsY0FBVSxTQUFTLE1BQU0sRUFBRSxNQUFNO0FBRWpDLFVBQU0sVUFBVSxVQUFVLFVBQVU7QUFFcEMsUUFBSSxLQUFLLFNBQVMsVUFBVTtBQUMxQixZQUFNLGNBQWMsUUFBUSxVQUFVO0FBQ3RDLGtCQUFZLFNBQVMsTUFBTSxFQUFFLE1BQU07QUFFbkMsV0FBSyxTQUFTLFNBQVMsUUFBUSxDQUFDLFNBQWlCLFVBQWtCO0FBQ2pFLGNBQU0sUUFBUSxLQUFLLFNBQVMsVUFBVTtBQUN0QyxjQUFNLGFBQWEsWUFBWSxVQUFVO0FBQ3pDLG1CQUFXLFNBQVMsUUFBUSxFQUFFLE1BQU07QUFDcEMsbUJBQVcsU0FBUyxRQUFRO0FBQUEsVUFDMUIsTUFBTSxHQUFJLFNBQVEsS0FBSyxRQUFRO0FBQUEsVUFDL0IsS0FBSztBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsRUFNYixVQUFVO0FBQ1IsVUFBTSxFQUFFLGNBQWM7QUFDdEIsY0FBVTtBQUFBO0FBQUE7IiwKICAibmFtZXMiOiBbXQp9Cg==
