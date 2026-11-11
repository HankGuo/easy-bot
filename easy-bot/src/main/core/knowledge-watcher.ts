import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { HybridRAGEngine } from './hybrid-rag';

export interface WatcherStatus {
  watchDir: string;
  totalIndexedFiles: number;
  files: {
    filename: string;
    documentId: string;
    size: number;
    updatedAt: string;
  }[];
  lastSyncTime: string;
}

export class KnowledgeDropWatcher {
  private watchDir: string;
  private rag: HybridRAGEngine;
  private fileHashes: Map<string, string> = new Map(); // filename -> sha256
  private fileDocIds: Map<string, string> = new Map();  // filename -> documentId
  private fsWatcher: fs.FSWatcher | null = null;
  private isScanning: boolean = false;
  private lastSyncTime: string = new Date().toISOString();

  constructor(watchDir: string, rag: HybridRAGEngine) {
    this.watchDir = path.resolve(watchDir);
    this.rag = rag;

    if (!fs.existsSync(this.watchDir)) {
      fs.mkdirSync(this.watchDir, { recursive: true });
    }
  }

  /**
   * Start watching the drop folder and do an initial scan
   */
  public start(): void {
    this.sync();

    try {
      this.fsWatcher = fs.watch(this.watchDir, (eventType, filename) => {
        if (!filename || filename.startsWith('.')) return;
        // Debounce scan
        setTimeout(() => this.sync(), 300);
      });
    } catch (err: any) {
      console.warn(`[KnowledgeDropWatcher] Warning: fs.watch error on ${this.watchDir}:`, err.message);
    }
  }

  public stop(): void {
    if (this.fsWatcher) {
      this.fsWatcher.close();
      this.fsWatcher = null;
    }
  }

  /**
   * Scan watchDir, index new/modified files, unindex deleted files
   */
  public sync(): { added: string[]; updated: string[]; removed: string[] } {
    if (this.isScanning) return { added: [], updated: [], removed: [] };
    this.isScanning = true;

    const added: string[] = [];
    const updated: string[] = [];
    const removed: string[] = [];

    try {
      if (!fs.existsSync(this.watchDir)) {
        fs.mkdirSync(this.watchDir, { recursive: true });
      }

      const currentFiles = fs.readdirSync(this.watchDir).filter(f => !f.startsWith('.'));
      const supportedExtensions = ['.txt', '.md', '.json', '.csv', '.log', '.pdf', '.docx', '.xlsx'];

      // 1. Check for removed files
      for (const [trackedFilename, docId] of this.fileDocIds.entries()) {
        if (!currentFiles.includes(trackedFilename)) {
          this.rag.removeDocument(docId);
          this.fileHashes.delete(trackedFilename);
          this.fileDocIds.delete(trackedFilename);
          removed.push(trackedFilename);
        }
      }

      // 2. Process existing files
      for (const filename of currentFiles) {
        const fullPath = path.join(this.watchDir, filename);
        const stat = fs.statSync(fullPath);
        if (!stat.isFile()) continue;

        const ext = path.extname(filename).toLowerCase();
        if (!supportedExtensions.includes(ext)) {
          continue;
        }

        try {
          const rawBuffer = fs.readFileSync(fullPath);
          const hash = crypto.createHash('sha256').update(rawBuffer).digest('hex');
          const prevHash = this.fileHashes.get(filename);
          const docId = `drop-${path.parse(filename).name.replace(/[^a-zA-Z0-9_\u4e00-\u9fa5]/g, '_')}`;

          if (!prevHash || prevHash !== hash) {
            if (prevHash) {
              this.rag.removeDocument(docId);
            }

            if (ext === '.pdf') {
              this.rag.addPdfDocument(docId, filename, rawBuffer);
            } else if (ext === '.docx') {
              this.rag.addWordDocument(docId, filename, rawBuffer);
            } else if (ext === '.xlsx') {
              this.rag.addExcelDocument(docId, filename, rawBuffer);
            } else {
              const content = rawBuffer.toString('utf-8');
              this.rag.addDocument(docId, filename, content);
            }

            this.fileHashes.set(filename, hash);
            this.fileDocIds.set(filename, docId);

            if (!prevHash) {
              added.push(filename);
            } else {
              updated.push(filename);
            }
          }
        } catch (e: any) {
          console.error(`[KnowledgeDropWatcher] Failed to process ${filename}:`, e.message);
        }
      }

      this.lastSyncTime = new Date().toISOString();
    } finally {
      this.isScanning = false;
    }

    return { added, updated, removed };
  }

  public getStatus(): WatcherStatus {
    const filesList: WatcherStatus['files'] = [];
    if (fs.existsSync(this.watchDir)) {
      for (const [filename, docId] of this.fileDocIds.entries()) {
        const fullPath = path.join(this.watchDir, filename);
        if (fs.existsSync(fullPath)) {
          const stat = fs.statSync(fullPath);
          filesList.push({
            filename,
            documentId: docId,
            size: stat.size,
            updatedAt: stat.mtime.toISOString()
          });
        }
      }
    }

    return {
      watchDir: this.watchDir,
      totalIndexedFiles: filesList.length,
      files: filesList,
      lastSyncTime: this.lastSyncTime
    };
  }

  public saveAndIndexFile(
    filename: string,
    content: string | Buffer,
    spaceId: string = 'public',
    ownerGroupId?: string
  ): { success: boolean; documentId: string } {
    const safeName = path.basename(filename);
    const targetPath = path.join(this.watchDir, safeName);
    const ext = path.extname(safeName).toLowerCase();

    if (Buffer.isBuffer(content)) {
      fs.writeFileSync(targetPath, content);
    } else if (typeof content === 'string') {
      if (['.pdf', '.docx', '.xlsx'].includes(ext) && content.includes('base64,')) {
        const base64Data = content.split('base64,').pop()!;
        fs.writeFileSync(targetPath, Buffer.from(base64Data, 'base64'));
      } else {
        fs.writeFileSync(targetPath, content, 'utf-8');
      }
    }

    const docId = `drop-${path.parse(safeName).name.replace(/[^a-zA-Z0-9_\u4e00-\u9fa5]/g, '_')}`;
    const rawBuffer = fs.readFileSync(targetPath);

    if (ext === '.pdf') {
      this.rag.addPdfDocument(docId, safeName, rawBuffer, 300, 50, spaceId, ownerGroupId);
    } else if (ext === '.docx') {
      this.rag.addWordDocument(docId, safeName, rawBuffer, 300, 50, spaceId, ownerGroupId);
    } else if (ext === '.xlsx') {
      this.rag.addExcelDocument(docId, safeName, rawBuffer, 300, 50, spaceId, ownerGroupId);
    } else {
      this.rag.addDocument(docId, safeName, rawBuffer.toString('utf-8'), 300, 50, undefined, spaceId, ownerGroupId);
    }

    const hash = crypto.createHash('sha256').update(rawBuffer).digest('hex');
    this.fileHashes.set(safeName, hash);
    this.fileDocIds.set(safeName, docId);

    return { success: true, documentId: docId };
  }

  public deleteFile(docIdOrFilename: string): boolean {
    let targetFilename: string | undefined;
    for (const [fn, docId] of this.fileDocIds.entries()) {
      if (fn === docIdOrFilename || docId === docIdOrFilename) {
        targetFilename = fn;
        break;
      }
    }

    if (targetFilename) {
      const fullPath = path.join(this.watchDir, targetFilename);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
      this.sync();
      return true;
    }
    return false;
  }
}
