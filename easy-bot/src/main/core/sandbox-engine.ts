import * as path from 'node:path';
import * as fs from 'node:fs';
import * as crypto from 'node:crypto';
import { spawn, type ChildProcess } from 'node:child_process';

export interface SandboxPolicy {
  enabled: boolean;
  isolationLevel: 'strict' | 'workspace-only' | 'audit-only';
  backend: 'local' | 'docker';
  dockerImage?: string;
  allowedCommands: string[];
  blockedPatterns: RegExp[];
  hitlPatterns: Array<{ pattern: RegExp; riskLevel: 'high' | 'critical'; reason: string }>;
  maxExecutionTimeMs: number;
  maxMemoryBytes: number;
}

export interface SandboxAuditLog {
  id: string;
  timestamp: string;
  sessionId: string;
  action: 'READ' | 'WRITE' | 'EXECUTE' | 'BLOCKED_ATTEMPT' | 'HITL_INTERCEPT';
  targetPath?: string;
  command?: string;
  status: 'ALLOWED' | 'REJECTED' | 'FAILED' | 'COMPLETED' | 'PENDING_APPROVAL';
  sha256Hash?: string;
  details?: string;
}

/**
 * Sandboxed Execution Engine (Pluggable Docker Container & Scoped Local Shell + HITL Guard)
 * 
 * Provides:
 * 1. Docker-based container isolation (when Docker is available and backend='docker')
 * 2. Strictly jailed local workspace process execution
 * 3. Human-in-the-loop (HITL) dangerous command interception
 * 4. Audit trail logging for all disk & shell interactions
 */
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
      backend: 'local',
      dockerImage: 'node:20-alpine',
      allowedCommands: ['node', 'npm', 'pnpm', 'git', 'cat', 'ls', 'pwd', 'echo', 'grep', 'find', 'mkdir', 'rm', 'cp', 'mv', 'python3', 'python', 'tar', 'unzip'],
      blockedPatterns: [
        /\brm\s+-rf\s+\/(?:\s|$)/,      // Block rm -rf /
        /\bcurl\b.*\|\s*(?:bash|sh)/,   // Block pipe curl to shell
        /\bmkfs\b/,                     // Block format
        /\bdd\s+if=/,                   // Block direct disk write
        /\/Library\/Application Support\/com\.apple\.TCC/, // Block TCC access
        /~?\/\.(?:ssh|aws|gnupg)/        // Block credential theft
      ],
      hitlPatterns: [
        { pattern: /\brm\s+-rf\b/, riskLevel: 'high', reason: '批量递归删除文件，需导师/管理员确认' },
        { pattern: /\bchmod\s+[0-7]{3,4}\b/, riskLevel: 'high', reason: '修改系统权限' },
        { pattern: /\b(?:curl|wget)\b.*https?:\/\//, riskLevel: 'high', reason: '尝试发起外部网络请求' },
        { pattern: /\b(?:pkill|killall)\b/, riskLevel: 'critical', reason: '批量终止进程' }
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
   * Prevents Directory Traversal attacks using path.relative
   */
  public validatePathAccess(sessionId: string, targetPath: string, mode: 'READ' | 'WRITE'): string {
    const sessionDir = path.resolve(this.getSessionWorkspace(sessionId));
    const resolved = path.resolve(sessionDir, targetPath);

    const relative = path.relative(sessionDir, resolved);
    const isEscaped = relative.startsWith('..') || path.isAbsolute(relative);

    if (isEscaped) {
      this.logAudit({
        sessionId,
        action: 'BLOCKED_ATTEMPT',
        targetPath: resolved,
        status: 'REJECTED',
        details: `Path Traversal Violation: ${targetPath} attempted to escape workspace ${sessionDir}`
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
   * Checks if a command requires Human-in-the-Loop (HITL) approval
   */
  public checkRequiresHITL(commandLine: string): { requiresHITL: boolean; riskLevel?: string; reason?: string } {
    for (const rule of this.policy.hitlPatterns) {
      if (rule.pattern.test(commandLine)) {
        return {
          requiresHITL: true,
          riskLevel: rule.riskLevel,
          reason: rule.reason
        };
      }
    }
    return { requiresHITL: false };
  }

  /**
   * Executes a command within the sandboxed session workspace with timeout & process monitoring.
   * If backend is 'docker', delegates into a throwaway Docker container with resource caps.
   */
  public async executeCommand(
    sessionId: string,
    commandLine: string,
    onOutput?: (chunk: string) => void,
    forceBypassHITL: boolean = false
  ): Promise<{ exitCode: number; stdout: string; stderr: string; executionTimeMs: number }> {
    const sessionDir = this.getSessionWorkspace(sessionId);
    const startTime = Date.now();

    // 1. Security Pattern Check (Hard Block)
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

    // 2. HITL Check
    if (!forceBypassHITL) {
      const hitl = this.checkRequiresHITL(commandLine);
      if (hitl.requiresHITL) {
        this.logAudit({
          sessionId,
          action: 'HITL_INTERCEPT',
          command: commandLine,
          status: 'PENDING_APPROVAL',
          details: `Risk Level: ${hitl.riskLevel}. Reason: ${hitl.reason}`
        });
        throw new Error(`HITL_INTERCEPTED: Command requires manual approval: [${hitl.riskLevel}] ${hitl.reason}`);
      }
    }

    // 3. Allowed Command Check
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

    // 4. Execution Dispatch: Docker vs Local
    if (this.policy.backend === 'docker') {
      return this.executeInDocker(sessionId, sessionDir, commandLine, startTime, onOutput);
    } else {
      return this.executeInLocal(sessionId, sessionDir, commandLine, startTime, onOutput);
    }
  }

  private async executeInDocker(
    sessionId: string,
    sessionDir: string,
    commandLine: string,
    startTime: number,
    onOutput?: (chunk: string) => void
  ): Promise<{ exitCode: number; stdout: string; stderr: string; executionTimeMs: number }> {
    const memoryLimit = `${Math.round(this.policy.maxMemoryBytes / (1024 * 1024))}m`;
    const dockerArgs = [
      'run', '--rm',
      '--network', 'none',
      '--memory', memoryLimit,
      '--cpus', '1.0',
      '--pids-limit', '64',
      '-v', `${sessionDir}:/workspace`,
      '-w', '/workspace',
      this.policy.dockerImage || 'node:20-alpine',
      'sh', '-c', commandLine
    ];

    return new Promise((resolve, reject) => {
      let stdout = '';
      let stderr = '';
      const child = spawn('docker', dockerArgs);

      const timer = setTimeout(() => {
        child.kill('SIGKILL');
        reject(new Error(`Docker container command timed out after ${this.policy.maxExecutionTimeMs}ms`));
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
          command: `[Docker] ${commandLine}`,
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
        // Fallback to local execution if Docker daemon is unreachable
        console.warn('[SandboxEngine] Docker execution failed, falling back to local shell:', err.message);
        this.executeInLocal(sessionId, sessionDir, commandLine, startTime, onOutput).then(resolve).catch(reject);
      });
    });
  }

  private async executeInLocal(
    sessionId: string,
    sessionDir: string,
    commandLine: string,
    startTime: number,
    onOutput?: (chunk: string) => void
  ): Promise<{ exitCode: number; stdout: string; stderr: string; executionTimeMs: number }> {
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
    if (this.auditLogs.length > 5000) {
      this.auditLogs.shift();
    }
  }
}
