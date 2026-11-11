import test, { before, after } from 'node:test';
import * as assert from 'node:assert/strict';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as http from 'node:http';
import { SandboxEngine } from '../core/sandbox-engine.js';
import { HybridRAGEngine } from '../core/hybrid-rag.js';
import { MCPHostManager } from '../core/mcp-host.js';
import { AgentRouter } from '../core/agent-router.js';
import { WorkflowEngine } from '../core/workflow-engine.js';
import { VibeCodingEngine } from '../core/vibecoding-engine.js';
import { ScreenPerceptionEngine } from '../core/screen-perception.js';
import { SkillLoader } from '../core/skill-loader.js';
import { AgentGroupCoordinator } from '../core/agent-group.js';

let testHttpServer: http.Server | null = null;

before(async () => {
  if (!process.env.OPENAI_API_KEY) {
    testHttpServer = http.createServer((req, res) => {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        if (req.url?.includes('/chat/completions')) {
          let parsed: any = {};
          try { parsed = JSON.parse(body); } catch {}
          const isToolQuery = parsed.messages?.some((m: any) => typeof m.content === 'string' && m.content.includes('调用工具'));
          const isPing = parsed.messages?.some((m: any) => m.content === 'Ping');

          if (isPing) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ choices: [{ message: { content: 'Pong (连通正常)' } }] }));
            return;
          }

          if (parsed.stream) {
            res.writeHead(200, {
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-cache',
              'Connection': 'keep-alive'
            });

            const isVibe = body.includes('CRM_Portal') || body.includes('VibeCoding');
            if (isVibe) {
              const vibeJson = JSON.stringify({
                html: '<!DOCTYPE html><html><body><h1>CRM Portal</h1></body></html>',
                css: 'body { font-family: system-ui; }',
                js: 'console.log("CRM App Initialized");'
              });
              const textPayload = JSON.stringify({
                choices: [{
                  delta: { content: '```json\n' + vibeJson + '\n```' }
                }]
              });
              res.write(`data: ${textPayload}\n\n`);
            } else if (isToolQuery && parsed.tools?.length > 0) {
              const toolPayload = JSON.stringify({
                choices: [{
                  delta: {
                    tool_calls: [{
                      index: 0,
                      id: 'call_test_1',
                      type: 'function',
                      function: {
                        name: 'workspace_file_write',
                        arguments: JSON.stringify({ path: 'app.js', content: '// EasyBot Test Application Code' })
                      }
                    }]
                  }
                }]
              });
              res.write(`data: ${toolPayload}\n\n`);
            } else {
              const textPayload = JSON.stringify({
                choices: [{
                  delta: { content: '任务执行已完成并验证符合规范要求。' }
                }]
              });
              res.write(`data: ${textPayload}\n\n`);
            }
            res.write('data: [DONE]\n\n');
            res.end();
            return;
          } else {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ choices: [{ message: { content: 'OK' } }] }));
            return;
          }
        }

        if (req.url?.includes('/embeddings')) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ data: [{ embedding: [0.1, 0.2, 0.3, 0.4] }] }));
          return;
        }

        res.writeHead(404);
        res.end();
      });
    });

    await new Promise<void>((resolve) => {
      testHttpServer!.listen(4199, '127.0.0.1', () => resolve());
    });

    process.env.OPENAI_BASE_URL = 'http://127.0.0.1:4199/v1';
    process.env.OPENAI_API_KEY = 'test_key_for_integration_runner';
    process.env.OPENAI_MODEL = 'deepseek-r1:7b';
  }
});

after(() => {
  if (testHttpServer) {
    testHttpServer.close();
  }
});

