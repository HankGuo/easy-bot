export interface OctopChannelConfig {
  kind: 'wecom' | 'dingtalk' | 'feishu' | 'weixin' | 'yuanbao' | 'webhook';
  name: string;
  config: Record<string, any>;
}

export interface OctopGatewayConfig {
  endpoint?: string;
  apiKey?: string;
  username?: string;
  password?: string;
  timeoutMs?: number;
}

/**
 * Enterprise TencentCloud Octop Multi-Agent & Channel Platform Driver
 * Interacts with upstream TencentCloud Octop official APIs:
 * - Health Check: GET /api/health
 * - JWT Authentication: POST /api/auth/login
 * - Agent Channel Listing: GET /api/agents/{aid}/channels
 * - Channel Creation: POST /api/agents/{aid}/channels
 * - Channel Connectivity Test: POST /api/agents/{aid}/channels/{cid}/test
 * - Channel Config Probe: POST /api/agents/{aid}/channels/probe
 * - Outbound Chat Dispatch: POST /api/agents/{aid}/chat (or POST /api/chats)
 * - Agent MCP Gateway: POST/GET /api/mcp/agents
 * Official Repo: github.com/TencentCloud/Octop
 */
export class OctopGatewayDriver {
  private endpoint: string;
  private apiKey?: string;
  private username?: string;
  private password?: string;
  private jwtToken?: string;
  private tokenExpiresAt: number = 0;
  private timeoutMs: number;

  constructor(config?: OctopGatewayConfig) {
    // Official Octop upstream default port is 8088 (OCTOP_PORT=8088)
    this.endpoint = (config?.endpoint || process.env.OCTOP_GATEWAY_URL || 'http://127.0.0.1:8088').replace(/\/+$/, '');
    this.apiKey = config?.apiKey || process.env.OCTOP_API_KEY;
    this.username = config?.username || process.env.OCTOP_USERNAME;
    this.password = config?.password || process.env.OCTOP_PASSWORD;
    this.timeoutMs = config?.timeoutMs || 8000;
  }

  public getEndpoint(): string {
    return this.endpoint;
  }

