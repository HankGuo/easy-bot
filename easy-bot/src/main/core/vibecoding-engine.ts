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

    if (!this.modelClient || !this.modelClient.getConfig().apiKey) {
      throw new Error('VibeCoding 应用生成失败: 必须配置大模型端点与 API Key 以动态实时编写 Web 应用代码。已彻底移除所有预制静态模板（Zero-Mock 准则生效）。');
    }

    let indexHtml = '';
    let styleCss = '';
    let appJs = '';

    const rawResponse = await this.modelClient.chat([
      {
        role: 'system',
        content: `You are EasyBot VibeCoding AI Engine.
Generate a concise, complete, fully-functional single-page web application based on the user's requirements.
CRITICAL INSTRUCTION: Respond directly with ONLY a raw JSON object (no markdown backticks, no preamble, no explanations) containing exactly three string fields:
{
  "html": "<concise index.html with Tailwind CDN script and basic UI layout>",
  "css": "<clean custom css rules>",
  "js": "<interactive JavaScript code with DOM event listeners>"
}`
      },
      {
        role: 'user',
        content: `Application Name: ${appName}\nRequirements: ${prompt}. Keep it clean and concise.`
      }
    ]);

    let cleaned = rawResponse.trim();
    const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (codeBlockMatch) {
      cleaned = codeBlockMatch[1].trim();
    } else {
      const firstBrace = cleaned.indexOf('{');
      const lastBrace = cleaned.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace > firstBrace) {
        cleaned = cleaned.substring(firstBrace, lastBrace + 1);
      }
    }

    let parsed: any;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      if (rawResponse.includes('<html') || rawResponse.includes('<!DOCTYPE')) {
        parsed = {
          html: rawResponse.replace(/```(?:html)?/g, '').trim(),
          css: '/* Custom Styles */',
          js: '// Interactive Script'
        };
      } else {
        throw new Error(`大模型输出未包含合法 JSON 或 HTML 应用代码: ${rawResponse.slice(0, 150)}`);
      }
    }

    if (!parsed.html || typeof parsed.html !== 'string') {
      throw new Error('大模型未按规范生成完整的 Web 应用 HTML 代码。');
    }

    indexHtml = parsed.html;
    styleCss = parsed.css || '/* VibeCoding Custom CSS */\n';
    appJs = parsed.js || '// VibeCoding Custom JS\n';

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
