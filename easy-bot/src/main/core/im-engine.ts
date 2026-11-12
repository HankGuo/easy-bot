import * as fs from 'node:fs';
import * as path from 'node:path';
import { ModelClient } from './model-client.js';
import { SandboxEngine } from './sandbox-engine.js';
import { HybridRAGEngine } from './hybrid-rag.js';
import { OctopGatewayDriver } from './octop-driver.js';

export interface Expert {
  id: string;
  name: string;
  avatar: string;
  title: string;
  description: string;
  systemPrompt: string;
  skills: string[];
  model: string;
  status: 'online' | 'busy' | 'offline';
  color: string;
  tags: string[];
}

export interface Channel {
  id: string;
  name: string;
  description: string;
  isGroup: boolean;
  expertIds: string[];
  unreadCount: number;
  lastMessage?: string;
  lastMessageTime?: string;
}

export interface Connector {
  id: string;
  name: string;
  type: 'octop' | 'wecom' | 'dingtalk' | 'feishu' | 'github' | 'database' | 'webhook';
  description: string;
  status: 'connected' | 'unconfigured' | 'error';
  config: Record<string, any>;
  lastSync?: string;
  stats: {
    totalDispatched: number;
    successRate: number;
  };
}

export interface IChannelConnector {
  id: string;
  name: string;
  type: Connector['type'];
  status: Connector['status'];
  config: Record<string, any>;
  init(config: Record<string, any>): Promise<void>;
  testConnection(): Promise<{ success: boolean; latencyMs: number; message: string }>;
}

export interface IMMessage {
  id: string;
  channelId: string;
  senderId: string;
  senderName: string;
  senderRole: 'user' | 'expert' | 'system';
  avatar: string;
  content: string;
  mentions?: string[];
  attachments?: { name: string; size: string; type: string; url?: string }[];
  toolCalls?: { name: string; args: any; output?: string; status: 'executing' | 'done' | 'failed' }[];
  timestamp: string;
}

export class IMEngine {
  private dataDir: string;
  private filePath: string;
  private modelClient: ModelClient;
  private sandbox: SandboxEngine;
  private rag: HybridRAGEngine;

  private experts: Map<string, Expert> = new Map();
  private channels: Map<string, Channel> = new Map();
  private connectors: Map<string, Connector> = new Map();
  private messages: Map<string, IMMessage[]> = new Map(); // channelId -> IMMessage[]
  private keywordRoutingMap: Map<string, string> = new Map();

  constructor(dataDir: string, modelClient: ModelClient, sandbox: SandboxEngine, rag: HybridRAGEngine) {
    this.dataDir = dataDir;
    this.filePath = path.join(dataDir, 'im_store.json');
    this.modelClient = modelClient;
    this.sandbox = sandbox;
    this.rag = rag;

    this.initDefaultData();
    this.loadFromDisk();
  }

