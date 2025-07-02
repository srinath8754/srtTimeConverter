import { Component } from '@angular/core';
import * as JSZip from 'jszip';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  convertedFiles: {name: string, content: string}[] = [];
  downloadType: string = 'srt';
  isDragOver = false;

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
    // Convert mm:ss,ms (ms 1-3 digits) to hh:mm:ss,ms (pad ms to 3 digits, but if ms is 1 digit, pad with two zeros; if 2 digits, pad with one zero)
    return content.replace(/(?<!\d:)(\d{2}):(\d{2}),(\d{1,3})\b/g, (match, mm, ss, ms) => {
      if (ms.length === 1) ms = ms + '00';
      else if (ms.length === 2) ms = ms + '0';
      // if ms.length === 3, leave as is
      return `00:${mm}:${ss},${ms}`;
    });
  }

  downloadFile(file: {name: string, content: string}) {
    let baseName = file.name.replace(/\.[^.]+$/, '');
    let downloadName = baseName + '.' + this.downloadType;
    const blob = new Blob([file.content], {type: 'text/plain'});
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = downloadName;
    a.click();
    window.URL.revokeObjectURL(url);
  }

  deleteFile(file: {name: string, content: string}) {
    this.convertedFiles = this.convertedFiles.filter(f => f !== file);
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    this.isDragOver = true;
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    this.isDragOver = false;
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    this.isDragOver = false;
    if (event.dataTransfer && event.dataTransfer.files.length > 0) {
      const fileEvent = { target: { files: event.dataTransfer.files } };
      this.onFileSelected(fileEvent);
    }
  }

  async downloadAll() {
    if (this.convertedFiles.length === 0) return;
    const zip = new JSZip();
    this.convertedFiles.forEach(file => {
      let baseName = file.name.replace(/\.[^.]+$/, '');
      let downloadName = baseName + '.' + this.downloadType;
      zip.file(downloadName, file.content);
    });
    const content = await zip.generateAsync({ type: 'blob' });
    const url = window.URL.createObjectURL(content);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'converted-files.zip';
    a.click();
    window.URL.revokeObjectURL(url);
  }
}
