import * as crypto from 'node:crypto';
import * as path from 'node:path';
import { SandboxEngine } from './sandbox-engine.js';
import { HybridRAGEngine } from './hybrid-rag.js';
import { MCPHostManager } from './mcp-host.js';
import { ModelClient } from './model-client.js';
import { SecurityContext } from './auth/security-context.js';

export type WorkflowNodeType = 
  | 'START' 
  | 'LLM_PROMPT' 
  | 'CODE_EXEC' 
  | 'KNOWLEDGE_RETRIEVAL' 
  | 'MCP_TOOL' 
  | 'CONDITION' 
  | 'END';

export interface WorkflowNode {
  id: string;
  name: string;
  type: WorkflowNodeType;
  config?: {
    promptTemplate?: string;
    codeSnippet?: string;
    queryTemplate?: string;
    toolName?: string;
    toolArgs?: Record<string, any>;
    conditionExpr?: string; // e.g. "context.score > 0.5"
    trueNextNodeId?: string;
    falseNextNodeId?: string;
    outputKey?: string;
  };
  nextNodeId?: string;
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  description?: string;
  nodes: WorkflowNode[];
  entryNodeId: string;
}

export type WorkflowTemplate = WorkflowDefinition;

export interface WorkflowExecutionLog {
  nodeId: string;
  nodeName: string;
  nodeType: WorkflowNodeType;
  input: any;
  output: any;
  durationMs: number;
  status: 'SUCCESS' | 'FAILED' | 'SKIPPED';
  error?: string;
}

export interface WorkflowRunResult {
  runId: string;
  workflowId: string;
  status: 'COMPLETED' | 'FAILED';
  finalOutput: any;
  logs: WorkflowExecutionLog[];
  totalDurationMs: number;
}

/**
 * Enterprise AgentFlow DAG Workflow Engine
 * Supports multi-node autonomous reasoning, sandboxed code execution, RAG injection, and conditional branching
 */
export class WorkflowEngine {
  private workflows: Map<string, WorkflowDefinition> = new Map();
  private sandbox: SandboxEngine;
  private rag: HybridRAGEngine;
  private mcp: MCPHostManager;
  private modelClient?: ModelClient;

  constructor(sandbox: SandboxEngine, rag: HybridRAGEngine, mcp: MCPHostManager, modelClient?: ModelClient) {
    this.sandbox = sandbox;
    this.rag = rag;
    this.mcp = mcp;
    this.modelClient = modelClient;

    // Register a default demo pipeline: "Deep Research & Code Generation Pipeline"
    this.registerSampleWorkflow();
  }

  public registerWorkflow(def: WorkflowDefinition) {
    this.workflows.set(def.id, def);
  }

  public getWorkflow(id: string): WorkflowDefinition | undefined {
    return this.workflows.get(id);
  }

  public listWorkflows(): WorkflowDefinition[] {
    return Array.from(this.workflows.values());
  }

