import test, { describe, it, before, after, beforeEach } from 'node:test';
import * as assert from 'node:assert/strict';
import * as http from 'node:http';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { VibeCodingEngine } from '../core/vibecoding-engine.js';
import { SandboxEngine } from '../core/sandbox-engine.js';
import { ModelClient } from '../core/model-client.js';

describe('Unit Test: VibeCodingEngine Live Generation & Sandboxed Assets', () => {
  let server: http.Server;
  let serverPort: number;
  let responseMode: 'valid_json' | 'raw_html' | 'corrupted' = 'valid_json';

  let testDir: string;
  let sandbox: SandboxEngine;
  let modelClient: ModelClient;

  before(async () => {
    server = http.createServer((req, res) => {
      if (req.method === 'POST' && req.url?.includes('/chat/completions')) {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
        });

        if (responseMode === 'valid_json') {
          const appPayload = JSON.stringify({
            html: '<!DOCTYPE html><html><head><title>Telemetry Dashboard</title></head><body><h1>Sensor Online</h1><div id="chart"></div></body></html>',
            css: 'body { font-family: sans-serif; background: #0f172a; color: #fff; }',
            js: 'console.log("Telemetry Dashboard initialized");'
          });
          res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: '```json\n' + appPayload + '\n```' } }] })}\n\n`);
          res.write('data: [DONE]\n\n');
          res.end();
        } else if (responseMode === 'raw_html') {
          const rawHtml = '<!DOCTYPE html><html><head><title>Raw App</title></head><body><h1>Raw Standalone HTML</h1></body></html>';
          res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: rawHtml } }] })}\n\n`);
          res.write('data: [DONE]\n\n');
          res.end();
        } else if (responseMode === 'corrupted') {
          res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: 'I cannot write this code due to constraints.' } }] })}\n\n`);
          res.write('data: [DONE]\n\n');
          res.end();
        }
      } else {
        res.writeHead(404);
        res.end();
      }
    });

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const addr = server.address() as any;
        serverPort = addr.port;
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  beforeEach(() => {
    testDir = path.join(process.cwd(), 'workspace', 'test_vibe_' + Date.now() + Math.random().toString(36).slice(2, 6));
    fs.mkdirSync(testDir, { recursive: true });

    sandbox = new SandboxEngine(path.join(testDir, 'sandbox'));
    modelClient = new ModelClient();
    modelClient.updateConfig({
      baseUrl: `http://127.0.0.1:${serverPort}/v1`,
      apiKey: 'sk-vibecoding-key',
      model: 'chat-vibe'
    });
  });

  it('13.1 should enforce Zero-Mock invariant and throw when modelClient or apiKey is missing', async () => {
    const emptyModelClient = new ModelClient();
    emptyModelClient.updateConfig({ apiKey: '' });

    const engineWithoutKey = new VibeCodingEngine(sandbox, emptyModelClient);
    await assert.rejects(
      () => engineWithoutKey.generateWebApp('sess_1', 'SensorDash', '实时传感器监控'),
      /必须配置大模型端点与 API Key/
    );
  });

  it('13.2 should generate web app from model response and write files inside sandbox', async () => {
    responseMode = 'valid_json';
    const engine = new VibeCodingEngine(sandbox, modelClient);

    const project = await engine.generateWebApp('sess_2', 'MotorDashboard', '电机运行转速与温升遥测看板');

    assert.ok(project.id);
    assert.equal(project.name, 'MotorDashboard');
    assert.ok(project.projectDir.includes('MotorDashboard'));
    assert.ok(project.previewUrl.includes('/preview/sess_2/MotorDashboard/index.html'));

    assert.equal(project.files.length, 3);
    const htmlFile = project.files.find(f => f.relativePath === 'index.html');
    assert.ok(htmlFile);
    assert.ok(htmlFile.content.includes('Sensor Online'));

    // Verify physical files on disk in sandbox
    const diskHtml = path.join(project.projectDir, 'index.html');
    const diskCss = path.join(project.projectDir, 'style.css');
    const diskJs = path.join(project.projectDir, 'app.js');

    assert.ok(fs.existsSync(diskHtml));
    assert.ok(fs.existsSync(diskCss));
    assert.ok(fs.existsSync(diskJs));
    assert.equal(fs.readFileSync(diskHtml, 'utf-8'), htmlFile.content);
  });

  it('13.3 should retrieve generated project by ID', async () => {
    responseMode = 'valid_json';
    const engine = new VibeCodingEngine(sandbox, modelClient);

    const created = await engine.generateWebApp('sess_3', 'QualityInspector', '产线视觉缺陷检测');
    const retrieved = engine.getProject(created.id);

    assert.ok(retrieved);
    assert.equal(retrieved.name, 'QualityInspector');
    assert.equal(retrieved.id, created.id);
  });

  it('13.4 should fallback cleanly when model outputs pure raw HTML', async () => {
    responseMode = 'raw_html';
    const engine = new VibeCodingEngine(sandbox, modelClient);

    const project = await engine.generateWebApp('sess_4', 'RawHtmlViewer', '生成单文件页面');
    assert.ok(project);

    const htmlFile = project.files.find(f => f.relativePath === 'index.html');
    assert.ok(htmlFile);
    assert.ok(htmlFile.content.includes('Raw Standalone HTML'));
  });

  it('13.5 should reject when model output cannot be parsed into valid web app code', async () => {
    responseMode = 'corrupted';
    const engine = new VibeCodingEngine(sandbox, modelClient);

    await assert.rejects(
      () => engine.generateWebApp('sess_5', 'BadApp', '异常测试'),
      /未包含合法 JSON 或 HTML 应用代码/
    );
  });
});
