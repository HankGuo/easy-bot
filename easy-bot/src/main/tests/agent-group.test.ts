import test, { describe, it, before, after, beforeEach } from 'node:test';
import * as assert from 'node:assert/strict';
import * as http from 'node:http';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { AgentGroupCoordinator } from '../core/agent-group.js';
import { AgentRouter } from '../core/agent-router.js';
import { SandboxEngine } from '../core/sandbox-engine.js';
import { HybridRAGEngine } from '../core/hybrid-rag.js';
import { MCPHostManager } from '../core/mcp-host.js';
import { ModelClient } from '../core/model-client.js';

describe('Unit Test: AgentGroupCoordinator Multi-Agent Consensus Pipeline', () => {
  let server: http.Server;
  let serverPort: number;
  let coderMode: 'json' | 'text' = 'json';

  let testDir: string;
  let sandbox: SandboxEngine;
  let router: AgentRouter;
  let modelClient: ModelClient;

  before(async () => {
    server = http.createServer((req, res) => {
      if (req.method === 'POST' && req.url?.includes('/chat/completions')) {
        let bodyStr = '';
        req.on('data', chunk => { bodyStr += chunk; });
        req.on('end', () => {
          let systemPrompt = '';
          try {
            const parsed = JSON.parse(bodyStr);
            systemPrompt = parsed.messages?.[0]?.content || '';
          } catch {}

          res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
          });

          let reply = '完成任务';
          if (systemPrompt.includes('Reviewer') || systemPrompt.includes('审计质检官')) {
            reply = '验收结论：通过安全基线审计，无高危提权风险。';
          } else if (systemPrompt.includes('Supervisor') || systemPrompt.includes('项目主管')) {
            reply = '项目目标拆解：1.微沙箱隔离 2.向量检索引擎 3.协议适配';
          } else if (systemPrompt.includes('Architect') || systemPrompt.includes('系统架构师')) {
            reply = '技术选型方案：微内核驱动，采用 Node 20 沙箱隔离与 WeKnora 混合检索。';
          } else if (systemPrompt.includes('Coder') || systemPrompt.includes('研发工程师')) {
            if (coderMode === 'json') {
              reply = JSON.stringify({ task: 'core_impl', architecture: 'microvm', deliverables: ['engine.js'], status: 'PRODUCED' });
            } else {
              reply = '无法格式化为 JSON 的文本成果说明';
            }
          } else {
            reply = `Fallback: ${systemPrompt.slice(0, 50)}`;
          }

          res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: reply } }] })}\n\n`);
          res.write('data: [DONE]\n\n');
          res.end();
        });
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
    testDir = path.join(process.cwd(), 'workspace', 'test_group_' + Date.now() + Math.random().toString(36).slice(2, 6));
    fs.mkdirSync(testDir, { recursive: true });

    sandbox = new SandboxEngine(path.join(testDir, 'sandbox'));
    const rag = new HybridRAGEngine();
    const mcp = new MCPHostManager();
    router = new AgentRouter(sandbox, rag, mcp);

    modelClient = new ModelClient();
    modelClient.updateConfig({
      baseUrl: `http://127.0.0.1:${serverPort}/v1`,
      apiKey: 'sk-group-test-key',
      model: 'chat-group'
    });
  });

  it('16.1 should enforce Zero-Mock invariant and throw when modelClient is not configured or missing apiKey', async () => {
    const unconfiguredModel = new ModelClient();
    unconfiguredModel.updateConfig({ apiKey: '' });

    const coordinator = new AgentGroupCoordinator(sandbox, router, unconfiguredModel);
    await assert.rejects(
      () => coordinator.runCollaboration('sess_1', '设计微沙箱多租户方案'),
      /必须配置有效大模型 API Key/
    );
  });

  it('16.2 should execute 4-agent collaborative consensus pipeline and return structured deliverable', async () => {
    coderMode = 'json';
    const coordinator = new AgentGroupCoordinator(sandbox, router, modelClient);

    const result = await coordinator.runCollaboration('sess_2', '企业协同平台架构落地');

    assert.equal(result.status, 'COMPLETED');
    assert.equal(result.task, '企业协同平台架构落地');
    assert.ok(result.groupId.startsWith('group-'));
    assert.ok(result.totalDurationMs >= 0);

    // Verify 4-agent conversation sequence
    assert.equal(result.conversation.length, 4);
    assert.equal(result.conversation[0].senderRole, 'SUPERVISOR');
    assert.equal(result.conversation[1].senderRole, 'ARCHITECT');
    assert.equal(result.conversation[2].senderRole, 'CODER');
    assert.equal(result.conversation[3].senderRole, 'REVIEWER');

    assert.ok(result.finalDeliverable.includes('多智能体集群协作执行完毕'));
    assert.ok(result.conversation[3].content.includes('验收结论：通过安全基线审计'));

    // Check sandboxed deliverable file
    const deliverablePath = path.join(sandbox.getSessionWorkspace('sess_2'), 'agent_group_result.json');
    assert.ok(fs.existsSync(deliverablePath));
    const parsedFile = JSON.parse(fs.readFileSync(deliverablePath, 'utf-8'));
    assert.equal(parsedFile.architecture, 'microvm');
  });

  it('16.3 should handle JSON parsing fallback gracefully when coder outputs raw text', async () => {
    coderMode = 'text';
    const coordinator = new AgentGroupCoordinator(sandbox, router, modelClient);

    const result = await coordinator.runCollaboration('sess_3', '编写部署文档');

    assert.equal(result.status, 'COMPLETED');
    assert.equal(result.conversation.length, 4);
    assert.ok(result.conversation[2].content.includes('核心实现已完成'));
  });

  it('16.4 should verify all 4 team members have unique roles and names', async () => {
    coderMode = 'json';
    const coordinator = new AgentGroupCoordinator(sandbox, router, modelClient);

    const result = await coordinator.runCollaboration('sess_4', '安全巡检测试');
    const roles = result.conversation.map(m => m.senderRole);
    assert.deepEqual(roles, ['SUPERVISOR', 'ARCHITECT', 'CODER', 'REVIEWER']);
  });

  it('16.5 should ensure sandbox audit log records deliverable write event', async () => {
    coderMode = 'json';
    const coordinator = new AgentGroupCoordinator(sandbox, router, modelClient);

    await coordinator.runCollaboration('sess_5', '审计日志生成验证');
    const logs = sandbox.getAuditLogs('sess_5');
    assert.ok(logs.some(l => l.targetPath?.includes('agent_group_result.json') && l.status === 'ALLOWED'));
  });
});
