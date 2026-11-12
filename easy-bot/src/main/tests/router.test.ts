import test, { describe, it, before, after, beforeEach } from 'node:test';
import * as assert from 'node:assert/strict';
import * as http from 'node:http';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { AgentRouter } from '../core/agent-router.js';
import { SandboxEngine } from '../core/sandbox-engine.js';
import { HybridRAGEngine } from '../core/hybrid-rag.js';
import { MCPHostManager } from '../core/mcp-host.js';
import { createSecurityContext } from '../core/auth/security-context.js';

describe('Unit Test: AgentRouter Multi-Turn Execution & Tool Dispatch', () => {
  let server: http.Server;
  let serverPort: number;
  let currentResponseMode: 'text' | 'tool_file_write' | 'tool_file_read' | 'tool_shell_exec' | 'tool_traversal' | 'tool_rag' = 'text';

  let sandbox: SandboxEngine;
  let rag: HybridRAGEngine;
  let mcp: MCPHostManager;
  let router: AgentRouter;
  let workspaceDir: string;

  before(async () => {
    server = http.createServer((req, res) => {
      if (req.method === 'POST' && req.url?.includes('/chat/completions')) {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
        });

        if (currentResponseMode === 'text') {
          res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: '工业级智能助手已就绪。' } }] })}\n\n`);
          res.write('data: [DONE]\n\n');
          res.end();
        } else if (currentResponseMode === 'tool_file_write') {
          const toolCallPayload = {
            choices: [{
              delta: {
                tool_calls: [{
                  index: 0,
                  id: 'call_write_01',
                  function: {
                    name: 'workspace_file_write',
                    arguments: JSON.stringify({ path: 'output_test.txt', content: 'Agent Generated Content 2026' })
                  }
                }]
              }
            }]
          };
          res.write(`data: ${JSON.stringify(toolCallPayload)}\n\n`);
          res.write('data: [DONE]\n\n');
          res.end();
        } else if (currentResponseMode === 'tool_file_read') {
          const toolCallPayload = {
            choices: [{
              delta: {
                tool_calls: [{
                  index: 0,
                  id: 'call_read_01',
                  function: {
                    name: 'workspace_file_read',
                    arguments: JSON.stringify({ path: 'target.txt' })
                  }
                }]
              }
            }]
          };
          res.write(`data: ${JSON.stringify(toolCallPayload)}\n\n`);
          res.write('data: [DONE]\n\n');
          res.end();
        } else if (currentResponseMode === 'tool_shell_exec') {
          const toolCallPayload = {
            choices: [{
              delta: {
                tool_calls: [{
                  index: 0,
                  id: 'call_sh_01',
                  function: {
                    name: 'workspace_shell_execute',
                    arguments: JSON.stringify({ command: 'echo ROUTER_EXEC_SUCCESS' })
                  }
                }]
              }
            }]
          };
          res.write(`data: ${JSON.stringify(toolCallPayload)}\n\n`);
          res.write('data: [DONE]\n\n');
          res.end();
        } else if (currentResponseMode === 'tool_traversal') {
          const toolCallPayload = {
            choices: [{
              delta: {
                tool_calls: [{
                  index: 0,
                  id: 'call_trav_01',
                  function: {
                    name: 'workspace_file_write',
                    arguments: JSON.stringify({ path: '../../../etc/forbidden.txt', content: 'hacked' })
                  }
                }]
              }
            }]
          };
          res.write(`data: ${JSON.stringify(toolCallPayload)}\n\n`);
          res.write('data: [DONE]\n\n');
          res.end();
        } else if (currentResponseMode === 'tool_rag') {
          const toolCallPayload = {
            choices: [{
              delta: {
                tool_calls: [{
                  index: 0,
                  id: 'call_rag_01',
                  function: {
                    name: 'hybrid_rag_query',
                    arguments: JSON.stringify({ query: '轴承油隙技术标准', topK: 2 })
                  }
                }]
              }
            }]
          };
          res.write(`data: ${JSON.stringify(toolCallPayload)}\n\n`);
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
    workspaceDir = path.join(process.cwd(), 'workspace', 'test_router_' + Date.now() + Math.random().toString(36).slice(2, 6));
    sandbox = new SandboxEngine(workspaceDir);
    rag = new HybridRAGEngine();
    mcp = new MCPHostManager();
    router = new AgentRouter(sandbox, rag, mcp);

    // Point ModelClient to local mock test server
    router.getModelClient().updateConfig({
      baseUrl: `http://127.0.0.1:${serverPort}/v1`,
      apiKey: 'sk-test-key-valid',
      model: 'test-model'
    });
  });

  it('11.1 should create session with default ID, sandbox workspace, and user attribution', () => {
    const session = router.createSession('测试工作会话', 'DeepSeekHarness', undefined, 'usr_analyst');
    assert.ok(session.id);
    assert.equal(session.title, '测试工作会话');
    assert.equal(session.backend, 'DeepSeekHarness');
    assert.equal(session.userId, 'usr_analyst');
    assert.ok(fs.existsSync(session.workspacePath));
    assert.equal(router.getSession(session.id)?.id, session.id);
  });

  it('11.2 should support custom session ID and assign user ID', () => {
    const customId = 'sess_fixed_001';
    const session = router.createSession('固定会话', 'OpenCodeACP', customId, 'usr_dev');
    assert.equal(session.id, customId);
    assert.equal(session.backend, 'OpenCodeACP');
    assert.equal(router.getSession(customId)?.title, '固定会话');
  });

  it('11.3 should list sessions with multi-tenant RBAC filtering', () => {
    router.createSession('Admin 会话 1', 'DeepSeekHarness', 's_adm_1', 'usr_admin');
    router.createSession('User 会话 1', 'DeepSeekHarness', 's_usr_1', 'usr_john');
    router.createSession('User 会话 2', 'DeepSeekHarness', 's_usr_2', 'usr_john');

    // Admin sees all sessions
    const adminList = router.listSessions('usr_admin', 'admin');
    assert.ok(adminList.some(s => s.id === 's_adm_1'));
    assert.ok(adminList.some(s => s.id === 's_usr_1'));

    // Regular student / member only sees their own sessions
    const johnList = router.listSessions('usr_john', 'student');
    assert.equal(johnList.filter(s => s.userId === 'usr_john').length, 2);
    assert.ok(!johnList.some(s => s.id === 's_adm_1'));
  });

  it('11.4 should reject message execution on nonexistent session', async () => {
    await assert.rejects(
      () => router.handleUserMessage('nonexistent_session_id', 'Hello'),
      /Session nonexistent_session_id not found/
    );
  });

  it('11.5 should handle pure text streaming response from model', async () => {
    currentResponseMode = 'text';
    const session = router.createSession('流式文本测试');

    const chunks: string[] = [];
    const msg = await router.handleUserMessage(session.id, '你好', (c) => chunks.push(c));

    assert.equal(msg.role, 'assistant');
    assert.ok(msg.content.includes('工业级智能助手已就绪'));
    assert.ok(chunks.length > 0);
    assert.equal(session.messages.length, 2); // 1 user + 1 assistant
  });

  it('11.6 should execute workspace_file_write tool call inside micro-sandbox', async () => {
    currentResponseMode = 'tool_file_write';
    const session = router.createSession('文件写入测试');

    const toolCallsEmitted: any[] = [];
    const toolResultsEmitted: any[] = [];

    const msg = await router.handleUserMessage(
      session.id,
      '生成测试文件',
      undefined,
      (tc) => toolCallsEmitted.push(tc),
      (tr) => toolResultsEmitted.push(tr)
    );

    assert.equal(toolCallsEmitted.length, 1);
    assert.equal(toolCallsEmitted[0].toolName, 'workspace_file_write');
    assert.equal(toolCallsEmitted[0].status, 'COMPLETED');

    assert.equal(toolResultsEmitted.length, 1);
    assert.ok(toolResultsEmitted[0].output.includes('written successfully inside sandbox'));

    const writtenFilePath = path.join(session.workspacePath, 'output_test.txt');
    assert.ok(fs.existsSync(writtenFilePath));
    assert.equal(fs.readFileSync(writtenFilePath, 'utf-8'), 'Agent Generated Content 2026');
  });

  it('11.7 should execute workspace_file_read tool call and return file contents', async () => {
    currentResponseMode = 'tool_file_read';
    const session = router.createSession('文件读取测试');

    // Pre-create target file in sandbox workspace
    const targetFile = path.join(session.workspacePath, 'target.txt');
    fs.writeFileSync(targetFile, 'VERIFIED_FILE_PAYLOAD_8848', 'utf-8');

    const toolResultsEmitted: any[] = [];
    await router.handleUserMessage(
      session.id,
      '读取 target.txt',
      undefined,
      undefined,
      (tr) => toolResultsEmitted.push(tr)
    );

    assert.equal(toolResultsEmitted.length, 1);
    assert.equal(toolResultsEmitted[0].output, 'VERIFIED_FILE_PAYLOAD_8848');
  });

  it('11.8 should execute workspace_shell_execute tool call and capture stdout', async () => {
    currentResponseMode = 'tool_shell_exec';
    const session = router.createSession('Shell执行测试');

    const toolResultsEmitted: any[] = [];
    await router.handleUserMessage(
      session.id,
      '执行 Node 脚本',
      undefined,
      undefined,
      (tr) => toolResultsEmitted.push(tr)
    );

    assert.equal(toolResultsEmitted.length, 1);
    assert.ok(toolResultsEmitted[0].output.includes('ROUTER_EXEC_SUCCESS'));
  });

  it('11.9 should catch security violation when tool attempts path traversal', async () => {
    currentResponseMode = 'tool_traversal';
    const session = router.createSession('越权安全拦截测试');

    const toolCallsEmitted: any[] = [];
    const toolResultsEmitted: any[] = [];

    await router.handleUserMessage(
      session.id,
      '尝试越权写文件',
      undefined,
      (tc) => toolCallsEmitted.push(tc),
      (tr) => toolResultsEmitted.push(tr)
    );

    assert.equal(toolCallsEmitted.length, 1);
    assert.equal(toolCallsEmitted[0].status, 'FAILED');
    assert.equal(toolResultsEmitted.length, 1);
    assert.ok(toolResultsEmitted[0].error?.includes('Security Violation: Path traversal outside workspace boundary'));
  });

  it('11.10 should execute hybrid_rag_query tool call and return ranked knowledge', async () => {
    currentResponseMode = 'tool_rag';
    const session = router.createSession('RAG检索测试');

    // Index test knowledge into RAG
    rag.addDocument('rag_doc_01', '机床轴承技术手册', '轴承油隙技术标准：初始径向游隙须保持在 0.02mm 至 0.05mm 之间');

    const toolResultsEmitted: any[] = [];
    const secCtx = createSecurityContext({ userId: 'usr_tech', username: 'tech', role: 'teacher_pi', groups: [] });

    await router.handleUserMessage(
      session.id,
      '查询轴承油隙技术标准',
      undefined,
      undefined,
      (tr) => toolResultsEmitted.push(tr),
      secCtx
    );

    assert.equal(toolResultsEmitted.length, 1);
    const parsedHits = JSON.parse(toolResultsEmitted[0].output);
    assert.ok(Array.isArray(parsedHits));
    assert.ok(parsedHits.length >= 1);
    assert.ok(parsedHits[0].snippet.includes('0.02mm'));
  });
});