  private initDefaultData() {
    // 1. Initial Domain-Neutral Enterprise Specialists (企业级通用专家矩阵)
    const activeModelName = this.modelClient?.getConfig()?.model || process.env.OPENAI_MODEL || 'default-chat-model';
    const defaultExperts: Expert[] = [
      {
        id: 'exp-arch',
        name: '张云峰',
        avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=arch',
        title: '企业系统架构师 (Enterprise System Architect)',
        description: '专注高并发分布式系统、微内核插件治理、企业数据中台治理与安全边界架构。',
        systemPrompt: '你是资深企业系统架构师张云峰。精通微服务设计、微沙箱多租户隔离、高可用保障与技术选型。回答条理清晰，注重系统解耦与防御性架构设计。',
        skills: ['architecture-review', 'high-availability-design', 'security-isolation-audit'],
        model: activeModelName,
        status: 'online',
        color: '#1890ff',
        tags: ['系统解耦', '微沙箱', '高可用', '架构评审']
      },
      {
        id: 'exp-code',
        name: '李工',
        avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=code',
        title: '全栈研发工程师 (Full-Stack Engineer)',
        description: '熟悉主流前后端技术栈、API规范设计、单元测试覆盖率提升与代码重构优化。',
        systemPrompt: '你是资深研发工程师李工。编写干净、高效且具备健壮错误处理的高质量工程代码。',
        skills: ['fullstack-dev', 'code-refactor', 'test-automation'],
        model: activeModelName,
        status: 'online',
        color: '#52c41a',
        tags: ['API设计', '代码审查', '单元测试', '性能优化']
      },
      {
        id: 'exp-ops',
        name: '陈主管',
        avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=ops',
        title: '云原生与自动化运维专家 (DevOps & SRE)',
        description: '精通容器编排、CI/CD流水线、网络隔离、密钥管理与线上突发告警应急处置。',
        systemPrompt: '你是资深 SRE 运维专家陈主管。严守生产高可用红线与安全操作规范。',
        skills: ['k8s-deploy', 'ci-cd-pipeline', 'incident-response'],
        model: activeModelName,
        status: 'online',
        color: '#fa8c16',
        tags: ['CI/CD', '容器云', '故障响应', '安全合规']
      },
      {
        id: 'exp-knowledge',
        name: '知识专员',
        avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=knowledge',
        title: '企业知识与制度问答专员 (Knowledge Specialist)',
        description: '熟悉企业规章制度、报销流程、知识资产检索与通用协同支持。',
        systemPrompt: '你是企业通用知识与制度答疑专员。解答各类流程、考勤报销、文档检索咨询。条理清晰，引述具体规章。',
        skills: ['policy-query', 'knowledge-search', 'onboarding-guide'],
        model: activeModelName,
        status: 'online',
        color: '#722ed1',
        tags: ['规章制度', '知识检索', '协同指引']
      }
    ];

    defaultExperts.forEach(exp => this.experts.set(exp.id, exp));

    // 2. Domain-Neutral Enterprise Channels (企业通用协作总线)
    const defaultChannels: Channel[] = [
      {
        id: 'chan-all',
        name: '企业协同总线 (General Hall)',
        description: '跨部门企业级 Agent 交互、协同派工与任务分发',
        isGroup: true,
        expertIds: ['exp-arch', 'exp-code', 'exp-ops', 'exp-knowledge'],
        unreadCount: 0,
        lastMessage: 'EasyBot 企业级通用协作中枢已就绪。',
        lastMessageTime: new Date().toLocaleTimeString()
      },
      {
        id: 'chan-devops',
        name: '研发效能与安全运维 (Engineering & DevOps)',
        description: '架构设计、代码审查、CI/CD 自动化流水线与安全合规审计',
        isGroup: true,
        expertIds: ['exp-code', 'exp-ops'],
        unreadCount: 0,
        lastMessage: '架构与运维专家在线就绪。',
        lastMessageTime: new Date().toLocaleTimeString()
      }
    ];

    defaultChannels.forEach(c => this.channels.set(c.id, c));

    // 3. Preloaded Connectors (含 TencentCloud Octop 统一网关)
    const defaultConnectors: Connector[] = [
      {
        id: 'conn-octop',
        name: 'TencentCloud Octop 统一通讯网关',
        type: 'octop',
        description: '基于腾讯云开源 Octop Gateway，打通企业微信、钉钉、飞书与 QQ 多平台统一路由与消息下发。',
        status: process.env.OCTOP_GATEWAY_URL ? 'connected' : 'unconfigured',
        config: {
          endpoint: process.env.OCTOP_GATEWAY_URL || 'http://127.0.0.1:5000',
          defaultPlatform: 'wecom'
        },
        lastSync: '待连接',
        stats: { totalDispatched: 0, successRate: 100 }
      },
      {
        id: 'conn-wecom',
        name: '企业微信 (WeCom) 群机器人与消息应用',
        type: 'wecom',
        description: '支持将 Agent 决策与报警推送到企业微信群，支持通过 Webhook 回调接收外部指令。',
        status: 'unconfigured',
        config: {
          webhookUrl: '',
          pushEvents: ['agent_result', 'security_blocked', 'workflow_completed'],
          autoReply: false
        },
        lastSync: '待配置',
        stats: { totalDispatched: 0, successRate: 100 }
      },
      {
        id: 'conn-dingtalk',
        name: '钉钉 (DingTalk) 自建机器人连接器',
        type: 'dingtalk',
        description: '支持钉钉群聊智能互动卡片 (ActionCard)、Markdown 消息与待办审批推送。',
        status: 'unconfigured',
        config: {
          webhookUrl: '',
          secret: ''
        },
        lastSync: '待配置',
        stats: { totalDispatched: 0, successRate: 100 }
      },
      {
        id: 'conn-feishu',
        name: '飞书 (Feishu / Lark) 应用互动卡片',
        type: 'feishu',
        description: '支持飞书开放平台事件订阅、高交互富文本卡片 (Interactive Card) 与多维表格同步。',
        status: 'unconfigured',
        config: {
          appId: '',
          webhookUrl: ''
        },
        lastSync: '待配置',
        stats: { totalDispatched: 0, successRate: 100 }
      },
      {
        id: 'conn-github',
        name: 'GitHub 仓库与 PR 自动化评审',
        type: 'github',
        description: '自动监听 GitHub Webhook，拉取 PR 代码变更并由沙箱专家进行代码质量与安全审计。',
        status: 'unconfigured',
        config: {
          repo: '',
          autoReviewPR: false,
          token: ''
        },
        lastSync: '待配置',
        stats: { totalDispatched: 0, successRate: 100 }
      },
      {
        id: 'conn-db',
        name: 'PostgreSQL / MySQL 生产只读数据库',
        type: 'database',
        description: '连接企业内部关系型数据库，支持自然语言转 SQL、安全只读分析与 Schema 索引推荐。',
        status: 'unconfigured',
        config: {
          host: '',
          port: 5432,
          database: '',
          readOnly: true
        },
        lastSync: '待配置',
        stats: { totalDispatched: 0, successRate: 100 }
      },
      {
        id: 'conn-webhook',
        name: '通用 HTTP REST Webhook 管道',
        type: 'webhook',
        description: '向企业 OA、ERP、CRM 或自建微服务中转站即时转发经过沙箱验真后的结构化数据。',
        status: 'unconfigured',
        config: {
          endpoint: '',
          authHeader: ''
        },
        lastSync: '待配置',
        stats: { totalDispatched: 0, successRate: 100 }
      }
    ];

    defaultConnectors.forEach(conn => this.connectors.set(conn.id, conn));

    // Seed Welcome Messages in General Channel
    const initialMsgs: IMMessage[] = [
      {
        id: 'msg-init-1',
        channelId: 'chan-all',
        senderId: 'sys-0',
        senderName: '系统总线',
        senderRole: 'system',
        avatar: '',
        content: '🎉 EasyBot 工业级企业 IM 协同空间已上线！6位技术专家、5大专业频道与6组主流连接器全部连接成功。',
        timestamp: new Date().toLocaleTimeString()
      },
      {
        id: 'msg-init-2',
        channelId: 'chan-all',
        senderId: 'exp-arch',
        senderName: '张云峰 · 系统架构师',
        senderRole: 'expert',
        avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=arch',
        content: '各位好！我是系统架构师张云峰。当前系统底层已集成真实的 Micro-Sandbox 微沙箱，并采用 WeKnora 规范的 BM25+向量 RRF 双路混合检索。您可以直接提出架构需求，或者使用 @提及 指令与我们共同协作。',
        timestamp: new Date().toLocaleTimeString()
      }
    ];

    this.messages.set('chan-all', initialMsgs);
  }

