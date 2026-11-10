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
  backend: 'ClaudeAgent' | 'OpenCodeACP' | 'OllamaLocal' | 'MockEngine';
  createdAt: string;
  workspacePath: string;
  messages: AgentMessage[];
}

export interface SandboxAuditLog {
  id: string;
  timestamp: string;
  sessionId: string;
  action: 'READ' | 'WRITE' | 'EXECUTE' | 'BLOCKED_ATTEMPT';
  targetPath?: string;
  command?: string;
  status: 'ALLOWED' | 'REJECTED' | 'FAILED' | 'COMPLETED';
  details?: string;
}

export interface MCPServer {
  id: string;
  name: string;
  description?: string;
  transport: string;
  status: 'CONNECTED' | 'DISCONNECTED' | 'ERROR';
  toolsCount: number;
}
