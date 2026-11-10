import * as path from 'node:path';
import * as fs from 'node:fs';
import * as crypto from 'node:crypto';
import { spawn, type ChildProcess } from 'node:child_process';

export interface SandboxPolicy {
  enabled: boolean;
  isolationLevel: 'strict' | 'workspace-only' | 'audit-only';
  allowedCommands: string[];
  blockedPatterns: RegExp[];
  maxExecutionTimeMs: number;
  maxMemoryBytes: number;
}

export interface SandboxAuditLog {
  id: string;
  timestamp: string;
  sessionId: string;
  action: 'READ' | 'WRITE' | 'EXECUTE' | 'BLOCKED_ATTEMPT';
  targetPath?: string;
  command?: string;
  status: 'ALLOWED' | 'REJECTED' | 'FAILED' | 'COMPLETED';
  sha256Hash?: string;
  details?: string;
}

export class SandboxEngine {
  private workspaceRoot: string;
  private policy: SandboxPolicy;
  private auditLogs: SandboxAuditLog[] = [];

  constructor(workspaceRoot: string, policy?: Partial<SandboxPolicy>) {
    this.workspaceRoot = path.resolve(workspaceRoot);
    if (!fs.existsSync(this.workspaceRoot)) {
      fs.mkdirSync(this.workspaceRoot, { recursive: true });
    }

    this.policy = {
      enabled: true,
      isolationLevel: 'strict',
      allowedCommands: ['node', 'npm', 'pnpm', 'git', 'cat', 'ls', 'pwd', 'echo', 'grep', 'find', 'mkdir', 'rm', 'cp', 'mv', 'python3'],
      blockedPatterns: [
        /\brm\s+-rf\s+\/(?:\s|$)/,      // Block rm -rf /
        /\bcurl\b.*\|\s*(?:bash|sh)/,   // Block pipe curl to shell
        /\bmkfs\b/,                     // Block format
        /\bdd\s+if=/,                   // Block direct disk write
        /\/Library\/Application Support\/com\.apple\.TCC/, // Block TCC access
        /~?\/\.(?:ssh|aws|gnupg)/        // Block credential theft
      ],
      maxExecutionTimeMs: 60000,
      maxMemoryBytes: 512 * 1024 * 1024,
      ...policy
    };
  }

  public getPolicy(): SandboxPolicy {
    return { ...this.policy };
  }

  public updatePolicy(patch: Partial<SandboxPolicy>): SandboxPolicy {
    this.policy = { ...this.policy, ...patch };
    return this.getPolicy();
  }

  public getSessionWorkspace(sessionId: string): string {
    const sessionDir = path.join(this.workspaceRoot, sessionId);
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
    }
    return sessionDir;
  }

  /**
   * Validates if a target path is strictly within the allowed workspace boundary.
   * Prevents Directory Traversal attacks (e.g., ../../etc/passwd)
   */
  public validatePathAccess(sessionId: string, targetPath: string, mode: 'READ' | 'WRITE'): string {
    const sessionDir = this.getSessionWorkspace(sessionId);
    const resolved = path.resolve(sessionDir, targetPath);

    // Enforce Boundary
    if (!resolved.startsWith(sessionDir)) {
      this.logAudit({
        sessionId,
        action: 'BLOCKED_ATTEMPT',
        targetPath: resolved,
        status: 'REJECTED',
        details: `Path Traversal Violation: ${targetPath} resolved outside workspace boundary ${sessionDir}`
      });
      throw new Error(`Security Violation: Path traversal outside workspace boundary is blocked: ${targetPath}`);
    }

    this.logAudit({
      sessionId,
      action: mode,
      targetPath: resolved,
      status: 'ALLOWED'
    });

    return resolved;
  }

  /**
   * Executes a command within the sandboxed session workspace with timeout & process monitoring
   */
  public async executeCommand(
    sessionId: string,
    commandLine: string,
    onOutput?: (chunk: string) => void
  ): Promise<{ exitCode: number; stdout: string; stderr: string; executionTimeMs: number }> {
    const sessionDir = this.getSessionWorkspace(sessionId);
    const startTime = Date.now();

    // 1. Security Pattern Check
    for (const pattern of this.policy.blockedPatterns) {
      if (pattern.test(commandLine)) {
        this.logAudit({
          sessionId,
          action: 'BLOCKED_ATTEMPT',
          command: commandLine,
          status: 'REJECTED',
          details: `Command matched dangerous pattern: ${pattern.toString()}`
        });
        throw new Error(`Security Violation: Command matched blocked security rule: ${commandLine}`);
      }
    }

    // 2. Allowed Command Check
    const rootBinary = commandLine.trim().split(/\s+/)[0];
    const baseBinary = path.basename(rootBinary);
    if (this.policy.isolationLevel === 'strict' && !this.policy.allowedCommands.includes(baseBinary)) {
      this.logAudit({
        sessionId,
        action: 'BLOCKED_ATTEMPT',
        command: commandLine,
        status: 'REJECTED',
        details: `Binary '${baseBinary}' is not in the whitelist of allowed execution commands.`
      });
      throw new Error(`Execution Blocked: Command '${baseBinary}' is not permitted in strict sandbox mode.`);
    }

    this.logAudit({
      sessionId,
      action: 'EXECUTE',
      command: commandLine,
      status: 'ALLOWED'
    });

    return new Promise((resolve, reject) => {
      let stdout = '';
      let stderr = '';

      const child: ChildProcess = spawn('/bin/sh', ['-c', commandLine], {
        cwd: sessionDir,
        env: {
          PATH: process.env.PATH,
          EASYBOT_SANDBOX_SESSION: sessionId,
          EASYBOT_WORKSPACE: sessionDir,
          LANG: 'en_US.UTF-8'
        }
      });

      const timer = setTimeout(() => {
        child.kill('SIGKILL');
        reject(new Error(`Command timed out after ${this.policy.maxExecutionTimeMs}ms`));
      }, this.policy.maxExecutionTimeMs);

      child.stdout?.on('data', (data) => {
        const text = data.toString('utf-8');
        stdout += text;
        onOutput?.(text);
      });

      child.stderr?.on('data', (data) => {
        const text = data.toString('utf-8');
        stderr += text;
        onOutput?.(text);
      });

      child.on('close', (code) => {
        clearTimeout(timer);
        const duration = Date.now() - startTime;
        this.logAudit({
          sessionId,
          action: 'EXECUTE',
          command: commandLine,
          status: code === 0 ? 'COMPLETED' : 'FAILED',
          details: `Exit code: ${code}, Duration: ${duration}ms`
        });
        resolve({
          exitCode: code ?? 1,
          stdout,
          stderr,
          executionTimeMs: duration
        });
      });

      child.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });
  }

  public getAuditLogs(sessionId?: string, limit: number = 100): SandboxAuditLog[] {
    let logs = this.auditLogs;
    if (sessionId) {
      logs = logs.filter(l => l.sessionId === sessionId);
    }
    return logs.slice(-limit);
  }

  private logAudit(entry: Omit<SandboxAuditLog, 'id' | 'timestamp'>) {
    const log: SandboxAuditLog = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      ...entry
    };
    this.auditLogs.push(log);
    // Keep bounded in-memory cache
    if (this.auditLogs.length > 5000) {
      this.auditLogs.shift();
    }
  }
}
