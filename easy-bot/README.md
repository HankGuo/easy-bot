<div align="center">

# ⚡ EasyBot · Octop 官方标准多智能体协作平台
### Self-Hosted Multi-User & Multi-Agent Turnkey Workspace Platform  
### 基于 TencentCloud Octop 官方标准架构的自托管多智能体企业工作台

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Upstream: TencentCloud/Octop](https://img.shields.io/badge/Upstream-TencentCloud%2FOctop-0052d9.svg)](https://github.com/TencentCloud/Octop)
[![Architecture: Single_Process](https://img.shields.io/badge/Architecture-Single_Process_Zero_Mesh-success.svg)](#-系统架构)
[![IM Gateways: WeCom_Feishu_DingTalk](https://img.shields.io/badge/IM_Gateways-WeCom_Feishu_DingTalk-orange.svg)](#-原生多渠道-im-连接器)
[![Protocols: Anthropic MCP](https://img.shields.io/badge/Protocol-Anthropic_MCP_Native-purple.svg)](#-标准-mcp-工具协议)

**EasyBot** 采用腾讯云 **TencentCloud/Octop** 官方标准开源架构，提供开箱即用、免复杂微服务编排的**自托管多用户 / 多智能体（Multi-User, Multi-Agent）协同平台**。  
彻底终结多容器过度缝合、端口冲突与数据库密码漂移的痛点，采用**单进程极简模型（Single-Process Model）**与 **SQLite WAL 存储底座**，原生集成**全渠道办公 IM（企微 / 飞书 / 钉钉 / QQ）、AgentTeams 专家团队协作、内置文档知识库 RAG、Anthropic MCP 协议工具箱与 Ant Design 现代化 Web 控制台**。

[核心理念](#-核心理念与架构优势) • [系统架构](#-系统架构) • [原生能力清单](#-原生能力清单) • [快速部署指南](#-快速部署指南) • [诊断与连通性验证](#-诊断与连通性验证) • [开源许可证](#-开源许可证)

---

</div>

## 🌟 核心理念与架构优势

1. **单进程极简模型（Single-Process Zero-Mesh）**：
   - 彻底摒弃将 IM、RAG、沙箱和数据库强行拆成 5~6 个容器的过度缝合设计。
   - 由统一进程承载 FastAPI、智能体运行时、消息网关与定时任务，空载资源占用仅为多容器集群的 1/10，**任何 macOS / Linux / Windows 机器均可一键拉起**。
2. **原生全渠道师生与员工触达（Native IM Gateways）**：
   - 原生开箱支持**企业微信 (WeCom)、飞书 (Lark)、钉钉 (DingTalk)、QQ、Telegram、Discord**。
   - 官方直连链路，双向流式收发，告别第三方自制转发脚本的丢包与断流。
3. **AgentTeams 多智能体专家协同（Multi-Agent System）**：
   - 基于 LangGraph 原理的原生 Expert 体系，支持针对维保、研发、工艺、教务配置专属智能体；
   - 原生支持 `@Agent`、`ask_agent` 跨专家任务交接与独立工作区上下文隔离。
4. **开箱即用文档 RAG（Built-in Knowledge Engine）**：
   - 内置文件解析与文档向量化 RAG 引擎，直接在管理后台拖拽上传文档；
   - 依托 SQLite WAL 原生存储，免去外挂独立向量数据库与 Redis 缓存的运维负担。
5. **官方 Anthropic MCP 标准（Model Context Protocol）**：
   - 原生支持 MCP 协议规范，无缝对接官方与社区 MCP 工具生态；
   - 内置 Playwright 浏览器自动化与终端命令安全执行能力。

---

## 🏛️ 系统架构

```
┌────────────────────────────────────────────────────────────────────────┐
│                        外部多渠道办公触达 (Messaging Channels)          │
│   企业微信 (WeCom)  │  飞书 (Lark)  │  钉钉 (DingTalk)  │  QQ / Telegram│
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ (Webhook / WebSocket 原生双向触达)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│               Octop 官方单进程服务 (Single-Process Engine :8088)       │
├────────────────────────────────────────────────────────────────────────┤
│ 1. 接入层与仪表盘 (Surfaces & API)                                     │
│    • Ant Design Web Console (React 18 + Vite)                          │
│    • RESTful API (FastAPI) + WebSocket 双向实时通道                    │
│    • JWT 多用户鉴权与行级安全隔离 (Row-Level Security)                 │
├────────────────────────────────────────────────────────────────────────┤
│ 2. 智能体中枢与团队协同 (Agent Runtime & Teams)                        │
│    • 多角色专家库 (Expert Roster: 维保工程师 / 工艺专家 / 科研导师)    │
│    • AgentTeams 协同流转 (Task Delegation & Shared Memory)             │
│    • 通用大模型网关 (BYOK: SenseNova / DeepSeek / OpenAI / Ollama)     │
├────────────────────────────────────────────────────────────────────────┤
│ 3. 增强能力底座 (Augmented Capabilities)                               │
│    • 内置文档知识库 (RAG): 本地文档切片与混合语义检索                  │
│    • 工具生态 (Tools & MCP): Anthropic MCP 协议 / 浏览器 / 本地终端     │
│    • 定时调度任务 (Cron): 自然语言驱动的周期性巡检与告警推送           │
├────────────────────────────────────────────────────────────────────────┤
│ 4. 持久化核心 (Persistence Layer)                                      │
│    • 内嵌 SQLite WAL 控制平面 (`~/.octop/`)，零外置数据库依赖          │
│    • 可选挂载至企业级 PostgreSQL（超大规模部署模式）                   │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 📋 原生能力清单

| 核心领域 | 功能特性 | 原生实现依据与标准 | 状态 |
| :--- | :--- | :--- | :---: |
| **办公 IM 通道** | • 企业微信自建应用<br>• 飞书开放平台<br>• 钉钉机器人 | 官方内置各渠道 SDK，支持流式双向通信，无需反向代理中间层 | ✅ **官方原生** |
| **多 Agent 协同** | • Expert 专家人设<br>• AgentTeams 跨角色分发<br>• 独立工作区隔离 | 基于 LangGraph 原理，支持 `@Agent` 委派与结果聚合回传 | ✅ **官方原生** |
| **知识库 RAG** | • 本地文件上传与解析<br>• 文本语义切片与检索<br>• 课题/业务资料库 | 原生内置 RAG 引擎，无需外置 WeKnora、Milvus 或 Redis，开箱即用 | ✅ **官方原生** |
| **工具协议 (MCP)** | • 官方 Anthropic MCP 协议<br>• 动态工具发现与调用<br>• 浏览器自动化 | 官方原生遵循 MCP 协议标准，内置 Playwright 与终端安全调用 | ✅ **官方原生** |
| **组织多用户** | • JWT 安全鉴权<br>• 用户与管理员角色<br>• 行级数据隔离 | 支持多成员独立账号，数据与会话严格按用户隔离 | ✅ **官方原生** |
| **运维复杂度** | • 单容器 / 单 Python 进程<br>• 零外部消息队列依赖<br>• SQLite WAL 存储 | 彻底消除多容器网络不通、密码漂移与 KVM 虚拟化缺失问题 | ✅ **极简生产级** |

---

## ⚡ 快速部署指南

### 1. Docker Compose 一键启动（推荐）

项目根目录已提供官方标准单容器编排文件 `docker-compose.yml`：

```bash
# 1. 复制配置文件模板
cp .env.example .env

# 2. 配置您的模型 Key (如 SenseNova / DeepSeek / OpenAI)
vim .env

# 3. 启动 Octop 服务 (官方端口 8088)
docker compose up -d
```

启动完成后，直接在浏览器中打开 Web 仪表盘：
👉 **http://localhost:8088**

---

### 2. 源码 / Python CLI 极简启动

如果您希望直接在宿主机裸跑，Octop 原生支持 pip 安装：

```bash
# 安装 Python 官方包
pip install octop

# 初始化并启动
octop init
```

---

## 🔍 诊断与连通性验证

项目内置自动化端点探测脚本 `verify-octop.mjs`，可秒级检测系统连通性与健康状态：

```bash
node verify-octop.mjs
```

**输出示例**：
```
================================================================
🚀 TencentCloud Octop Official Deployment Health Probe
================================================================
- Target Endpoint: http://127.0.0.1:8088
- Probing Service: Octop (Single-Process Multi-Agent Platform)
----------------------------------------------------------------

🟢 [PASS] Octop Service is Healthy and Reachable!
   - HTTP Status: 200 OK
   - Round-trip Latency: 12ms
   - Payload: { "status": "healthy", "version": "1.0.3" }

✔ Web Dashboard is ready at: http://127.0.0.1:8088
✔ Native Feishu/WeCom/DingTalk IM gateways active.
✔ Native MCP and Document RAG engines active.
```

---

## 📦 备选：EasyBot 纯原生桌面单体模式（Route B）

如果您仍希望在本地使用由纯 TypeScript/Electron 构建的桌面开发端，EasyBot 原生保留了**100% 进程内直接调用能力**：
- 核心 MCP 工具通过官方 `InMemoryTransport` 内存信道直连；
- 核心 RAG 基于进程内 Okapi BM25 与本地 SQLite WAL；
- 核心沙箱基于本地文件系统 Path Jail；
- 运行测试：`npm test`（173 个纯原生用例 100% 通过，绝无外部容器依赖）。

---

## 📄 开源许可证

本项目遵循 [MIT License](LICENSE)。核心上游组件遵循 [TencentCloud/Octop](https://github.com/TencentCloud/Octop) 开源授权。
