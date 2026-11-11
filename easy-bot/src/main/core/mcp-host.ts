import { spawn, type ChildProcess } from 'node:child_process';
import * as crypto from 'node:crypto';

export interface MCPServerConfig {
  id: string;
  name: string;
  description?: string;
  transport: 'stdio' | 'sse' | 'websocket';
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  status: 'CONNECTED' | 'DISCONNECTED' | 'ERROR';
  toolsCount: number;
}

export interface MCPToolDefinition {
  name: string;
  description: string;
  serverId: string;
  inputSchema: Record<string, any>;
}

/**
 * Standard Model Context Protocol (MCP) Host Manager
 * Manages 1:1 client connections to local stdio and remote MCP servers with full JSON-RPC 2.0 lifecycle
 */
export class MCPHostManager {
  private servers: Map<string, MCPServerConfig> = new Map();
  private tools: Map<string, MCPToolDefinition> = new Map(); // toolName -> definition
  private childProcesses: Map<string, ChildProcess> = new Map();
  private pendingRequests: Map<string, { resolve: (res: any) => void; reject: (err: any) => void }> = new Map();
  private nextRpcId = 1;

  constructor() {
    // Register Default Built-in MCP Tool Services
    this.registerBuiltInTools();
  }

  private registerBuiltInTools() {
    this.addBuiltinTool({
      name: 'workspace_file_read',
      description: 'Safely read a file inside the sandboxed workspace',
      serverId: 'builtin-filesystem',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Relative path to file' }
        },
        required: ['path']
      }
    });

    this.addBuiltinTool({
      name: 'workspace_file_write',
      description: 'Safely write or update a file inside the sandboxed workspace',
      serverId: 'builtin-filesystem',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Relative path to file' },
          content: { type: 'string', description: 'Full file content' }
        },
        required: ['path', 'content']
      }
    });

    this.addBuiltinTool({
      name: 'workspace_shell_execute',
      description: 'Execute a verified shell command inside the isolated session sandbox',
      serverId: 'builtin-sandbox',
      inputSchema: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'Command to run' }
        },
        required: ['command']
      }
    });

    this.addBuiltinTool({
      name: 'hybrid_rag_query',
      description: 'Query enterprise knowledge base using BM25 and Vector hybrid ranking',
      serverId: 'builtin-knowledge',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search term or question' },
          topK: { type: 'number', default: 5 }
        },
        required: ['query']
      }
    });

    this.servers.set('builtin-filesystem', {
      id: 'builtin-filesystem',
      name: 'Sandboxed Filesystem MCP',
      description: 'Local workspace file isolation operations',
      transport: 'stdio',
      status: 'CONNECTED',
      toolsCount: 2
    });

    this.servers.set('builtin-sandbox', {
      id: 'builtin-sandbox',
      name: 'Secure Sandbox Runner MCP',
      description: 'Application-level workspace guard and process filter',
      transport: 'stdio',
      status: 'CONNECTED',
      toolsCount: 1
    });

    this.servers.set('builtin-knowledge', {
      id: 'builtin-knowledge',
      name: 'WeKnora Hybrid RAG MCP',
      description: 'Industrial hybrid knowledge retrieval engine',
      transport: 'stdio',
      status: 'CONNECTED',
      toolsCount: 1
    });
  }

  private addBuiltinTool(tool: MCPToolDefinition) {
    this.tools.set(tool.name, tool);
  }

  public listServers(): MCPServerConfig[] {
    return Array.from(this.servers.values());
  }

  public listTools(): MCPToolDefinition[] {
    return Array.from(this.tools.values());
  }

  public hasTool(name: string): boolean {
    return this.tools.has(name);
  }

  public getTool(name: string): MCPToolDefinition | undefined {
    return this.tools.get(name);
  }

  /**
   * Registers and connects an external MCP Server via standard JSON-RPC 2.0
   */
  public async registerServer(config: Omit<MCPServerConfig, 'status' | 'toolsCount'>): Promise<MCPServerConfig> {
    if (config.transport === 'stdio' && config.command) {
      try {
        const proc = spawn(config.command, config.args || [], {
          env: { ...process.env, ...(config.env || {}) },
          stdio: ['pipe', 'pipe', 'pipe']
        });

        this.childProcesses.set(config.id, proc);

        let buffer = '';
        proc.stdout?.on('data', (chunk) => {
          buffer += chunk.toString('utf-8');
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            try {
              const msg = JSON.parse(trimmed);
              if (msg.id && this.pendingRequests.has(String(msg.id))) {
                const { resolve, reject } = this.pendingRequests.get(String(msg.id))!;
                this.pendingRequests.delete(String(msg.id));
                if (msg.error) {
                  reject(new Error(msg.error.message || JSON.stringify(msg.error)));
                } else {
                  resolve(msg.result);
                }
              }
            } catch {
              // Ignore partial chunk parsing
            }
          }
        });

        proc.on('error', (err) => {
          console.warn(`[MCP Server ${config.id}] process error:`, err.message);
          const s = this.servers.get(config.id);
          if (s) s.status = 'ERROR';
        });

        proc.on('exit', (code) => {
          console.log(`[MCP Server ${config.id}] exited with code ${code}`);
          const s = this.servers.get(config.id);
          if (s) s.status = 'DISCONNECTED';
        });

        // Step 1: Standard JSON-RPC initialize handshake
        await this.sendJsonRpc(proc, 'initialize', {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'EasyBot', version: '2.1.0' }
        });

        // Step 2: Send initialized notification
        proc.stdin?.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized', params: {} }) + '\n');

        // Step 3: Discover available tools from external MCP server
        const toolsRes = await this.sendJsonRpc(proc, 'tools/list', {});
        const discoveredTools: any[] = toolsRes?.tools || [];

        for (const t of discoveredTools) {
          this.tools.set(t.name, {
            name: t.name,
            description: t.description || '',
            serverId: config.id,
            inputSchema: t.inputSchema || {}
          });
        }

        const fullConfig: MCPServerConfig = {
          ...config,
          status: 'CONNECTED',
          toolsCount: discoveredTools.length
        };
        this.servers.set(config.id, fullConfig);
        return fullConfig;
      } catch (err: any) {
        console.warn(`[MCP Server ${config.id}] connection failed:`, err.message);
        const fullConfig: MCPServerConfig = {
          ...config,
          status: 'ERROR',
          toolsCount: 0
        };
        this.servers.set(config.id, fullConfig);
        return fullConfig;
      }
    }

    const fullConfig: MCPServerConfig = {
      ...config,
      status: 'DISCONNECTED',
      toolsCount: 0
    };
    this.servers.set(config.id, fullConfig);
    return fullConfig;
  }

  /**
   * Invokes an external tool call via JSON-RPC 2.0 tools/call
   */
  public async callTool(toolName: string, args: Record<string, any>): Promise<string> {
    const tool = this.tools.get(toolName);
    if (!tool) throw new Error(`Tool ${toolName} not found in registry`);

    const proc = this.childProcesses.get(tool.serverId);
    if (!proc) throw new Error(`MCP Server process for ${tool.serverId} is not active`);

    const result = await this.sendJsonRpc(proc, 'tools/call', {
      name: toolName,
      arguments: args
    });

    if (Array.isArray(result?.content)) {
      return result.content.map((c: any) => c.text || JSON.stringify(c)).join('\n');
    }
    return typeof result === 'string' ? result : JSON.stringify(result || {});
  }

  private async sendJsonRpc(proc: ChildProcess, method: string, params: any = {}): Promise<any> {
    const id = this.nextRpcId++;
    const payload = JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n';

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(String(id));
        reject(new Error(`MCP timeout on ${method}`));
      }, 15000);

      this.pendingRequests.set(String(id), {
        resolve: (val) => {
          clearTimeout(timer);
          resolve(val);
        },
        reject: (err) => {
          clearTimeout(timer);
          reject(err);
        }
      });

      try {
        proc.stdin?.write(payload);
      } catch (err) {
        clearTimeout(timer);
        this.pendingRequests.delete(String(id));
        reject(err);
      }
    });
  }

  public async disconnectServer(serverId: string): Promise<boolean> {
    const proc = this.childProcesses.get(serverId);
    if (proc) {
      proc.kill('SIGTERM');
      this.childProcesses.delete(serverId);
    }
    // Remove all tools registered by this server
    for (const [toolName, tool] of this.tools.entries()) {
      if (tool.serverId === serverId) {
        this.tools.delete(toolName);
      }
    }
    const s = this.servers.get(serverId);
    if (s) {
      s.status = 'DISCONNECTED';
      s.toolsCount = 0;
      return true;
    }
    return false;
  }
}
