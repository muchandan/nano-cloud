import fs from 'fs/promises';
import path from 'path';

export class StorageManager {
  constructor(baseDir) {
    this.baseDir = path.resolve(baseDir);
  }

  async init() {
    await fs.mkdir(this.baseDir, { recursive: true });
    console.log(`[Storage] Sandboxed environment active at: ${this.baseDir}`);
  }

  _getSafePath(fileName) {
    const safeName = path.basename(fileName);
    return path.join(this.baseDir, safeName);
  }

  async listFiles() {
    const rawFiles = await fs.readdir(this.baseDir);
    const enriched = [];

    for (const name of rawFiles) {
      try {
        const stats = await fs.stat(path.join(this.baseDir, name));
        enriched.push({
          name,
          sizeKb: (stats.size / 1024).toFixed(1),
          modified: stats.mtime.toISOString(),
          isText: /\.(txt|json|js|md|log|env|yml|yaml|css|html)$/i.test(name),
          isImage: /\.(png|jpe?g|gif|webp|svg)$/i.test(name)
        });
      } catch {
        enriched.push({ name, sizeKb: '0.0', modified: new Date().toISOString(), isText: false, isImage: false });
      }
    }

    return enriched;
  }


  // Live Sandbox + Host Physical Disk Stats
  async getStorageStats() {
    try {
      const files = await fs.readdir(this.baseDir);
      let totalBytes = 0;
      for (const file of files) {
        const stat = await fs.stat(path.join(this.baseDir, file));
        totalBytes += stat.size;
      }

      // Query partition disk blocks (Termux & OS safe)
      let diskInfo = { totalGb: '0.0', freeGb: '0.0', usedPercent: 0 };
      try {
        if (fs.statfs) {
          const stats = await fs.statfs(this.baseDir);
          const totalDiskBytes = Number(stats.blocks) * Number(stats.bsize);
          const freeDiskBytes = Number(stats.bavail) * Number(stats.bsize);
          const usedDiskBytes = totalDiskBytes - freeDiskBytes;

          if (totalDiskBytes > 0) {
            // Using 1e9 (Decimal GB) to match Android/macOS Settings apps
            diskInfo = {
              totalGb: (totalDiskBytes / 1e9).toFixed(1),
              freeGb: (freeDiskBytes / 1e9).toFixed(1),
              usedPercent: Math.round((usedDiskBytes / totalDiskBytes) * 100)
            };
          }
        }
      } catch (err) {
        // Fallback for filesystems without statfs support
      }


      return {
        fileCount: files.length,
        sandboxUsedMb: (totalBytes / (1024 * 1024)).toFixed(2),
        disk: diskInfo
      };
    } catch {
      return { 
        fileCount: 0, 
        sandboxUsedMb: '0.00', 
        disk: { totalGb: '0.0', freeGb: '0.0', usedPercent: 0 } 
      };
    }
  }

  async saveFile(fileName, base64Data) {
    const buffer = Buffer.from(base64Data, 'base64');
    await fs.writeFile(this._getSafePath(fileName), buffer);
  }

  async readFile(fileName) {
    const buffer = await fs.readFile(this._getSafePath(fileName));
    return buffer.toString('base64');
  }

  async deleteFile(fileName) {
    await fs.unlink(this._getSafePath(fileName));
  }
}

