import { Component } from '@angular/core';
import * as JSZip from 'jszip';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  convertedFiles: {name: string, content: string}[] = [];
  downloadType: string = 'txt';
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
    // 1. Pad milliseconds to 3 digits for hh:mm:ss,ms and mm:ss,ms
    // 2. Convert mm:ss,ms to hh:mm:ss,ms (with padded ms)
    // First, handle mm:ss,ms (not preceded by a digit and colon)
    content = content.replace(/(?<!\d:)(\d{2}):(\d{2}),(\d{1,3})/g, (match, mm, ss, ms) => {
      while (ms.length < 3) ms += '0';
      return `00:${mm}:${ss},${ms}`;
    });
    // Then, handle already-correct hh:mm:ss,ms but ms < 3 digits
    content = content.replace(/(\d{2}:\d{2}:\d{2}),(\d{1,3})/g, (match, time, ms) => {
      while (ms.length < 3) ms += '0';
      return `${time},${ms}`;
    });
    return content;
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
