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
 * Manages 1:1 client connections to local and remote MCP servers
 */
export class MCPHostManager {
  private servers: Map<string, MCPServerConfig> = new Map();
  private tools: Map<string, MCPToolDefinition> = new Map(); // toolName -> definition
  private childProcesses: Map<string, ChildProcess> = new Map();

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
      description: 'Hardware-grade Micro-Sandbox execution controller',
      transport: 'stdio',
      status: 'CONNECTED',
      toolsCount: 1
    });

    this.servers.set('builtin-knowledge', {
      id: 'builtin-knowledge',
      name: 'WeKnora Hybrid RAG MCP',
      description: 'Enterprise hybrid knowledge retrieval engine',
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

  public async registerServer(config: Omit<MCPServerConfig, 'status' | 'toolsCount'>): Promise<MCPServerConfig> {
    const fullConfig: MCPServerConfig = {
      ...config,
      status: 'CONNECTED',
      toolsCount: 0
    };
    this.servers.set(config.id, fullConfig);
    return fullConfig;
  }

  public async disconnectServer(serverId: string): Promise<boolean> {
    const proc = this.childProcesses.get(serverId);
    if (proc) {
      proc.kill('SIGTERM');
      this.childProcesses.delete(serverId);
    }
    const s = this.servers.get(serverId);
    if (s) {
      s.status = 'DISCONNECTED';
      return true;
    }
    return false;
  }

  public getTool(name: string): MCPToolDefinition | undefined {
    return this.tools.get(name);
  }
}
