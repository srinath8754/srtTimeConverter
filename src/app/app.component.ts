import { Component, OnInit } from '@angular/core';
import srtValidator from 'srt-validator';
import * as JSZip from 'jszip';
import { Document, Packer, Paragraph, TextRun } from 'docx';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  ngOnInit() {
    this.ensureSubtitleEditingFlags();
  }

  private ensureSubtitleEditingFlags() {
    if (Array.isArray(this.subtitles)) {
      this.subtitles.forEach(sub => {
        if (typeof sub.isEditing !== 'boolean') {
          sub.isEditing = false;
        }
      });
    }
  }
  tabWarning = '';

  switchTab(tab: 'timestamp' | 'script') {
    this.tabWarning = 'You are switching tabs. Please make sure to save or download your work before proceeding.';
    setTimeout(() => { this.tabWarning = ''; }, 0);
    this.activeTab = tab;
    // Move focus to the next tab button after switching
    setTimeout(() => {
      const tabButtons = document.querySelectorAll('.main-header-tab-btn');
      if (tabButtons && tabButtons.length > 0) {
        let idx = tab === 'timestamp' ? 0 : 1;
        (tabButtons[idx] as HTMLElement).focus();
      }
    }, 10);
  }
  previewDownloadType: string = 'txt';

  // Download the current preview (with any edits) as .srt or .txt
  downloadPreview(): void {
    // Compose SRT from the current subtitles array
    const subtitlesArr = Array.isArray(this.subtitles) ? this.subtitles : [];
    const ext = (this as any).previewDownloadType ? (this as any).previewDownloadType : 'srt';
    const baseName = this.previewFileName ? this.previewFileName.replace(/\.[^.]+$/, '') : 'subtitle';
    const downloadName = baseName + '.' + ext;
    if (ext === 'docx') {
      // Generate DOCX from subtitles
      const paragraphs: Paragraph[] = [];
      subtitlesArr.forEach((sub, idx) => {
        // Number, time, text as separate paragraphs for clarity
        paragraphs.push(new Paragraph({
          children: [
            new TextRun({ text: String(idx + 1), bold: true }),
            new TextRun({ text: '  ' }),
            new TextRun({ text: sub.start + ' --> ' + sub.end, italics: true, size: 20 })
          ]
        }));
        paragraphs.push(new Paragraph(sub.text));
        paragraphs.push(new Paragraph(''));
      });
      const doc = new Document({
        sections: [
          { properties: {}, children: paragraphs }
        ]
      });
      Packer.toBlob(doc).then(blob => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = downloadName;
        a.click();
        window.URL.revokeObjectURL(url);
      });
      return;
    }
    // Default: txt or srt
    let srt = subtitlesArr.map((sub, idx) => {
      return (
        (idx + 1) + '\n' +
        sub.start + ' --> ' + sub.end + '\n' +
        sub.text + '\n'
      );
    }).join('\n');
    // Remove trailing blank lines
    srt = srt.replace(/\n+$/g, '\n');
    const blob = new Blob([srt], {type: 'text/plain'});
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = downloadName;
    a.click();
    window.URL.revokeObjectURL(url);
  }






  // ...existing code...

  // ...existing code...



  // ...existing code...

  // ...existing code...

  convertedFiles: {name: string, content: string, errors?: any[], hasCriticalError?: boolean}[] = [];
  downloadType: string = 'txt';
  isDragOver = false;

  previewContent: string | null = null;
  previewFileName: string = '';
  previewErrorLines: Set<number> = new Set();

  subtitles: Array<{start: string, end: string, text: string, warning?: string, isEditing?: boolean}> = [];

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
    this.ensureSubtitleEditingFlags();
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

  convertSrtToMinSec(content: string): string {
    // Replace all hh:mm:ss,ms with mm:ss
    return content.replace(/(\d{2}):(\d{2}):(\d{2}),\d{3}/g, (match, hh, mm, ss) => {
      const totalMin = parseInt(hh) * 60 + parseInt(mm);
      return `${totalMin}:${ss}`;
    });
  }

  downloadFile(file: {name: string, content: string}) {
    let baseName = file.name.replace(/\.[^.]+$/, '');
    let downloadName = baseName + '.' + this.downloadType;
    if (this.downloadType === 'docx') {
      // Convert SRT or TXT to DOCX (same logic as preview)
      const paragraphs: Paragraph[] = [];
      // Try to parse as SRT: number, time, text blocks
      const srtBlockRegex = /((?:\d+\n)?\d{2}:\d{2}:\d{2},\d{3}\s+-->\s+\d{2}:\d{2}:\d{2},\d{3}\n(?:[^\n]*\n?)+?)(?=\n\d+\n\d{2}:|$)/g;
      let match;
      let found = false;
      while ((match = srtBlockRegex.exec(file.content)) !== null) {
        found = true;
        const block = match[1].trim();
        const lines = block.split(/\n/);
        if (lines.length >= 3) {
          paragraphs.push(new Paragraph({
            children: [
              new TextRun({ text: lines[0], bold: true }),
              new TextRun({ text: ' ' }),
              new TextRun({ text: lines[1], italics: true, size: 20 }),
            ],
          }));
          paragraphs.push(new Paragraph(lines.slice(2).join('\n')));
          paragraphs.push(new Paragraph(''));
        } else {
          paragraphs.push(new Paragraph(block));
          paragraphs.push(new Paragraph(''));
        }
      }
      if (!found) {
        // Plain text: one paragraph per line
        file.content.split(/\n/).forEach(line => {
          paragraphs.push(new Paragraph(line));
        });
      }
      const doc = new Document({
        sections: [
          { properties: {}, children: paragraphs }
        ]
      });
      Packer.toBlob(doc).then(blob => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = downloadName;
        a.click();
        window.URL.revokeObjectURL(url);
      });
      return;
    }
    // Default: txt or srt
    const blob = new Blob([file.content], {type: 'text/plain'});
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = downloadName;
    a.click();
    window.URL.revokeObjectURL(url);
  }

  deletedFiles: {name: string, content: string}[] = [];

  deleteFile(file: {name: string, content: string}) {
    this.convertedFiles = this.convertedFiles.filter(f => f !== file);
    this.deletedFiles.push(file);
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
    const docxPromises: Promise<void>[] = [];
    this.convertedFiles.forEach(file => {
      let baseName = file.name.replace(/\.[^.]+$/, '');
      let downloadName = baseName + '.' + this.downloadType;
      if (this.downloadType === 'docx') {
        // Convert SRT or TXT to DOCX (same logic as downloadFile)
        const paragraphs: Paragraph[] = [];
        const srtBlockRegex = /((?:\d+\n)?\d{2}:\d{2}:\d{2},\d{3}\s+-->\s+\d{2}:\d{2}:\d{2},\d{3}\n(?:[^\n]*\n?)+?)(?=\n\d+\n\d{2}:|$)/g;
        let match;
        let found = false;
        while ((match = srtBlockRegex.exec(file.content)) !== null) {
          found = true;
          const block = match[1].trim();
          const lines = block.split(/\n/);
          if (lines.length >= 3) {
            paragraphs.push(new Paragraph({
              children: [
                new TextRun({ text: lines[0], bold: true }),
                new TextRun({ text: ' ' }),
                new TextRun({ text: lines[1], italics: true, size: 20 }),
              ],
            }));
            paragraphs.push(new Paragraph(lines.slice(2).join('\n')));
            paragraphs.push(new Paragraph(''));
          } else {
            paragraphs.push(new Paragraph(block));
            paragraphs.push(new Paragraph(''));
          }
        }
        if (!found) {
          // Plain text: one paragraph per line
          file.content.split(/\n/).forEach(line => {
            paragraphs.push(new Paragraph(line));
          });
        }
        const doc = new Document({
          sections: [
            { properties: {}, children: paragraphs }
          ]
        });
        // Add to zip asynchronously
        const promise = Packer.toBlob(doc).then(blob => {
          zip.file(downloadName, blob);
        });
        docxPromises.push(promise);
      } else {
        // txt or srt
        zip.file(downloadName, file.content);
      }
    });
    if (this.downloadType === 'docx') {
      await Promise.all(docxPromises);
    }
    const content = await zip.generateAsync({ type: 'blob' });
    const url = window.URL.createObjectURL(content);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'converted-files.zip';
    a.click();
    window.URL.revokeObjectURL(url);
  }

  scriptFiles: {name: string, content: string, downloadType?: string}[] = [];
  scriptPreviewContent: string | null = null;
  scriptPreviewFileName: string = '';

  openScriptPreview(file: {name: string, content: string}) {
    this.scriptPreviewContent = file.content;
    this.scriptPreviewFileName = file.name;
  }

  closeScriptPreview() {
    this.scriptPreviewContent = null;
    this.scriptPreviewFileName = '';
  }

  onFileSelectedScript(event: any) {
    const files: FileList = event.target.files;
    Array.from(files).forEach(file => {
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (ext !== 'txt' && ext !== 'srt') {
        alert('Only .txt and .srt files are allowed for SRT to Script.');
        return;
      }
      const reader = new FileReader();
      reader.onload = (e: any) => {
        let text = e.target.result;
        // Convert SRT time format to mm:ss - mm:ss if present
        // Match lines like: 00:01:23,456 --> 00:01:25,789
        text = text.replace(/(\d{2}):(\d{2}):(\d{2}),\d{3}\s*-->\s*(\d{2}):(\d{2}):(\d{2}),\d{3}/g, (match, h1, m1, s1, h2, m2, s2) => {
          const startMin = (parseInt(h1) * 60 + parseInt(m1)).toString();
          const startSec = s1;
          const endMin = (parseInt(h2) * 60 + parseInt(m2)).toString();
          const endSec = s2;
          return `${startMin}:${startSec} - ${endMin}:${endSec}`;
        });
        this.scriptFiles.push({name: file.name, content: text, downloadType: 'txt'});
      };
      reader.readAsText(file);
    });
  }

  onDropScript(event: DragEvent) {
    event.preventDefault();
    this.isDragOver = false;
    if (event.dataTransfer && event.dataTransfer.files.length > 0) {
      const fileEvent = { target: { files: event.dataTransfer.files } };
      this.onFileSelectedScript(fileEvent);
    }
  }

  downloadScriptFile(file: {name: string, content: string}, type: string = 'txt') {
    let content = file.content;
    let name = file.name.replace(/\.[^.]+$/, '');
    if (type === 'minsec') {
      content = this.convertSrtToMinSec(content);
      name = name + '_minsec.txt';
    } else if (type === 'docx') {
      // Convert to DOCX
      const paragraphs: Paragraph[] = [];
      // Treat each line as a paragraph for script files
      content.split(/\n/).forEach(line => {
        paragraphs.push(new Paragraph(line));
      });
      const doc = new Document({
        sections: [
          { properties: {}, children: paragraphs }
        ]
      });
      Packer.toBlob(doc).then(blob => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = name + '.docx';
        a.click();
        window.URL.revokeObjectURL(url);
      });
      return;
    } else {
      name = name + '.' + type;
    }
    const blob = new Blob([content], {type: 'text/plain'});
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    window.URL.revokeObjectURL(url);
  }

  deleteScriptFile(file: {name: string, content: string}) {
    this.scriptFiles = this.scriptFiles.filter(f => f !== file);
  }

  scriptDownloadType: string = 'txt';

  async downloadAllScripts() {
    if (this.scriptFiles.length === 0) return;
    // Use the selected scriptDownloadType from the UI
    const type = this.scriptDownloadType || 'txt';
    const zip = new JSZip();
    const docxPromises: Promise<void>[] = [];
    this.scriptFiles.forEach(file => {
      let name = file.name.replace(/\.[^.]+$/, '');
      if (type === 'mmss') {
        const content = this.convertSrtToMinSec(file.content);
        zip.file(name + '_minsec.txt', content);
      } else if (type === 'docx') {
        const paragraphs: Paragraph[] = [];
        file.content.split(/\n/).forEach(line => {
          paragraphs.push(new Paragraph(line));
        });
        const doc = new Document({
          sections: [
            { properties: {}, children: paragraphs }
          ]
        });
        const promise = Packer.toBlob(doc).then(blob => {
          zip.file(name + '.docx', blob);
        });
        docxPromises.push(promise);
      } else {
        zip.file(name + '.' + type, file.content);
      }
    });
    if (type === 'docx') {
      await Promise.all(docxPromises);
    }
    const content = await zip.generateAsync({ type: 'blob' });
    const url = window.URL.createObjectURL(content);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'script-files.zip';
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

  activeTab: string = 'timestamp';

  // Keyboard navigation for tab buttons
  onTabKeydown(event: KeyboardEvent, tab: 'timestamp' | 'script') {
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      const nextTab = tab === 'timestamp' ? 'script' : 'timestamp';
      this.switchTab(nextTab);
    }
  }
}

