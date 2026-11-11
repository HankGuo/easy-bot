import * as fs from 'node:fs';
import * as path from 'node:path';
import { ModelClient } from './model-client.js';
import { SandboxEngine } from './sandbox-engine.js';
import { HybridRAGEngine } from './hybrid-rag.js';

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
  type: 'wecom' | 'dingtalk' | 'feishu' | 'github' | 'database' | 'webhook';
  description: string;
  status: 'connected' | 'unconfigured' | 'error';
  config: Record<string, any>;
  lastSync?: string;
  stats: {
    totalDispatched: number;
    successRate: number;
  };
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
    // 1. Initial Industry & Enterprise Specialist Roster (6 大实用工业与企业专家)
    const activeModelName = this.modelClient?.getConfig()?.model || process.env.OPENAI_MODEL || 'default-chat-model';
    const defaultExperts: Expert[] = [
      {
        id: 'exp-academic',
        name: '张导师',
        avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=academic',
        title: '高校科研与论文指导专家 (Academic & Research Advisor)',
        description: '国家重点实验室资深科研带头人。精通中英文学术论文写作、国家自然科学基金申报、实验方案设计与学术规范审查。',
        systemPrompt: '你是高校科研与研究生论文指导专家张导师。熟悉国家自然科学基金立项要求、顶级期刊投稿规范与学术伦理。能够严谨客观地评审开题报告、审阅实验设计并指引文献调研方向。',
        skills: ['literature-review', 'grant-proposal-check', 'academic-writing-audit'],
        model: activeModelName,
        status: 'online',
        color: '#722ed1',
        tags: ['科研立项', '论文审稿', '文献综述', '基金申报']
      },
      {
        id: 'exp-edu-affairs',
        name: '王老师',
        avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=affairs',
        title: '教务处与学籍规章答疑专家 (Academic Affairs Guide)',
        description: '熟悉高校本科与研究生培养方案、选课排课规程、学分置换、毕业设计要求与出国成绩审核。',
        systemPrompt: '你是高校教务处综合事务主管王老师。解答各类选课、免修、学分置换、考场纪律与毕业资格审核咨询。回答亲切和蔼、条理清晰，引述具体规章条款。',
        skills: ['curriculum-policy-search', 'credit-exchange-guide', 'graduation-audit'],
        model: activeModelName,
        status: 'online',
        color: '#13c2c2',
        tags: ['培养方案', '选课答疑', '学分审核', '毕业规章']
      },
      {
        id: 'exp-equip',
        name: '马工',
        avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=equip',
        title: '设备运维与故障诊断专家 (Maintenance Engineer)',
        description: '精通数控机床、自动化产线、注塑冲压与工业电气维保；快速解读设备报错代码 (E-xx) 并提供安全排错步骤。',
        systemPrompt: '你是资深工业设备运维专家马工。熟悉机械电气结构、PLC报警代码与设备日常点检维保。回答严谨条理，优先给出停机排查逻辑、安全断电规程与应急处置指南。',
        skills: ['equipment-diagnostics', 'fault-code-lookup', 'safety-reset'],
        model: activeModelName,
        status: 'online',
        color: '#1677ff',
        tags: ['设备排错', '故障代码', '维保SOP', '电气安全']
      },
      {
        id: 'exp-qa',
        name: '刘主管',
        avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=qa',
        title: '生产工艺与质检合规专家 (Quality & Process)',
        description: '熟悉作业指导书 (SOP)、公差配合、制程检验标准 (IPQC/FQC) 与不良品缺陷成因排查。',
        systemPrompt: '你是资深生产工艺与质检主管刘主管。熟悉加工工艺规程、尺寸公差与质检检验标准。擅长分析产品缺陷（起泡、尺寸偏差、划痕、缩水）原因，提供纠偏与工艺参数优化建议。',
        skills: ['process-sop-verify', 'tolerance-check', 'defect-root-cause'],
        model: activeModelName,
        status: 'online',
        color: '#52c41a',
        tags: ['工艺指导书', '质检标准', '缺陷排查', '制程把控']
      },
      {
        id: 'exp-bom',
        name: '王科长',
        avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=bom',
        title: '物料BOM与采购核算员 (BOM & Costing)',
        description: '擅长多层级物料清单 (BOM) 核对、工艺定额损耗计算、非标定制件技术参数比对与快速成本预估。',
        systemPrompt: '你是物料与成本核算专家王科长。熟悉原材料规格、BOM结构与生产定额损耗。擅长比对非标订单与物料参数，提供准确的损耗估算与报价辅助。',
        skills: ['bom-diff', 'material-loss-calc', 'cost-estimation'],
        model: activeModelName,
        status: 'online',
        color: '#faad14',
        tags: ['BOM比对', '物料损耗', '定额核算', '成本预估']
      },
      {
        id: 'exp-safe',
        name: '赵安全',
        avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=safe',
        title: '厂区安环与安全生产专员 (EHS & Safety)',
        description: '专注于安全生产操作规程、危险作业审批、消防应急自救、劳动防护标准与环保巡检合规。',
        systemPrompt: '你是企业安全与环保专员赵安全。时刻强调“安全第一、预防为主”，严格遵守特种作业、消防通道、劳保穿戴与环保台账标准，严厉杜绝违章冒险作业。',
        skills: ['ehs-audit', 'fire-safety', 'hazard-identification'],
        model: activeModelName,
        status: 'online',
        color: '#ff4d4f',
        tags: ['安全生产', '消防应急', 'EHS合规', '隐患排查']
      },
      {
        id: 'exp-admin',
        name: '陈专员',
        avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=admin',
        title: '综合行政与规章制度专员 (Admin & Policy)',
        description: '熟悉企业规章制度、考勤排班、请假报销、宿舍用餐与新员工入职安全培训制度。',
        systemPrompt: '你是综合行政与制度专员陈专员。熟悉企业内部制度、请休假规程、差旅报销与行政审批，解答规范亲和，帮助员工快速搞清流程规矩。',
        skills: ['policy-query', 'leave-expense-guide', 'employee-handbook'],
        model: activeModelName,
        status: 'online',
        color: '#722ed1',
        tags: ['规章制度', '考勤休假', '报销流程', '行政支持']
      },
      {
        id: 'exp-it',
        name: '周工',
        avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=it',
        title: '办公IT与网络技术专员 (IT & Technical Support)',
        description: '负责厂区网络与打印机调试、系统账号与软件排障、数据备份与共享文件夹权限管理。',
        systemPrompt: '你是企业IT运维专员周工。快速排查局域网连接、网络共享文件夹、打印机脱机与账号权限问题，提供清晰的 step-by-step 排错步骤。',
        skills: ['network-diagnostics', 'printer-troubleshoot', 'backup-verify'],
        model: activeModelName,
        status: 'online',
        color: '#13c2c2',
        tags: ['网络配置', '共享文件夹', '打印机排障', '系统支持']
      }
    ];

    defaultExperts.forEach(exp => this.experts.set(exp.id, exp));

    // 2. Preloaded Channels (企业 IM 频道)
    const defaultChannels: Channel[] = [
      {
        id: 'chan-all',
        name: '企业协同大厅 (General Hall)',
        description: '全员生产与业务协同讨论群，支持 @任意专家 触发跨岗位协同与即时问答。',
        isGroup: true,
        expertIds: ['exp-equip', 'exp-qa', 'exp-bom', 'exp-safe', 'exp-admin', 'exp-it'],
        unreadCount: 0,
        lastMessage: 'EasyBot 工业协同中心已启动，所有制造与运维专家在线就绪。',
        lastMessageTime: new Date().toLocaleTimeString()
      },
      {
        id: 'chan-equip',
        name: '设备报修与故障排查 (Equipment & Maintenance)',
        description: '设备故障代码 E-xx、电气报警、机械异响与日常点检维保指导。',
        isGroup: true,
        expertIds: ['exp-equip', 'exp-it'],
        unreadCount: 0,
        lastMessage: '设备故障排查专家马工已就绪，请输入机床型号或报警代码。',
        lastMessageTime: new Date().toLocaleTimeString()
      },
      {
        id: 'chan-qa',
        name: '工艺SOP与质检规范 (Quality & Process SOP)',
        description: '作业指导书 SOP 速查、公差配合要求、不合格品缺陷原因分析与纠正措施。',
        isGroup: true,
        expertIds: ['exp-qa'],
        unreadCount: 0,
        lastMessage: '生产工艺与质检主管刘主管已就绪，可随时核对公差与标准。',
        lastMessageTime: new Date().toLocaleTimeString()
      },
      {
        id: 'chan-bom',
        name: '物料BOM与成本核算 (Materials & BOM)',
        description: '非标定制件物料清单比对、定额损耗率计算与原材料规格确认。',
        isGroup: true,
        expertIds: ['exp-bom'],
        unreadCount: 0,
        lastMessage: 'BOM物料与成本核算员王科长在线，可上传物料清单核算定额。',
        lastMessageTime: new Date().toLocaleTimeString()
      },
      {
        id: 'chan-safe',
        name: '安全环保与综合事务 (EHS & Administration)',
        description: '安全生产操作规程、消防应急处置、考勤休假与员工手册速查。',
        isGroup: true,
        expertIds: ['exp-safe', 'exp-admin'],
        unreadCount: 0,
        lastMessage: '安环专员赵安全与行政专员陈专员在线，守护厂区安全生产。',
        lastMessageTime: new Date().toLocaleTimeString()
      }
    ];

    defaultChannels.forEach(c => this.channels.set(c.id, c));

    // 3. Preloaded Connectors (官方与企业生态连接器)
    const defaultConnectors: Connector[] = [
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
      if (lower.includes('设备') || lower.includes('故障') || lower.includes('报警') || lower.includes('机床')) {
        targetExpertId = 'exp-equip';
      } else if (lower.includes('选课') || lower.includes('学分') || lower.includes('教务') || lower.includes('毕业')) {
        targetExpertId = 'exp-edu-affairs';
      } else if (lower.includes('科研') || lower.includes('论文') || lower.includes('基金') || lower.includes('课题')) {
        targetExpertId = 'exp-academic';
      } else {
        targetExpertId = 'exp-admin';
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
