export interface ModelConfig {
  provider: 'openai-compatible' | 'anthropic' | 'ollama' | 'mock';
  baseUrl: string;
  apiKey: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
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

/**
 * Universal Custom Model Client
 * Connects to ANY custom OpenAI-compatible endpoint (DeepSeek, Qwen, Ollama, OpenAI, vLLM, corporate gateways)
 * or Anthropic endpoints, with full streaming & native tool calling.
 */
export class ModelClient {
  private config: ModelConfig;

  constructor(initialConfig?: Partial<ModelConfig>) {
    this.config = {
      provider: 'openai-compatible',
      baseUrl: process.env.OPENAI_BASE_URL || 'https://token.sensenova.cn/v1',
      apiKey: process.env.OPENAI_API_KEY || 'sk-3UHPzn5qZBVktG9EZwE7AYxoXSxxxUTS',
      model: process.env.OPENAI_MODEL || 'sensenova-6.8-flash-lite',
      temperature: 0.7,
      maxTokens: 4096,
      ...initialConfig
    };
  }

  public getConfig(): ModelConfig {
    return { ...this.config };
  }

  public getMaskedConfig(): Omit<ModelConfig, 'apiKey'> & { apiKeyMasked: string; hasKey: boolean } {
    const key = this.config.apiKey;
    const masked = key.length > 8 ? `${key.slice(0, 4)}...${key.slice(-4)}` : (key ? '****' : '');
    return {
      provider: this.config.provider,
      baseUrl: this.config.baseUrl,
      model: this.config.model,
      temperature: this.config.temperature,
      maxTokens: this.config.maxTokens,
      apiKeyMasked: masked,
      hasKey: Boolean(key)
    };
  }

  public updateConfig(patch: Partial<ModelConfig>): ModelConfig {
    this.config = { ...this.config, ...patch };
    return this.getConfig();
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
    // 1. Fallback to Mock/Offline engine if provider is mock or no API Key provided
    if (this.config.provider === 'mock' || (!this.config.apiKey && this.config.provider !== 'ollama')) {
      const userPrompt = messages[messages.length - 1]?.content || '';
      return this.offlineSimulatedCompletion(userPrompt, onToken);
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
      stream: true
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

    return {
      content: fullContent,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined
    };
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
