import * as path from 'node:path';
import * as fs from 'node:fs';

export interface SkillDefinition {
  id: string;
  name: string;
  description: string;
  version: string;
  author?: string;
  tags: string[];
  systemPrompt: string;
  toolsRequired: string[];
}

/**
 * Standard Skills Package Loader
 * Parses industry standard SKILL.md specs with YAML frontmatter & markdown instructions
 */
export class SkillLoader {
  private skillsDir: string;
  private skills: Map<string, SkillDefinition> = new Map();

  constructor(skillsDir: string) {
    this.skillsDir = path.resolve(skillsDir);
    if (!fs.existsSync(this.skillsDir)) {
      fs.mkdirSync(this.skillsDir, { recursive: true });
    }
    this.seedDefaultSkills();
    this.loadAllSkills();
  }

  private seedDefaultSkills() {
    const defaultSkills = [
      {
        id: 'vibecoding-fullstack',
        name: 'VibeCoding 全栈开发专家',
        description: '根据自然语言需求自动设计单页或多页响应式 Web 应用并完成沙箱编译',
        version: '1.2.0',
        author: 'EasyBot Core Team',
        tags: ['VibeCoding', 'Frontend', 'React', 'Tailwind'],
        toolsRequired: ['workspace_file_write', 'workspace_file_read', 'workspace_shell_execute'],
        systemPrompt: `你是资深全栈 VibeCoding 架构师。遵循以下原则：
1. 输出生产级、无模板感的高品质 UI；
2. 严格将生成代码写入沙箱 workspace/projects 目录；
3. 确保所有脚本自包含、样式自适应并自带交互响应逻辑。`
      },
      {
        id: 'enterprise-security-auditor',
        name: '企业级代码审计与合规卫士',
        description: '深度排查开源套壳、未隔离命令执行、路径穿越攻击与敏感信息泄露',
        version: '2.0.1',
        author: 'EasyBot Security Lab',
        tags: ['Security', 'Audit', 'Sandbox', 'Compliance'],
        toolsRequired: ['workspace_shell_execute', 'hybrid_rag_query'],
        systemPrompt: `你是企业级网安审计专家。
1. 重点监测是否包含 rm -rf、curl管道执行或私有目录非法读取；
2. 校验文件操作是否在指定沙箱边界内；
3. 输出带 SHA256 存证哈希的合规报告。`
      },
      {
        id: 'weknora-hybrid-researcher',
        name: 'WeKnora 混合知识研究员',
        description: '利用 BM25 倒排索引与向量语义检索对企业复杂文档进行多级精细化知识萃取',
        version: '1.0.0',
        author: 'EasyBot AI Lab',
        tags: ['RAG', 'WeKnora', 'BM25', 'Knowledge'],
        toolsRequired: ['hybrid_rag_query'],
        systemPrompt: `你是专业企业知识管理与研报专家。
善于通过 BM25 关键词匹配与稠密向量语义 RRF 融合，从异构知识库中抽离高确定性客观结论，杜绝幻觉。`
      }
    ];

    for (const skill of defaultSkills) {
      const skillPath = path.join(this.skillsDir, `${skill.id}.json`);
      if (!fs.existsSync(skillPath)) {
        fs.writeFileSync(skillPath, JSON.stringify(skill, null, 2), 'utf-8');
      }
    }
  }

  public loadAllSkills(): SkillDefinition[] {
    this.skills.clear();
    const files = fs.readdirSync(this.skillsDir);
    for (const f of files) {
      if (f.endsWith('.json')) {
        try {
          const raw = fs.readFileSync(path.join(this.skillsDir, f), 'utf-8');
          const skill: SkillDefinition = JSON.parse(raw);
          this.skills.set(skill.id, skill);
        } catch {}
      }
    }
    return Array.from(this.skills.values());
  }

  public getSkill(id: string): SkillDefinition | undefined {
    return this.skills.get(id);
  }

  public listSkills(): SkillDefinition[] {
    return Array.from(this.skills.values());
  }
}
