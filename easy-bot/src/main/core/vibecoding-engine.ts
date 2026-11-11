import * as path from 'node:path';
import * as fs from 'node:fs';
import * as crypto from 'node:crypto';
import { SandboxEngine } from './sandbox-engine.js';
import { ModelClient } from './model-client.js';

export interface VibeAppFile {
  relativePath: string;
  content: string;
  sizeBytes: number;
}

export interface VibeAppProject {
  id: string;
  name: string;
  description: string;
  projectDir: string;
  previewUrl: string;
  createdAt: string;
  updatedAt: string;
  files: VibeAppFile[];
}

/**
 * VibeCoding Engine
 * Natural-language driven instant Web Application creation with isolated workspace hosting and live sandboxed preview
 */
export class VibeCodingEngine {
  private sandbox: SandboxEngine;
  private modelClient?: ModelClient;
  private projects: Map<string, VibeAppProject> = new Map();
  private basePreviewUrl: string;

  constructor(sandbox: SandboxEngine, modelClient?: ModelClient, port: number = 4100) {
    this.sandbox = sandbox;
    this.modelClient = modelClient;
    this.basePreviewUrl = `http://127.0.0.1:${port}/preview`;
  }

  public async generateWebApp(
    sessionId: string,
    appName: string,
    prompt: string
  ): Promise<VibeAppProject> {
    const projectId = 'app-' + crypto.randomUUID().slice(0, 8);
    const cleanName = appName.replace(/[^a-zA-Z0-9_\-]/g, '_') || 'webapp';
    
    // Validate target project path in sandbox
    const sessionDir = this.sandbox.getSessionWorkspace(sessionId);
    const projectRelDir = path.join('projects', cleanName);
    const fullProjectDir = this.sandbox.validatePathAccess(sessionId, projectRelDir, 'WRITE');

    if (!fs.existsSync(fullProjectDir)) {
      fs.mkdirSync(fullProjectDir, { recursive: true });
    }

    let indexHtml = '';
    let styleCss = '';
    let appJs = '';

    // If ModelClient is available with configured API Key, generate real application code dynamically
    if (this.modelClient && this.modelClient.getConfig().apiKey && this.modelClient.getConfig().provider !== 'mock') {
      try {
        const rawResponse = await this.modelClient.chat([
          {
            role: 'system',
            content: `You are EasyBot VibeCoding AI Engine.
Generate a complete, fully-functional, self-contained single-page web application based on the user's requirements.
CRITICAL FORMAT REQUIREMENT:
Respond with ONLY a raw JSON object (no markdown backticks, no explanations) containing exactly three string fields:
{
  "html": "<complete index.html code with Tailwind CSS script tag <script src=\\"https://cdn.tailwindcss.com\\"></script>, link to style.css and script app.js>",
  "css": "<clean custom css rules>",
  "js": "<complete, interactive JavaScript code with event listeners and state management>"
}
Requirements:
1. Provide a modern, clean, production-grade layout.
2. Implement real domain-specific interactive features (e.g. data filters, calculated KPIs, state toggles, charts/visuals).
3. Ensure the JavaScript handles DOM events reliably.`
          },
          {
            role: 'user',
            content: `Application Name: ${appName}\nUser Requirements: ${prompt}`
          }
        ]);

        const cleaned = rawResponse.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
        const parsed = JSON.parse(cleaned);
        if (parsed.html && typeof parsed.html === 'string') {
          indexHtml = parsed.html;
          styleCss = parsed.css || '/* VibeCoding Custom CSS */\n';
          appJs = parsed.js || '// VibeCoding Custom JS\n';
        }
      } catch (err: any) {
        console.warn('[VibeCoding] Model generation error or JSON parse failure, using structured fallback:', err.message);
      }
    }

    // Dynamic fallback scaffold if offline or model unavailable
    if (!indexHtml) {
      indexHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${appName} - EasyBot VibeCoding</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="style.css">
</head>
<body class="bg-slate-900 text-slate-100 min-h-screen flex flex-col font-sans">
  <header class="border-b border-slate-800 bg-slate-950/60 backdrop-blur px-6 py-4 flex items-center justify-between">
    <div class="flex items-center gap-3">
      <div class="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center font-bold">
        ⚡
      </div>
      <div>
        <h1 class="text-base font-bold text-slate-100">${appName}</h1>
        <p class="text-xs text-slate-400">EasyBot VibeCoding 离线运行容器</p>
      </div>
    </div>
    <span class="px-2.5 py-1 rounded-full text-xs font-mono bg-emerald-950 text-emerald-400 border border-emerald-800">
      SANDBOX PREVIEW
    </span>
  </header>

  <main class="flex-1 max-w-5xl w-full mx-auto p-6 space-y-6">
    <div class="p-6 bg-slate-950 border border-slate-800 rounded-2xl shadow-xl space-y-4">
      <div class="flex items-center justify-between">
        <h2 class="text-sm font-semibold text-slate-300">自然语言需求规格</h2>
        <span class="text-xs text-slate-500">生成时间: ${new Date().toLocaleTimeString()}</span>
      </div>
      <p class="text-sm text-slate-400 bg-slate-900/60 p-4 rounded-xl border border-slate-800/80 font-mono">
        ${prompt}
      </p>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
        <div class="p-4 bg-slate-900/80 border border-slate-800 rounded-xl space-y-1">
          <div class="text-xs text-slate-400">隔离工作区</div>
          <div class="text-lg font-bold text-emerald-400">${cleanName}</div>
          <div class="text-[11px] text-slate-500">会话目录独立承载</div>
        </div>
        <div class="p-4 bg-slate-900/80 border border-slate-800 rounded-xl space-y-1">
          <div class="text-xs text-slate-400">运行模式</div>
          <div class="text-lg font-bold text-blue-400">Micro-Workspace</div>
          <div class="text-[11px] text-slate-500">本地受控预览</div>
        </div>
        <div class="p-4 bg-slate-900/80 border border-slate-800 rounded-xl space-y-1">
          <div class="text-xs text-slate-400">状态</div>
          <div class="text-lg font-bold text-purple-400">Mounted</div>
          <div class="text-[11px] text-slate-500">静态资源就绪</div>
        </div>
      </div>
    </div>
  </main>

  <footer class="border-t border-slate-800 py-4 text-center text-xs text-slate-500">
    EasyBot VibeCoding Runtime · 本地微沙箱容器
  </footer>

  <script src="app.js"></script>
</body>
</html>`;

      styleCss = `/* EasyBot VibeCoding Generated Stylesheet */
body {
  font-family: system-ui, -apple-system, sans-serif;
}
`;

      appJs = `// EasyBot VibeCoding Interactive Script
document.addEventListener('DOMContentLoaded', () => {
  console.log('[EasyBot VibeApp] Initialized successfully inside sandboxed preview container.');
});
`;
    }

    const files: VibeAppFile[] = [
      { relativePath: 'index.html', content: indexHtml, sizeBytes: Buffer.byteLength(indexHtml) },
      { relativePath: 'style.css', content: styleCss, sizeBytes: Buffer.byteLength(styleCss) },
      { relativePath: 'app.js', content: appJs, sizeBytes: Buffer.byteLength(appJs) }
    ];

    // Write all files to disk in sandboxed directory
    for (const f of files) {
      const filePath = path.join(fullProjectDir, f.relativePath);
      fs.writeFileSync(filePath, f.content, 'utf-8');
    }

    const previewUrl = `${this.basePreviewUrl}/${sessionId}/${cleanName}/index.html`;

    const project: VibeAppProject = {
      id: projectId,
      name: appName,
      description: prompt,
      projectDir: fullProjectDir,
      previewUrl,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      files
    };

    this.projects.set(projectId, project);
    return project;
  }

  public getProject(id: string): VibeAppProject | undefined {
    return this.projects.get(id);
  }

  public listProjects(): VibeAppProject[] {
    return Array.from(this.projects.values());
  }
}
