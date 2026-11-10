import test from 'node:test';
import * as assert from 'node:assert/strict';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { SandboxEngine } from '../core/sandbox-engine.js';
import { HybridRAGEngine } from '../core/hybrid-rag.js';
import { MCPHostManager } from '../core/mcp-host.js';
import { AgentRouter } from '../core/agent-router.js';
import { WorkflowEngine } from '../core/workflow-engine.js';
import { VibeCodingEngine } from '../core/vibecoding-engine.js';
import { ScreenPerceptionEngine } from '../core/screen-perception.js';
import { SkillLoader } from '../core/skill-loader.js';
import { AgentGroupCoordinator } from '../core/agent-group.js';

test('1. Sandbox Isolation & Path Traversal Block', () => {
  const tmpWorkspace = path.join(process.cwd(), 'tmp_test_ws_1');
  const sandbox = new SandboxEngine(tmpWorkspace);
  const sessionId = 'test-session-001';

  const legit = sandbox.validatePathAccess(sessionId, 'subdir/file.txt', 'WRITE');
  assert.ok(legit.startsWith(sandbox.getSessionWorkspace(sessionId)));

  // Path Traversal Attempt Blocked
  assert.throws(() => {
    sandbox.validatePathAccess(sessionId, '../../../../etc/passwd', 'READ');
  }, /Security Violation/);

  fs.rmSync(tmpWorkspace, { recursive: true, force: true });
});

test('2. Sandbox Dangerous Command Detection & Audit Log', async () => {
  const tmpWorkspace = path.join(process.cwd(), 'tmp_test_ws_2');
  const sandbox = new SandboxEngine(tmpWorkspace);
  const sessionId = 'test-session-002';

  // Dangerous rm -rf / blocked
  await assert.rejects(async () => {
    await sandbox.executeCommand(sessionId, 'rm -rf /');
  }, /Security Violation/);

  // Legitimate echo command succeeds
  const res = await sandbox.executeCommand(sessionId, 'echo "EasyBot Sandbox OK"');
  assert.equal(res.exitCode, 0);
  assert.ok(res.stdout.includes('EasyBot Sandbox OK'));

  // Verify Audit Log was recorded
  const logs = sandbox.getAuditLogs(sessionId);
  assert.ok(logs.length >= 2);
  assert.ok(logs.some(l => l.status === 'REJECTED'));

  fs.rmSync(tmpWorkspace, { recursive: true, force: true });
});

test('3. WeKnora-grade Hybrid RAG (BM25 + Vector RRF)', () => {
  const rag = new HybridRAGEngine();
  rag.addDocument('doc-test-1', 'Linux Security Policy', 'Linux cgroups and namespaces provide operating system level virtualization and process sandboxing.');
  rag.addDocument('doc-test-2', 'Network Firewall Guide', 'IPTables and eBPF packet filters inspect incoming TCP and UDP connections.');

  const results = rag.query('cgroups sandboxing process', 3);
  assert.ok(results.length > 0);
  assert.equal(results[0].chunk.documentId, 'doc-test-1');
  assert.ok(results[0].score > 0);
  assert.equal(results[0].bm25Rank, 1);
});

test('4. MCP Standard Tools Catalog & Discovery', () => {
  const mcp = new MCPHostManager();
  const tools = mcp.listTools();
  assert.ok(tools.length >= 3);
  assert.ok(tools.some(t => t.name === 'workspace_file_write'));
  assert.ok(tools.some(t => t.name === 'hybrid_rag_query'));
  assert.ok(tools.some(t => t.name === 'workspace_shell_execute'));
});

test('5. Agent Router Autonomous Tool Execution', async () => {
  const tmpWorkspace = path.join(process.cwd(), 'tmp_test_ws_3');
  const sandbox = new SandboxEngine(tmpWorkspace);
  const rag = new HybridRAGEngine();
  const mcp = new MCPHostManager();
  const router = new AgentRouter(sandbox, rag, mcp);
  router.getModelClient().updateConfig({ provider: 'mock' });

  const session = router.createSession('Test Suite Session', 'ClaudeAgent');
  const assistantMsg = await router.handleUserMessage(session.id, '请帮我创建文件 app.js 并写入测试逻辑');

  assert.equal(assistantMsg.role, 'assistant');
  assert.ok(assistantMsg.toolCalls && assistantMsg.toolCalls.length > 0);
  assert.equal(assistantMsg.toolCalls[0].status, 'COMPLETED');

  const createdFile = path.join(session.workspacePath, 'app.js');
  assert.ok(fs.existsSync(createdFile));

  fs.rmSync(tmpWorkspace, { recursive: true, force: true });
});

test('6. AgentFlow DAG Workflow Engine Execution', async () => {
  const tmpWorkspace = path.join(process.cwd(), 'tmp_test_ws_4');
  const sandbox = new SandboxEngine(tmpWorkspace);
  const rag = new HybridRAGEngine();
  rag.addDocument('doc-qa', 'QA Standard', 'All API handlers must return strict typed JSON response.');
  const mcp = new MCPHostManager();
  const wfEngine = new WorkflowEngine(sandbox, rag, mcp);

  const res = await wfEngine.executeWorkflow('wf-auto-dev-qa', { query: 'API handler standard' }, 'test-session-wf');
  assert.equal(res.status, 'COMPLETED');
  assert.ok(res.logs.length >= 4);
  assert.ok(res.logs.some(l => l.nodeName === 'WeKnora 规范知识库检索'));
  assert.ok(res.logs.some(l => l.nodeName === 'Micro-Sandbox 隔离执行测试'));

  fs.rmSync(tmpWorkspace, { recursive: true, force: true });
});

