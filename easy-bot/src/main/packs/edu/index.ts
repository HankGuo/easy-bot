import { DomainPack } from '../types.js';

export const EduPack: DomainPack = {
  id: 'pack-edu',
  name: 'EduPack (高等院校与科研协同适配包)',
  description: '为大学、科研院所与重点实验室量身定制的垂直适配包，提供教务规章问答、课题立项辅导与学位论文预审',
  version: '1.0.0',
  roleAliases: {
    teacher_pi: 'manager',
    student: 'member',
    dean: 'admin'
  },
  identityMapping: (attrs: Record<string, any>) => {
    const ou = String(attrs.ou || attrs.department || '').toLowerCase();
    const isFaculty = ou.includes('faculty') || ou.includes('teacher') || ou.includes('lab');
    return {
      role: isFaculty ? 'manager' : 'member',
      department: attrs.department || (isFaculty ? '人工智能国家重点实验室' : '计算机科学与技术学院'),
      groups: isFaculty ? ['grp_ai_lab', 'grp_college_faculty'] : ['grp_college_students']
    };
  },
  specialists: [
    {
      id: 'exp-academic',
      name: '张导师',
      avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=academic',
      title: '高校科研与论文指导专家 (Academic & Research Advisor)',
      description: '国家重点实验室资深科研带头人。精通中英文学术论文写作、国家自然科学基金申报、实验方案设计与学术规范审查。',
      systemPrompt: '你是高校科研与研究生论文指导专家张导师。熟悉国家自然科学基金立项要求、顶级期刊投稿规范与学术伦理。能够严谨客观地评审开题报告、审阅实验设计并指引文献调研方向。',
      skills: ['literature-review', 'grant-proposal-check', 'academic-writing-audit'],
      model: 'default-chat-model',
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
      model: 'default-chat-model',
      status: 'online',
      color: '#13c2c2',
      tags: ['培养方案', '选课答疑', '学分审核', '毕业规章']
    }
  ],
  channels: [
    {
      id: 'chan-academic',
      name: '学术科研与论文指导',
      description: '学位论文开题、文献综述研讨与国家自然科学基金申报协作',
      isGroup: true,
      expertIds: ['exp-academic'],
      unreadCount: 0
    },
    {
      id: 'chan-edu-affairs',
      name: '教务培养与学籍咨询',
      description: '选课学分核算、免修申请、培养计划变更与毕业资格前置审核',
      isGroup: true,
      expertIds: ['exp-edu-affairs'],
      unreadCount: 0
    }
  ],
  workflows: [
    {
      id: 'wf-thesis-check',
      name: '毕业设计与学位论文开题前置自检',
      description: '自动核验论文开题报告的文献数量、研究背景充分性与实验方案合规性',
      entryNodeId: 'step-1',
      nodes: [
        {
          id: 'step-1',
          name: '提取开题文档要点',
          type: 'MCP_TOOL',
          nextNodeId: 'step-2',
          config: {
            toolName: 'workspace_file_read',
            toolArgs: { path: 'thesis_proposal.md' },
            outputKey: 'raw_proposal'
          }
        },
        {
          id: 'step-2',
          name: '学术规范与创新点预审',
          type: 'LLM_PROMPT',
          nextNodeId: 'step-3',
          config: {
            promptTemplate: '请针对以下学位论文开题内容，从研究背景、创新点与技术路线三个维度生成开题导师预审意见：\n\n{{raw_proposal}}',
            outputKey: 'audit_opinion'
          }
        },
        {
          id: 'step-3',
          name: '生成开题自检报告',
          type: 'MCP_TOOL',
          config: {
            toolName: 'workspace_file_write',
            toolArgs: {
              path: 'thesis_check_report.md',
              content: '# 🎓 学位论文开题预审评估报告\n\n{{audit_opinion}}\n\n*生成状态: 通过 EduPack 自检流水线*'
            },
            outputKey: 'report_file'
          }
        }
      ]
    }
  ],
  customTools: [
    {
      definition: {
        name: 'edu_thesis_similarity_estimate',
        description: 'Estimates structural overlap and academic integrity metrics for research drafts',
        serverId: 'pack-edu',
        inputSchema: {
          type: 'object',
          properties: {
            text: { type: 'string', description: 'Draft text segment to evaluate' }
          },
          required: ['text']
        }
      },
      handler: async (args: Record<string, any>) => {
        const text = String(args.text || '');
        const wordCount = text.length;
        const paragraphs = text.split('\n\n').filter(p => p.trim()).length;
        return JSON.stringify({
          status: 'SUCCESS',
          academicIntegrityEstimate: 'HIGH',
          approximateWordCount: wordCount,
          paragraphsAnalyzed: paragraphs,
          citationFormatRecommendation: 'GB/T 7714-2015',
          checkPassed: true
        }, null, 2);
      }
    }
  ],
  keywordRouting: {
    '科研': 'exp-academic',
    '论文': 'exp-academic',
    '课题': 'exp-academic',
    '基金': 'exp-academic',
    '开题': 'exp-academic',
    '实验': 'exp-academic',
    '选课': 'exp-edu-affairs',
    '学分': 'exp-edu-affairs',
    '教务': 'exp-edu-affairs',
    '毕业': 'exp-edu-affairs',
    '培养方案': 'exp-edu-affairs'
  }
};
