import * as http from 'node:http';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as crypto from 'node:crypto';
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
import { LDAPProvider } from './core/auth/ldap-provider.js';
import { CryptoUtil, type JWTPayload } from './core/auth/crypto-util.js';

// Security & Network Configuration
// Default strictly to 127.0.0.1 (local loopback) to prevent unauthenticated LAN/WAN exposure
const HOST = process.env.EASYBOT_HOST || '127.0.0.1';
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 4100;
const WORKSPACE_ROOT = path.resolve(process.env.EASYBOT_WORKSPACE || path.join(process.cwd(), 'workspace'));
const DATA_DIR = path.resolve(process.env.EASYBOT_DATA || path.join(process.cwd(), '.easybot_data'));
const SKILLS_DIR = path.resolve(process.env.EASYBOT_SKILLS || path.join(process.cwd(), 'skills'));
const DROP_DIR = path.resolve(process.env.EASYBOT_KNOWLEDGE_DROP || path.join(process.cwd(), 'knowledge_drop'));

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Persistent Security Admin Token
const TOKEN_FILE = path.join(DATA_DIR, 'admin_token.key');
let AUTH_TOKEN = process.env.EASYBOT_AUTH_TOKEN || '';
if (!AUTH_TOKEN) {
  if (fs.existsSync(TOKEN_FILE)) {
    AUTH_TOKEN = fs.readFileSync(TOKEN_FILE, 'utf-8').trim();
  } else {
    AUTH_TOKEN = crypto.randomBytes(24).toString('hex');
    fs.writeFileSync(TOKEN_FILE, AUTH_TOKEN, 'utf-8');
  }
}

function isLoopback(ip?: string): boolean {
  if (!ip) return false;
  return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
}

// Initialize Enterprise & Campus Core Subsystems
const sandbox = new SandboxEngine(WORKSPACE_ROOT);
const rag = new HybridRAGEngine();
const mcp = new MCPHostManager();
const router = new AgentRouter(sandbox, rag, mcp);
const modelClient = router.getModelClient();
const store = new SessionStore(DATA_DIR);
modelClient.setStore(store);
const workflow = new WorkflowEngine(sandbox, rag, mcp, modelClient);
const vibecoding = new VibeCodingEngine(sandbox, modelClient, PORT);
const screen = new ScreenPerceptionEngine(sandbox);
const skills = new SkillLoader(SKILLS_DIR);
const agentGroup = new AgentGroupCoordinator(sandbox, router, modelClient);
const imEngine = new IMEngine(DATA_DIR, modelClient, sandbox, rag);
const ldapProvider = new LDAPProvider({
  simulationMode: true // Simulation mode enabled by default for air-gapped demo & tests
});

// Seed Initial Campus & Enterprise Identity Hierarchy if fresh
if (store.listUsers().length === 0) {
  const admin = store.createUser({
    id: 'usr_admin',
    username: 'admin',
    passwordHash: CryptoUtil.hashPassword('admin123456'),
    displayName: '系统管理员 (Super Admin)',
    email: 'admin@univ.edu.cn',
    role: 'superadmin',
    authSource: 'local',
    department: '信息化建设与网络安全中心'
  });

  const teacher = store.createUser({
    id: 'usr_zhang',
    username: 'prof_zhang',
    passwordHash: CryptoUtil.hashPassword('prof123456'),
    displayName: '张教授 (PI)',
    email: 'zhang@cs.univ.edu.cn',
    role: 'teacher_pi',
    authSource: 'local',
    department: '人工智能国家重点实验室'
  });

  const student = store.createUser({
    id: 'usr_li',
    username: 'stu_li',
    passwordHash: CryptoUtil.hashPassword('stu123456'),
    displayName: '李同学 (研究生)',
    email: 'li@cs.univ.edu.cn',
    role: 'student',
    authSource: 'local',
    department: '计算机科学与技术学院'
  });

  const gPublic = store.createGroup({
    id: 'grp_all',
    name: '全校公共协作空间',
    departmentOu: 'univ_public',
    description: '面向全校教职员工与学生的公共服务与通用规章'
  });

  const gLab = store.createGroup({
    id: 'grp_ai_lab',
    name: 'AI国家重点实验室涉密课题组',
    departmentOu: 'cs_ai_lab',
    description: '张教授团队未公开实验成果、国自然基金与专利库'
  });

  store.addUserToGroup(admin.id, gPublic.id);
  store.addUserToGroup(admin.id, gLab.id);
  store.addUserToGroup(teacher.id, gPublic.id);
  store.addUserToGroup(teacher.id, gLab.id);
  store.addUserToGroup(student.id, gPublic.id); // Student only in public group by default

  // Grant lab confidential knowledge to lab group only
  store.createResourceGrant({
    id: 'grant_lab_1',
    resourceType: 'knowledge_base',
    resourceId: 'space_ai_lab',
    groupId: gLab.id,
    permission: 'read'
  });
}