test('7. VibeCoding WebApp Generator & Sandboxed Assets', async () => {
  const tmpWorkspace = path.join(process.cwd(), 'tmp_test_ws_5');
  const sandbox = new SandboxEngine(tmpWorkspace);
  const vibe = new VibeCodingEngine(sandbox, 4100);

  const project = await vibe.generateWebApp('test-session-vibe', 'CRM_Portal', 'Create customer metrics dashboard');
  assert.ok(project.id.startsWith('app-'));
  assert.ok(project.files.length >= 3);
  assert.ok(project.previewUrl.includes('/preview/test-session-vibe/CRM_Portal/index.html'));

  // Verify files exist in filesystem
  assert.ok(fs.existsSync(path.join(project.projectDir, 'index.html')));
  assert.ok(fs.existsSync(path.join(project.projectDir, 'style.css')));
  assert.ok(fs.existsSync(path.join(project.projectDir, 'app.js')));

  fs.rmSync(tmpWorkspace, { recursive: true, force: true });
});

test('8. Skills Package Dynamic Loader', () => {
  const tmpSkillsDir = path.join(process.cwd(), 'tmp_test_skills');
  const loader = new SkillLoader(tmpSkillsDir);
  const list = loader.listSkills();
  assert.ok(list.length >= 3);
  assert.ok(list.some(s => s.id === 'vibecoding-fullstack'));
  assert.ok(list.some(s => s.id === 'enterprise-security-auditor'));

  fs.rmSync(tmpSkillsDir, { recursive: true, force: true });
});

test('9. AgentGroup Multi-Agent Collaboration & Consensus', async () => {
  const tmpWorkspace = path.join(process.cwd(), 'tmp_test_ws_6');
  const sandbox = new SandboxEngine(tmpWorkspace);
  const rag = new HybridRAGEngine();
  const mcp = new MCPHostManager();
  const router = new AgentRouter(sandbox, rag, mcp);
  const group = new AgentGroupCoordinator(sandbox, router);

  const res = await group.runCollaboration('test-session-group', '全栈安全审计管道搭建');
  assert.equal(res.status, 'COMPLETED');
  assert.equal(res.conversation.length, 4);
  assert.ok(res.finalDeliverable.includes('多智能体集群协作执行完毕'));

  fs.rmSync(tmpWorkspace, { recursive: true, force: true });
});

test('10. Screen Perception Capture Service', async () => {
  const tmpWorkspace = path.join(process.cwd(), 'tmp_test_ws_7');
  const sandbox = new SandboxEngine(tmpWorkspace);
  const screen = new ScreenPerceptionEngine(sandbox);

  const res = await screen.captureScreen('test-session-screen');
  assert.ok(res.filePath.includes('screenshot-'));
  assert.ok(fs.existsSync(res.filePath));

  fs.rmSync(tmpWorkspace, { recursive: true, force: true });
});

test('11. Custom Model Client Config & Tool Translation', async () => {
  const { ModelClient } = await import('../core/model-client.js');
  const client = new ModelClient({
    provider: 'mock',
    apiKey: 'sk-test-secret-1234567890',
    model: 'deepseek-chat',
    baseUrl: 'https://api.deepseek.com/v1'
  });

  const masked = client.getMaskedConfig();
  assert.equal(masked.model, 'deepseek-chat');
  assert.equal(masked.hasKey, true);
  assert.ok(masked.apiKeyMasked.includes('...'));
  assert.ok(!masked.apiKeyMasked.includes('1234567890')); // secret protected

  const ping = await client.testConnection();
  assert.equal(ping.success, true);
  assert.ok(ping.latencyMs >= 0);

  // Test streaming with tool output
  const res = await client.streamChat([
    { role: 'user', content: '创建文件 index.html' }
  ]);
  assert.ok(res.content.length > 0);
  assert.ok(res.toolCalls && res.toolCalls.length > 0);
  assert.equal(res.toolCalls[0].name, 'workspace_file_write');
});

test('12. Enterprise IM Suite, Specialists & Connectors', async () => {
  const { IMEngine } = await import('../core/im-engine.js');
  const { ModelClient } = await import('../core/model-client.js');
  const tmpWs = path.join(process.cwd(), 'tmp_test_ws_im');
  const tmpData = path.join(process.cwd(), 'tmp_test_data_im');
  const sandbox = new SandboxEngine(tmpWs);
  const rag = new HybridRAGEngine();
  const client = new ModelClient({ provider: 'mock' });

  const im = new IMEngine(tmpData, client, sandbox, rag);

  const channels = im.listChannels();
  const experts = im.listExperts();
  const connectors = im.listConnectors();

  assert.ok(channels.length >= 4);
  assert.ok(experts.length >= 6);
  assert.ok(connectors.length >= 5);

  assert.ok(experts.some(e => e.name === '马工'));
  assert.ok(connectors.some(c => c.type === 'wecom'));

  // Test connector probe
  const probe = im.testConnector('conn-wecom');
  assert.equal(probe.success, true);
  assert.ok(probe.message.includes('企业微信'));

  fs.rmSync(tmpWs, { recursive: true, force: true });
  fs.rmSync(tmpData, { recursive: true, force: true });
});
