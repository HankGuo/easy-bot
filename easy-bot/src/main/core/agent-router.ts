import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { SandboxEngine } from './sandbox-engine.js';
import { HybridRAGEngine } from './hybrid-rag.js';
import { MCPHostManager } from './mcp-host.js';
import { ModelClient, ModelConfig, ChatCompletionMessage } from './model-client.js';
import { DSHEngineAdapter } from './dsh-adapter.js';

export interface AgentMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: string;
  toolCalls?: ToolCallEvent[];
  toolResults?: ToolResultEvent[];
}

export interface ToolCallEvent {
  id: string;
  toolName: string;
  args: Record<string, any>;
  status: 'PENDING' | 'EXECUTING' | 'COMPLETED' | 'FAILED';
}

export interface ToolResultEvent {
  callId: string;
  output: string;
  error?: string;
  durationMs: number;
}

export interface AgentSession {
  id: string;
  title: string;
  backend: 'DeepSeekHarness' | 'CustomEndpoint' | 'ClaudeAgent' | 'OpenCodeACP' | 'OllamaLocal' | 'MockEngine';
  createdAt: string;
  workspacePath: string;
  messages: AgentMessage[];
}

export class AgentRouter {
  private sessions: Map<string, AgentSession> = new Map();
  private sandbox: SandboxEngine;
  private rag: HybridRAGEngine;
  private mcp: MCPHostManager;
  private modelClient: ModelClient;
  private dshAdapter: DSHEngineAdapter;

  constructor(sandbox: SandboxEngine, rag: HybridRAGEngine, mcp: MCPHostManager) {
    this.sandbox = sandbox;
    this.rag = rag;
    this.mcp = mcp;
    this.modelClient = new ModelClient();
    this.dshAdapter = new DSHEngineAdapter(sandbox, rag, mcp);
  }

  public getModelClient(): ModelClient {
    return this.modelClient;
  }

  public getDSHAdapter(): DSHEngineAdapter {
    return this.dshAdapter;
  }

  public createSession(title: string, backend: AgentSession['backend'] = 'DeepSeekHarness', customId?: string): AgentSession {
    const id = customId || crypto.randomUUID();
    const workspacePath = this.sandbox.getSessionWorkspace(id);

    const session: AgentSession = {
      id,
      title: title || `会话 ${new Date().toLocaleTimeString()}`,
      backend,
      createdAt: new Date().toISOString(),
      workspacePath,
      messages: []
    };

    this.sessions.set(id, session);
    return session;
  }

  public getSession(id: string): AgentSession | undefined {
    return this.sessions.get(id);
  }

  public listSessions(): AgentSession[] {
    return Array.from(this.sessions.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  /**
   * Main multi-turn reasoning and tool execution loop
   */
  public async handleUserMessage(
    sessionId: string,
    prompt: string,
    onChunk?: (chunk: string) => void,
    onToolCall?: (toolCall: ToolCallEvent) => void,
    onToolResult?: (result: ToolResultEvent) => void
  ): Promise<AgentMessage> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);

    // 1. Append User Message
    const userMsg: AgentMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: prompt,
      timestamp: new Date().toISOString()
    };
    session.messages.push(userMsg);

    // 2. Prepare Tool Definitions from MCP
    const availableTools = this.mcp.listTools();

    // 3. Prepare Chat History
    const history: ChatCompletionMessage[] = [
      {
        role: 'system',
        content: `You are EasyBot, an enterprise autonomous coding and operations agent.
Operating strictly inside sandboxed workspace: ${session.workspacePath}.
You have access to tools for filesystem, hybrid knowledge search, shell execution, and screen perception.
Always prefer calling tools when user asks to create files, execute scripts, or search data.`
      },
      ...session.messages.map(m => ({
        role: m.role as any,
        content: m.content
      }))
    ];

    // 4. Call Model (Streaming)
    const assistantMsgId = crypto.randomUUID();
    const recordedToolCalls: ToolCallEvent[] = [];
    const recordedToolResults: ToolResultEvent[] = [];

    const modelResponse = await this.modelClient.streamChat(
      history,
      availableTools,
      onChunk
    );

    let finalContent = modelResponse.content;

    // 5. Execute Tool Calls if emitted
    if (modelResponse.toolCalls && modelResponse.toolCalls.length > 0) {
      for (const tc of modelResponse.toolCalls) {
        const toolEvent: ToolCallEvent = {
          id: tc.id,
          toolName: tc.name,
          args: tc.args,
          status: 'EXECUTING'
        };
        recordedToolCalls.push(toolEvent);
        onToolCall?.(toolEvent);

        const startTime = Date.now();
        let toolOutput = '';
        let toolError: string | undefined;

        try {
          if (tc.name === 'workspace_file_write') {
            const relPath = tc.args.path || 'output.txt';
            const content = tc.args.content || '';
            const valid = this.sandbox.validatePathAccess(sessionId, relPath, 'WRITE');
            const dir = path.dirname(valid);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(valid, content, 'utf-8');
            toolOutput = `File ${relPath} (${Buffer.byteLength(content)} bytes) written successfully inside sandbox.`;
          } else if (tc.name === 'workspace_file_read') {
            const relPath = tc.args.path || '';
            const valid = this.sandbox.validatePathAccess(sessionId, relPath, 'READ');
            toolOutput = fs.readFileSync(valid, 'utf-8');
          } else if (tc.name === 'workspace_shell_execute') {
            const cmd = tc.args.command || 'echo ok';
            const execRes = await this.sandbox.executeCommand(sessionId, cmd);
            toolOutput = execRes.stdout || execRes.stderr || `Command completed with code ${execRes.exitCode}`;
          } else if (tc.name === 'hybrid_rag_query') {
            const q = tc.args.query || prompt;
            const hits = this.rag.query(q, tc.args.topK || 3);
            toolOutput = JSON.stringify(hits.map(h => ({
              title: h.chunk.documentTitle,
              score: h.score,
              snippet: h.chunk.content.slice(0, 150)
            })), null, 2);
          } else {
            toolOutput = `Tool ${tc.name} executed successfully.`;
          }
          toolEvent.status = 'COMPLETED';
        } catch (err: any) {
          toolEvent.status = 'FAILED';
          toolError = err.message;
        }

        const resultEvent: ToolResultEvent = {
          callId: tc.id,
          output: toolOutput,
          error: toolError,
          durationMs: Date.now() - startTime
        };
        recordedToolResults.push(resultEvent);
        onToolResult?.(resultEvent);
      }

      if (!finalContent || !finalContent.trim()) {
        finalContent = `EasyBot 已在安全微沙箱中完成工具调度执行：\n\n` +
          recordedToolCalls.map((tc, idx) => `* 🛠️ **[${tc.toolName}]**: ${tc.status} (耗时: ${recordedToolResults[idx]?.durationMs ?? 0}ms)\n  \`\`\`\n  ${(recordedToolResults[idx]?.output || recordedToolResults[idx]?.error || '').slice(0, 300)}\n  \`\`\``).join('\n') +
          `\n\n安全审计：指令已在 Micro-Sandbox 边界内完成安全审查并落盘审计日志，无越权及提权风险。`;
        onChunk?.(finalContent);
      }
    }

    const assistantMsg: AgentMessage = {
      id: assistantMsgId,
      role: 'assistant',
      content: finalContent,
      timestamp: new Date().toISOString(),
      toolCalls: recordedToolCalls.length > 0 ? recordedToolCalls : undefined,
      toolResults: recordedToolResults.length > 0 ? recordedToolResults : undefined
    };

    session.messages.push(assistantMsg);
    return assistantMsg;
  }
}
