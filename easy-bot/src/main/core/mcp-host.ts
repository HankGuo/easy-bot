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

export type MCPToolHandler = (args: Record<string, any>, context?: any) => Promise<string>;

interface SSEServerSession {
  url: string;
  postUrl: string;
  abortController: AbortController;
}

/**
 * Standard Model Context Protocol (MCP) Host Manager
 * Manages 1:1 client connections to local stdio, remote HTTP-SSE, and WebSocket MCP servers with full JSON-RPC 2.0 lifecycle
 */
export class MCPHostManager {
  private servers: Map<string, MCPServerConfig> = new Map();
  private tools: Map<string, MCPToolDefinition> = new Map(); // toolName -> definition
  private toolHandlers: Map<string, MCPToolHandler> = new Map(); // toolName -> execution handler
  private childProcesses: Map<string, ChildProcess> = new Map();
  private sseSessions: Map<string, SSEServerSession> = new Map();
  private wsClients: Map<string, WebSocket> = new Map();
  private pendingRequests: Map<string, { resolve: (res: any) => void; reject: (err: any) => void }> = new Map();
  private nextRpcId = 1;

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
   * Registers and connects an external MCP Server via standard JSON-RPC 2.0 (stdio, sse, or websocket)
   */
  public async registerServer(config: Omit<MCPServerConfig, 'status' | 'toolsCount'>): Promise<MCPServerConfig> {
    if (config.transport === 'stdio' && config.command) {
      return this.connectStdioServer(config);
    } else if (config.transport === 'sse' && config.url) {
      return this.connectSSEServer(config);
    } else if (config.transport === 'websocket' && config.url) {
      return this.connectWebSocketServer(config);
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
   * Connects an external MCP Server via local Stdio
   */
  private async connectStdioServer(config: Omit<MCPServerConfig, 'status' | 'toolsCount'>): Promise<MCPServerConfig> {
    try {
      const proc = spawn(config.command!, config.args || [], {
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
          this.handleIncomingRpcMessage(trimmed);
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
      await this.sendStdioJsonRpc(proc, 'initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'EasyBot', version: '2.2.0' }
      });

      // Step 2: Send initialized notification
      proc.stdin?.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized', params: {} }) + '\n');

      // Step 3: Discover available tools from external MCP server
      const toolsRes = await this.sendStdioJsonRpc(proc, 'tools/list', {});
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

  /**
   * Connects a remote MCP Server via HTTP Server-Sent Events (SSE)
   */
  private async connectSSEServer(config: Omit<MCPServerConfig, 'status' | 'toolsCount'>): Promise<MCPServerConfig> {
    try {
      const abortController = new AbortController();
      const sseUrl = config.url!;
      let postUrl = sseUrl; // Default post URL is same or discovered via endpoint event

      // Probe remote SSE endpoint
      const response = await fetch(sseUrl, {
        headers: { 'Accept': 'text/event-stream' },
        signal: abortController.signal
      });

      if (!response.ok) {
        throw new Error(`Remote SSE server returned HTTP ${response.status}`);
      }

      // Read SSE stream in background
      (async () => {
        try {
          const reader = response.body?.getReader();
          if (!reader) return;
          const decoder = new TextDecoder();
          let sseBuffer = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            sseBuffer += decoder.decode(value, { stream: true });
            const chunks = sseBuffer.split('\n\n');
            sseBuffer = chunks.pop() || '';

            for (const chunk of chunks) {
              const lines = chunk.split('\n');
              let eventType = 'message';
              let data = '';
              for (const line of lines) {
                if (line.startsWith('event:')) eventType = line.slice(6).trim();
                else if (line.startsWith('data:')) data += line.slice(5).trim();
              }
              if (eventType === 'endpoint' && data) {
                try {
                  const resolved = new URL(data, sseUrl).toString();
                  postUrl = resolved;
                  const s = this.sseSessions.get(config.id);
                  if (s) s.postUrl = resolved;
                } catch {}
              } else if (data) {
                this.handleIncomingRpcMessage(data);
              }
            }
          }
        } catch (err: any) {
          if (err.name !== 'AbortError') {
            console.warn(`[MCP SSE ${config.id}] stream error:`, err.message);
            const s = this.servers.get(config.id);
            if (s) s.status = 'ERROR';
          }
        }
      })();

      const session: SSEServerSession = {
        url: sseUrl,
        postUrl,
        abortController
      };
      this.sseSessions.set(config.id, session);

      // Initialize handshake via POST
      await this.sendHttpJsonRpc(session, 'initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'EasyBot', version: '2.2.0' }
      });

      // Discover tools
      const toolsRes = await this.sendHttpJsonRpc(session, 'tools/list', {});
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
      console.warn(`[MCP SSE ${config.id}] connection failed:`, err.message);
      const fullConfig: MCPServerConfig = {
        ...config,
        status: 'ERROR',
        toolsCount: 0
      };
      this.servers.set(config.id, fullConfig);
      return fullConfig;
    }
  }

  /**
   * Connects a remote MCP Server via WebSocket
   */
  private async connectWebSocketServer(config: Omit<MCPServerConfig, 'status' | 'toolsCount'>): Promise<MCPServerConfig> {
    try {
      const ws = new WebSocket(config.url!);

      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('WebSocket connection timeout')), 8000);
        ws.onopen = () => {
          clearTimeout(timer);
          resolve();
        };
        ws.onerror = (err: any) => {
          clearTimeout(timer);
          reject(new Error(err.message || 'WebSocket connection error'));
        };
      });

      this.wsClients.set(config.id, ws);

      ws.onmessage = (event) => {
        const text = typeof event.data === 'string' ? event.data : event.data.toString();
        this.handleIncomingRpcMessage(text);
      };

      ws.onerror = (err: any) => {
        console.warn(`[MCP WS ${config.id}] error:`, err.message);
        const s = this.servers.get(config.id);
        if (s) s.status = 'ERROR';
      };

      ws.onclose = () => {
        console.log(`[MCP WS ${config.id}] disconnected`);
        const s = this.servers.get(config.id);
        if (s) s.status = 'DISCONNECTED';
      };

      // Step 1: Handshake
      await this.sendWsJsonRpc(ws, 'initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'EasyBot', version: '2.2.0' }
      });

