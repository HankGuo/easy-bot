import { DomainPack } from '../types.js';

export const GenericPack: DomainPack = {
  id: 'pack-generic',
  name: 'GenericPack (企业通用基础协作包)',
  description: '面向通用企业与数字化园区的标准底座包，提供系统架构规划、代码合规审查与自动化运维诊断',
  version: '1.0.0',
  specialists: [
    {
      id: 'exp-arch',
      name: '张云峰',
      avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=arch',
      title: '企业系统架构师 (Enterprise System Architect)',
      description: '专注高并发分布式系统、微内核插件治理、企业数据中台治理与安全边界架构。',
      systemPrompt: '你是资深企业系统架构师张云峰。精通微服务设计、微沙箱多租户隔离、高可用保障与技术选型。回答条理清晰，注重系统解耦与防御性架构设计。',
      skills: ['architecture-review', 'high-availability-design', 'security-isolation-audit'],
      model: 'default-chat-model',
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
      model: 'default-chat-model',
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
      model: 'default-chat-model',
      status: 'online',
      color: '#fa8c16',
      tags: ['CI/CD', '容器云', '故障响应', '安全合规']
    }
  ],
  channels: [
    {
      id: 'chan-all',
      name: '企业协同总线',
      description: '跨部门企业级 Agent 交互、协同派工与任务分发',
      isGroup: true,
      expertIds: ['exp-arch', 'exp-code', 'exp-ops'],
      unreadCount: 0
    },
    {
      id: 'chan-devops',
      name: '研发效能与安全运维',
      description: '生产发布、代码评审与故障应急处置',
      isGroup: true,
      expertIds: ['exp-code', 'exp-ops'],
      unreadCount: 0
    }
  ],
  workflows: [
    {
      id: 'wf-code-review',
      name: '企业代码工程自动化审计',
      description: '静态扫描工作区源码，分析潜在安全越权风险并生成整改报告',
      entryNodeId: 'step-1',
      nodes: [
        {
          id: 'step-1',
          name: '读取核心代码',
          type: 'MCP_TOOL',
          nextNodeId: 'step-2',
          config: {
            toolName: 'workspace_file_read',
            toolArgs: { path: 'src/index.ts' },
            outputKey: 'raw_code'
          }
        },
        {
          id: 'step-2',
          name: '静态安全与工程规范评审',
          type: 'LLM_PROMPT',
          nextNodeId: 'step-3',
          config: {
            promptTemplate: '对以下源码进行代码规范与安全边界评审，列出潜在风险点与改进建议：\n\n{{raw_code}}',
            outputKey: 'review_comments'
          }
        },
        {
          id: 'step-3',
          name: '输出审计报告',
          type: 'MCP_TOOL',
          config: {
            toolName: 'workspace_file_write',
            toolArgs: {
              path: 'code_review_report.md',
              content: '# 📋 企业代码安全与工程规范审计报告\n\n{{review_comments}}\n\n*生成状态: 经 GenericPack 安全流水线核验*'
            },
            outputKey: 'report_file'
          }
        }
      ]
    }
  ],
  keywordRouting: {
    '架构': 'exp-arch',
    '解耦': 'exp-arch',
    '代码': 'exp-code',
    '开发': 'exp-code',
    '重构': 'exp-code',
    '运维': 'exp-ops',
    '部署': 'exp-ops',
    '容器': 'exp-ops'
  }
};