// Authentication Resolver: returns User or null
function resolveUser(req: http.IncomingMessage, url: URL): JWTPayload | null {
  const authHeader = req.headers['authorization'];
  let token = '';
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
  } else if (url.searchParams.get('token')) {
    token = url.searchParams.get('token')!;
  }

  if (token) {
    if (token === AUTH_TOKEN) {
      return {
        userId: 'usr_admin',
        username: 'admin',
        displayName: '系统管理员 (Super Admin)',
        role: 'superadmin',
        authSource: 'master_key',
        department: '信息化安全中心',
        groups: ['grp_all', 'grp_ai_lab']
      };
    }
    const jwt = CryptoUtil.verifyJWT(token, AUTH_TOKEN);
    if (jwt) return jwt;
  }

  // Local loopback fallback for developer convenience on 127.0.0.1
  const remoteIp = req.socket.remoteAddress;
  if (HOST === '127.0.0.1' && isLoopback(remoteIp)) {
    return {
      userId: 'usr_loopback',
      username: 'localhost_developer',
      displayName: '本地开发者 (Local Loopback)',
      role: 'superadmin',
      authSource: 'loopback',
      groups: ['grp_all', 'grp_ai_lab']
    };
  }

  return null;
}

// Seed baseline real industrial & university knowledge assets
if (!fs.existsSync(DROP_DIR)) {
  fs.mkdirSync(DROP_DIR, { recursive: true });
}

const existingDropFiles = fs.readdirSync(DROP_DIR).filter(f => !f.startsWith('.'));
if (existingDropFiles.length === 0) {
  fs.writeFileSync(path.join(DROP_DIR, 'SOP-EQ-01_数控机床常见故障与应急排错规程.txt'), `
【数控机床常见故障代码与应急排错规程 (SOP-EQ-01)】
1. 故障代码 E-06: 主轴伺服驱动器过载报警
   - 原因：切削进给量偏大、刀具严重磨损、机械滑台导轨导向润滑不足或丝杠卡入细小铁屑。
   - 处置规程：立即按下【红色紧急停止】，清理丝杠铁屑并加注 ISO VG46 导轨油后重试。
2. 故障代码 E-12: 液压夹具夹紧压力不足报警
   - 处置规程：检查液压泵站油位，将减压阀压力稳定调至 3.5~4.0MPa 额定区间。
`.trim(), 'utf-8');

  fs.writeFileSync(path.join(DROP_DIR, 'EDU-POLICY-01_高校学生学籍管理与选课学分置换办法.txt'), `
【高校本科与研究生学籍管理与选课学分置换办法 (EDU-POLICY-01)】
1. 选课与学分要求：
   - 每学期选课学分下限为 15 学分，上限为 32 学分；超过上限需经指导教师与院教务办特批。
   - 专业核心课重修不及格满 12 学分者，进入学业黄色预警。
2. 毕业设计与开题报告硬性要求：
   - 毕业论文开题必须在第 7 学期第 10 周前完成线上盲审备案；开题未通过者不得进入中期检查。
`.trim(), 'utf-8');
}

