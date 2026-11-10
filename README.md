# EasyBot · 企业级桌面智能体操作系统 (Enterprise Desktop Agent OS)

> **工业级通用版 · 基于 DeepSeek Harness (`@deepseek-ai/dsh`) 官方运行时驱动**

---

## 📖 项目简介

**EasyBot** 是一款面向现代化研发协同、知识流转与安全代码执行的下一代企业级桌面智能体操作系统。

项目彻底终结传统重型中台架构（Java SpringBoot + MySQL + Redis + Milvus）的臃肿技术债务，全面采用 **DeepSeek 官方开源的 DeepSeek Harness 运行时底座 (MIT 协议)**，结合纯 TypeScript 原生同构架构，具备极致轻量、零依赖开箱即用、100% 物理断网纯内网私有化部署等核心优势。

---

## 🏛️ 七层全栈技术架构

```
┌────────────────────────────────────────────────────────────────────────┐
│ L1: 宿主与表现层 (UI Shell) ── React 18 + Ant Design 5.0 + Tailwind     │
│     智能专家协同大厅 / 研发与执行 / 流程编排 / 知识检索 / 算力审计大盘    │
├────────────────────────────────────────────────────────────────────────┤
│ L2: 协议与协同层 (Protocol & Connectors) ── ACP 标准规范 + WebSocket    │
│     企业微信 / 钉钉 / 飞书 / GitLab / GitHub 企业集成通道              │
├────────────────────────────────────────────────────────────────────────┤
│ ★ L3: 智能体循环核心 (Agent Loop) ── DeepSeek Harness (@deepseek-ai/dsh)│
│     Cordis 插件化架构 / 任务状态机 / 步骤生命周期治理 / 异常自愈熔断     │
├────────────────────────────────────────────────────────────────────────┤
│ L4: 多模型抽象网关 (LLM Gateway) ── Universal Model Client             │
│     SenseNova (默认) / 任意 OpenAI 兼容接口 / 本地私有化推理集群 (vLLM) │
├────────────────────────────────────────────────────────────────────────┤
│ L5: 扩展生态与双路 RAG ── MCP Protocol + Okapi BM25 + 向量 bge-m3 RRF  │
│     专有名词高保真匹配 / 技术规范与工程资产语义深度理解                  │
├────────────────────────────────────────────────────────────────────────┤
│ L6: 桌面多模态感知 ── Screen Perception & Nut.js 原生驱动              │
│     UI 元素高精度定位 / OCR 文本提取 / 跨窗口应用操作定位               │
├────────────────────────────────────────────────────────────────────────┤
│ L7: 受限安全代码沙箱 ── Micro-Sandbox 内核 (对标 CubeSandbox 规范)      │
│     主机物理隔离 / 路径越权拦截 / 高危指令阻断 / 全量审计流水存证       │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 🚀 核心特性

1. **智能专家协同网络 (Enterprise IM)**：
   - 预置张云峰（系统架构师）、李维（全栈工程师）、赵铁卫（安全合规官）等 6 大企业级智能专家矩阵；
   - 支持多智能体异步协同开题、架构评审与自动化代码编写。
2. **受限安全代码微沙箱 (Micro-Sandbox)**：
   - 严格路径越权拦截（Path Traversal 防逃逸），高危指令实时阻断；
   - 支持安全执行 Python、Node.js 等脚本任务与应用构建。
3. **企业工程与知识资产 (双路 Hybrid RAG)**：
   - Okapi BM25 词项精准倒排 + 向量稠密检索 + RRF 倒数融合重排；
   - 消除专有术语与历史资产检索幻觉。
4. **算力与 Token 消耗审计看板**：
   - 实时审计团队推理 Token 配额、平均响应延迟与单次调用成本；
   - 支持本地私有 GPU 算力节点（vLLM / Ollama）直接纳管。
5. **开箱即用，零客户端安装**：
   - 单台商用机一键拉起，局域网内通过浏览器即可直接访问。

---

## ⚡ 快速启动

### 1. 安装依赖
```bash
cd easy-bot
npm install
```

### 2. 编译项目
```bash
npm run build
```

### 3. 启动服务 (默认监听 0.0.0.0:4100)
```bash
npm start
```

- **工作台主入口**：`http://localhost:4100`
- **工业级商用方案白皮书**：`http://localhost:4100/solution`
- **七层技术架构看板**：`http://localhost:4100/architecture`
- **DeepSeek Harness 状态 API**：`http://localhost:4100/api/dsh/status`

### 4. 运行全链路场景测试
```bash
node test-enterprise-cases.mjs
```

---

## 📄 商业解决方案与白皮书

- 完整商用方案看板：[`easy-bot/commercial_industrial_solution.html`](file:///Users/hankia/AISpace/edux/easy-bot/commercial_industrial_solution.html)
- 技术选型架构蓝图：[`easy-bot/architecture_blueprint_dashboard.html`](file:///Users/hankia/AISpace/edux/easy-bot/architecture_blueprint_dashboard.html)

---

## 📜 许可证

本项目业务封装自主可控；底层智能体核心基于 MIT 协议开源的 **DeepSeek Harness (`@deepseek-ai/dsh`)**。