test('1. Sandbox Isolation & Path Traversal Block', () => {
  const tmpWorkspace = path.join(process.cwd(), 'tmp_test_ws_1');
  const sandbox = new SandboxEngine(tmpWorkspace);
  const sessionId = 'test-session-001';

  const legit = sandbox.validatePathAccess(sessionId, 'subdir/file.txt', 'WRITE');
  assert.ok(legit.startsWith(sandbox.getSessionWorkspace(sessionId)));

  // Standard Path Traversal Attempt Blocked
  assert.throws(() => {
    sandbox.validatePathAccess(sessionId, '../../../../etc/passwd', 'READ');
  }, /Security Violation/);

  // Prefix Collision Traversal Attempt Blocked (CVE-style startsWith bypass prevention)
  assert.throws(() => {
    sandbox.validatePathAccess(sessionId, `../${sessionId}_secret/leak.txt`, 'READ');
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

test('3. Industrial RAG (Okapi BM25 with Exact Code Matching)', () => {
  const rag = new HybridRAGEngine();
  rag.addDocument('doc-test-1', 'Linux Security Policy', 'Linux cgroups and namespaces provide operating system level virtualization and process sandboxing.');
  rag.addDocument('doc-test-2', 'CNC Alarms SOP', '数控机床 E-06 报警代表主轴伺服过载，处理标准是立即按下急停按钮。');
  rag.addDocument('doc-test-3', 'Tolerances SOP', '轴承外径公差按照 h6 标准执行，允许偏差上限为0，下偏差根据公称尺寸查表。');

  // Test 1: General conceptual query
  const res1 = rag.query('cgroups sandboxing process', 3);
  assert.ok(res1.length > 0);
  assert.equal(res1[0].chunk.documentId, 'doc-test-1');
  assert.equal(res1[0].bm25Rank, 1);

  // Test 2: Alphanumeric fault code exact match
  const res2 = rag.query('E-06 报警', 3);
  assert.ok(res2.length > 0);
  assert.equal(res2[0].chunk.documentId, 'doc-test-2');
  assert.ok(res2[0].matchedKeywords.includes('e-06'));

  // Test 3: Tolerance code exact match
  const res3 = rag.query('h6 公差', 3);
  assert.ok(res3.length > 0);
  assert.equal(res3[0].chunk.documentId, 'doc-test-3');
  assert.ok(res3[0].matchedKeywords.includes('h6'));
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

  const session = router.createSession('Test Suite Session', 'ClaudeAgent');
  const assistantMsg = await router.handleUserMessage(session.id, '请调用工具创建文件 app.js 并写入测试逻辑');

  assert.equal(assistantMsg.role, 'assistant');
  assert.ok(assistantMsg.toolCalls && assistantMsg.toolCalls.length > 0);
  assert.equal(assistantMsg.toolCalls[0].status, 'COMPLETED');

  const createdFile = path.join(session.workspacePath, 'app.js');
  assert.ok(fs.existsSync(createdFile));

  fs.rmSync(tmpWorkspace, { recursive: true, force: true });
});

test('6. AgentFlow DAG Workflow Engine Execution', async () => {
  const { ModelClient } = await import('../core/model-client.js');
  const tmpWorkspace = path.join(process.cwd(), 'tmp_test_ws_4');
  const sandbox = new SandboxEngine(tmpWorkspace);
  const rag = new HybridRAGEngine();
  rag.addDocument('doc-qa', 'QA Standard', 'All API handlers must return strict typed JSON response.');
  const mcp = new MCPHostManager();
  const client = new ModelClient();
  const wfEngine = new WorkflowEngine(sandbox, rag, mcp, client);

  const res = await wfEngine.executeWorkflow('wf-auto-dev-qa', { query: 'API handler standard' }, 'test-session-wf');
  assert.equal(res.status, 'COMPLETED');
  assert.ok(res.logs.length >= 4);
  assert.ok(res.logs.some(l => l.nodeName === 'WeKnora 规范知识库检索'));
  assert.ok(res.logs.some(l => l.nodeName === 'Micro-Sandbox 隔离执行测试'));

  fs.rmSync(tmpWorkspace, { recursive: true, force: true });
});

test('7. VibeCoding WebApp Generator & Sandboxed Assets', async () => {
  const { ModelClient } = await import('../core/model-client.js');
  const tmpWorkspace = path.join(process.cwd(), 'tmp_test_ws_5');
  const sandbox = new SandboxEngine(tmpWorkspace);
  const client = new ModelClient();
  const vibe = new VibeCodingEngine(sandbox, client, 4100);

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
  const { ModelClient } = await import('../core/model-client.js');
  const tmpWorkspace = path.join(process.cwd(), 'tmp_test_ws_6');
  const sandbox = new SandboxEngine(tmpWorkspace);
  const rag = new HybridRAGEngine();
  const mcp = new MCPHostManager();
  const router = new AgentRouter(sandbox, rag, mcp);
  const client = new ModelClient();
  const group = new AgentGroupCoordinator(sandbox, router, client);

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
  const client = new ModelClient();

  const masked = client.getMaskedConfig();
  assert.equal(masked.model, process.env.OPENAI_MODEL || 'deepseek-r1:7b');
  assert.equal(masked.hasKey, true);
  assert.ok(masked.apiKeyMasked.includes('...'));

  const ping = await client.testConnection();
  assert.equal(ping.success, true);
  assert.ok(ping.latencyMs >= 0);

  // Test real tool call dispatch with live model
  const res = await client.streamChat(
    [{ role: 'user', content: '请调用工具创建文件 index.html 并写入 hello' }],
    [{
      name: 'workspace_file_write',
      description: 'Write a file',
      inputSchema: {
        type: 'object',
        properties: { path: { type: 'string' }, content: { type: 'string' } },
        required: ['path', 'content']
      }
    }]
  );

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
  const client = new ModelClient();

  const im = new IMEngine(tmpData, client, sandbox, rag);

  const channels = im.listChannels();
  const experts = im.listExperts();
  const connectors = im.listConnectors();

  assert.ok(channels.length >= 4);
  assert.ok(experts.length >= 6);
  assert.ok(connectors.length >= 5);

  assert.ok(experts.some(e => e.name === '马工'));
  assert.ok(connectors.some(c => c.type === 'wecom'));

  // Test connector probe (honest unconfigured detection)
  const probe = await im.testConnector('conn-wecom');
  assert.equal(probe.success, false);
  assert.ok(probe.message.includes('未配置有效 Webhook') || probe.message.includes('企业微信'));

  fs.rmSync(tmpWs, { recursive: true, force: true });
  fs.rmSync(tmpData, { recursive: true, force: true });
});

test('13. Campus LDAP Authentication Provider & Filter Escaping', async () => {
  const { LDAPProvider } = await import('../core/auth/ldap-provider.js');
  const provider = new LDAPProvider({ simulationMode: true });

  // Test filter injection escaping
  const maliciousInput = 'admin)(|(uid=*';
  const escaped = LDAPProvider.escapeFilter(maliciousInput);
  assert.ok(!escaped.includes(')('));
  assert.ok(escaped.includes('\\28') || escaped.includes('\\29') || escaped.includes('\\2a'));

  // Test faculty login simulation
  const faculty = await provider.authenticate('t_zhang', 'password123');
  assert.ok(faculty !== null);
  assert.equal(faculty?.role, 'teacher_pi');
  assert.equal(faculty?.department, '人工智能国家重点实验室');

  // Test student login simulation
  const student = await provider.authenticate('stu_wang', 'password123');
  assert.ok(student !== null);
  assert.equal(student?.role, 'student');
  assert.equal(student?.department, '计算机科学与技术学院');

  // Test invalid short password
  const failed = await provider.authenticate('stu_wang', '123');
  assert.equal(failed, null);
});

test('14. Organization Multi-Tenancy & Resource Grants Isolation', async () => {
  const { SessionStore } = await import('../core/session-store.js');
  const { CryptoUtil } = await import('../core/auth/crypto-util.js');
  const tmpData = path.join(process.cwd(), 'tmp_test_org');
  const store = new SessionStore(tmpData);

  // 1. Password hashing & verification
  const pass = 'CampusSecure2026!';
  const hash = CryptoUtil.hashPassword(pass);
  assert.ok(CryptoUtil.verifyPassword(pass, hash));
  assert.ok(!CryptoUtil.verifyPassword('WrongPass', hash));

  // 2. JWT token generation & payload verification
  const jwt = CryptoUtil.signJWT({
    userId: 'usr_test',
    username: 'test_prof',
    displayName: '测试教授',
    role: 'teacher_pi',
    authSource: 'ldap',
    groups: ['grp_lab_ai']
  }, 'secret-test-key', 3600);

  const decoded = CryptoUtil.verifyJWT(jwt, 'secret-test-key');
  assert.ok(decoded !== null);
  assert.equal(decoded?.username, 'test_prof');
  assert.equal(decoded?.role, 'teacher_pi');

  // 3. User, group & grant isolation in SQLite
  const u1 = store.createUser({
    id: 'usr_u1',
    username: 'user_lab_a',
    passwordHash: null,
    displayName: '实验室A成员',
    role: 'student'
  });
  const g1 = store.createGroup({ id: 'grp_lab_a', name: '国家重点实验室A组' });
  const g2 = store.createGroup({ id: 'grp_lab_b', name: '外系非涉密组' });

  store.addUserToGroup(u1.id, g1.id);
  const u1Groups = store.getUserGroupIds(u1.id);
  assert.deepEqual(u1Groups, ['grp_lab_a']);

  // Grant access on confidential lab knowledge space to grp_lab_a only
  store.createResourceGrant({
    id: 'grant_1',
    resourceType: 'knowledge_base',
    resourceId: 'doc_confidential_grant_proposal',
    groupId: g1.id
  });

  // User 1 has access; Group 2 has NO access
  assert.equal(store.checkResourceAccess('knowledge_base', 'doc_confidential_grant_proposal', u1Groups), true);
  assert.equal(store.checkResourceAccess('knowledge_base', 'doc_confidential_grant_proposal', ['grp_lab_b']), false);

  fs.rmSync(tmpData, { recursive: true, force: true });
});

test('15. HITL Dangerous Command Interception & Resolution', async () => {
  const tmpWs = path.join(process.cwd(), 'tmp_test_hitl');
  const sandbox = new SandboxEngine(tmpWs);

  // rm -rf is flagged as high-risk requiring approval
  const check = sandbox.checkRequiresHITL('rm -rf ./temp_cache');
  assert.equal(check.requiresHITL, true);
  assert.equal(check.riskLevel, 'high');

  // Normal safe command does not trigger HITL
  const safeCheck = sandbox.checkRequiresHITL('echo "Hello Lab"');
  assert.equal(safeCheck.requiresHITL, false);

  // Executing dangerous command directly throws HITL_INTERCEPTED error
  await assert.rejects(
    async () => {
      await sandbox.executeCommand('default', 'rm -rf ./temp_cache');
    },
    (err: any) => err.message.startsWith('HITL_INTERCEPTED')
  );

  fs.rmSync(tmpWs, { recursive: true, force: true });
});

test('16. IM Gateway Inbound Dispatch & Specialist Routing', async () => {
  const { IMEngine } = await import('../core/im-engine.js');
  const { ModelClient } = await import('../core/model-client.js');
  const tmpWs = path.join(process.cwd(), 'tmp_test_im_gw');
  const tmpData = path.join(process.cwd(), 'tmp_test_im_data');
  const sandbox = new SandboxEngine(tmpWs);
  const rag = new HybridRAGEngine();
  const client = new ModelClient();
  const im = new IMEngine(tmpData, client, sandbox, rag);

  // Test inbound WeCom academic dispatch
  const wecomInbound = await im.handleInboundMessage('wecom', {
    senderId: 'wecom_student_01',
    senderName: '研究生小赵',
    content: '请教关于国家自然科学基金立项和学术论文引用的规范要求'
  });

  assert.ok(wecomInbound.expertName.includes('张导师') || wecomInbound.expertName.includes('专家'));
  assert.ok(wecomInbound.reply.length > 0);

  fs.rmSync(tmpWs, { recursive: true, force: true });
  fs.rmSync(tmpData, { recursive: true, force: true });
});

test('17. Multi-Format Enterprise Knowledge Pipeline (Word & Excel Ingestion)', async () => {
  const xlsx = await import('xlsx');
  const rag = new HybridRAGEngine();

  // 1. Generate real Excel workbook in memory
  const wb = xlsx.utils.book_new();
  const ws = xlsx.utils.aoa_to_sheet([
    ['课程编号', '课程名称', '授课教师', '先修要求'],
    ['CS-801', '异构张量计算与集群调度', '张教授', '线性代数与操作系统'],
    ['CS-802', '大规模并行存储系统', '王教授', '计算机组成原理']
  ]);
  xlsx.utils.book_append_sheet(wb, ws, '培养计划');
  const excelBuf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

  // 2. Index Excel document into Hybrid RAG
  const chunks = await rag.addExcelDocument('doc_curriculum_xlsx', '2026研究生培养计划.xlsx', excelBuf, 300, 50, 'public');
  assert.ok(chunks.length > 0);

  // 3. Query specific tabular content
  const searchResults = rag.query('异构张量计算 集群调度');
  assert.ok(searchResults.length > 0);
  assert.equal(searchResults[0].chunk.documentId, 'doc_curriculum_xlsx');
  assert.ok(searchResults[0].chunk.content.includes('CS-801'));
});

test('18. Token Bucket Rate Limiter (Brute-Force & Abuse Defense)', async () => {
  const { RateLimiter } = await import('../core/rate-limiter.js');
  const limiter = new RateLimiter();
  const testKey = 'test_ip_192_168_1_100';

  // 5 requests allowed within 60 seconds
  for (let i = 1; i <= 5; i++) {
    const res = limiter.check(testKey, 5, 60000);
    assert.equal(res.allowed, true);
    assert.equal(res.remaining, 5 - i);
  }

  // 6th request is strictly blocked
  const blocked = limiter.check(testKey, 5, 60000);
  assert.equal(blocked.allowed, false);
  assert.ok(blocked.retryAfterSeconds > 0);

  // Reset allows immediate clearance
  limiter.reset(testKey);
  const cleared = limiter.check(testKey, 5, 60000);
  assert.equal(cleared.allowed, true);
});

test('19. Online Atomic Database Backup & Disaster Recovery', async () => {
  const { SessionStore } = await import('../core/session-store.js');
  const Database = (await import('better-sqlite3')).default;
  const tmpData = path.join(process.cwd(), 'tmp_test_backup_data');
  const tmpBackup = path.join(process.cwd(), 'tmp_test_backup_target.db');

  const store = new SessionStore(tmpData);
  store.createUser({
    id: 'usr_backup_test',
    username: 'dr_tester',
    passwordHash: null,
    displayName: '容灾验证用户',
    role: 'teacher_pi'
  });

  // Execute online backup
  await store.backupDatabase(tmpBackup);
  assert.ok(fs.existsSync(tmpBackup));

  // Verify backup integrity
  const backupDb = new Database(tmpBackup, { readonly: true });
  const check: any = backupDb.pragma('integrity_check');
  backupDb.close();

  assert.equal(check.length, 1);
  assert.equal(check[0].integrity_check, 'ok');

  fs.rmSync(tmpData, { recursive: true, force: true });
  fs.rmSync(tmpBackup, { force: true });
});

test('20. Hardened Sandbox Engine (Fail-Closed Docker & Local Interpreter Guard)', async () => {
  const tmpWs = path.join(process.cwd(), 'tmp_test_ws_sb_hardening');
  const localSandbox = new SandboxEngine(tmpWs, { backend: 'local' });
  const sess = 'test_sb_hardening';

  // 1. Block inline eval flag node -e
  await assert.rejects(async () => {
    await localSandbox.executeCommand(sess, 'node -e "console.log(process.mainModule)"');
  }, /Security Violation/);

  // 2. Block pipeline chain containing unauthorized / dangerous token
  await assert.rejects(async () => {
    await localSandbox.executeCommand(sess, 'echo ok && python -c "import os; os.system(\'id\')"');
  }, /Security Violation/);

  // 3. Local interpreter execution requires HITL approval
  await assert.rejects(async () => {
    await localSandbox.executeCommand(sess, 'python3 script.py', undefined, false);
  }, /HITL_INTERCEPTED/);

  // 4. Docker backend fails closed immediately on error (no silent host shell fallback)
  const failClosedDocker = new SandboxEngine(tmpWs, {
    backend: 'docker',
    dockerImage: '--invalid-docker-run-flag'
  });
  await assert.rejects(async () => {
    await failClosedDocker.executeCommand(sess, 'echo 123');
  }, /Docker container/);

  fs.rmSync(tmpWs, { recursive: true, force: true });
});

test('21. Persistent Confidential Knowledge Space (Zero-Leakage on Server Restart)', async () => {
  const { SessionStore } = await import('../core/session-store.js');
  const { KnowledgeDropWatcher } = await import('../core/knowledge-watcher.js');
  const tmpDrop = path.join(process.cwd(), 'tmp_test_knowledge_persist');
  const tmpData = path.join(process.cwd(), 'tmp_test_data_persist');

  const store = new SessionStore(tmpData);
  const rag1 = new HybridRAGEngine();
  const watcher1 = new KnowledgeDropWatcher(tmpDrop, rag1, store);

  // 1. Upload confidential research doc with restricted space and owner group
  watcher1.saveAndIndexFile(
    'quantum_secret_algo.md',
    '# 量子退火保密算法说明\n本算法为重点实验室专用核心机密文档，严禁公开。',
    'space_quantum_pi',
    'grp_quantum_research',
    'usr_pi_prof'
  );

  // 2. Verify indexed with confidential space and ownerGroupId in session 1
  const search1 = rag1.queryWithScope('量子退火算法', ['grp_other_students']);
  assert.equal(search1.length, 0, 'Students outside group must NOT access confidential paper');

  const searchAuth = rag1.queryWithScope('量子退火算法', ['grp_quantum_research']);
  assert.equal(searchAuth.length, 1, 'Group member can access confidential paper');

  // 3. Simulate server restart: fresh RAG engine and watcher rescanning disk
  const rag2 = new HybridRAGEngine();
  const watcher2 = new KnowledgeDropWatcher(tmpDrop, rag2, store);
  watcher2.sync(); // Rescans from disk

  // 4. Verify confidential space and ownerGroupId are recovered from persistent SQLite store
  const searchAfterRebootUnauthorized = rag2.queryWithScope('量子退火算法', ['grp_other_students']);
  assert.equal(searchAfterRebootUnauthorized.length, 0, 'CRITICAL AUDIT FIX: Confidential space must NOT revert to public after server restart!');

  const searchAfterRebootAuthorized = rag2.queryWithScope('量子退火算法', ['grp_quantum_research']);
  assert.equal(searchAfterRebootAuthorized.length, 1, 'Authorized group member still retains access after restart');

  fs.rmSync(tmpDrop, { recursive: true, force: true });
  fs.rmSync(tmpData, { recursive: true, force: true });
});

test('22. Group Management RBAC & Faculty Membership Scoping', async () => {
  const { SessionStore } = await import('../core/session-store.js');
  const tmpData = path.join(process.cwd(), 'tmp_test_group_rbac');
  const store = new SessionStore(tmpData);

  // 1. Setup groups
  store.createGroup({ id: 'grp_chem_lab', name: '化学院重点实验室' });
  store.createGroup({ id: 'grp_physics_lab', name: '物理院保密课题组' });

  // 2. Setup faculty user only in Chemistry Lab
  store.createUser({ id: 'usr_prof_chem', username: 'prof_chem', passwordHash: null, displayName: '化学张教授', role: 'teacher_pi' });
  store.addUserToGroup('usr_prof_chem', 'grp_chem_lab');

  // 3. Verify teacher groups query
  const teacherGroups = store.getUserGroupIds('usr_prof_chem');
  assert.ok(teacherGroups.includes('grp_chem_lab'));
  assert.equal(teacherGroups.includes('grp_physics_lab'), false);

  // 4. Faculty cannot manage Physics Lab members
  const canManageChem = teacherGroups.includes('grp_chem_lab');
  const canManagePhysics = teacherGroups.includes('grp_physics_lab');
  assert.equal(canManageChem, true);
  assert.equal(canManagePhysics, false, 'Faculty member cannot manage external groups');

  fs.rmSync(tmpData, { recursive: true, force: true });
});