  private loadFromDisk() {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        const data = JSON.parse(raw);
        if (data.experts) data.experts.forEach((e: Expert) => this.experts.set(e.id, e));
        if (data.channels) data.channels.forEach((c: Channel) => this.channels.set(c.id, c));
        if (data.connectors) data.connectors.forEach((conn: Connector) => this.connectors.set(conn.id, conn));
        if (data.messages) {
          Object.entries(data.messages).forEach(([chanId, msgs]) => {
            this.messages.set(chanId, msgs as IMMessage[]);
          });
        }
      }
    } catch (err) {
      console.error('[IMEngine] Load from disk failed:', err);
    }
  }

  private saveToDisk() {
    try {
      if (!fs.existsSync(this.dataDir)) fs.mkdirSync(this.dataDir, { recursive: true });
      const obj = {
        experts: Array.from(this.experts.values()),
        channels: Array.from(this.channels.values()),
        connectors: Array.from(this.connectors.values()),
        messages: Object.fromEntries(this.messages.entries())
      };
      fs.writeFileSync(this.filePath, JSON.stringify(obj, null, 2), 'utf-8');
    } catch (err) {
      console.error('[IMEngine] Save to disk failed:', err);
    }
  }

  // --- Public APIs ---
  public registerExpert(expert: Expert) {
    this.experts.set(expert.id, expert);
  }

  public registerChannel(channel: Channel) {
    this.channels.set(channel.id, channel);
  }

  public registerKeywordRouting(routing: Record<string, string>) {
    for (const [kw, expertId] of Object.entries(routing)) {
      this.keywordRoutingMap.set(kw.toLowerCase(), expertId);
    }
  }

  public listExperts(): Expert[] {
    return Array.from(this.experts.values());
  }

  public getExpert(id: string): Expert | undefined {
    return this.experts.get(id);
  }

  public listChannels(): Channel[] {
    return Array.from(this.channels.values());
  }

  public listConnectors(): Connector[] {
    return Array.from(this.connectors.values());
  }

  public getMessages(channelId: string): IMMessage[] {
    return this.messages.get(channelId) || [];
  }

  public async sendMessage(
    channelId: string,
    senderId: string,
    senderName: string,
    text: string,
    onToken?: (token: string) => void,
    overrideExpertId?: string
  ): Promise<{ userMessage: IMMessage; expertMessage?: IMMessage }> {
    const channel = this.channels.get(channelId);
    if (!channel) throw new Error(`Channel ${channelId} not found`);

    // 1. Record User Message
    const userMsg: IMMessage = {
      id: 'msg_' + Math.random().toString(36).substring(7),
      channelId,
      senderId,
      senderName,
      senderRole: 'user',
      avatar: 'https://api.dicebear.com/7.x/identicon/svg?seed=' + senderName,
      content: text,
      timestamp: new Date().toLocaleTimeString()
    };

    if (!this.messages.has(channelId)) this.messages.set(channelId, []);
    this.messages.get(channelId)!.push(userMsg);

    // Update Channel last message
    channel.lastMessage = `${senderName}: ${text.slice(0, 30)}`;
    channel.lastMessageTime = userMsg.timestamp;

    // 2. Determine target expert to reply
    let targetExpert: Expert | undefined;

    if (overrideExpertId && this.experts.has(overrideExpertId)) {
      targetExpert = this.experts.get(overrideExpertId);
    }

    if (!targetExpert) {
      // Check @mentions in text
      for (const exp of this.experts.values()) {
        if (text.includes(`@${exp.name}`) || text.includes(`@${exp.title.split(' ')[0]}`)) {
          targetExpert = exp;
          break;
        }
      }
    }

    // Default to the first expert in channel if not mentioned
    if (!targetExpert && channel.expertIds && channel.expertIds.length > 0) {
      targetExpert = this.experts.get(channel.expertIds[0]);
    }

    if (!targetExpert) {
      targetExpert = this.experts.get('exp-arch');
    }

    let expertMsg: IMMessage | undefined;

    if (targetExpert) {
      const history = (this.messages.get(channelId) || []).slice(-8).map(m => ({
        role: m.senderRole === 'user' ? ('user' as const) : ('assistant' as const),
        content: `${m.senderName}: ${m.content}`
      }));

      // Call ModelClient with targetExpert system prompt
      const promptMessages = [
        { role: 'system' as const, content: `${targetExpert.systemPrompt}\n当前所处协同频道: ${channel.name}\n请以专业角色语气回答并解决问题。` },
        ...history,
        { role: 'user' as const, content: text }
      ];

      try {
        const reply = await this.modelClient.streamChat(promptMessages, undefined, onToken);

        expertMsg = {
          id: 'msg_' + Math.random().toString(36).substring(7),
          channelId,
          senderId: targetExpert.id,
          senderName: `${targetExpert.name} · ${targetExpert.title.split(' ')[0]}`,
          senderRole: 'expert',
          avatar: targetExpert.avatar,
          content: reply.content || '已收到您的需求，正在为您处理中。',
          timestamp: new Date().toLocaleTimeString()
        };

        this.messages.get(channelId)!.push(expertMsg);
        channel.lastMessage = `${expertMsg.senderName}: ${expertMsg.content.slice(0, 30)}`;
        channel.lastMessageTime = expertMsg.timestamp;
      } catch (err: any) {
        expertMsg = {
          id: 'msg_' + Math.random().toString(36).substring(7),
          channelId,
          senderId: targetExpert.id,
          senderName: `${targetExpert.name} (系统降级)`,
          senderRole: 'expert',
          avatar: targetExpert.avatar,
          content: `[专家响应暂缓]: ${err.message}`,
          timestamp: new Date().toLocaleTimeString()
        };
        this.messages.get(channelId)!.push(expertMsg);
      }
    }

    this.saveToDisk();
    return { userMessage: userMsg, expertMessage: expertMsg };
  }

  public async testConnector(connectorId: string): Promise<{ success: boolean; latencyMs: number; message: string }> {
    const conn = this.connectors.get(connectorId);
    if (!conn) throw new Error(`Connector ${connectorId} not found`);

    const webhookUrl = (conn.config?.webhookUrl || conn.config?.endpoint || '').trim();

    if (!webhookUrl || webhookUrl.startsWith('mock-') || webhookUrl.includes('••••')) {
      conn.status = 'unconfigured';
      this.saveToDisk();
      return {
        success: false,
        latencyMs: 0,
        message: `[${conn.name}] 未配置有效 Webhook URL，请在设置中输入真实的群机器人 Webhook 地址。`
      };
    }

    const startTime = Date.now();
    try {
      if (conn.type === 'octop') {
        const octop = new OctopGatewayDriver({ endpoint: webhookUrl });
        const isUp = await octop.isAvailable();
        const latencyMs = Date.now() - startTime;
        if (isUp) {
          conn.status = 'connected';
          conn.lastSync = '刚刚';
          this.saveToDisk();
          return {
            success: true,
            latencyMs,
            message: `[${conn.name}] 成功连通 TencentCloud Octop 网关集群 (${latencyMs}ms)`
          };
        } else {
          conn.status = 'error';
          this.saveToDisk();
          return {
            success: false,
            latencyMs,
            message: `[${conn.name}] Octop 网关状态检查未通过`
          };
        }
      }

      const testPayload = conn.type === 'wecom'
        ? { msgtype: 'text', text: { content: '[EasyBot 探针] 连通性测试消息：系统已成功连通。' } }
        : conn.type === 'dingtalk'
        ? { msgtype: 'text', text: { content: '[EasyBot 探针] 连通性测试消息：系统已成功连通。' } }
        : conn.type === 'feishu'
        ? { msg_type: 'text', content: { text: '[EasyBot 探针] 连通性测试消息：系统已成功连通。' } }
        : { event: 'ping', timestamp: new Date().toISOString() };

      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testPayload),
        signal: AbortSignal.timeout(10000)
      });

      const latencyMs = Date.now() - startTime;
      if (res.ok) {
        conn.status = 'connected';
        conn.lastSync = '刚刚';
        conn.stats.totalDispatched += 1;
        this.saveToDisk();
        return {
          success: true,
          latencyMs,
          message: `[${conn.name}] 握手成功，远程端点返回 HTTP ${res.status} (真实往返时延 ${latencyMs}ms)`
        };
      } else {
        conn.status = 'error';
        this.saveToDisk();
        return {
          success: false,
          latencyMs,
          message: `[${conn.name}] 远程服务器返回 HTTP ${res.status} 错误`
        };
      }
    } catch (err: any) {
      conn.status = 'error';
      this.saveToDisk();
      return {
        success: false,
        latencyMs: Date.now() - startTime,
        message: `[${conn.name}] 连接探测失败: ${err.message}`
      };
    }
  }

  /**
   * Handle incoming messages from WeCom, DingTalk, Feishu webhooks
   */
  public async handleInboundMessage(
    platform: 'wecom' | 'dingtalk' | 'feishu',
    body: { senderId: string; senderName: string; content: string; channelId?: string; expertId?: string }
  ): Promise<{ expertName: string; reply: string; channelId: string }> {
    const channelId = body.channelId || 'chan-all';
    let targetExpertId = body.expertId;
    if (!targetExpertId) {
      const lower = body.content.toLowerCase();
      // 1. Dynamic Keyword Routing registered by active Domain Packs
      for (const [kw, expId] of this.keywordRoutingMap.entries()) {
        if (lower.includes(kw) && this.experts.has(expId)) {
          targetExpertId = expId;
          break;
        }
      }
      // 2. Safe Fallback if no specific keyword matched
      if (!targetExpertId) {
        if (this.experts.has('exp-academic') && (lower.includes('科研') || lower.includes('论文') || lower.includes('课题'))) {
          targetExpertId = 'exp-academic';
        } else if (this.experts.has('exp-equip') && (lower.includes('设备') || lower.includes('故障') || lower.includes('机床'))) {
          targetExpertId = 'exp-equip';
        } else {
          const firstExp = Array.from(this.experts.values())[0];
          targetExpertId = firstExp ? firstExp.id : 'exp-arch';
        }
      }
    }

    const result = await this.sendMessage(channelId, body.senderId, body.senderName, body.content, undefined, targetExpertId);
    return {
      expertName: result.expertMessage?.senderName || 'EasyBot 专家',
      reply: result.expertMessage?.content || '已收到需求，处理完成。',
      channelId
    };
  }
}
