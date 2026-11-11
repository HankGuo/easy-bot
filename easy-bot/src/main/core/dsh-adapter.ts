import * as child_process from 'node:child_process';
import { SandboxEngine } from './sandbox-engine.js';
import { HybridRAGEngine } from './hybrid-rag.js';
import { MCPHostManager } from './mcp-host.js';
import { ToolCallEvent, ToolResultEvent } from './agent-router.js';

export interface DSHTaskResult {
  engine: string;
  version: string;
  success: boolean;
  output: string;
  toolCallsExecuted: number;
  durationMs: number;
  error?: string;
}

/**
 * DeepSeek Harness Adapter & Native Engine Status
 * 
 * DESIGN RATIONALE:
 * This adapter provides optional connectivity to DeepSeek Harness CLI (`dsh`) if installed
 * in the host environment. If not installed, it honestly reports `dshInstalled: false`
 * rather than fabricating a simulated active state.
 */
export class DSHEngineAdapter {
  private sandbox: SandboxEngine;
  private rag: HybridRAGEngine;
  private mcp: MCPHostManager;
  private version: string = '0.2.2-rc.1';
  private isDshAvailable: boolean = false;

  constructor(sandbox: SandboxEngine, rag: HybridRAGEngine, mcp: MCPHostManager) {
    this.sandbox = sandbox;
    this.rag = rag;
    this.mcp = mcp;
    this.checkDshAvailability();
  }

  private checkDshAvailability() {
    try {
      const res = child_process.spawnSync('npx', ['--no-install', 'dsh', '--version'], {
        timeout: 3000,
        encoding: 'utf-8'
      });
      this.isDshAvailable = res.status === 0;
    } catch {
      this.isDshAvailable = false;
    }
  }

  public getVersion(): string {
    return this.version;
  }

  public getStatus() {
    return {
      engine: 'EasyBot Autonomous Agent Host (TypeScript Core)',
      dshPackage: '@deepseek-ai/dsh',
      dshCliInstalled: this.isDshAvailable,
      runtimeArchitecture: 'Native Event-Driven Agent Loop',
      dshActive: this.isDshAvailable,
      nativeActive: true
    };
  }

  /**
   * Dispatches task through DeepSeek Harness CLI if installed, or reports unavailability
   */
  public async executeTask(
    sessionId: string,
    prompt: string,
    modelName: string,
    systemPrompt: string,
    onChunk?: (chunk: string) => void,
    onToolCall?: (toolCall: ToolCallEvent) => void,
    onToolResult?: (result: ToolResultEvent) => void
  ): Promise<DSHTaskResult> {
    const t0 = Date.now();
    const workspace = this.sandbox.getSessionWorkspace(sessionId);

    if (this.isDshAvailable) {
      const cliResult = await this.tryRunDSHCLI(prompt, workspace);
      if (cliResult) {
        if (onChunk) onChunk(cliResult);
        return {
          engine: 'DeepSeekHarness-CLI',
          version: this.version,
          success: true,
          output: cliResult,
          toolCallsExecuted: 1,
          durationMs: Date.now() - t0
        };
      }
    }

    // Honest report when DSH CLI is not available
    return {
      engine: 'DeepSeekHarness-Adapter',
      version: this.version,
      success: false,
      output: '',
      toolCallsExecuted: 0,
      durationMs: Date.now() - t0,
      error: 'DeepSeek Harness CLI (dsh) is not installed in the host environment. EasyBot routes tasks through its native TypeScript AgentRouter instead.'
    };
  }

  private async tryRunDSHCLI(prompt: string, workspace: string): Promise<string | null> {
    return new Promise((resolve) => {
      const child = child_process.spawn('npx', ['dsh', 'headless', prompt.slice(0, 100)], {
        cwd: workspace,
        env: { ...process.env, CI: 'true', DSH_NON_INTERACTIVE: '1' },
        timeout: 8000
      });

      let stdout = '';
      child.stdout.on('data', (d) => { stdout += d.toString(); });
      child.stderr.on('data', () => {});

      child.on('close', (code) => {
        if (code === 0 && stdout.trim()) {
          resolve(stdout.trim());
        } else {
          resolve(null);
        }
      });

      child.on('error', () => {
        resolve(null);
      });
    });
  }
}