// Start Knowledge Drop-Directory Watcher
const dropWatcher = new KnowledgeDropWatcher(DROP_DIR, rag);
dropWatcher.start();

// Create HTTP Server
const server = http.createServer((req, res) => {
  const origin = req.headers.origin;
  if (origin) {
    try {
      const parsedOrigin = new URL(origin);
      if (parsedOrigin.hostname === 'localhost' || parsedOrigin.hostname === '127.0.0.1' || parsedOrigin.hostname === HOST) {
        res.setHeader('Access-Control-Allow-Origin', origin);
      }
    } catch {}
  } else {
    res.setHeader('Access-Control-Allow-Origin', `http://127.0.0.1:${PORT}`);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url || '/', `http://${req.headers.host || '127.0.0.1'}`);

  // Public Health Endpoint
  if (url.pathname === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      name: 'EasyBot EduAgent Core',
      version: '2.5.0-org',
      engine: 'EasyBot Unified Organization Agent OS',
      host: HOST,
      port: PORT,
      authEnforced: true,
      features: ['LDAP', 'MultiTenancy', 'WeComDingTalkGateway', 'HybridRAG', 'ContainerSandbox', 'HITL']
    }));
    return;
  }

  // Public Inbound IM Webhooks (WeCom, DingTalk, Feishu)
  if (url.pathname === '/api/gateway/wecom/callback' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const reply = await imEngine.handleInboundMessage('wecom', {
          senderId: payload.FromUserName || payload.senderId || 'wecom_user',
          senderName: payload.senderName || '企业微信用户',
          content: payload.Content || payload.content || '你好'
        });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, platform: 'wecom', reply }));
      } catch (err: any) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  if (url.pathname === '/api/gateway/dingtalk/callback' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const reply = await imEngine.handleInboundMessage('dingtalk', {
          senderId: payload.senderStaffId || payload.senderId || 'ding_user',
          senderName: payload.senderNick || '钉钉师生',
          content: payload.text?.content || payload.content || '你好'
        });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, platform: 'dingtalk', reply }));
      } catch (err: any) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // Unified Campus / Organization Login Endpoint
  if (url.pathname === '/api/auth/login' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { username, password } = JSON.parse(body || '{}');
        if (!username || !password) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Username and password required' }));
          return;
        }

        // 1. Try local user database authentication
        let user = store.getUserByUsername(username);
        let authenticated = false;

        if (user && user.password_hash) {
          authenticated = CryptoUtil.verifyPassword(password, user.password_hash);
        }

        // 2. If not local or failed, try campus LDAP / Active Directory
        if (!authenticated) {
          const ldapUser = await ldapProvider.authenticate(username, password);
          if (ldapUser) {
            authenticated = true;
            if (!user) {
              // Auto-provision user from LDAP directory
              user = store.createUser({
                id: 'usr_' + crypto.randomUUID().slice(0, 8),
                username: ldapUser.username,
                passwordHash: null, // LDAP accounts don't store local password
                displayName: ldapUser.displayName,
                email: ldapUser.email,
                role: ldapUser.role,
                authSource: 'ldap',
                department: ldapUser.department
              });
              // Assign to default public group
              store.addUserToGroup(user.id, 'grp_all');
              for (const gid of ldapUser.groups) {
                store.addUserToGroup(user.id, gid);
              }
            }
          }
        }

        if (!authenticated || !user) {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Authentication failed: Invalid credentials or unprovisioned user.' }));
          return;
        }

        const userGroups = store.getUserGroupIds(user.id);
        const jwtPayload: JWTPayload = {
          userId: user.id,
          username: user.username,
          displayName: user.display_name,
          role: user.role,
          authSource: user.auth_source,
          department: user.department || undefined,
          groups: userGroups
        };

        const token = CryptoUtil.signJWT(jwtPayload, AUTH_TOKEN);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          token,
          user: {
            id: user.id,
            username: user.username,
            displayName: user.display_name,
            role: user.role,
            department: user.department,
            groups: userGroups
          }
        }));
      } catch (err: any) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // Local-only admin token bootstrap endpoint
  if (url.pathname === '/api/auth/token' && req.method === 'GET') {
    if (!isLoopback(req.socket.remoteAddress)) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Forbidden: Admin token can only be retrieved from local loopback.' }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ token: AUTH_TOKEN }));
    return;
  }

  // Enforce authentication on all protected /api/* endpoints
  if (url.pathname.startsWith('/api/')) {
    const currentUser = resolveUser(req, url);
    if (!currentUser) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized: Valid authentication token or LDAP login required.' }));
      return;
    }

    // Attach user payload to request for downstream authorization
    (req as any).user = currentUser;
  }

  const currentUser = (req as any).user as JWTPayload | undefined;

  // Current User Info Endpoint
  if (url.pathname === '/api/auth/me' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ user: currentUser }));
    return;
  }

  // Organization & Multi-Tenancy Management Endpoints
  if (url.pathname === '/api/org/users' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(store.listUsers()));
    return;
  }

  if (url.pathname === '/api/org/groups' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(store.listGroups()));
    return;
  }

  if (url.pathname === '/api/org/groups' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { id, name, departmentOu, description } = JSON.parse(body || '{}');
        const grp = store.createGroup({ id: id || 'grp_' + crypto.randomUUID().slice(0, 8), name, departmentOu, description });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, group: grp }));
      } catch (err: any) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  if (url.pathname === '/api/org/groups/members' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { userId, groupId } = JSON.parse(body || '{}');
        store.addUserToGroup(userId, groupId);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, userId, groupId }));
      } catch (err: any) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // HITL (Human-in-the-Loop) Approval Endpoints
  if (url.pathname === '/api/hitl/pending' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(store.listPendingHITLRequests()));
    return;
  }

  if (url.pathname === '/api/hitl/resolve' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { id, approved } = JSON.parse(body || '{}');
        const reviewerId = currentUser?.userId || 'admin';
        const ok = store.resolveHITLRequest(id, reviewerId, Boolean(approved));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: ok, id, status: approved ? 'approved' : 'rejected' }));
      } catch (err: any) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // Static Sandboxed WebApp Preview Handler
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

  // REST Endpoints
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
        router.getModelClient().updateConfig(patch);
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
        const { command, sessionId, bypassHITL } = JSON.parse(body);
        const resExec = await sandbox.executeCommand(sessionId || 'default', command, undefined, Boolean(bypassHITL));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(resExec));
      } catch (err: any) {
        if (err.message.startsWith('HITL_INTERCEPTED')) {
          // Record HITL approval request
          const reqItem = store.createHITLRequest({
            id: 'hitl_' + crypto.randomUUID().slice(0, 8),
            sessionId: 'default',
            userId: currentUser?.userId || 'anonymous',
            command: JSON.parse(body).command,
            riskLevel: 'high',
            reason: err.message
          });
          res.writeHead(202, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ hitlRequired: true, requestId: reqItem.id, message: err.message }));
        } else {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
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

  // Scoped Knowledge Ingestion & Retrieval Endpoints
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
        const { filename, content, spaceId, ownerGroupId } = JSON.parse(body);
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

  // Telemetry Tracking
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

  // Enterprise IM Suite
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
        const result = await imEngine.sendMessage(channelId, senderId || currentUser?.userId || 'user-1', senderName || currentUser?.displayName || 'User', text);
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
    req.on('end', async () => {
      try {
        const { connectorId } = JSON.parse(body);
        const result = await imEngine.testConnector(connectorId);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (err: any) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // Static SPA Frontend Server: Fallback all UI routes to dist/renderer
  const staticRoot = path.resolve(process.cwd(), 'dist/renderer');
  let relPath = url.pathname === '/' ? 'index.html' : url.pathname.replace(/^\//, '');
  let targetPath = path.join(staticRoot, relPath);

  if (!targetPath.startsWith(staticRoot)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

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

// WebSocket Server
const wss = new WebSocketServer({ server });

wss.on('connection', (ws: WebSocket, req: http.IncomingMessage) => {
  const wsUrl = new URL(req.url || '/', `http://${req.headers.host || '127.0.0.1'}`);
  const user = resolveUser(req, wsUrl);

  if (!user && HOST !== '127.0.0.1') {
    ws.close(4401, 'Unauthorized');
    return;
  }

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
          const allowedGroups = user?.groups || [];
          const results = rag.queryWithScope(payload.query, allowedGroups, payload.topK || 5);
          ws.send(JSON.stringify({ type: 'rag_results', id, payload: results }));
          break;
        }

        case 'get_audit_logs': {
          const logs = sandbox.getAuditLogs(payload?.sessionId);
          ws.send(JSON.stringify({ type: 'audit_logs', id, payload: logs }));
          break;
        }

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

        case 'run_agent_group': {
          const { sessionId, task } = payload;
          const groupRes = await agentGroup.runCollaboration(sessionId, task);
          ws.send(JSON.stringify({ type: 'agent_group_finished', id, payload: groupRes }));
          break;
        }

        case 'capture_screen': {
          const { sessionId } = payload || {};
          const screenRes = await screen.captureScreen(sessionId);
          ws.send(JSON.stringify({ type: 'screen_captured', id, payload: screenRes }));
          break;
        }

        case 'execute_sandbox_command': {
          const { command, sessionId, bypassHITL } = payload || {};
          try {
            const cmdRes = await sandbox.executeCommand(sessionId || 'default', command, undefined, Boolean(bypassHITL));
            ws.send(JSON.stringify({ type: 'sandbox_command_executed', id, payload: cmdRes }));
          } catch (err: any) {
            if (err.message.startsWith('HITL_INTERCEPTED')) {
              const reqItem = store.createHITLRequest({
                id: 'hitl_' + crypto.randomUUID().slice(0, 8),
                sessionId: sessionId || 'default',
                userId: user?.userId || 'anonymous',
                command,
                riskLevel: 'high',
                reason: err.message
              });
              ws.send(JSON.stringify({ type: 'sandbox_command_hitl', id, payload: { hitlRequired: true, requestId: reqItem.id, message: err.message } }));
            } else {
              ws.send(JSON.stringify({ type: 'error', id, error: err.message }));
            }
          }
          break;
        }

        case 'list_skills': {
          const skillList = skills.listSkills();
          ws.send(JSON.stringify({ type: 'skills_list', id, payload: skillList }));
          break;
        }

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
            senderId || user?.userId || 'user-1',
            senderName || user?.displayName || 'User',
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
          const testRes = await imEngine.testConnector(connectorId);
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

  ws.send(JSON.stringify({
    type: 'connected',
    payload: {
      message: 'Connected to EasyBot EduAgent OS Core Runtime',
      version: '2.5.0-org',
      currentUser: user,
      activeSandbox: true,
      features: ['LDAP', 'MultiTenancy', 'WeComDingTalk', 'HybridRAG', 'ContainerSandbox', 'HITL']
    }
  }));
});

server.listen(PORT, HOST, () => {
  console.log(`\n========================================================`);
  console.log(`🚀 [EasyBot Core] EduAgent OS Organization Host Started`);
  console.log(`   - Binding Host:        http://${HOST}:${PORT}`);
  console.log(`   - Multi-Tenancy:       Active (Schema v2, Users & Groups)`);
  console.log(`   - Identity Provider:   LDAP & Local DB Integrated`);
  console.log(`   - Access Security:     ${HOST === '127.0.0.1' ? 'Local Loopback Isolated (Secure)' : 'Token Auth Enforced'}`);
  console.log(`   - Auth Token:          ${AUTH_TOKEN.slice(0, 6)}...${AUTH_TOKEN.slice(-4)}`);
  console.log(`   - IM Gateways:         WeCom / DingTalk / Feishu Active`);
  console.log(`   - Sandbox Mode:        ${sandbox.getPolicy().backend} (HITL Guard Active)`);
  console.log(`   - WebSocket Bridge:    ws://${HOST}:${PORT}`);
  console.log(`========================================================\n`);
});
