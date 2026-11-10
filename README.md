# EduAgent OS (edux) · 高校智能科研与实验实训工作台

> **工业级商用版 · 基于 DeepSeek Harness (`@deepseek-ai/dsh`) 官方运行时驱动**

---

## 📖 项目简介

**EduAgent OS (edux)** 是专为高等院校科研课题组、计算机实验实训示范中心定制的下一代智能 Agent 操作系统。

项目彻底终结传统重型中台架构（Java SpringBoot + MySQL + Redis + Milvus）的臃肿技术债务，全面采用 **DeepSeek 官方开源的 DeepSeek Harness 运行时底座 (MIT 协议)**，结合纯 TypeScript 原生同构架构，具备极致轻量、零依赖开箱即用、100% 物理断网纯内网私有化部署等核心优势。

---

## 🏛️ 七层全栈技术架构

```
┌────────────────────────────────────────────────────────────────────────┐
│ L1: 宿主与表现层 (UI Shell) ── React 18 + Ant Design 5.0 + Tailwind     │
│     课题组研讨厅 / 导师专家团 / 交互实验生成 / 文献查阅 / 算力审计大盘    │
├────────────────────────────────────────────────────────────────────────┤
│ L2: 协议与协同层 (Protocol & Connectors) ── ACP 标准规范 + WebSocket    │
│     高校企业微信 / 钉钉校园版 / 飞书教育版 / 高校 Git 实训平台直连       │
├────────────────────────────────────────────────────────────────────────┤
│ ★ L3: 智能体循环核心 (Agent Loop) ── DeepSeek Harness (@deepseek-ai/dsh)│
│     Cordis 插件化架构 / 任务状态机 / 步骤生命周期治理 / 异常自愈熔断     │
├────────────────────────────────────────────────────────────────────────┤
│ L4: 多模型抽象网关 (LLM Gateway) ── Universal Model Client             │
│     SenseNova (测试用) / 校园私有 vLLM (Qwen2.5-Coder / DeepSeek-R1)   │
├────────────────────────────────────────────────────────────────────────┤
│ L5: 学术生态与双路 RAG ── MCP Protocol + Okapi BM25 + 向量 bge-m3 RRF  │
│     教材专有名词高保真匹配 / 课题论文意图语义深度理解                    │
├────────────────────────────────────────────────────────────────────────┤
│ L6: 教学多模态感知 ── Screen Perception & Nut.js 原生驱动              │
│     PPT 课件图表识别 / 复杂公式提取 / 软件实训操作定位                 │
├────────────────────────────────────────────────────────────────────────┤
│ L7: 受限安全实训沙箱 ── Micro-Sandbox 内核 (对标 CubeSandbox 规范)      │
│     教学主机物理隔离 / 路径越权拦截 / 高危指令阻断 / 全量审计流水存证   │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 🚀 核心特性

1. **课题组学术研讨厅 (Campus IM)**：
   - 预置张云峰教授（学术导师）、李维老师（实训助教）、赵铁卫研究员（论文审查）等 6 大高校导师矩阵；
   - 支持多智能体异步协同开题、同行评审与答辩建议。
2. **受限安全代码实训沙箱 (Micro-Sandbox)**：
   - 严格路径越权拦截（Path Traversal 防逃逸），高危指令实时阻断；
   - 支持学生安全执行 Python、C 等交互实验脚本与散点图生成。
3. **课程讲义与学术文献库 (双路 Hybrid RAG)**：
   - Okapi BM25 词项精准倒排 + 向量稠密检索 + RRF 倒数融合重排；
   - 解决高校教材冷门专有名词易幻觉错漏的问题。
4. **校园算力与 Token 消耗审计看板**：
   - 实时审计各院系师生推理 Token 配额、平均响应延迟与单次调用成本；
   - 支持本地私有 GPU 算力节点（vLLM / Ollama）直接纳管。
5. **开箱即用，零客户端安装**：
   - 单台商用机一键拉起，局域网内师生通过浏览器即可直接访问。

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
- **七层技术选型看板**：`http://localhost:4100/architecture`
- **DeepSeek Harness 状态 API**：`http://localhost:4100/api/dsh/status`

### 4. 运行全链路场景测试
```bash
node test-university-cases.mjs
```

---

## 📄 商业解决方案与白皮书

- 完整商用方案看板：[`easy-bot/commercial_industrial_solution.html`](file:///Users/hankia/AISpace/edux/easy-bot/commercial_industrial_solution.html)
- 技术选型架构蓝图：[`easy-bot/architecture_blueprint_dashboard.html`](file:///Users/hankia/AISpace/edux/easy-bot/architecture_blueprint_dashboard.html)

---

## 📜 许可证

本项目业务封装与高校模块自主可控；底层智能体核心基于 MIT 协议开源的 **DeepSeek Harness (`@deepseek-ai/dsh`)**。
