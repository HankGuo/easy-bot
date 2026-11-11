export interface ModelConfig {
  provider: 'openai-compatible' | 'anthropic' | 'ollama' | 'mock';
  baseUrl: string;
  apiKey: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  embeddingBaseUrl?: string;
  embeddingApiKey?: string;
  embeddingModel?: string;
}

export interface ChatCompletionMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  tool_call_id?: string;
  tool_calls?: {
    id: string;
    type: 'function';
    function: {
      name: string;
      arguments: string;
    };
  }[];
}

export interface TelemetryRecord {
  id: string;
  timestamp: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  latencyMs: number;
  estimatedCost: number;
  task: string;
  status: 'success' | 'failed' | 'cached' | 'simulated';
  tokenSource: 'upstream_exact' | 'estimated_heuristic';
}

/**
 * Universal Custom Model Client
 * Connects to ANY custom OpenAI-compatible endpoint (Local vLLM, Ollama, LM Studio, Enterprise Gateway, or Cloud Providers)
 * or Anthropic endpoints, with full streaming & native tool calling.
 */
export class ModelClient {
  private config: ModelConfig;
  private telemetryRecords: TelemetryRecord[] = [];
  private store?: {
    saveTelemetry: (rec: any) => void;
    getTelemetry: (limit?: number) => any[];
    clearTelemetry: () => void;
  };

  constructor(initialConfig?: Partial<ModelConfig>) {
    this.config = {
      provider: (process.env.OPENAI_PROVIDER as any) || 'openai-compatible',
      baseUrl: process.env.OPENAI_BASE_URL || 'http://localhost:11434/v1',
      apiKey: process.env.OPENAI_API_KEY || '',
      model: process.env.OPENAI_MODEL || 'default-chat-model',
      temperature: 0.7,
      maxTokens: 4096,
      embeddingBaseUrl: process.env.OPENAI_EMBEDDING_BASE_URL,
      embeddingApiKey: process.env.OPENAI_EMBEDDING_API_KEY,
      embeddingModel: process.env.OPENAI_EMBEDDING_MODEL,
      ...initialConfig
    };
  }

  public getConfig(): ModelConfig {
    return { ...this.config };
  }

  public getMaskedConfig(): Omit<ModelConfig, 'apiKey' | 'embeddingApiKey'> & { apiKeyMasked: string; hasKey: boolean; embeddingKeyMasked?: string; hasEmbeddingKey: boolean } {
    const key = this.config.apiKey;
    const masked = key.length > 8 ? `${key.slice(0, 4)}...${key.slice(-4)}` : (key ? '****' : '');
    const embKey = this.config.embeddingApiKey || '';
    const embMasked = embKey.length > 8 ? `${embKey.slice(0, 4)}...${embKey.slice(-4)}` : (embKey ? '****' : '');
    return {
      provider: this.config.provider,
      baseUrl: this.config.baseUrl,
      model: this.config.model,
      temperature: this.config.temperature,
      maxTokens: this.config.maxTokens,
      embeddingBaseUrl: this.config.embeddingBaseUrl,
      embeddingModel: this.config.embeddingModel,
      apiKeyMasked: masked,
      hasKey: Boolean(key),
      embeddingKeyMasked: embMasked,
      hasEmbeddingKey: Boolean(embKey)
    };
  }

  public updateConfig(patch: Partial<ModelConfig>): ModelConfig {
    this.config = { ...this.config, ...patch };
    return this.getConfig();
  }

  public hasEmbeddingConfig(): boolean {
    return Boolean(this.config.embeddingModel);
  }

