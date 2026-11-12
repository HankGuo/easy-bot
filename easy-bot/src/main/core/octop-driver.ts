export interface OctopMessagePayload {
  platform: 'wecom' | 'dingtalk' | 'feishu' | 'qq' | 'telegram' | 'webhook';
  recipientId: string;
  content: string;
  msgType?: 'text' | 'markdown';
}

export interface OctopGatewayConfig {
  endpoint?: string;
  apiKey?: string;
  timeoutMs?: number;
}

/**
 * Enterprise TencentCloud Octop Gateway Driver
 * Bridges enterprise IM systems (WeCom, DingTalk, Feishu, QQ) through TencentCloud Octop Gateway
 * Official Repo: github.com/TencentCloud/Octop
 */
export class OctopGatewayDriver {
  private endpoint: string;
  private apiKey?: string;
  private timeoutMs: number;

  constructor(config?: OctopGatewayConfig) {
    this.endpoint = (config?.endpoint || process.env.OCTOP_GATEWAY_URL || 'http://127.0.0.1:5000').replace(/\/+$/, '');
    this.apiKey = config?.apiKey || process.env.OCTOP_API_KEY;
    this.timeoutMs = config?.timeoutMs || 8000;
  }

  public getEndpoint(): string {
    return this.endpoint;
  }

  public async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch(`${this.endpoint}/api/v1/gateway/status`, {
        method: 'GET',
        signal: AbortSignal.timeout(2000)
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  public async sendMessage(payload: OctopMessagePayload): Promise<{ success: boolean; latencyMs: number; message: string }> {
    const startTime = Date.now();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    try {
      const res = await fetch(`${this.endpoint}/api/v1/gateway/send`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(this.timeoutMs)
      });

      const latencyMs = Date.now() - startTime;
      if (res.ok) {
        return {
          success: true,
          latencyMs,
          message: `Octop Gateway dispatched to ${payload.platform} successfully (${latencyMs}ms)`
        };
      } else {
        const errText = await res.text();
        return {
          success: false,
          latencyMs,
          message: `Octop Gateway returned HTTP ${res.status}: ${errText}`
        };
      }
    } catch (err: any) {
      return {
        success: false,
        latencyMs: Date.now() - startTime,
        message: `Octop Gateway communication failed: ${err.message}`
      };
    }
  }
}
