import * as http from 'node:http';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { WebSocketServer, WebSocket } from 'ws';
import { SandboxEngine } from './core/sandbox-engine.js';
import { HybridRAGEngine } from './core/hybrid-rag.js';
import { MCPHostManager } from './core/mcp-host.js';
import { AgentRouter } from './core/agent-router.js';
import { SessionStore } from './core/session-store.js';
import { WorkflowEngine } from './core/workflow-engine.js';
import { VibeCodingEngine } from './core/vibecoding-engine.js';
import { ScreenPerceptionEngine } from './core/screen-perception.js';
import { SkillLoader } from './core/skill-loader.js';
import { AgentGroupCoordinator } from './core/agent-group.js';
import { IMEngine } from './core/im-engine.js';
import { KnowledgeDropWatcher } from './core/knowledge-watcher.js';

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 4100;
const WORKSPACE_ROOT = path.resolve(process.env.EASYBOT_WORKSPACE || path.join(process.cwd(), 'workspace'));
const DATA_DIR = path.resolve(process.env.EASYBOT_DATA || path.join(process.cwd(), '.easybot_data'));
const SKILLS_DIR = path.resolve(process.env.EASYBOT_SKILLS || path.join(process.cwd(), 'skills'));
const DROP_DIR = path.resolve(process.env.EASYBOT_KNOWLEDGE_DROP || path.join(process.cwd(), 'knowledge_drop'));

// Initialize Enterprise Core Subsystems
const sandbox = new SandboxEngine(WORKSPACE_ROOT);
const rag = new HybridRAGEngine();
const mcp = new MCPHostManager();
const router = new AgentRouter(sandbox, rag, mcp);
const store = new SessionStore(DATA_DIR);
const workflow = new WorkflowEngine(sandbox, rag, mcp);
const vibecoding = new VibeCodingEngine(sandbox, PORT);
const screen = new ScreenPerceptionEngine(sandbox);
const skills = new SkillLoader(SKILLS_DIR);
const agentGroup = new AgentGroupCoordinator(sandbox, router);
const imEngine = new IMEngine(DATA_DIR, router.getModelClient(), sandbox, rag);

// Seed baseline real industrial knowledge assets into drop-folder if empty
if (!fs.existsSync(DROP_DIR)) {
  fs.mkdirSync(DROP_DIR, { recursive: true });
}

const existingDropFiles = fs.readdirSync(DROP_DIR).filter(f => !f.startsWith('.'));
if (existingDropFiles.length === 0) {
  fs.writeFileSync(path.join(DROP_DIR, 'SOP-EQ-01_数控机床常见故障与应急排错规程.txt'), `
【数控机床常见故障代码与应急排错规程 (SOP-EQ-01)】
1. 故障代码 E-06: 主轴伺服驱动器过载报警
   - 原因：切削进给量偏大、刀具严重磨损、机械滑台导轨导向润滑不足或丝杠卡入细小铁屑。
   - 现场标准处置规程：
     第一步：立即按下操作面板【红色紧急停止按纽】，切断伺服动力电；
     第二步：戴防割手套手动顺时针微转丝杠，排查机械传动阻滞点；
     第三步：检查自动润滑注油泵压力表，确认压力维持在 0.4~0.6MPa 范围，油位高于红线；
     第四步：用压缩空气枪清理丝杠风琴防护罩内铁屑；
     第五步：静置待主轴伺服电机温升降至 45℃ 以下后，在系统面板按下【ALARM RESET】复位键重新对刀试车。
2. 故障代码 E-12: 液压夹具夹紧压力不足报警
   - 原因：液压泵站油位低于低位油位感应线、比例调压阀滤网堵塞、油路存在微渗漏。
   - 现场处置规程：
     补充 ISO VG46 抗磨液压油至油窗中上刻度；
     顺时针微调主减压阀旋钮，使夹具进油管路压力稳定在 3.5~4.0MPa 额定区间。
`.trim(), 'utf-8');

  fs.writeFileSync(path.join(DROP_DIR, 'SOP-QA-02_制程首件检验与公差配合标准.txt'), `
【精密加工制程首件检验与公差配合标准 (SOP-QA-02)】
1. 轴类零件公差配合标准：
   - 生产执行基轴制配合，主要轴承配合档公差等级严格执行 h6（如 Φ25h6 公差范围为 0 至 -0.009mm）。
   - 首件车削加工完成后，质检员必须使用数显外径千分尺在三个截面测量圆度与圆柱度，超差一律判定为不合格并停机调机。
2. 表面粗糙度要求：
   - 关键密封接触面粗糙度 Ra ≤ 0.8μm，一般滑动导向面 Ra ≤ 1.6μm。
   - 如发现表面有微小振纹或拉毛，应立即检查刀具前刀面磨损情况，并将走刀进给倍率由 100% 降至 80%。
`.trim(), 'utf-8');

  fs.writeFileSync(path.join(DROP_DIR, 'SOP-SAFE-03_车间安全生产与消防规程.txt'), `
【车间安全生产与突发险情应急处置规程 (SOP-SAFE-03)】
1. 个人劳动防护防护穿戴红线：
   - 严禁戴手套操作车床、铣床、钻床等旋转类机械机床，长发必须盘入工作帽内。
   - 涉酸洗、淬火热处理作业必须佩戴护目镜与耐高温防溅面罩。
2. 消防与电气事故应急：
   - 发生电气短路打火时，首先扳下分路动力配电箱总空气开关，严禁直接用水扑救带电设备。
   - 车间主通道、配电箱前 1 米范围内严禁堆放原料木托盘与半成品周转箱，保持生命通道通畅。
`.trim(), 'utf-8');
}