      // Step 2: Initialized notification
      ws.send(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized', params: {} }));

      // Step 3: Discover tools
      const toolsRes = await this.sendWsJsonRpc(ws, 'tools/list', {});
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
      console.warn(`[MCP WS ${config.id}] connection failed:`, err.message);
      const fullConfig: MCPServerConfig = {
        ...config,
        status: 'ERROR',
        toolsCount: 0
      };
      this.servers.set(config.id, fullConfig);
      return fullConfig;
    }
  }

  private handleIncomingRpcMessage(raw: string) {
    try {
      const msg = JSON.parse(raw);
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
      // Ignore partial or unparseable frames
    }
  }

  /**
   * Invokes any registered tool call (Builtin Handler, Stdio, SSE, or WebSocket)
   */
  public async callTool(toolName: string, args: Record<string, any>, context?: any): Promise<string> {
    // 1. Direct Built-in / In-Memory Handler execution
    if (this.toolHandlers.has(toolName)) {
      return await this.toolHandlers.get(toolName)!(args, context);
    }

    const tool = this.tools.get(toolName);
    if (!tool) throw new Error(`Tool "${toolName}" not found in MCP registry or active tool handlers`);

    // 2. Stdio Subprocess Call
    const proc = this.childProcesses.get(tool.serverId);
    if (proc) {
      const result = await this.sendStdioJsonRpc(proc, 'tools/call', {
        name: toolName,
        arguments: args
      });
      return this.formatToolResult(result);
    }

    // 3. SSE Remote Call
    const sse = this.sseSessions.get(tool.serverId);
    if (sse) {
      const result = await this.sendHttpJsonRpc(sse, 'tools/call', {
        name: toolName,
        arguments: args
      });
      return this.formatToolResult(result);
    }

    // 4. WebSocket Remote Call
    const ws = this.wsClients.get(tool.serverId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      const result = await this.sendWsJsonRpc(ws, 'tools/call', {
        name: toolName,
        arguments: args
      });
      return this.formatToolResult(result);
    }

    throw new Error(`MCP Server connection for server "${tool.serverId}" is not active`);
  }

  private formatToolResult(result: any): string {
    if (Array.isArray(result?.content)) {
      return result.content.map((c: any) => c.text || JSON.stringify(c)).join('\n');
    }
    return typeof result === 'string' ? result : JSON.stringify(result ?? {});
  }

  private async sendStdioJsonRpc(proc: ChildProcess, method: string, params: any = {}): Promise<any> {
    const id = this.nextRpcId++;
    const payload = JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n';

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(String(id));
        reject(new Error(`MCP Stdio timeout on ${method}`));
      }, 15000);

      this.pendingRequests.set(String(id), {
        resolve: (val) => { clearTimeout(timer); resolve(val); },
        reject: (err) => { clearTimeout(timer); reject(err); }
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

  private async sendHttpJsonRpc(session: SSEServerSession, method: string, params: any = {}): Promise<any> {
    const id = this.nextRpcId++;
    const payload = { jsonrpc: '2.0', id, method, params };

    const response = await fetch(session.postUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000)
    });

    if (!response.ok) {
      throw new Error(`HTTP error ${response.status} from MCP Server`);
    }

    const json: any = await response.json();
    if (json.error) {
      throw new Error(json.error.message || JSON.stringify(json.error));
    }
    return json.result;
  }

  private async sendWsJsonRpc(ws: WebSocket, method: string, params: any = {}): Promise<any> {
    const id = this.nextRpcId++;
    const payload = JSON.stringify({ jsonrpc: '2.0', id, method, params });

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(String(id));
        reject(new Error(`MCP WebSocket timeout on ${method}`));
      }, 15000);

      this.pendingRequests.set(String(id), {
        resolve: (val) => { clearTimeout(timer); resolve(val); },
        reject: (err) => { clearTimeout(timer); reject(err); }
      });

      try {
        ws.send(payload);
      } catch (err) {
        clearTimeout(timer);
        this.pendingRequests.delete(String(id));
        reject(err);
      }
    });
  }

  public async disconnectServer(serverId: string): Promise<boolean> {
    // 1. Stdio
    const proc = this.childProcesses.get(serverId);
    if (proc) {
      proc.kill('SIGTERM');
      this.childProcesses.delete(serverId);
    }

    // 2. SSE
    const sse = this.sseSessions.get(serverId);
    if (sse) {
      sse.abortController.abort();
      this.sseSessions.delete(serverId);
    }

    // 3. WebSocket
    const ws = this.wsClients.get(serverId);
    if (ws) {
      try { ws.close(); } catch {}
      this.wsClients.delete(serverId);
    }

    // Remove tools registered by this server
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