  /**
   * Generates true vector embeddings via OpenAI-compatible /v1/embeddings API
   */
  public async createEmbeddings(texts: string[]): Promise<number[][] | null> {
    const embModel = this.config.embeddingModel;
    if (!embModel || texts.length === 0) return null;

    const cleanBase = (this.config.embeddingBaseUrl || this.config.baseUrl).replace(/\/+$/, '');
    const apiKey = this.config.embeddingApiKey || this.config.apiKey;
    const url = `${cleanBase}/embeddings`;

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {})
        },
        body: JSON.stringify({
          model: embModel,
          input: texts
        }),
        signal: AbortSignal.timeout(30000)
      });

      if (!res.ok) {
        const errText = await res.text();
        console.warn(`[Embedding API Warning] HTTP ${res.status}: ${errText.slice(0, 200)}`);
        return null;
      }

      const json: any = await res.json();
      if (Array.isArray(json.data)) {
        return json.data.map((item: any) => item.embedding);
      }
      return null;
    } catch (err: any) {
      console.warn(`[Embedding API Error]: ${err.message}`);
      return null;
    }
  }

  /**
   * Helper for non-streaming chat completions
   */
  public async chat(messages: ChatCompletionMessage[]): Promise<string> {
    const res = await this.streamChat(messages, undefined, undefined);
    return res.content;
  }

  /**
   * Tests connectivity to the custom endpoint with a minimal ping request
   */
  public async testConnection(): Promise<{ success: boolean; latencyMs: number; responsePreview?: string; error?: string }> {
    const start = Date.now();
    if (!this.config.apiKey && this.config.provider !== 'ollama' && this.config.provider !== 'mock') {
      return {
        success: false,
        latencyMs: 0,
        error: '未配置 API Key（对于非 Ollama 本地模型，必须提供有效密钥）'
      };
    }

    if (this.config.provider === 'mock') {
      return {
        success: true,
        latencyMs: 12,
        responsePreview: 'Mock 模拟引擎通信就绪，延迟 12ms。'
      };
    }

    try {
      const cleanBase = this.config.baseUrl.replace(/\/+$/, '');
      const url = `${cleanBase}/chat/completions`;

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: [{ role: 'user', content: 'Ping' }],
          max_tokens: 10
        }),
        signal: AbortSignal.timeout(15000)
      });

      const latency = Date.now() - start;

      if (!res.ok) {
        const errorText = await res.text();
        return {
          success: false,
          latencyMs: latency,
          error: `HTTP ${res.status}: ${errorText.slice(0, 200)}`
        };
      }

      const json: any = await res.json();
      const preview = json.choices?.[0]?.message?.content || 'Pong (连通正常)';

      return {
        success: true,
        latencyMs: latency,
        responsePreview: preview
      };
    } catch (err: any) {
      return {
        success: false,
        latencyMs: Date.now() - start,
        error: `连接失败: ${err.message}`
      };
    }
  }

  /**
   * Universal Chat Completion with Tool Calling & Streaming
   */
  public async streamChat(
    messages: ChatCompletionMessage[],
    tools?: { name: string; description: string; inputSchema: any }[],
    onToken?: (token: string) => void
  ): Promise<{ content: string; toolCalls?: { id: string; name: string; args: Record<string, any> }[] }> {
    const startTime = Date.now();
    // 1. Fallback to Mock/Offline engine if provider is mock or no API Key provided
    if (this.config.provider === 'mock' || (!this.config.apiKey && this.config.provider !== 'ollama')) {
      const userPrompt = messages[messages.length - 1]?.content || '';
      const res = await this.offlineSimulatedCompletion(userPrompt, onToken);
      this.recordTelemetry({
        id: `tel-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        timestamp: new Date().toLocaleTimeString(),
        model: 'offline-local-sandbox',
        promptTokens: Math.round(userPrompt.length / 2),
        completionTokens: Math.round(res.content.length / 2),
        totalTokens: Math.round((userPrompt.length + res.content.length) / 2),
        latencyMs: Date.now() - startTime,
        estimatedCost: 0,
        task: userPrompt.slice(0, 30) || '离线沙箱执行',
        status: 'simulated',
        tokenSource: 'estimated_heuristic'
      });
      return res;
    }

    // 2. Format OpenAI tools schema
    const formattedTools = tools && tools.length > 0 ? tools.map(t => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters: t.inputSchema
      }
    })) : undefined;

    const cleanBase = this.config.baseUrl.replace(/\/+$/, '');
    const url = `${cleanBase}/chat/completions`;

    const body: Record<string, any> = {
      model: this.config.model,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
        ...(m.tool_calls ? { tool_calls: m.tool_calls } : {}),
        ...(m.tool_call_id ? { tool_call_id: m.tool_call_id } : {})
      })),
      temperature: this.config.temperature,
      max_tokens: this.config.maxTokens,
      stream: true,
      stream_options: { include_usage: true }
    };

    if (formattedTools && formattedTools.length > 0) {
      body.tools = formattedTools;
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.config.apiKey ? { 'Authorization': `Bearer ${this.config.apiKey}` } : {})
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60000)
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Model API error (${res.status}): ${err.slice(0, 300)}`);
    }

    if (!res.body) throw new Error('Response body is empty');

    let fullContent = '';
    let upstreamUsage: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | null = null;
    const pendingToolCalls: Map<number, { id: string; name: string; argsJson: string }> = new Map();

    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data:')) continue;
        if (trimmed === 'data: [DONE]') continue;

        try {
          const json = JSON.parse(trimmed.replace(/^data:\s*/, ''));
          if (json.usage) {
            upstreamUsage = json.usage;
          }

          const delta = json.choices?.[0]?.delta;
          if (!delta) continue;

          // Stream content text
          if (delta.content) {
            fullContent += delta.content;
            onToken?.(delta.content);
          }

          // Tool calls chunk accumulation
          if (delta.tool_calls) {
            for (const tc of delta.tool_calls) {
              const idx = tc.index ?? 0;
              const existing = pendingToolCalls.get(idx) || { id: tc.id || `call_${idx}`, name: '', argsJson: '' };
              if (tc.id) existing.id = tc.id;
              if (tc.function?.name) existing.name += tc.function.name;
              if (tc.function?.arguments) existing.argsJson += tc.function.arguments;
              pendingToolCalls.set(idx, existing);
            }
          }
        } catch {
          // ignore stream parse glitches
        }
      }
    }

    // Assemble tool calls
    const toolCalls = Array.from(pendingToolCalls.values()).map(tc => {
      let parsedArgs: Record<string, any> = {};
      try {
        parsedArgs = JSON.parse(tc.argsJson || '{}');
      } catch {
        parsedArgs = { raw: tc.argsJson };
      }
      return {
        id: tc.id,
        name: tc.name,
        args: parsedArgs
      };
    });

    const durationMs = Date.now() - startTime;
    let promptTokens: number;
    let completionTokens: number;
    let totalTokens: number;
    let tokenSource: 'upstream_exact' | 'estimated_heuristic';

    if (upstreamUsage && typeof upstreamUsage.prompt_tokens === 'number') {
      promptTokens = upstreamUsage.prompt_tokens;
      completionTokens = upstreamUsage.completion_tokens ?? Math.max(1, Math.round(fullContent.length / 2));
      totalTokens = upstreamUsage.total_tokens ?? (promptTokens + completionTokens);
      tokenSource = 'upstream_exact';
    } else {
      const promptLen = messages.reduce((acc, m) => acc + (m.content?.length || 0), 0);
      promptTokens = Math.max(1, Math.round(promptLen / 2));
      completionTokens = Math.max(1, Math.round(fullContent.length / 2));
      totalTokens = promptTokens + completionTokens;
      tokenSource = 'estimated_heuristic';
    }

    const estimatedCost = Number(((promptTokens * 0.0000015) + (completionTokens * 0.0000025)).toFixed(6));
    const taskName = (messages[messages.length - 1]?.content || '智能体推理').slice(0, 35);

    this.recordTelemetry({
      id: `tel-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toLocaleTimeString(),
      model: this.config.model,
      promptTokens,
      completionTokens,
      totalTokens,
      latencyMs: durationMs,
      estimatedCost,
      task: taskName,
      status: 'success',
      tokenSource
    });

    return {
      content: fullContent,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined
    };
  }

  public setStore(store: { saveTelemetry: (rec: any) => void; getTelemetry: (limit?: number) => any[]; clearTelemetry: () => void }): void {
    this.store = store;
    try {
      const persisted = store.getTelemetry(100);
      if (persisted && persisted.length > 0) {
        this.telemetryRecords = persisted;
      }
    } catch {
      // ignore
    }
  }

  public getTelemetryRecords(): TelemetryRecord[] {
    if (this.store) {
      try {
        const persisted = this.store.getTelemetry(100);
        if (persisted && persisted.length > 0) {
          return persisted;
        }
      } catch {
        // fallback
      }
    }
    return [...this.telemetryRecords];
  }

  public recordTelemetry(record: TelemetryRecord): void {
    this.telemetryRecords.unshift(record);
    if (this.telemetryRecords.length > 100) {
      this.telemetryRecords.pop();
    }
    try {
      this.store?.saveTelemetry(record);
    } catch (err: any) {
      console.warn('[ModelClient] Failed to persist telemetry to SQLite:', err.message);
    }
  }

  public clearTelemetry(): void {
    this.telemetryRecords = [];
    try {
      this.store?.clearTelemetry();
    } catch (err: any) {
      console.warn('[ModelClient] Failed to clear telemetry from SQLite:', err.message);
    }
  }

  private async offlineSimulatedCompletion(
    prompt: string,
    onToken?: (token: string) => void
  ): Promise<{ content: string; toolCalls?: { id: string; name: string; args: Record<string, any> }[] }> {
    const isFileWrite = prompt.includes('创建') || prompt.includes('写') || prompt.includes('create') || prompt.includes('write');
    const isSearch = prompt.includes('查询') || prompt.includes('找') || prompt.includes('search') || prompt.includes('知识库');
    const isExec = prompt.includes('运行') || prompt.includes('执行') || prompt.includes('run') || prompt.includes('test');

    const toolCalls: { id: string; name: string; args: Record<string, any> }[] = [];

    if (isFileWrite) {
      const matchFile = prompt.match(/(?:文件|file)\s*([a-zA-Z0-9_\-\.\/]+)/i);
      const filename = matchFile ? matchFile[1] : 'demo_output.js';
      toolCalls.push({
        id: 'call_' + Math.random().toString(36).slice(2, 9),
        name: 'workspace_file_write',
        args: { path: filename, content: `// Generated in EasyBot Sandbox\nconsole.log("Custom model execution verified.");\n` }
      });
    }

    if (isSearch) {
      toolCalls.push({
        id: 'call_' + Math.random().toString(36).slice(2, 9),
        name: 'hybrid_rag_query',
        args: { query: prompt, topK: 3 }
      });
    }

    if (isExec) {
      toolCalls.push({
        id: 'call_' + Math.random().toString(36).slice(2, 9),
        name: 'workspace_shell_execute',
        args: { command: 'node -e "console.log(process.version)"' }
      });
    }

    const text = `[EasyBot 模拟引擎回包]：已解析您的指令「${prompt}」。\n系统检测到当前未配置云端商业 API Key，已自动路由至离线高保真沙箱模式进行工具调度测试。`;
    for (const char of text) {
      onToken?.(char);
    }

    return {
      content: text,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined
    };
  }
}
