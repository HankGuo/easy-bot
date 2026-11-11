import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { SandboxEngine } from './sandbox-engine.js';

const execFileAsync = promisify(execFile);

export interface ScreenCaptureResult {
  filePath: string;
  timestamp: string;
  width?: number;
  height?: number;
  base64Preview?: string;
  platform: string;
}

/**
 * Screen Perception & Desktop Action Engine
 * Native, cross-platform, non-invasive screen perception service
 */
export class ScreenPerceptionEngine {
  private sandbox: SandboxEngine;

  constructor(sandbox: SandboxEngine) {
    this.sandbox = sandbox;
  }

  /**
   * Captures screen safely into the session's isolated workspace
   */
  public async captureScreen(sessionId: string): Promise<ScreenCaptureResult> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `screenshot-${timestamp}.png`;
    const fullPath = this.sandbox.validatePathAccess(sessionId, path.join('screenshots', filename), 'WRITE');

    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const platform = os.platform();

    try {
      if (platform === 'darwin') {
        // macOS native screencapture CLI (-x: silent without shutter sound)
        await execFileAsync('/usr/sbin/screencapture', ['-x', fullPath]);
      } else if (platform === 'linux') {
        // Linux import / scrot
        await execFileAsync('import', ['-window', 'root', fullPath]);
      } else if (platform === 'win32') {
        // Windows PowerShell System.Drawing capture
        const psScript = `
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$bmp = New-Object System.Drawing.Bitmap $bounds.Width, $bounds.Height
$graphics = [System.Drawing.Graphics]::FromImage($bmp)
$graphics.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size)
$bmp.Save('${fullPath}', [System.Drawing.Imaging.ImageFormat]::Png)
$graphics.Dispose()
$bmp.Dispose()
`;
        await execFileAsync('powershell', ['-NoProfile', '-Command', psScript]);
      } else {
        throw new Error(`屏幕感知服务不支持当前操作系统平台: ${process.platform}`);
      }
    } catch (err: any) {
      throw new Error(`屏幕感知抓取失败: ${err.message}`);
    }

    // Read base64 thumbnail
    let base64Preview: string | undefined;
    if (fs.existsSync(fullPath)) {
      const buf = fs.readFileSync(fullPath);
      // If image is reasonably sized, generate data URL
      if (buf.length < 5 * 1024 * 1024) {
        base64Preview = `data:image/png;base64,${buf.toString('base64')}`;
      }
    }

    return {
      filePath: fullPath,
      timestamp: new Date().toISOString(),
      platform,
      base64Preview
    };
  }
}
