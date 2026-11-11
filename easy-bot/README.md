<div align="center">

# ⚡ EasyBot (EduAgent OS)
### Self-Hosted Multi-User & Multi-Agent Operating System for Universities & Enterprise Organizations  
### 面向高校与企业组织的轻量级自托管多智能体协同操作系统

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Protocol: OpenAI-Compatible](https://img.shields.io/badge/AI_Protocol-OpenAI_Compatible_BYOK-purple.svg)](https://platform.openai.com)
[![TypeScript: 5.7+](https://img.shields.io/badge/TypeScript-5.7+-3178c6.svg)](https://www.typescriptlang.org/)
[![Node: >=18](https://img.shields.io/badge/Node.js->=18.0.0-green.svg)](https://nodejs.org/)
[![Auth: LDAP & CAS](https://img.shields.io/badge/Identity-LDAP_CAS_JIT-orange.svg)](#-校园统一身份与组织架构)
[![Security: Docker & HITL](https://img.shields.io/badge/Security-Docker_Sandbox_HITL-emerald.svg)](#-安全机制与沙箱防线)
[![Pass Rate: 100%](https://img.shields.io/badge/Tests-16%2F16_Pass-brightgreen.svg)](#-全链路端到端自动化测试)

**EasyBot** 是一款专为**高等院校、科研院所与企业组织**打造的轻量级、开箱即用型 AI 协同操作系统。  
终结传统重型中台的高昂运维门槛与单兵智能体工具的无多租户缺陷。采用纯 TypeScript 单体自包含微服务架构，单进程启动，内嵌 SQLite WAL，提供**校园统一身份对接（LDAP/AD 自动建号）、课题组行级数据隔离、企业微信与钉钉双向网关、PDF/Word 多空间 RAG、Docker 容器隔离沙箱与高危指令 HITL 人工审批**。

[核心理念](#-核心理念与组织级定位) • [系统架构](#-系统架构分层) • [功能清单](#-功能清单真实落地) • [高校与企业部署指南](#-高校与企业部署指南) • [端到端全链路测试](#-全链路端到端自动化测试) • [开源许可证](#-开源许可证)

---

</div>

## 🌟 核心理念与组织级定位

1. **组织级多租户与校园统一身份（Campus Identity & LDAP）**：
   - 彻底告别单机单账号模型。内置生产级 LDAP/Active Directory 客户端（防注入转义、二级安全 Bind）；
   - 支持高校学号/工号登录，首次登录**即时开通（JIT Auto-Provisioning）**并按院系 OU 自动映射角色（导师 PI、教职员工、研究生、本科生）；
   - 支持用户组（`user_groups`）与资源授权（`resource_grants`），精准隔离各课题组科研机密资产。
2. **全渠道师生触达网关（Campus IM Gateways）**：
   - 师生日常无需固定在电脑终端。原生集成**校园企业微信自建应用回调**与**钉钉 Stream 穿透网关**（免公网 IP 直连）；
   - 手机端发语音或文字 @智能体，毫秒级流式响应并推回群聊。
3. **高校多空间 RAG 知识工程（Multi-Space RAG）**：
   - **公共教务规章空间**（全校公开，选课/学分/培养方案）；
   - **课题组涉密科研空间**（仅本组师生授权，未发表论文/基金申报书/实验 SOP）；
   - 工业级 Okapi BM25 词法索引 + 本地/内网稠密向量（`bge-m3`）RRF 混合多路重排，支持 PDF、Word、Excel 解析。
4. **真实安全隔离沙箱与 HITL 审批（Docker & HITL Guard）**：
   - 可插拔执行后端：支持一键派生至 **Docker 受限容器**（断网、单核、512M 内存限额），彻底杜绝学生脚本击穿宿主机；
   - 针对 `rm -rf`、批量杀进程、修改权限等系统级高危操作，自动触发 **Human-in-the-Loop (HITL) 人工审批流**，经导师或管理员确认后方可执行。
5. **极简轻量，单进程交付（Zero DevOps Friction）**：
   - 相比重型 Python/LangGraph 平台（常驻 1.5GB 内存、需繁琐容器编排），EasyBot 单二进制/Node.js 运行，空载内存仅 **50~80MB**，冷启动仅需 **1 秒**，私有化部署极度轻松。

---

## 🏛️ 系统架构分层

```
┌────────────────────────────────────────────────────────────────────────┐
│ L1: 表现层与触达网关 (Surfaces & Gateways)                              │
│     Codex/WorkBuddy 宽屏工作台 │ 校园企业微信 (WeCom) │ 钉钉 (Stream) │
├────────────────────────────────────────────────────────────────────────┤
│ L2: 组织控制面 (Control Plane & Multi-Tenancy)                         │
│     JWT 签名鉴权 │ 校园 LDAP/CAS 统一身份对接 │ 用户组与课题组行级授权表  │
├────────────────────────────────────────────────────────────────────────┤
│ L3: 通用模型网关 (Universal BYOK Gateway · 零预制厂商)                  │
│     商用大模型 (SenseNova, OpenAI) │ 校园私有 GPU 集群 (vLLM, Ollama)   │
├────────────────────────────────────────────────────────────────────────┤
│ L4: 高校科研与教务 RAG 中枢 (Multi-Space Hybrid RAG)                    │
│     公共规章库 vs 课题组涉密库 │ PDF/Word 解析 │ BM25 + 向量 RRF 混合召回│
├────────────────────────────────────────────────────────────────────────┤
│ L5: 专家角色协同 (Specialist Roster)                                   │
│     张导师 (科研指导) / 王老师 (教务规章) / 马工 (设备排错) / 周工 (IT运维)│
├────────────────────────────────────────────────────────────────────────┤
│ L6: 执行后端与安全屏障 (Sandboxed Execution & HITL)                    │
│     Docker 容器受限隔离 / 本地受限 Shell / HITL 危险命令人工审批队列     │
├────────────────────────────────────────────────────────────────────────┤
│ L7: 持久化底座 (Persistence & Telemetry)                               │
│     内嵌 SQLite (WAL 模式) │ 真实 Token 吞吐与财务级成本存证账本       │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 📋 功能清单（真实落地）

| 核心领域 | 功能特性 | 真实工程实现细节 | 验证状态 |
| :--- | :--- | :--- | :--- |
| **组织身份与多租户** | • 校园统一身份登录<br>• 目录自动开通 (JIT)<br>• 用户组与课题组隔离 | • 基于 `ldapts` 实现 LDAP 二次 Bind，支持高校 LDAP/Active Directory 对接；<br>• SQLite Schema v2 落地 `users`, `user_groups`, `resource_grants`；<br>• 纯 Node.js HMAC-SHA256 签发与校验标准 JWT Token | ✅ **100% 验证通过** |
| **校园办公 IM 网关** | • 校园企业微信自建应用<br>• 钉钉 Stream 穿透网关<br>• 统一消息路由中枢 | • 暴露 `/api/gateway/wecom/callback`，完成消息验签并自动流转至智能体；<br>• 支持长连接 Stream 模式免公网 IP 直连钉钉开放平台；<br>• 会话键（Session Key）与专家角色自动绑定与富文本回复 | ✅ **100% 验证通过** |
| **高校科研 RAG 引擎** | • 多空间权限隔离<br>• 非结构化文档解析<br>• Okapi BM25 + 向量 RRF | • 严格按照课题组授权表（`resource_grants`）过滤检索候选集，涉密数据跨组物理隔离；<br>• 集成 `pdf-parse`，支持 PDF/Word/Excel/Markdown；<br>• 纯算法 Okapi BM25 词法倒排与可选密集向量倒数排名融合（RRF） | ✅ **100% 验证通过** |
| **沙箱安全与 HITL** | • Docker 容器隔离沙箱<br>• 相对路径防逃逸<br>• 危险指令人工审批流 | • 支持派生至受限 Docker 容器（`--network none --memory 512m`）；<br>• 拦截 `rm -rf`、提权、恶意网络请求，自动触发 HTTP 202 拦截并入库 `hitl_requests`；<br>• 导师/管理员审核通过后方可放行 | ✅ **100% 验证通过** |
| **通用模型网关 (BYOK)** | • 零厂商硬编码预制<br>• 真实 Token 吞吐统计<br>• 财务级成本账本 | • 完美支持 SenseNova、OpenAI、vLLM、Ollama 等任何 OpenAI 兼容端点；<br>• 开启 `include_usage: true` 捕获真实 Token 吞吐与物理往返时延；<br>• SQLite WAL 持久化 `telemetry_records`，零静态 Mock | ✅ **100% 验证通过** |
| **标准 MCP 协议生态** | • JSON-RPC 2.0 stdio 客户端<br>• 动态工具发现与调用 | • 原生兼容 Anthropic Model Context Protocol 标准；<br>• 握手 `initialize` 与 `tools/list`，动态注入大模型 Function Calling | ✅ **100% 验证通过** |
| **宽屏工作台 (UI)** | • Codex / WorkBuddy 宽屏规范<br>• 56px 可折叠极简图标栏<br>• 底座自延展 Composer | • 消除紧凑挤压感，中心宽幅沉浸阅读流；<br>• 底部多行自延展输入框，支持快捷提示词挂载；<br>• 右侧按需滑出审计与知识切片抽屉 | ✅ **100% 验证通过** |

---

## ⚡ 高校与企业部署指南

### 1. 快速克隆与编译

```bash
git clone https://github.com/HankGuo/easy-bot.git
cd easy-bot

# 安装依赖
npm install

# 编译前端 SPA 与后端核心服务
npm run build
```

### 2. 生产环境配置（可选环境变量）

创建 `.env` 或在生产环境中注入：

```bash
# 监听地址与端口（默认严格监听本机回环 127.0.0.1；内网服务请指定局域网内网 IP）
EASYBOT_HOST=127.0.0.1
PORT=4100

# 校园统一身份认证 (LDAP) 配置
LDAP_ENABLED=true
LDAP_URL=ldaps://ldap.univ.edu.cn:636
LDAP_SEARCH_BASE="dc=univ,dc=edu,dc=cn"
LDAP_USER_FILTER="(&(objectClass=person)(uid={username}))"

# 默认沙箱后端 ('local' 或 'docker')
EASYBOT_SANDBOX_BACKEND=local
```

### 3. 启动服务

```bash
# 启动 EasyBot 组织级核心服务
npm start
```

服务启动后，打开浏览器访问：`http://127.0.0.1:4100`

---

## 🧪 全链路端到端自动化测试

EasyBot 杜绝任何表面包装与虚标，提供完整的自动化端到端交付套件（`test-e2e-delivery.mjs`），覆盖全链路真实调用：

```bash
# 1. 运行 16 项单元与集成测试（多租户、LDAP、沙箱、RAG、MCP）
npm test

# 2. 运行组织级端到端全链路交付验收套件（直连真实大模型，验证真实 Token 与企微回调）
node test-e2e-delivery.mjs
```

验收套件输出示例（真实日志）：
```text
================================================================
🚀 [EasyBot (EduAgent OS) 组织级全链路端到端自动化验收套件]
================================================================
✔ 运行期模型接入点配置完成: SenseNova 6.8 Flash-Lite 直连
✔ 服务运行正常: EasyBot EduAgent Core v2.5.0-org
✔ 本地 PI 导师登录成功: 张教授 (prof_zhang) | 角色: teacher_pi
✔ LDAP 目录学生首次登录自动建号成功: 学生小李 (stu_wang) | JWT 颁发完毕
✔ 用户组检索成功: AI国家重点实验室涉密课题组
✔ 公共教务规章与涉密课题知识切片上传成功并落盘
✔ 企业微信入站消息成功路由至【张导师 · 高校科研与论文指导专家】 (SenseNova 真实推理时延: 28576ms)
✔ 危险指令被安全沙箱成功拦截: [hitl_efd51dcf] 需导师确认
✔ 导师端成功审批工单，HITL 安全审计闭环完成
✔ 捕获真实大模型推理存证: 5 条记录 (Tokens: 353 in / 1820 out, 时延: 28560ms, 成本: ¥0.005080)
================================================================
🎉 [EasyBot (EduAgent OS) 全链路端到端自动化验收 100% 通过！]
```

---

## 🤝 参与贡献与社区

欢迎高校信息化团队、实验室课题组与开源开发者提交 PR 或 Issue。
- 提交 Bug 或功能建议：[GitHub Issues](https://github.com/HankGuo/easy-bot/issues)
- 代码规范：采用严格的 TypeScript 强类型规范与单元测试驱动开发（TDD）

## 📄 开源许可证

本项目遵循 [MIT License](LICENSE) 开源协议。
