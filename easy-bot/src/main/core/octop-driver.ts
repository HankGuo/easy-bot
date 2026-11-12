export interface OctopChannelConfig {
  kind: 'wecom' | 'dingtalk' | 'feishu' | 'weixin' | 'yuanbao' | 'webhook';
  name: string;
  config: Record<string, any>;
}

export interface OctopGatewayConfig {
  endpoint?: string;
  apiKey?: string;
  timeoutMs?: number;
}

/**
 * Enterprise TencentCloud Octop Multi-Agent & Channel Platform Driver
 * Interacts with upstream TencentCloud Octop official APIs:
 * - Health Check: GET /api/health
 * - Agent Channel Listing: GET /api/agents/{aid}/channels
 * - Channel Creation: POST /api/agents/{aid}/channels
 * - Channel Connectivity Test: POST /api/agents/{aid}/channels/{cid}/test
 * - Channel Config Probe: POST /api/agents/{aid}/channels/probe
 * - Agent MCP Gateway: POST/GET /api/mcp/agents (or /mcp/agents)
 * Official Repo: github.com/TencentCloud/Octop
 */
export class OctopGatewayDriver {
  private endpoint: string;
  private apiKey?: string;
  private timeoutMs: number;

  constructor(config?: OctopGatewayConfig) {
    this.endpoint = (config?.endpoint || process.env.OCTOP_GATEWAY_URL || 'http://127.0.0.1:8090').replace(/\/+$/, '');
    this.apiKey = config?.apiKey || process.env.OCTOP_API_KEY;
    this.timeoutMs = config?.timeoutMs || 8000;
  }

  public getEndpoint(): string {
    return this.endpoint;
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
    const headers: Record<string, string> = {};
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

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
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

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
    const headers: Record<string, string> = {};
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

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
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

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
   * Return the URL of the official Octop Agent MCP Gateway
   */
  public getMcpGatewayUrl(): string {
    return `${this.endpoint}/api/mcp/agents`;
  }
}
