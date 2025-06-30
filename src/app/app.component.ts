import { Component } from '@angular/core';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  convertedFiles: {name: string, content: string}[] = [];

  onFileSelected(event: any) {
    const files: FileList = event.target.files;
    this.convertedFiles = [];

    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (e: any) => {
        const text = e.target.result;
        const converted = this.convertSrtTimestamps(text);
        this.convertedFiles.push({name: file.name, content: converted});
      };
      reader.readAsText(file);
    });
  }

  convertSrtTimestamps(content: string): string {
    // Only convert timestamps in mm:ss,ms format (not already hh:mm:ss,ms)
    // Matches timestamps at the start of a line or after a space, not preceded by a digit and colon
    return content.replace(/(?<!\d:)\b(\d{2}):(\d{2}),(\d{3})\b/g, (match, mm, ss, ms) => {
      return `00:${mm}:${ss},${ms}`;
    });
  }

  downloadFile(file: {name: string, content: string}) {
    const blob = new Blob([file.content], {type: 'text/plain'});
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    a.click();
    window.URL.revokeObjectURL(url);
  }

  deleteFile(file: {name: string, content: string}) {
    this.convertedFiles = this.convertedFiles.filter(f => f !== file);
  }
}