  public async executeWorkflow(
    workflowId: string,
    initialInputs: Record<string, any>,
    sessionId: string = 'workflow-run',
    securityContext?: SecurityContext
  ): Promise<WorkflowRunResult> {
    const wf = this.workflows.get(workflowId);
    if (!wf) throw new Error(`Workflow ${workflowId} not found`);

    const runId = crypto.randomUUID();
    const startTime = Date.now();
    const logs: WorkflowExecutionLog[] = [];
    const context: Record<string, any> = { ...initialInputs };

    const nodeMap = new Map(wf.nodes.map(n => [n.id, n]));
    let currentNodeId: string | undefined = wf.entryNodeId;
    let stepCount = 0;
    const MAX_STEPS = 50;

    while (currentNodeId && stepCount < MAX_STEPS) {
      stepCount++;
      const node = nodeMap.get(currentNodeId);
      if (!node) break;

      const nodeStart = Date.now();
      const cfg = node.config || {};
      let nodeOutput: any = null;
      let nextId: string | undefined = node.nextNodeId;
      let nodeStatus: 'SUCCESS' | 'FAILED' = 'SUCCESS';
      let errorMsg: string | undefined;

      try {
        switch (node.type) {
          case 'START':
            nodeOutput = { ...initialInputs };
            break;

          case 'KNOWLEDGE_RETRIEVAL': {
            const query = this.interpolate(cfg.queryTemplate || '', context);
            const allowedGroups = securityContext?.groups || [];
            const hits = await this.rag.queryHybridAsync(query, allowedGroups, 3);
            nodeOutput = hits.map(h => ({
              doc: h.chunk.documentTitle,
              content: h.chunk.content,
              score: h.score
            }));
            if (cfg.outputKey) context[cfg.outputKey] = nodeOutput;
            break;
          }

          case 'CODE_EXEC': {
            const code = this.interpolate(cfg.codeSnippet || '', context);
            // Write script safely into session workspace, avoiding dangerous inline eval flags
            const scriptPath = this.sandbox.validatePathAccess(sessionId, '_workflow_runner.js', 'WRITE');
            const fs = await import('node:fs');
            fs.writeFileSync(scriptPath, code, 'utf-8');

            const execRes = await this.sandbox.executeCommand(
              sessionId,
              'node _workflow_runner.js',
              undefined,
              true // Engine internal automated step runs with verified system authorization
            );
            nodeOutput = execRes.stdout.trim() || execRes.stderr.trim();
            if (cfg.outputKey) context[cfg.outputKey] = nodeOutput;
            break;
          }

          case 'MCP_TOOL': {
            const toolName = cfg.toolName;
            if (!toolName) throw new Error('MCP_TOOL requires toolName');
            if (!this.mcp.hasTool(toolName)) {
              throw new Error(`Tool "${toolName}" not found in MCP registry`);
            }
            
            // Interpolate tool arguments with context
            const toolArgs: Record<string, any> = {};
            if (cfg.toolArgs) {
              for (const [k, v] of Object.entries(cfg.toolArgs)) {
                toolArgs[k] = typeof v === 'string' ? this.interpolate(v, context) : v;
              }
            }

            if (toolName === 'workspace_file_write') {
              const target = toolArgs.path || 'output.txt';
              const content = toolArgs.content || '';
              const validPath = this.sandbox.validatePathAccess(sessionId, target, 'WRITE');
              const fs = await import('node:fs');
              const dir = path.dirname(validPath);
              if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
              fs.writeFileSync(validPath, content, 'utf-8');
              nodeOutput = `Written to ${target} (${Buffer.byteLength(content)} bytes)`;
            } else if (toolName === 'workspace_file_read') {
              const target = toolArgs.path || '';
              const validPath = this.sandbox.validatePathAccess(sessionId, target, 'READ');
              const fs = await import('node:fs');
              nodeOutput = fs.readFileSync(validPath, 'utf-8');
            } else if (toolName === 'workspace_shell_execute') {
              const cmd = toolArgs.command || '';
              const execRes = await this.sandbox.executeCommand(sessionId, cmd, undefined, true);
              nodeOutput = execRes.stdout.trim() || execRes.stderr.trim();
            } else {
              // Real dispatch to external MCP server or registered custom tool with SecurityContext
              nodeOutput = await this.mcp.callTool(toolName, toolArgs, { sessionId, context: securityContext });
            }
            if (cfg.outputKey) context[cfg.outputKey] = nodeOutput;
            break;
          }

          case 'LLM_PROMPT': {
            const prompt = this.interpolate(cfg.promptTemplate || '', context);
            if (!this.modelClient || !this.modelClient.getConfig().apiKey) {
              throw new Error('Workflow LLM 节点执行中断: 未配置大模型 API Key。系统已清空所有模拟返回（Zero-Mock 准则生效）。');
            }
            nodeOutput = await this.modelClient.chat([
              {
                role: 'system',
                content: 'You are an autonomous workflow reasoning node. Execute the task concisely based on provided context and return structured conclusions.'
              },
              {
                role: 'user',
                content: prompt
              }
            ]);
            if (cfg.outputKey) context[cfg.outputKey] = nodeOutput;
            break;
          }

          case 'CONDITION': {
            const expr = this.interpolate(cfg.conditionExpr || 'true', context);
            const conditionPassed = this.safeEvaluateCondition(expr, context);
            nodeOutput = { conditionPassed, expression: expr };
            nextId = conditionPassed ? cfg.trueNextNodeId : cfg.falseNextNodeId;
            break;
          }

          case 'END':
            nodeOutput = { ...context };
            nextId = undefined;
            break;
        }
      } catch (err: any) {
        nodeStatus = 'FAILED';
        errorMsg = err.message;
        nodeOutput = null;
        nextId = undefined; // abort
      }

      logs.push({
        nodeId: node.id,
        nodeName: node.name,
        nodeType: node.type,
        input: { ...context },
        output: nodeOutput,
        durationMs: Date.now() - nodeStart,
        status: nodeStatus,
        error: errorMsg
      });

      if (nodeStatus === 'FAILED') break;
      currentNodeId = nextId;
    }

    return {
      runId,
      workflowId,
      status: logs.some(l => l.status === 'FAILED') ? 'FAILED' : 'COMPLETED',
      finalOutput: context,
      logs,
      totalDurationMs: Date.now() - startTime
    };
  }

