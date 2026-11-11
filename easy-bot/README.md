<div align="center">

# ⚡ EasyBot
### Lightweight Enterprise Agent Workspace · 轻量级企业桌面智能体操作系统

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Protocol: OpenAI-Compatible](https://img.shields.io/badge/AI_Protocol-OpenAI_Compatible_BYOK-purple.svg)](https://platform.openai.com)
[![TypeScript: 5.7+](https://img.shields.io/badge/TypeScript-5.7+-3178c6.svg)](https://www.typescriptlang.org/)
[![Node: >=18](https://img.shields.io/badge/Node.js->=18.0.0-green.svg)](https://nodejs.org/)
[![Security: Loopback Isolated](https://img.shields.io/badge/Security-Loopback_Isolated-emerald.svg)](#-安全机制与网络隔离说明)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/HankGuo/easy-bot/pulls)

**EasyBot** 是一款面向制造工厂、企事业单位研发协同、规程流转与设备排错的轻量级单机桌面智能体工作台。  
终结传统重型微服务中台的高昂运维门槛，采用纯 TypeScript 单体自包含架构，实现 **零厂商绑定 (Zero Lock-in)、客户自备硬件零成本 (¥0 CapEx)、热插拔自服务文件入库、开箱即用的现场排错专家协同**。

[核心理念](#-核心理念与真实工程定位) • [安全隔离说明](#-安全机制与网络隔离说明) • [真实功能清单](#-功能清单真实落地) • [快速启动](#-快速启动) • [开源许可证](#-开源许可证)

---

</div>

## 🌟 核心理念与真实工程定位

- **零厂商绑定的通用模型接入 (Universal BYOK Gateway)**：拒绝单一厂商锁定。全面兼容任意遵循 OpenAI 标准协议的接口服务（云端大模型中转、本地私有化 Ollama / vLLM / LM Studio / SGLang、企业自建网关），支持自带密钥（BYOK）或内网免密直连。
- **自服务热插拔知识注入 (Self-Service Ingestion)**：车间班长或文员只需将规程、BOM 表、设备说明书（`.txt` / `.md` / `.json` / `.csv`）直接拖入 `knowledge_drop/` 文件夹，系统自动完成 SHA256 校验、滑动窗口切块并构建倒排索引；删除文件即刻安全注销。
- **高精准工矿代码 BM25 词法检索**：针对制造现场设备报警码（如 `E-06`）、尺寸公差（如 `h6`、`H7`）、标准号（如 `GB/T 1800.1`）等英数复合代号，基于专业分词的 Okapi BM25 词法倒排索引具备确定性的精准命中能力，杜绝玄学向量可能带来的幻觉与巨额显存开销；同时保留标准向量接口（配置 Embedding API 后可扩展密集向量检索）。
- **实用工业与企业专家矩阵**：预置接地气的车间实战专家提示词路由（设备运维马工、工艺质检刘主管、物料核算王科长、安环专员赵安全）。
- **宽裕大气的开发者交互设计 (Codex / WorkBuddy Style)**：消除双侧边栏挤压感，支持可折叠图标侧边栏（w-64 至 w-16）、抽屉式专家面板、大号字体与舒适行距，拒绝界面拥挤。

---

## 🛡️ 安全机制与网络隔离说明

> [!IMPORTANT]
> **安全边界与隔离等级说明（客观真实原则）**
> 
> 1. **默认本机回环隔离（127.0.0.1）**：EasyBot 默认严格仅监听 `127.0.0.1` 本机回环地址，禁止无防护暴露给外网或局域网；
> 2. **管理令牌保护（Admin Token）**：系统在首次启动时会自动生成高强度管理密钥（保存在 `.easybot_data/admin_token.key` 中，亦可通过环境变量 `EASYBOT_AUTH_TOKEN` 自定义）。任何跨机器网络访问必须在 HTTP Header 中携带 `Authorization: Bearer <TOKEN>` 或 WebSocket 查询参数 `?token=<TOKEN>`，未授权请求一律拒绝（401 Unauthorized）；
> 3. **受限工作区脚本执行器（Workspace Process Guard）**：
>    - 本项目的代码执行能力是基于 `path.relative` 相对路径校验与危险命令模式黑名单（阻断 `rm -rf /`、网络反弹 shell、破坏性操作）；
>    - **它属于应用层安全防护，并非 Docker/cgroups 级别的内核硬件沙箱**。执行的进程拥有宿主运行用户的普通权限，严禁将其作为不受信任多租户的公共 Root 执行环境。

---

## 🏛️ 系统架构分层

```
┌────────────────────────────────────────────────────────────────────────┐
│ L1: 表现层 (UI Shell · Codex/WorkBuddy Style) ── React 18 + Tailwind    │
│     可折叠工作台 / 专家研讨大厅 / 自服务知识库管理 / 真实算力看板          │
├────────────────────────────────────────────────────────────────────────┤
│ L2: 安全网关与鉴权层 (Security & Auth) ── Local Loopback + Admin Token  │
│     127.0.0.1 隔离防护 / Bearer Token 验证 / 路径防逃逸拦截 (Relative Path)│
├────────────────────────────────────────────────────────────────────────┤
│ L3: 通用模型网关 (Universal Model Gateway) ── OpenAI 标准协议兼容       │
│     云端 OpenAI 兼容服务 / 本地私有化 Ollama & vLLM / 企业内部私有网关  │
├────────────────────────────────────────────────────────────────────────┤
│ L4: 工业 SOP 知识库中枢 ── Okapi BM25 Inverted Index + Watcher         │
│     knowledge_drop/ 共享目录热插拔监听 / 英数代码 (E-xx, h6) 精准分词匹配 │
├────────────────────────────────────────────────────────────────────────┤
│ L5: 实用企业智能体协同层 ── Industrial IM Specialists & Context Routing│
│     马工 (设备排错) / 刘主管 (工艺质检) / 王科长 (BOM核算) / 赵安全 (EHS) │
├────────────────────────────────────────────────────────────────────────┤
│ L6: 受限工作区命令执行器 ── Process-Restricted Workspace Execution     │
│     workspace/ 独立目录隔离 / 敏感指令拦截 / 全生命周期审计日志 (Audit)   │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 📋 功能清单（真实落地）

| 模块名称 | 真实工程实现说明 | 状态 |
| :--- | :--- | :--- |
| **通用大模型接入** | • 支持任意兼容 OpenAI `/v1/chat/completions` 的模型（BYOK）<br>• 支持本地私有化 Ollama（`localhost:11434`）、vLLM（`localhost:8000`）<br>• 网页端免重启热更新端点与测试物理时延 | ✅ **真实可用** |
| **安全网络与认证** | • 默认强制监听 `127.0.0.1`，杜绝未认证暴露至 0.0.0.0；<br>• 自动生成持久化 `admin_token.key`，跨设备调用强制 Bearer 鉴权；<br>• 修复目录穿越漏洞，使用 `path.relative` 严格防止路径逃逸 | ✅ **安全已加固** |
| **车间专家研讨大厅** | • 预置 6 位真实工厂专家角色与系统提示词（马工、刘主管、王科长、赵安全、陈专员、周工）；<br>• 支持 `@专家` 精准定向提问与上下文推理；<br>• 顶部集成专家智囊与消息通道直接切换 | ✅ **真实可用** |
| **自服务知识库管理** | • `knowledge_drop/` 文件夹常驻监听，丢入 `.txt/.md/.json/.csv` 自动切块入库，删除即注销；<br>• 基于专业分词的 Okapi BM25 词法检索，专门确保机床故障码 `E-06`、尺寸公差 `h6` 的 100% 确定性召回；<br>• 支持标准 `/v1/embeddings` 密集向量扩展与余弦相似度 RRF 融合 | ✅ **真实可用** |
| **标准 MCP 协议生态** | • 完整实现标准 JSON-RPC 2.0 stdio 传输层客户端；<br>• 自动执行 `initialize` 握手与 `tools/list` 动态工具发现；<br>• 运行时通过 `tools/call` 调度本地子进程外部工具 | ✅ **真实可用** |
| **VibeCoding 极速应用** | • 由真实大模型根据自然语言需求动态编写自包含 HTML5 + Tailwind CSS + 交互式 JavaScript；<br>• 产物落盘至沙箱并在 `127.0.0.1:4100/preview` 安全隔离预览 | ✅ **真实可用** |
| **AgentFlow 任务流水线** | • 支持 DAG 节点调度（知识库检索、沙箱脚本执行、LLM 智能推理、条件分支）；<br>• 条件分支采用安全比较器求值，杜绝危险的 `eval()` 代码注入漏洞 | ✅ **真实可用** |
| **受限终端命令执行** | • 提供在 `workspace/` 内部执行基础构建和脚本的受限命令通道；<br>• 正确接线会话 ID 与命令参数，全量记录审计日志；<br>• 明确标注为应用层过滤，绝不夸大为硬件内核沙箱 | ✅ **真实可用** |
| **Token 计量与 SQLite WAL** | • 开启 `include_usage: true`，优先捕获上游大模型 API 真实上报的 Token 使用量；<br>• 明确标记并展示 `upstream_exact`（精确）与 `estimated_heuristic`（字符估算）；<br>• 所有会话、审计日志与调用账本持久化至 SQLite WAL，重启零丢失 | ✅ **真实可用** |

---

## ⚡ 快速启动

### 1. 安装与构建

```bash
git clone https://github.com/HankGuo/easy-bot.git
cd easy-bot/easy-bot

# 安装依赖
npm install

# 编译主进程与前端
npm run build
```

### 2. 启动服务（默认安全监听 127.0.0.1）

```bash
npm start
```
- 控制台将打印生成的安全管理 Token（同时保存在 `.easybot_data/admin_token.key`）；
- 本地工作台访问地址：`http://localhost:4100`

### 3. 运行自动化测试

```bash
# 运行单元与集成测试（包含路径穿越防护回归、代码分词回归）
npm test

# 运行工业业务场景实测
node test-enterprise-cases.mjs

# 运行端到端全链路交付验证
node test-e2e-delivery.mjs
```

---

## 📜 开源许可证

本项目源码基于 **[MIT 许可证](LICENSE)** 开源。商业闭环、私有化部署、二次开发不受任何限制。

---

<div align="center">
  <sub>Practical, grounded, and honest software engineering for manufacturing efficiency.</sub>
</div>
