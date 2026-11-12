import { DomainPack } from './types.js';
import { GenericPack } from './generic/index.js';
import { EduPack } from './edu/index.js';
import { MfgPack } from './mfg/index.js';
import { MCPHostManager } from '../core/mcp-host.js';
import { IMEngine } from '../core/im-engine.js';
import { WorkflowEngine } from '../core/workflow-engine.js';
import { HybridRAGEngine } from '../core/hybrid-rag.js';

export interface KernelContext {
  mcp: MCPHostManager;
  im: IMEngine;
  workflow: WorkflowEngine;
  rag: HybridRAGEngine;
}

export class DomainPackManager {
  private registeredPacks: Map<string, DomainPack> = new Map();
  private activePacks: Map<string, DomainPack> = new Map();

  constructor() {
    // Register standard out-of-the-box domain packs
    this.registerPack(GenericPack);
    this.registerPack(EduPack);
    this.registerPack(MfgPack);
  }

  public registerPack(pack: DomainPack) {
    this.registeredPacks.set(pack.id, pack);
  }

  public getPack(id: string): DomainPack | undefined {
    return this.registeredPacks.get(id);
  }

  public listRegisteredPacks(): DomainPack[] {
    return Array.from(this.registeredPacks.values());
  }

  public listActivePacks(): DomainPack[] {
    return Array.from(this.activePacks.values());
  }

  /**
   * Initializes and mounts active domain packs based on config or EASYBOT_PACKS environment variable
   */
  public async loadActivePacks(packSpecifier?: string, context?: KernelContext): Promise<string[]> {
    const raw = packSpecifier || process.env.EASYBOT_PACKS || 'all';
    const tokens = raw.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
    
    let targetPackIds: string[] = [];
    if (tokens.includes('all')) {
      targetPackIds = Array.from(this.registeredPacks.keys());
    } else {
      for (const t of tokens) {
        if (t === 'edu' || t === 'campus' || t === 'pack-edu') targetPackIds.push('pack-edu');
        else if (t === 'mfg' || t === 'factory' || t === 'pack-mfg') targetPackIds.push('pack-mfg');
        else if (t === 'generic' || t === 'pack-generic') targetPackIds.push('pack-generic');
        else if (this.registeredPacks.has(t)) targetPackIds.push(t);
      }
    }

    if (targetPackIds.length === 0) {
      targetPackIds = ['pack-generic'];
    }

    const loaded: string[] = [];

    for (const packId of targetPackIds) {
      const pack = this.registeredPacks.get(packId);
      if (!pack) continue;

      this.activePacks.set(pack.id, pack);
      loaded.push(pack.id);

      if (context) {
        // 1. Mount Specialists into IM Engine
        if (pack.specialists && context.im) {
          for (const expert of pack.specialists) {
            context.im.registerExpert(expert);
          }
        }

        // 2. Mount Channels into IM Engine
        if (pack.channels && context.im) {
          for (const channel of pack.channels) {
            context.im.registerChannel(channel);
          }
        }

        // 3. Mount Keyword Routing
        if (pack.keywordRouting && context.im) {
          context.im.registerKeywordRouting(pack.keywordRouting);
        }

        // 4. Mount Workflows
        if (pack.workflows && context.workflow) {
          for (const wf of pack.workflows) {
            context.workflow.registerWorkflow(wf);
          }
        }

        // 5. Mount Custom Tools into MCP Host
        if (pack.customTools && context.mcp) {
          for (const tool of pack.customTools) {
            context.mcp.registerCustomTool(tool.definition, tool.handler);
          }
        }

        // 6. Invoke Pack Lifecycle hook
        if (pack.onLoad) {
          await pack.onLoad(context);
        }
      }
    }

    return loaded;
  }
}