  private interpolate(template: string, ctx: Record<string, any>): string {
    return template.replace(/\{\{\s*([a-zA-Z0-9_\.]+)\s*\}\}/g, (_, key) => {
      const parts = key.split('.');
      let curr = ctx;
      for (const p of parts) {
        if (curr && typeof curr === 'object' && p in curr) {
          curr = curr[p];
        } else {
          return '';
        }
      }
      return typeof curr === 'string' ? curr : JSON.stringify(curr);
    });
  }

  /**
   * Safe condition evaluator that eliminates raw eval() execution
   */
  private safeEvaluateCondition(expr: string, context: Record<string, any>): boolean {
    const trimmed = expr.trim();
    if (trimmed === 'true') return true;
    if (trimmed === 'false') return false;

    // Check binary comparison operators
    const ops = ['===', '!==', '==', '!=', '>=', '<=', '>', '<'];
    for (const op of ops) {
      const idx = trimmed.indexOf(op);
      if (idx !== -1) {
        const leftRaw = trimmed.slice(0, idx).trim();
        const rightRaw = trimmed.slice(idx + op.length).trim();

        const parseVal = (v: string): any => {
          if (v === 'true') return true;
          if (v === 'false') return false;
          if (v === 'null') return null;
          if (v === 'undefined') return undefined;
          if (/^-?\d+(?:\.\d+)?$/.test(v)) return Number(v);
          if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
            return v.slice(1, -1);
          }
          // Resolve from context path
          const parts = v.split('.');
          let curr: any = context;
          for (const p of parts) {
            if (curr && typeof curr === 'object' && p in curr) {
              curr = curr[p];
            } else {
              return undefined;
            }
          }
          return curr;
        };

        const left = parseVal(leftRaw);
        const right = parseVal(rightRaw);

        switch (op) {
          case '===':
          case '==':
            return left == right;
          case '!==':
          case '!=':
            return left != right;
          case '>':
            return Number(left) > Number(right);
          case '<':
            return Number(left) < Number(right);
          case '>=':
            return Number(left) >= Number(right);
          case '<=':
            return Number(left) <= Number(right);
        }
      }
    }

    if (trimmed in context) {
      return Boolean(context[trimmed]);
    }
    return Boolean(trimmed);
  }

  private registerSampleWorkflow() {
    const sampleWf: WorkflowDefinition = {
      id: 'wf-auto-dev-qa',
      name: '智能代码审计与自动化安全测试流程 (AgentFlow)',
      description: '自动知识库检索标准规范 -> 沙箱脚本编写 -> 代码执行 -> 合规判定',
      entryNodeId: 'node-start',
      nodes: [
        {
          id: 'node-start',
          name: '任务触发与入参校验',
          type: 'START',
          nextNodeId: 'node-rag'
        },
        {
          id: 'node-rag',
          name: 'WeKnora 规范知识库检索',
          type: 'KNOWLEDGE_RETRIEVAL',
          config: {
            queryTemplate: '{{query}}',
            outputKey: 'ragResults'
          },
          nextNodeId: 'node-llm'
        },
        {
          id: 'node-llm',
          name: 'Agent 逻辑规划与生成',
          type: 'LLM_PROMPT',
          config: {
            promptTemplate: '基于参考资料 {{ragResults}}，为用户需求 {{query}} 生成安全执行代码',
            outputKey: 'generatedPlan'
          },
          nextNodeId: 'node-code'
        },
        {
          id: 'node-code',
          name: 'Micro-Sandbox 隔离执行测试',
          type: 'CODE_EXEC',
          config: {
            codeSnippet: 'console.log(JSON.stringify({ status: "PASS", testsRun: 5, benchmark: "ok" }))',
            outputKey: 'testResults'
          },
          nextNodeId: 'node-end'
        },
        {
          id: 'node-end',
          name: '交付审计报告与归档',
          type: 'END'
        }
      ]
    };

    this.registerWorkflow(sampleWf);
  }
}
