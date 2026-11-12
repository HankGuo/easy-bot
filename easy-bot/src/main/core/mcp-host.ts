import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { WebSocketClientTransport } from '@modelcontextprotocol/sdk/client/websocket.js';

export interface MCPServerConfig {
  id: string;
  name: string;
  description?: string;
  transport: 'stdio' | 'sse' | 'websocket';
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  headers?: Record<string, string>;
  auth?: {
    type: 'bearer' | 'basic' | 'custom';
    token?: string;
  };
  status: 'CONNECTED' | 'DISCONNECTED' | 'ERROR';
  toolsCount: number;
}

export interface MCPToolDefinition {
  name: string;
  description: string;
  serverId: string;
  inputSchema: Record<string, any>;
}

export type MCPToolHandler = (args: Record<string, any>, context?: any) => Promise<string>;

/**
 * Enterprise Model Context Protocol (MCP) Host Manager
 * Powered by Anthropic Official @modelcontextprotocol/sdk
 * Supports Stdio, HTTP-SSE (with custom Auth Headers), and WebSocket transports
 */
export class MCPHostManager {
  private servers: Map<string, MCPServerConfig> = new Map();
  private tools: Map<string, MCPToolDefinition> = new Map();
  private toolHandlers: Map<string, MCPToolHandler> = new Map();
  private clients: Map<string, Client> = new Map();
  private transports: Map<string, any> = new Map();

  constructor() {
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
      name: 'Enterprise Hybrid RAG MCP',
      description: 'Multi-tenant hybrid knowledge retrieval engine',
      transport: 'stdio',
      status: 'CONNECTED',
      toolsCount: 1
    });
  }

  public registerToolHandler(name: string, handler: MCPToolHandler) {
    this.toolHandlers.set(name, handler);
  }

  private addBuiltinTool(tool: MCPToolDefinition) {
    this.tools.set(tool.name, tool);
  }

  public registerCustomTool(tool: MCPToolDefinition, handler?: MCPToolHandler) {
    this.tools.set(tool.name, tool);
    if (handler) {
      this.toolHandlers.set(tool.name, handler);
    }
  }

  public listServers(): MCPServerConfig[] {
    return Array.from(this.servers.values());
  }

  public listTools(): MCPToolDefinition[] {
    return Array.from(this.tools.values());
  }

  public hasTool(name: string): boolean {
    return this.tools.has(name) || this.toolHandlers.has(name);
  }

  public getTool(name: string): MCPToolDefinition | undefined {
    return this.tools.get(name);
  }

  /**
   * Registers and connects an external MCP Server via official Anthropic MCP SDK
   */
  public async registerServer(config: Omit<MCPServerConfig, 'status' | 'toolsCount'>): Promise<MCPServerConfig> {
    const serverConfig: MCPServerConfig = {
      ...config,
      status: 'DISCONNECTED',
      toolsCount: 0
    };

    try {
      const client = new Client(
        { name: 'EasyBot-Enterprise', version: '2.5.0' },
        { capabilities: {} }
      );

      let transport: any;

      if (config.transport === 'stdio' && config.command) {
        const cleanEnv: Record<string, string> = {};
        for (const [k, v] of Object.entries(process.env)) {
          if (typeof v === 'string') cleanEnv[k] = v;
        }
        if (config.env) {
          for (const [k, v] of Object.entries(config.env)) {
            if (typeof v === 'string') cleanEnv[k] = v;
          }
        }
        transport = new StdioClientTransport({
          command: config.command,
          args: config.args || [],
          env: cleanEnv
        });
      } else if (config.transport === 'sse' && config.url) {
        // Build Auth Headers
        const headers: Record<string, string> = { ...(config.headers || {}) };
        if (config.auth?.token) {
          if (config.auth.type === 'bearer') {
            headers['Authorization'] = `Bearer ${config.auth.token}`;
          } else if (config.auth.type === 'basic') {
            headers['Authorization'] = `Basic ${config.auth.token}`;
          } else {
            headers['X-API-Key'] = config.auth.token;
          }
        }

        transport = new SSEClientTransport(new URL(config.url), {
          eventSourceInit: { headers } as any,
          requestInit: { headers }
        });
      } else if (config.transport === 'websocket' && config.url) {
        transport = new WebSocketClientTransport(new URL(config.url));
      } else {
        throw new Error(`Unsupported or unconfigured MCP transport: ${config.transport}`);
      }

      await client.connect(transport);
      this.clients.set(config.id, client);
      this.transports.set(config.id, transport);

      // Discover Tools using official MCP SDK
      const listRes = await client.listTools();
      const discoveredTools = listRes.tools || [];

      for (const t of discoveredTools) {
        this.tools.set(t.name, {
          name: t.name,
          description: t.description || '',
          serverId: config.id,
          inputSchema: t.inputSchema || {}
        });
      }

      serverConfig.status = 'CONNECTED';
      serverConfig.toolsCount = discoveredTools.length;
      this.servers.set(config.id, serverConfig);
      return serverConfig;
    } catch (err: any) {
      console.warn(`[MCP Server ${config.id}] connection failed:`, err.message);
      serverConfig.status = 'ERROR';
      serverConfig.toolsCount = 0;
      this.servers.set(config.id, serverConfig);
      return serverConfig;
    }
  }

  /**
   * Invokes any registered tool call via official Anthropic MCP SDK or registered handler
   */
  public async callTool(toolName: string, args: Record<string, any>, context?: any): Promise<string> {
    // 1. Direct In-Memory Handler execution
    if (this.toolHandlers.has(toolName)) {
      return await this.toolHandlers.get(toolName)!(args, context);
    }

    const tool = this.tools.get(toolName);
    if (!tool) {
      throw new Error(`Tool "${toolName}" not found in MCP registry or active tool handlers`);
    }

    // 2. Official MCP Client Execution
    const client = this.clients.get(tool.serverId);
    if (!client) {
      throw new Error(`MCP Client for server "${tool.serverId}" is not connected or active`);
    }

    const res = await client.callTool({
      name: toolName,
      arguments: args
    });

    if (Array.isArray(res.content)) {
      return res.content.map((c: any) => c.text || JSON.stringify(c)).join('\n');
    }
    return typeof res === 'string' ? res : JSON.stringify(res ?? {});
  }

  public async disconnectServer(serverId: string): Promise<boolean> {
    const client = this.clients.get(serverId);
    if (client) {
      try {
        await client.close();
      } catch {}
      this.clients.delete(serverId);
    }

    const transport = this.transports.get(serverId);
    if (transport) {
      try {
        await transport.close();
      } catch {}
      this.transports.delete(serverId);
    }

    // Unregister tools from this server
    for (const [toolName, tool] of this.tools.entries()) {
      if (tool.serverId === serverId) {
        this.tools.delete(toolName);
        this.toolHandlers.delete(toolName);
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