  /**
   * Acquire or auto-renew JWT bearer token from Octop:
   * POST /api/auth/login
   */
  public async ensureAuthenticated(): Promise<string | undefined> {
    if (this.apiKey) return this.apiKey;

    // Check if current token is still valid (with 60-second buffer)
    if (this.jwtToken && Date.now() < this.tokenExpiresAt - 60000) {
      return this.jwtToken;
    }

    if (!this.username || !this.password) {
      return this.jwtToken; // No credentials configured, proceed with whatever is present
    }

    try {
      const res = await fetch(`${this.endpoint}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: this.username,
          password: this.password
        }),
        signal: AbortSignal.timeout(this.timeoutMs)
      });

      if (res.ok) {
        const data: any = await res.json();
        const token = data.token || data.access_token || data.jwt;
        if (token) {
          this.jwtToken = token;
          const ttlSeconds = data.expires_in || data.ttl || 86400;
          this.tokenExpiresAt = Date.now() + ttlSeconds * 1000;
          return this.jwtToken;
        }
      }
    } catch (err: any) {
      console.warn(`[OctopGatewayDriver] Authentication warning: ${err.message}`);
    }

    return this.jwtToken;
  }

  private async getAuthHeaders(): Promise<Record<string, string>> {
    const headers: Record<string, string> = {};
    const token = await this.ensureAuthenticated();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  /**
   * Health probe against Octop server: GET /api/health
   */
  public async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch(`${this.endpoint}/api/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(2000)
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  /**
   * List configured channels for an Octop agent:
   * GET /api/agents/{aid}/channels
   */
  public async listChannels(agentId: string): Promise<any[]> {
    const headers = await this.getAuthHeaders();

    const res = await fetch(`${this.endpoint}/api/agents/${encodeURIComponent(agentId)}/channels`, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(this.timeoutMs)
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Octop listChannels failed (HTTP ${res.status}): ${errText}`);
    }

    const data: any = await res.json();
    return Array.isArray(data) ? data : (data.channels || []);
  }

  /**
   * Register a new channel on an Octop agent:
   * POST /api/agents/{aid}/channels
   */
  public async createChannel(
    agentId: string,
    channel: OctopChannelConfig
  ): Promise<{ ok: boolean; channelId?: string; message: string }> {
    const headers = {
      ...(await this.getAuthHeaders()),
      'Content-Type': 'application/json'
    };

    try {
      const res = await fetch(`${this.endpoint}/api/agents/${encodeURIComponent(agentId)}/channels`, {
        method: 'POST',
        headers,
        body: JSON.stringify(channel),
        signal: AbortSignal.timeout(this.timeoutMs)
      });

      if (res.ok || res.status === 201) {
        const result: any = await res.json();
        return {
          ok: true,
          channelId: result.id || result.channel_id,
          message: `Octop channel "${channel.name}" (${channel.kind}) successfully created`
        };
      } else {
        const errText = await res.text();
        return {
          ok: false,
          message: `Octop channel creation returned HTTP ${res.status}: ${errText}`
        };
      }
    } catch (err: any) {
      return {
        ok: false,
        message: `Octop communication failed: ${err.message}`
      };
    }
  }

  /**
   * Test an existing agent channel connection:
   * POST /api/agents/{aid}/channels/{cid}/test
   */
  public async testChannel(
    agentId: string,
    channelId: string
  ): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
    const start = Date.now();
    const headers = await this.getAuthHeaders();

    try {
      const res = await fetch(`${this.endpoint}/api/agents/${encodeURIComponent(agentId)}/channels/${encodeURIComponent(channelId)}/test`, {
        method: 'POST',
        headers,
        signal: AbortSignal.timeout(this.timeoutMs)
      });

      const latencyMs = Date.now() - start;
      const data: any = await res.json();
      return {
        ok: res.ok && data.ok !== false,
        latencyMs,
        error: data.error
      };
    } catch (err: any) {
      return {
        ok: false,
        latencyMs: Date.now() - start,
        error: err.message
      };
    }
  }

  /**
   * Preflight probe candidate channel configuration without saving:
   * POST /api/agents/{aid}/channels/probe
   */
  public async probeChannel(
    agentId: string,
    config: { kind: string; name?: string; config: Record<string, any> }
  ): Promise<{ ok: boolean; reason?: string; detail?: any }> {
    const headers = {
      ...(await this.getAuthHeaders()),
      'Content-Type': 'application/json'
    };

    try {
      const res = await fetch(`${this.endpoint}/api/agents/${encodeURIComponent(agentId)}/channels/probe`, {
        method: 'POST',
        headers,
        body: JSON.stringify(config),
        signal: AbortSignal.timeout(this.timeoutMs)
      });

      const data: any = await res.json();
      return {
        ok: res.ok && data.ok !== false,
        reason: data.reason,
        detail: data.detail
      };
    } catch (err: any) {
      return {
        ok: false,
        reason: err.message
      };
    }
  }

  /**
   * Dispatches outbound message through Octop agent channel:
   * POST /api/agents/{aid}/chat (or POST /api/chats)
   * Connects EasyBot directly into external IM messaging delivery pipeline.
   */
  public async dispatchMessage(
    agentId: string,
    content: string,
    channelId?: string,
    metadata?: Record<string, any>
  ): Promise<{ ok: boolean; messageId?: string; reply?: string; error?: string }> {
    const headers = {
      ...(await this.getAuthHeaders()),
      'Content-Type': 'application/json'
    };

    const targetUrl = `${this.endpoint}/api/agents/${encodeURIComponent(agentId)}/chat`;
    const payload = {
      content,
      channel_id: channelId,
      metadata: {
        ...metadata,
        sender: 'EasyBot',
        dispatched_at: new Date().toISOString()
      }
    };

    try {
      const res = await fetch(targetUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(this.timeoutMs)
      });

      if (!res.ok) {
        const errText = await res.text();
        return { ok: false, error: `HTTP ${res.status}: ${errText}` };
      }

      const data: any = await res.json();
      return {
        ok: true,
        messageId: data.id || data.message_id || data.chat_id,
        reply: data.reply || data.content || data.response
      };
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  }

  /**
   * Return the URL of the official Octop Agent MCP Gateway
   */
  public getMcpGatewayUrl(): string {
    return `${this.endpoint}/api/mcp/agents`;
  }
}
