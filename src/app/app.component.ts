import { Component } from '@angular/core';
import srtValidator from 'srt-validator';
import * as JSZip from 'jszip';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  previewDownloadType: string = 'txt';

  // Download the current preview (with any edits) as .srt or .txt
  downloadPreview(): void {
    // Compose SRT from the current subtitles array
    const subtitlesArr = Array.isArray(this.subtitles) ? this.subtitles : [];
    let srt = subtitlesArr.map((sub, idx) => {
      return (
        (idx + 1) + '\n' +
        sub.start + ' --> ' + sub.end + '\n' +
        sub.text + '\n'
      );
    }).join('\n');
    // Remove trailing blank lines
    srt = srt.replace(/\n+$/g, '\n');
    const ext = (this as any).previewDownloadType ? (this as any).previewDownloadType : 'srt';
    const baseName = this.previewFileName ? this.previewFileName.replace(/\.[^.]+$/, '') : 'subtitle';
    const downloadName = baseName + '.' + ext;
    const blob = new Blob([srt], {type: 'text/plain'});
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = downloadName;
    a.click();
    window.URL.revokeObjectURL(url);
  }
  convertedFiles: {name: string, content: string, errors?: any[], hasCriticalError?: boolean}[] = [];
  downloadType: string = 'txt';
  isDragOver = false;

  previewContent: string | null = null;
  previewFileName: string = '';
  previewErrorLines: Set<number> = new Set();

  subtitles: Array<{start: string, end: string, text: string, warning?: string}> = [];

  // Find error navigation state
  errorIndex = -1;

  findNextError() {
    const subtitlesArr = Array.isArray(this.subtitles) ? this.subtitles : [];
    const errorRows = subtitlesArr
      .map((sub, idx) => ({ idx, hasError: !!sub.warning }))
      .filter(row => row.hasError);
    if (errorRows.length === 0) {
      alert('No errors found in the preview.');
      return;
    }
    this.errorIndex = (this.errorIndex + 1) % errorRows.length;
    const rowIdx = errorRows[this.errorIndex].idx;
    setTimeout(() => {
      const tbody = document.querySelector('.preview-modal-body tbody');
      if (tbody && tbody.children && tbody.children[rowIdx]) {
        const row = tbody.children[rowIdx] as HTMLElement;
        row.scrollIntoView({ behavior: 'smooth', block: 'center' });
        row.classList.add('highlight-error-row');
        setTimeout(() => row.classList.remove('highlight-error-row'), 1200);
      }
    }, 50);
  }



  // Parse SRT content to subtitles array, with warnings for invalid times
  parseSrtToSubtitles(srt: string) {
    const lines = srt.split(/\r?\n/);
    const subtitles = [];
    let i = 0;
    let prevEnd: number | null = null;
    while (i < lines.length) {
      if (!lines[i].trim()) { i++; continue; }
      let idx = i;
      if (/^\d+$/.test(lines[idx].trim())) idx++;
      const timeLine = lines[idx]?.trim();
      let start = '';
      let end = '';
      let warning = '';
      let validTime = false;
      let match = null;
      if (timeLine && /-->/.test(timeLine)) {
        // Always split on -->, even if not valid
        const parts = timeLine.split('-->');
        start = parts[0] ? parts[0].trim() : '';
        end = parts[1] ? parts[1].trim() : '';
        // Check if both start and end match strict SRT format
        const strictSrt = /^\d{2}:\d{2}:\d{2},\d{3}$/;
        const hourPattern = /^\d{2}:/;
        const minPattern = /^\d{2}:\d{2},/;
        let startWarning = '';
        let endWarning = '';
        if (strictSrt.test(start) && strictSrt.test(end)) {
          validTime = true;
        } else {
          // User-friendly warnings for hour/minute/millisecond errors
          if (!strictSrt.test(start)) {
            // If matches mm:ss,ms (missing hour)
            if (/^\d{2}:\d{2},\d{3}$/.test(start)) {
              startWarning = 'Hour missing in start time';
            } else if (!hourPattern.test(start)) {
              startWarning = 'Hour missing or invalid in start time';
            } else if (!minPattern.test(start)) {
              startWarning = 'Minute missing or invalid in start time';
            } else if (!/\d{2},\d{3}$/.test(start)) {
              startWarning = 'Millisecond missing or invalid in start time';
            } else {
              startWarning = 'Invalid start time format';
            }
          }
          if (!strictSrt.test(end)) {
            if (!hourPattern.test(end)) {
              endWarning = 'Hour missing or invalid in end time';
            } else if (!minPattern.test(end)) {
              endWarning = 'Minute missing or invalid in end time';
            } else if (!/\d{2},\d{3}$/.test(end)) {
              endWarning = 'Millisecond missing or invalid in end time';
            } else {
              endWarning = 'Invalid end time format';
            }
          }
          warning = [startWarning, endWarning].filter(Boolean).join('; ');
        }
      } else {
        i++;
        continue;
      }
      idx++;
      let text = '';
      while (idx < lines.length && lines[idx].trim() && !/^\d+$/.test(lines[idx].trim()) && !lines[idx].includes('-->')) {
        text += (text ? '\n' : '') + lines[idx];
        idx++;
      }
      // Validate times if format is valid
      if (validTime) {
        const startMs = this.parseSrtTimeToMs(start);
        const endMs = this.parseSrtTimeToMs(end);
        if (startMs >= endMs) {
          warning = 'Start time must be before end time';
        } else if (prevEnd !== null && startMs < prevEnd) {
          warning = 'Overlap or out-of-order timeline';
        }
        prevEnd = endMs;
      }
      subtitles.push({ start, end, text, warning });
      i = idx;
    }
    this.subtitles = subtitles;
  }

  parseSrtTimeToMs(str: string): number {
    const m = str.match(/(\d{2}):(\d{2}):(\d{2}),(\d{3})/);
    if (!m) return 0;
    return parseInt(m[1])*3600000 + parseInt(m[2])*60000 + parseInt(m[3])*1000 + parseInt(m[4]);
  }

  openPreview(file: {name: string, content: string, errors?: any[]}) {
    this.previewContent = file.content;
    this.previewFileName = file.name;
    this.previewErrorLines = new Set();
    this.parseSrtToSubtitles(file.content);
    // Only highlight invalid lines
    if (file.errors && file.errors.length > 0) {
      file.errors.forEach(err => {
        if (typeof err.lineNumber === 'number') {
          this.previewErrorLines.add(err.lineNumber);
        }
      });
    }
    // Highlight lines with any timestamp format other than HH:MM:SS,mmm --> HH:MM:SS,mmm as invalid
    const lines = file.content.split('\n');
    const validSrtTimeLine = /^(\d{2}:\d{2}:\d{2},\d{3})\s+-->\s+(\d{2}:\d{2}:\d{2},\d{3})$/;
    lines.forEach((line, idx) => {
      // If line looks like a timestamp but is not exactly valid, highlight it
      if (/-->/g.test(line) && !validSrtTimeLine.test(line.trim())) {
        this.previewErrorLines.add(idx + 1);
      }
    });
  }

  closePreview() {
    this.previewContent = null;
    this.previewFileName = '';
    this.previewErrorLines = new Set();
  }

  onFileSelected(event: any) {
    const files: FileList = event.target.files;
    this.convertedFiles = [];

    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (e: any) => {
        const text = e.target.result;
        const converted = this.convertSrtTimestamps(text);
        const errors = srtValidator(converted);
        // If any error is about time, format, order, overlap, or start/end, mark file as having errors
        let hasCriticalError = false;
        // Check for invalid timestamp lines (not just srtValidator errors)
        const lines = converted.split('\n');
        const validSrtTimeLine = /^(\d{2}:\d{2}:\d{2},\d{3})\s+-->\s+(\d{2}:\d{2}:\d{2},\d{3})$/;
        const hasInvalidTimestamp = lines.some(line => /-->/g.test(line) && !validSrtTimeLine.test(line.trim()));
        if (errors && errors.length > 0) {
          hasCriticalError = errors.some(err =>
            err.message && /-->|time|format|chronology|order|invalid|overlap|start|end/i.test(err.message)
          );
        }
        if (hasInvalidTimestamp) {
          hasCriticalError = true;
        }
        this.convertedFiles.push({name: file.name, content: converted, errors, hasCriticalError});
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

  validateSubtitleRow(i: number) {
    const sub = this.subtitles[i];
    if (!sub) return;
    const strictSrt = /^\d{2}:\d{2}:\d{2},\d{3}$/;
    const hourPattern = /^\d{2}:/;
    const minPattern = /^\d{2}:\d{2},/;
    let startWarning = '';
    let endWarning = '';
    let validTime = false;
    if (strictSrt.test(sub.start) && strictSrt.test(sub.end)) {
      validTime = true;
    } else {
      if (!strictSrt.test(sub.start)) {
        // If matches mm:ss,ms (missing hour)
        if (/^\d{2}:\d{2},\d{3}$/.test(sub.start)) {
          startWarning = 'Hour missing in start time';
        } else if (!hourPattern.test(sub.start)) {
          startWarning = 'Hour missing or invalid in start time';
        } else if (!minPattern.test(sub.start)) {
          startWarning = 'Minute missing or invalid in start time';
        } else if (!/\d{2},\d{3}$/.test(sub.start)) {
          startWarning = 'Millisecond missing or invalid in start time';
        } else {
          startWarning = 'Invalid start time format';
        }
      }
      if (!strictSrt.test(sub.end)) {
        if (!hourPattern.test(sub.end)) {
          endWarning = 'Hour missing or invalid in end time';
        } else if (!minPattern.test(sub.end)) {
          endWarning = 'Minute missing or invalid in end time';
        } else if (!/\d{2},\d{3}$/.test(sub.end)) {
          endWarning = 'Millisecond missing or invalid in end time';
        } else {
          endWarning = 'Invalid end time format';
        }
      }
    }
    // Overlap and order check if both are valid
    if (validTime) {
      const startMs = this.parseSrtTimeToMs(sub.start);
      const endMs = this.parseSrtTimeToMs(sub.end);
      if (startMs >= endMs) {
        sub.warning = 'Start time must be before end time';
        return;
      }
      // Check previous end
      if (i > 0 && strictSrt.test(this.subtitles[i-1].end)) {
        const prevEndMs = this.parseSrtTimeToMs(this.subtitles[i-1].end);
        if (startMs < prevEndMs) {
          sub.warning = 'Overlap or out-of-order timeline';
          return;
        }
      }
      sub.warning = '';
    } else {
      sub.warning = [startWarning, endWarning].filter(Boolean).join('; ');
    }
  }
}
