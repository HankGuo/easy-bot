# EasyBot · 企业级桌面智能体操作系统 (Enterprise Desktop Agent OS)

> **工业级商用版 · 基于 DeepSeek Harness (`@deepseek-ai/dsh`) 官方运行时驱动**

---

## 📖 项目简介

**EasyBot** 是一款面向制造工厂、企事业单位研发协同、规程流转与设备排错的下一代轻量化桌面智能体操作系统。

项目彻底终结传统重型中台架构（Java SpringBoot + MySQL + Redis + Milvus）的臃肿技术债务，全面采用 **DeepSeek 官方开源的 DeepSeek Harness 运行时底座 (MIT 协议)**，结合纯 TypeScript 原生同构架构，具备**客户自备硬件零成本、3 大自服务数据接入插槽（共享目录热插拔、网页拖拽、REST API）、1 人 4 天标准化交付**等核心商业优势。

---

## 🏛️ 七层全栈技术架构

```
┌────────────────────────────────────────────────────────────────────────┐
│ L1: 宿主与表现层 (UI Shell) ── React 18 + Ant Design 5.0 + Tailwind     │
│     工业专家协同大厅 / 任务流水线 / 自服务知识库管理 / 真实算力审计看板   │
├────────────────────────────────────────────────────────────────────────┤
│ L2: 协议与协同层 (Protocol & Connectors) ── ACP 标准规范 + WebSocket    │
│     企业微信 / 钉钉 / 飞书 办公扫码免密直连通道                         │
├────────────────────────────────────────────────────────────────────────┤
│ ★ L3: 智能体循环核心 (Agent Loop) ── DeepSeek Harness (@deepseek-ai/dsh)│
│     Cordis 插件化架构 / 任务状态机 / 步骤生命周期治理 / 异常自愈熔断     │
├────────────────────────────────────────────────────────────────────────┤
│ L4: 多模型抽象网关 (LLM Gateway) ── Universal Model Client             │
│     SenseNova (默认) / 任意 OpenAI 兼容接口 / 客户自选 API (BYOK)       │
├────────────────────────────────────────────────────────────────────────┤
│ L5: 扩展生态与双路 RAG ── MCP Protocol + Okapi BM25 + 向量 bge-m3 RRF  │
│     机床型号与报警码 E-xx 100% 精准匹配 / 工艺指导书语义深度理解         │
├────────────────────────────────────────────────────────────────────────┤
│ L6: 自服务知识插槽 ── Hot-Drop Folder Watcher & Multi-Format Ingestion  │
│     knowledge_drop/ 共享目录热插拔监听 / 网页自服务拖拽 / REST API     │
├────────────────────────────────────────────────────────────────────────┤
│ L7: 受限安全代码微沙箱 ── Micro-Sandbox 内核 (对标 CubeSandbox 规范)    │
│     物理隔离保护 / 路径越权拦截 / 高危指令阻断 / 全量审计流水存证       │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 🚀 核心特性

1. **实用工业与企业专家矩阵 (Industrial IM Network)**：
   - 预置马工（设备运维与故障诊断专家）、刘主管（生产工艺与质检主管）、王科长（物料BOM与核算专家）、赵安全（安环与安全生产专员）等实用工业专家；
   - 支持多智能体异步协同排查设备报警码、公差比对与成本预估，支持企业自主增删改角色名与 Prompt。
2. **零保姆自服务知识插槽 (Self-Service Ingestion)**：
   - **共享目录热插拔**：系统自动监听 `knowledge_drop/` 文件夹，员工拷入说明书自动建立索引，删除文件自动注销；
   - **网页端自服务拖拽**：支持 `.txt`、`.md`、`.json`、`.csv` 文件拖拽解析与手动文本粘贴入库；
   - **标准 REST API 接口**：支持 `POST /api/knowledge/upload` 与 `POST /api/knowledge/sync`。
3. **真实 Token 消耗与财务计量看板 (Zero-Mock Telemetry)**：
   - 彻底剔除所有静态假数据，100% 呈现大模型真实调用时延、Token 吞吐明细与核算成本。
4. **受限安全代码微沙箱 (Micro-Sandbox)**：
   - 严格路径越权拦截（Path Traversal 防逃逸），高危指令实时阻断；
   - 安全隔离执行计算、数据清洗与脚本任务，绝不越权侵入生产内网。
5. **极轻资产交付，毛利率超 85%**：
   - 硬件由客户自备（普通办公机或虚拟机即可），零硬件采购包袱；
   - 算力支持客户自选（BYOK）或年费全包托管。

---

## ⚡ 快速启动

### 1. 安装依赖与编译
```bash
cd easy-bot
npm install
npm run build
```

### 2. 启动服务 (默认监听 0.0.0.0:4100)
```bash
npm start
```

- **工作台主入口**：`http://localhost:4100`
- **工业级商用方案白皮书**：`http://localhost:4100/solution`
- **七层技术架构蓝图**：`http://localhost:4100/architecture`
- **DeepSeek Harness 状态 API**：`http://localhost:4100/api/dsh/status`
- **自服务知识库资产 API**：`http://localhost:4100/api/knowledge/documents`
- **真实 Token 计量审计 API**：`http://localhost:4100/api/telemetry/tokens`

### 3. 运行端到端工业真实场景测试
```bash
node test-enterprise-cases.mjs
```

---

## 📄 商业白皮书与架构看板

- 完整商用方案白皮书：[`easy-bot/commercial_industrial_solution.html`](file:///Users/hankia/AISpace/edux/easy-bot/commercial_industrial_solution.html)
- 技术选型架构蓝图：[`easy-bot/architecture_blueprint_dashboard.html`](file:///Users/hankia/AISpace/edux/easy-bot/architecture_blueprint_dashboard.html)

---

## 📜 许可证

本项目业务封装自主可控；底层智能体核心基于 MIT 协议开源的 **DeepSeek Harness (`@deepseek-ai/dsh`)**。