// Start Knowledge Drop-Directory Watcher (零保姆热插拔监听器)
const dropWatcher = new KnowledgeDropWatcher(DROP_DIR, rag);
dropWatcher.start();

// Create HTTP server for REST, WebSocket & VibeCoding sandboxed preview
const server = http.createServer((req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url || '/', `http://${req.headers.host}`);

  // 1. Static Sandboxed WebApp Preview Handler (/preview/:sessionId/:appName/:file*)
  if (url.pathname.startsWith('/preview/')) {
    const parts = url.pathname.replace(/^\/preview\//, '').split('/');
    if (parts.length >= 2) {
      const sessionId = parts[0];
      const appName = parts[1];
      const relFile = parts.slice(2).join('/') || 'index.html';
      const filePath = path.join(WORKSPACE_ROOT, sessionId, 'projects', appName, relFile);

      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const ext = path.extname(filePath).toLowerCase();
        const mimeTypes: Record<string, string> = {
          '.html': 'text/html; charset=utf-8',
          '.js': 'application/javascript; charset=utf-8',
          '.css': 'text/css; charset=utf-8',
          '.json': 'application/json',
          '.png': 'image/png',
          '.svg': 'image/svg+xml'
        };
        res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'text/plain' });
        fs.createReadStream(filePath).pipe(res);
        return;
      }
    }
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('VibeCoding app preview file not found in sandbox');
    return;
  }

  // 2. REST Endpoints
  if (url.pathname === '/api/model/config' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(router.getModelClient().getMaskedConfig()));
    return;
  }

  if (url.pathname === '/api/model/config' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const patch = JSON.parse(body);
        const updated = router.getModelClient().updateConfig(patch);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, config: router.getModelClient().getMaskedConfig() }));
      } catch (err: any) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  if (url.pathname === '/api/model/test' && req.method === 'POST') {
    router.getModelClient().testConnection().then(result => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    }).catch(err => {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    });
    return;
  }

  if (url.pathname === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      name: 'EasyBot',
      version: '2.0.0-commercial',
      engine: 'DeepSeek Harness (@deepseek-ai/dsh)',
      license: 'MIT',
      uptime: process.uptime()
    }));
    return;
  }

  if (url.pathname === '/api/dsh/status' || url.pathname === '/api/engine') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(router.getDSHAdapter().getStatus()));
    return;
  }

  if (url.pathname === '/api/sessions') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(router.listSessions()));
    return;
  }

  if (url.pathname === '/api/workflows') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(workflow.listWorkflows()));
    return;
  }

  if (url.pathname === '/api/skills') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(skills.listSkills()));
    return;
  }

  if (url.pathname === '/api/vibecoding/projects') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(vibecoding.listProjects()));
    return;
  }

  if (url.pathname === '/api/sandbox/policy') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(sandbox.getPolicy()));
    return;
  }

  if (url.pathname === '/api/sandbox/logs') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(sandbox.getAuditLogs()));
    return;
  }

  if (url.pathname === '/api/sandbox/execute' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { command, sessionId } = JSON.parse(body);
        const resExec = await sandbox.executeCommand(command, sessionId);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(resExec));
      } catch (err: any) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  if (url.pathname === '/api/mcp/servers') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(mcp.listServers()));
    return;
  }

  if (url.pathname === '/api/mcp/tools') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(mcp.listTools()));
    return;
  }

  // --- Self-Service Knowledge Drop & Ingestion Endpoints (极轻量交付插槽) ---
  if (url.pathname === '/api/knowledge/documents' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      documents: rag.listDocuments(),
      watcher: dropWatcher.getStatus(),
      stats: rag.getStats()
    }));
    return;
  }

  if (url.pathname === '/api/knowledge/upload' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { filename, content } = JSON.parse(body);
        if (!filename || !content) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'filename and content are required' }));
          return;
        }
        const result = dropWatcher.saveAndIndexFile(filename, content);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, result, stats: rag.getStats() }));
      } catch (err: any) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  if ((url.pathname === '/api/knowledge/documents' || url.pathname.startsWith('/api/knowledge/documents/')) && req.method === 'DELETE') {
    const id = url.searchParams.get('id') || url.pathname.split('/').pop() || '';
    const success = dropWatcher.deleteFile(id) || rag.removeDocument(id);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success, id }));
    return;
  }

  if (url.pathname === '/api/knowledge/sync' && req.method === 'POST') {
    const result = dropWatcher.sync();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, sync: result, stats: rag.getStats() }));
    return;
  }

  // --- Real Telemetry Tracking Endpoints (真实计量监控，无Mock) ---
  if (url.pathname === '/api/telemetry/tokens' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      records: router.getModelClient().getTelemetryRecords()
    }));
    return;
  }

  if (url.pathname === '/api/telemetry/tokens' && req.method === 'DELETE') {
    router.getModelClient().clearTelemetry();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
    return;
  }

  if (url.pathname === '/api/rag/stats') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(rag.getStats()));
    return;
  }

  // --- Enterprise IM System Endpoints ---
  if (url.pathname === '/api/im/channels') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(imEngine.listChannels()));
    return;
  }

  if (url.pathname === '/api/im/experts') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(imEngine.listExperts()));
    return;
  }

  if (url.pathname === '/api/im/connectors') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(imEngine.listConnectors()));
    return;
  }

  if (url.pathname === '/api/im/messages') {
    const channelId = url.searchParams.get('channelId') || 'chan-all';
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(imEngine.getMessages(channelId)));
    return;
  }

  if (url.pathname === '/api/im/send' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { channelId, senderId, senderName, text } = JSON.parse(body);
        const result = await imEngine.sendMessage(channelId, senderId || 'user-1', senderName || 'User', text);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (err: any) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  if (url.pathname === '/api/im/connectors/test' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { connectorId } = JSON.parse(body);
        const result = imEngine.testConnector(connectorId);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (err: any) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  if (url.pathname === '/report' || url.pathname === '/board-report') {
    const reportPath = path.resolve(process.cwd(), 'nuwax_vs_easybot_executive_decision_dashboard.html');
    if (fs.existsSync(reportPath)) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      fs.createReadStream(reportPath).pipe(res);
      return;
    }
  }

  if (url.pathname === '/architecture' || url.pathname === '/blueprint') {
    const archPath = path.resolve(process.cwd(), 'architecture_blueprint_dashboard.html');
    if (fs.existsSync(archPath)) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      fs.createReadStream(archPath).pipe(res);
      return;
    }
  }

  if (url.pathname === '/solution' || url.pathname === '/commercial' || url.pathname === '/whitepaper') {
    const solPath = path.resolve(process.cwd(), 'commercial_industrial_solution.html');
    if (fs.existsSync(solPath)) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      fs.createReadStream(solPath).pipe(res);
      return;
    }
  }

  // 3. Static SPA Frontend Server: Fallback all UI routes to dist/renderer
  const staticRoot = path.resolve(process.cwd(), 'dist/renderer');
  let relPath = url.pathname === '/' ? 'index.html' : url.pathname.replace(/^\//, '');
  let targetPath = path.join(staticRoot, relPath);

  // Path traversal guard
  if (!targetPath.startsWith(staticRoot)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  // SPA fallback to index.html if file does not exist
  if (!fs.existsSync(targetPath) || fs.statSync(targetPath).isDirectory()) {
    targetPath = path.join(staticRoot, 'index.html');
  }

  if (fs.existsSync(targetPath) && fs.statSync(targetPath).isFile()) {
    const ext = path.extname(targetPath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.html': 'text/html; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.json': 'application/json',
      '.png': 'image/png',
      '.svg': 'image/svg+xml',
      '.ico': 'image/x-icon'
    };
    res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'text/plain' });
    fs.createReadStream(targetPath).pipe(res);
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Endpoint not found' }));
});

