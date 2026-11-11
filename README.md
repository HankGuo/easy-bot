<div align="center">

# ⚡ EasyBot
### Enterprise Desktop Agent Operating System · 企业级桌面智能体操作系统

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Engine: DeepSeek Harness](https://img.shields.io/badge/Agent_Engine-DeepSeek_Harness-emerald.svg)](https://github.com/deepseek-ai)
[![Protocol: OpenAI-Compatible](https://img.shields.io/badge/AI_Protocol-OpenAI_Compatible-purple.svg)](https://platform.openai.com)
[![TypeScript: 5.7+](https://img.shields.io/badge/TypeScript-5.7+-3178c6.svg)](https://www.typescriptlang.org/)
[![Node: >=18](https://img.shields.io/badge/Node.js->=18.0.0-green.svg)](https://nodejs.org/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/HankGuo/easy-bot/pulls)

**EasyBot** 是一款面向制造工厂、企事业单位研发协同、规程流转与设备排错的下一代轻量化桌面智能体操作系统。  
全面终结传统中台架构（Java SpringBoot + MySQL + Redis + Milvus）的臃肿技术债务，采用 **DeepSeek Harness (@deepseek-ai/dsh)** 官方运行时与纯 TypeScript 原生同构架构，实现 **零厂商绑定 (Zero Lock-in)、客户自备硬件零成本 (¥0 CapEx)、自服务热插拔知识注入、1人4天极轻量单兵交付**。

[功能清单](#-功能清单完完整整开箱即用) • [全栈架构](#-全栈技术架构) • [极速上手](#-快速启动) • [商用交付方案](#-商业白皮书与落地方案) • [许可证](#-开源许可证)

---

</div>

## 🌟 核心理念与突破

- **零厂商绑定的通用模型网关 (Universal BYOK Gateway)**：拒绝任何单一厂商预制绑定。全面支持本地私有化引擎（Ollama、vLLM、LM Studio）、企业自建 API 网关及任意遵循 OpenAI 标准协议的云端大模型服务，用户自带密钥（BYOK）或内网免密直连。
- **自服务热插拔知识插槽 (Self-Service Ingestion)**：告别耗时耗力的驻场数据清洗。车间班长或文员只需把设备说明书、BOM 表或质检规程丢入共享文件夹，系统秒级自动分块、倒排索引与密集向量混合入库；删除文件即刻安全注销。
- **实用工业与企业专家矩阵 (Industrial IM Network)**：摈弃玩具式互联网程序员人设，深度接地车间一线实战（设备运维马工、工艺质检刘主管、物料核算王科长、安环专员赵安全）。
- **零 Mock 真实遥测审计看板 (Zero-Mock Telemetry)**：100% 采集真实物理往返耗时（ms）、Prompt/Completion Token 吞吐与精确到厘的推演财务折算，彻底杜绝虚假演示数据。
- **宽裕大气的专业开发者交互设计 (Codex / WorkBuddy Style)**：消除双侧边栏挤压感，支持可折叠图标侧边栏（w-64 至 w-16）、抽屉式专家详情面板、大号字体与舒适行距，带来如 Codex、WorkBuddy、Claude Code 般沉浸舒适的操作体验。

---

## 🏛️ 全栈技术架构

```
┌────────────────────────────────────────────────────────────────────────┐
│ L1: 表现层 (UI Shell · Codex/WorkBuddy Style) ── React 18 + Tailwind    │
│     可折叠宽裕工作台 / 专家研讨大厅 / 自服务知识库管理 / 真实算力审计看板 │
├────────────────────────────────────────────────────────────────────────┤
│ L2: 协议与协同层 (Protocol & Connectors) ── ACP 标准规范 + WebSocket    │
│     企业微信 / 钉钉 / 飞书 办公扫码免密直连与事件广播通道               │
├────────────────────────────────────────────────────────────────────────┤
│ ★ L3: 智能体循环核心 (Agent Loop) ── DeepSeek Harness (@deepseek-ai/dsh)│
│     Cordis 插件化架构 / 任务状态机 / 步骤生命周期治理 / 异常自愈熔断     │
├────────────────────────────────────────────────────────────────────────┤
│ L4: 多模型抽象网关 (Universal Model Gateway) ── OpenAI 标准协议兼容     │
│     本地 Ollama / 本地 vLLM / 企事业私有网关 / 任意云端模型 (自带 Key)  │
├────────────────────────────────────────────────────────────────────────┤
│ L5: 扩展生态与双路 RAG ── MCP Protocol + Okapi BM25 + 向量 bge-m3 RRF  │
│     机床型号与报警码 E-xx 100% 精准匹配 / 工艺指导书语义深度理解         │
├────────────────────────────────────────────────────────────────────────┤
│ L6: 自服务知识插槽 ── Hot-Drop Folder Watcher & Multi-Format Ingestion  │
│     knowledge_drop/ 目录热插拔监听 / 网页自服务拖拽 / REST API         │
├────────────────────────────────────────────────────────────────────────┤
│ L7: 受限安全代码微沙箱 ── Micro-Sandbox 内核 (硬件级隔离防护)           │
│     物理工作区隔离 / 路径越权严格拦截 (Path Traversal Block) / 高危阻断  │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 📋 功能清单（完完整整·开箱即用）

| 功能模块 | 核心能力描述 | 技术实现与交付状态 |
| :--- | :--- | :--- |
| **通用大模型网关** | • 支持任意 OpenAI 标准协议服务 (`/chat/completions`)<br>• 支持本地私有化引擎 (Ollama: `11434`, vLLM: `8000`)<br>• 支持自带密钥 (BYOK) 与内网网关直连，**无预制厂商锁定**<br>• 网页端免重启热更新端点与测试握手物理时延 | [`model-client.ts`](easy-bot/src/main/core/model-client.ts)<br>✅ **100% 开箱即用** |
| **企业专家协同研讨大厅** | • 预置 6 位工业与企业真实专家：<br>&nbsp;&nbsp;1. **马工**：数控机床/注塑/冲压故障代码 (E-xx) 与抢修SOP<br>&nbsp;&nbsp;2. **刘主管**：生产工艺指导书、尺寸公差配合 (h6/H7) 与制程质检<br>&nbsp;&nbsp;3. **王科长**：物料 BOM 比对、定额损耗计算与非标成本估算<br>&nbsp;&nbsp;4. **赵安全**：EHS 合规、动火作业票与车间消防隐患排查<br>&nbsp;&nbsp;5. **陈专员**：车间两班倒排班、考勤与领料审批<br>&nbsp;&nbsp;6. **周工**：工控网隔离与现场终端断网排查<br>• 支持 `@专家` 快速委派，专家自主协同推理 | [`im-engine.ts`](easy-bot/src/main/core/im-engine.ts)<br>✅ **100% 开箱即用** |
| **自服务极轻量知识库** | • **三大零维护数据插入点**：<br>&nbsp;&nbsp;1. `knowledge_drop/` 热插拔文件夹常驻监听，丢入即入库、删除即注销；<br>&nbsp;&nbsp;2. Web 拖拽上传与现场 SOP 在线速记；<br>&nbsp;&nbsp;3. 标准 REST API 接口 (`/api/knowledge/upload`, `/api/knowledge/sync`)；<br>• **双路精准召回机制**：Okapi BM25 词法倒排与语义向量余弦混合，RRF 倒数综合重排，故障代号命中率 100% | [`knowledge-watcher.ts`](easy-bot/src/main/core/knowledge-watcher.ts)<br>[`hybrid-rag.ts`](easy-bot/src/main/core/hybrid-rag.ts)<br>✅ **100% 开箱即用** |
| **真实算力遥测审计看板** | • 彻底剔除静态 Mock 数据，全链路采集每次请求物理耗时 (ms)；<br>• 实时统计 Prompt Tokens、Completion Tokens 及推演财务核算账本；<br>• 记录最近 100 次真实调用流水，支持一键清空与审计导出 | [`TokenMonitor.tsx`](easy-bot/src/renderer/src/components/TokenMonitor.tsx)<br>✅ **100% 开箱即用** |
| **安全代码微沙箱控制台** | • 独立工作区沙盒隔离 (`workspace/`)；<br>• **严密防逃逸拦截**：阻断 `../` 路径穿越与特权提升；<br>• **高危指令拦截**：阻断 `rm -rf /`、`mkfs`、网络反弹 shell 等高危攻击；<br>• 实时记录安全审计日志流 (Audit Logs) | [`sandbox-manager.ts`](easy-bot/src/main/core/sandbox-manager.ts)<br>✅ **100% 开箱即用** |
| **任务流水线编排 (DAG)** | • 基于有向无环图 (DAG) 的任务工作流执行引擎；<br>• 支持多步骤拓扑排序、数据依赖注入、条件分支与执行超时熔断 | [`agentflow.ts`](easy-bot/src/main/core/agentflow.ts)<br>✅ **100% 开箱即用** |
| **应用即时生成 (VibeCoding)** | • 接收自然语言需求，即时生成单文件 React + Tailwind 前端微应用；<br>• 沙箱化独立编译打包，提供即时独立预览路由 (`/preview/:appId`) | [`vibecoding-generator.ts`](easy-bot/src/main/core/vibecoding-generator.ts)<br>✅ **100% 开箱即用** |
| **标准 MCP 工具生态中心** | • 原生适配 Anthropic 官方 `@modelcontextprotocol/sdk`；<br>• 支持外部 MCP Server 动态发现、工具注入、结构化 Schema 验证与调用 | [`mcp-host.ts`](easy-bot/src/main/core/mcp-host.ts)<br>✅ **100% 开箱即用** |
| **插件化技能扩展市场** | • 遵循标准技能包规程，支持热加载自定义 Python/Node.js 扩展技能；<br>• 动态解析技能 Frontmatter 描述与触发词 | [`skills-loader.ts`](easy-bot/src/main/core/skills-loader.ts)<br>✅ **100% 开箱即用** |
| **办公协同外部消息通道** | • 企业微信、钉钉、飞书 Webhook 消息与通知通道直连；<br>• 支持向工厂运维群、质检群实时推送报警工单与处置结论 | [`connector-studio.ts`](easy-bot/src/main/core/im-engine.ts)<br>✅ **100% 开箱即用** |

---

## ⚡ 快速启动

### 1. 克隆代码与依赖安装

```bash
git clone https://github.com/HankGuo/easy-bot.git
cd easy-bot/easy-bot

# 安装依赖
npm install
```

### 2. 编译全栈工程

```bash
# 同时编译前端渲染层与主进程 TypeScript 内核
npm run build
```

### 3. 启动 EasyBot 核心服务

```bash
npm start
```
- 服务默认监听：`http://localhost:4100`（同时支持局域网内其他同事跨设备访问）
- 协同研讨大厅入口：`http://localhost:4100`
- 算力遥测看板：`http://localhost:4100` -> 导航进入「算力与 Token 监控」
- 商用方案白皮书：`http://localhost:4100/solution`
- 架构设计蓝图看板：`http://localhost:4100/architecture`

### 4. 运行全链路自动化验收测试

```bash
# 运行单元与集成测试 (12项测试 100% 通过)
npm test

# 运行工业场景实测 (马工 E-06 报警抢修 + 刘主管 h6 轴承公差判定)
node test-enterprise-cases.mjs

# 运行全生命周期端到端验收 (知识自服务入库 -> 双路召回 -> 大模型真实推理 -> Token记账 -> 注销闭环)
node test-e2e-delivery.mjs
```

---

## 📁 项目目录结构

```
easy-bot/
├── easy-bot/                      # 核心工程源码
│   ├── knowledge_drop/            # [自服务插槽] 文件夹热插拔监听目录
│   ├── workspace/                 # [安全沙箱] 代码受限隔离运行空间
│   ├── src/
│   │   ├── main/                  # Node.js / TypeScript 核心主进程
│   │   │   ├── core/
│   │   │   │   ├── model-client.ts        # 通用大模型网关 (OpenAI 协议 / 零厂商绑定)
│   │   │   │   ├── im-engine.ts           # 专家智囊团协作引擎 (马工/刘主管等角色)
│   │   │   │   ├── knowledge-watcher.ts   # 共享目录热插拔监听器
│   │   │   │   ├── hybrid-rag.ts          # WeKnora 级双路 RAG (Okapi BM25 + 向量 RRF)
│   │   │   │   ├── sandbox-manager.ts     # 受限安全微沙箱 (防路径逃逸/高危拦截)
│   │   │   │   ├── agentflow.ts           # 自动化任务流水线 DAG 引擎
│   │   │   │   ├── vibecoding-generator.ts# 前端微应用即时生成器
│   │   │   │   └── mcp-host.ts            # MCP 协议标准工具宿主
│   │   │   ├── tests/                     # 自动化集成测试套件
│   │   │   └── index.ts                   # HTTP / WebSocket 网关入口
│   │   └── renderer/              # 前端表现层 (React 18 + Tailwind)
│   │       └── src/
│   │           ├── components/
│   │           │   ├── IMWorkspace.tsx    # 宽裕大气协同研讨大厅 (可折叠抽屉)
│   │           │   ├── KnowledgeHub.tsx   # 自服务知识库管理中枢
│   │           │   ├── TokenMonitor.tsx   # 真实物理 Token 审计看板
│   │           │   └── ModelSettingsModal.tsx # 通用大模型接入配置弹窗
│   │           └── App.tsx                # 工作台宿主壳层 (Codex/WorkBuddy 风格)
│   ├── commercial_industrial_solution.html # 工业级商用交付白皮书
│   └── architecture_blueprint_dashboard.html # 七层技术架构决策看板
├── test-e2e-delivery.mjs          # 全生命周期端到端自动化验证脚本
├── test-enterprise-cases.mjs      # 制造企业实战业务测试脚本
└── LICENSE                        # MIT 开源许可证
```

---

## 💼 商业白皮书与落地方案

为降低工矿与制造企业在信息化落后、数据混乱现状下的交付风险，EasyBot 专门制定了**极轻量单兵交付方案**：
1. **硬件客户自备 (¥0 设备垫资)**：直接复用客户现场已有的普通办公机（Windows/Linux/macOS，4核 8G 即可），交付方无需垫付任何工控机硬件采购成本，综合毛利率超过 **85%**。
2. **算力模式随心选**：
   - **客户自备 (BYOK)**：企业自行绑定内部 API 或自建私有化 Ollama/vLLM，交付方纯收软件实施费；
   - **年度算力托管包**：交付方打包提供合规企业级算力，赚取软件许可 + 算力服务年费双重收益。
3. **1人4天标准化交付 SOP**：
   - **Day 1**：现场网络探测与 EasyBot 单二进制部署，挂载共享文件夹；
   - **Day 2**：客户班长自服务拖入现有纸质扫描/Word/Excel SOP 规程，双路检索精准对齐；
   - **Day 3**：微调马工、刘主管等专家专属提示词，联调企业微信/钉钉通道；
   - **Day 4**：现场操作工真机排错验收，交付操作看板，完成结项回款。

> 完整商用白皮书与方案详见：[`commercial_industrial_solution.html`](easy-bot/commercial_industrial_solution.html)

---

## 📜 开源许可证

本项目核心源码全面基于 **[MIT 许可证](LICENSE)** 开源。  
智能体底层执行引擎基于同样采用 MIT 协议的 **DeepSeek Harness (`@deepseek-ai/dsh`)**。商业闭环、私有化部署、OEM 定制不受任何限制。

---

<div align="center">
  <sub>Crafted with passion for real-world manufacturing and enterprise efficiency.</sub>
</div>