// WebSocket Server for High-Performance Desktop IPC / Real-Time Streaming
const wss = new WebSocketServer({ server });

wss.on('connection', (ws: WebSocket) => {
  ws.on('message', async (raw) => {
    try {
      const data = JSON.parse(raw.toString());
      const { type, payload, id } = data;

      switch (type) {
        case 'create_session': {
          const session = router.createSession(payload?.title, payload?.backend, payload?.id);
          store.saveSession(session);
          ws.send(JSON.stringify({ type: 'session_created', id, payload: session }));
          break;
        }

        case 'get_model_config': {
          ws.send(JSON.stringify({ type: 'model_config', id, payload: router.getModelClient().getMaskedConfig() }));
          break;
        }

        case 'set_model_config': {
          router.getModelClient().updateConfig(payload);
          ws.send(JSON.stringify({ type: 'model_config_updated', id, payload: router.getModelClient().getMaskedConfig() }));
          break;
        }

        case 'test_model_connection': {
          const testRes = await router.getModelClient().testConnection();
          ws.send(JSON.stringify({ type: 'model_connection_tested', id, payload: testRes }));
          break;
        }

        case 'list_sessions': {
          const sessions = router.listSessions();
          ws.send(JSON.stringify({ type: 'sessions_list', id, payload: sessions }));
          break;
        }

        case 'send_prompt': {
          const { sessionId, prompt } = payload;
          const msg = await router.handleUserMessage(
            sessionId,
            prompt,
            (chunk) => {
              ws.send(JSON.stringify({ type: 'stream_chunk', sessionId, payload: { chunk } }));
            },
            (toolCall) => {
              ws.send(JSON.stringify({ type: 'tool_call', sessionId, payload: toolCall }));
            },
            (toolResult) => {
              ws.send(JSON.stringify({ type: 'tool_result', sessionId, payload: toolResult }));
            }
          );
          ws.send(JSON.stringify({ type: 'prompt_finished', id, sessionId, payload: msg }));
          break;
        }

        case 'query_rag': {
          const results = rag.query(payload.query, payload.topK || 5);
          ws.send(JSON.stringify({ type: 'rag_results', id, payload: results }));
          break;
        }

        case 'get_audit_logs': {
          const logs = sandbox.getAuditLogs(payload?.sessionId);
          ws.send(JSON.stringify({ type: 'audit_logs', id, payload: logs }));
          break;
        }

        // --- Multi-Agent Workflow Engine ---
        case 'list_workflows': {
          const list = workflow.listWorkflows();
          ws.send(JSON.stringify({ type: 'workflows_list', id, payload: list }));
          break;
        }

        case 'run_workflow': {
          const { workflowId, inputs, sessionId } = payload;
          const runRes = await workflow.executeWorkflow(workflowId, inputs || {}, sessionId);
          ws.send(JSON.stringify({ type: 'workflow_finished', id, payload: runRes }));
          break;
        }

        // --- VibeCoding App Generation ---
        case 'generate_vibecoding_app': {
          const { sessionId, appName, prompt } = payload;
          const project = await vibecoding.generateWebApp(sessionId, appName, prompt);
          ws.send(JSON.stringify({ type: 'vibecoding_generated', id, payload: project }));
          break;
        }

        case 'list_vibecoding_projects': {
          const list = vibecoding.listProjects();
          ws.send(JSON.stringify({ type: 'vibecoding_projects_list', id, payload: list }));
          break;
        }

        // --- AgentGroup Collaboration ---
        case 'run_agent_group': {
          const { sessionId, task } = payload;
          const groupRes = await agentGroup.runCollaboration(sessionId, task);
          ws.send(JSON.stringify({ type: 'agent_group_finished', id, payload: groupRes }));
          break;
        }

        // --- Screen Perception ---
        case 'capture_screen': {
          const { sessionId } = payload || {};
          const screenRes = await screen.captureScreen(sessionId);
          ws.send(JSON.stringify({ type: 'screen_captured', id, payload: screenRes }));
          break;
        }

        // --- Sandbox Terminal Command Execution ---
        case 'execute_sandbox_command': {
          const { command, sessionId } = payload || {};
          const cmdRes = await sandbox.executeCommand(command, sessionId);
          ws.send(JSON.stringify({ type: 'sandbox_command_executed', id, payload: cmdRes }));
          break;
        }

        // --- Skills System ---
        case 'list_skills': {
          const skillList = skills.listSkills();
          ws.send(JSON.stringify({ type: 'skills_list', id, payload: skillList }));
          break;
        }

        // --- Enterprise IM Suite ---
        case 'im_get_init': {
          ws.send(JSON.stringify({
            type: 'im_init_data',
            id,
            payload: {
              channels: imEngine.listChannels(),
              experts: imEngine.listExperts(),
              connectors: imEngine.listConnectors()
            }
          }));
          break;
        }

        case 'im_get_messages': {
          const { channelId } = payload || {};
          const msgs = imEngine.getMessages(channelId || 'chan-all');
          ws.send(JSON.stringify({ type: 'im_messages', id, payload: { channelId, messages: msgs } }));
          break;
        }

        case 'im_send_message': {
          const { channelId, senderId, senderName, text } = payload || {};
          const res = await imEngine.sendMessage(
            channelId || 'chan-all',
            senderId || 'user-1',
            senderName || 'CTO',
            text,
            (token) => {
              ws.send(JSON.stringify({
                type: 'im_message_chunk',
                id,
                payload: { channelId, delta: token }
              }));
            }
          );
          ws.send(JSON.stringify({ type: 'im_message_finished', id, payload: res }));
          break;
        }

        case 'im_test_connector': {
          const { connectorId } = payload || {};
          const testRes = imEngine.testConnector(connectorId);
          ws.send(JSON.stringify({ type: 'im_connector_tested', id, payload: testRes }));
          break;
        }

        default:
          ws.send(JSON.stringify({ type: 'error', id, error: `Unknown event type: ${type}` }));
      }
    } catch (err: any) {
      ws.send(JSON.stringify({ type: 'error', error: err.message }));
    }
  });

  // Welcome handshake
  ws.send(JSON.stringify({
    type: 'connected',
    payload: {
      message: 'Connected to EasyBot Desktop Core Runtime',
      version: '1.0.0',
      activeSandbox: true,
      features: ['AgentFlow', 'VibeCoding', 'AgentGroup', 'HybridRAG', 'MicroSandbox', 'MCPHost']
    }
  }));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n========================================================`);
  console.log(`🚀 [EasyBot Enterprise Core] Desktop Agent Host Started`);
  console.log(`   - LAN Access (同事访问): http://192.168.120.132:${PORT}`);
  console.log(`   - Local Access:        http://127.0.0.1:${PORT}`);
  console.log(`   - WebSocket Bridge:    ws://127.0.0.1:${PORT}`);
  console.log(`   - VibeCoding Preview:  http://127.0.0.1:${PORT}/preview/`);
  console.log(`   - Sandbox Root:        ${WORKSPACE_ROOT}`);
  console.log(`   - Storage Dir:         ${DATA_DIR}`);
  console.log(`   - Skills Dir:          ${SKILLS_DIR}`);
  console.log(`========================================================\n`);
});

// Friendly fallback port 3000: Redirect users to port 5173 / 4100
try {
  const redirectServer = http.createServer((req, res) => {
    res.writeHead(302, { Location: `http://localhost:5173${req.url || ''}` });
    res.end();
  });
  redirectServer.listen(3000, '0.0.0.0', () => {
    console.log(`🧭 [EasyBot] Port 3000 helper active -> forwarding to http://localhost:5173`);
  });
  redirectServer.on('error', () => {
    // Port 3000 occupied, ignore
  });
} catch (_) {}
