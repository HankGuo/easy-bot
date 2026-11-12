import * as path from 'node:path';
import * as fs from 'node:fs';
import * as crypto from 'node:crypto';
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { Sandbox } from '@cubesandbox/sdk';

export interface SandboxPolicy {
  enabled: boolean;
  isolationLevel: 'strict' | 'workspace-only' | 'audit-only';
  backend: 'cubesandbox' | 'docker' | 'local';
  cubeSandboxEndpoint?: string;
  cubeSandboxApiKey?: string;
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

export const SAFE_LOCAL_COMMANDS = [
  'cat', 'ls', 'pwd', 'echo', 'grep', 'find', 'mkdir', 'rm', 'cp', 'mv',
  'tar', 'unzip', 'head', 'tail', 'diff', 'sort', 'uniq', 'wc', 'touch'
];

export const SCRIPT_INTERPRETER_COMMANDS = [
  'node', 'python', 'python3', 'python3.10', 'python3.11', 'python3.12',
  'npm', 'pnpm', 'npx', 'yarn', 'pip', 'pip3', 'sh', 'bash', 'zsh', 'perl', 'ruby', 'php'
];

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

  private static dockerAvailableCache: boolean | null = null;

  public static isDockerAvailable(): boolean {
    if (SandboxEngine.dockerAvailableCache !== null) {
      return SandboxEngine.dockerAvailableCache;
    }
    if (process.env.EASYBOT_DISABLE_DOCKER === 'true') {
      SandboxEngine.dockerAvailableCache = false;
      return false;
    }
    try {
      const res = spawnSync('docker', ['version', '--format', '{{.Server.Version}}'], {
        stdio: 'pipe',
        timeout: 1000
      });
      SandboxEngine.dockerAvailableCache = res.status === 0;
    } catch {
      SandboxEngine.dockerAvailableCache = false;
    }
    return SandboxEngine.dockerAvailableCache;
  }

  public static sanitizeSessionId(sessionId: string): string {
    const cleaned = (sessionId || '').trim();
    if (!cleaned || !/^[a-zA-Z0-9_-]{1,128}$/.test(cleaned)) {
      throw new Error(`Security Violation: Invalid or malicious sessionId format: "${sessionId}"`);
    }
    return cleaned;
  }

  public static parseCommandBinaries(commandLine: string): string[] {
    const segments = commandLine.split(/[;&|`$()\n\r]+/);
    const binaries: string[] = [];

    for (const rawSeg of segments) {
      const seg = rawSeg.trim();
      if (!seg) continue;
      const tokens = seg.split(/\s+/);
      let cmdToken = '';
      for (const t of tokens) {
        if (/^[a-zA-Z_][a-zA-Z0-9_]*=/.test(t)) continue;
        cmdToken = t;
        break;
      }
      if (cmdToken) {
        binaries.push(path.basename(cmdToken));
      }
    }
    return binaries;
  }

  constructor(workspaceRoot: string, policy?: Partial<SandboxPolicy>) {
    this.workspaceRoot = path.resolve(workspaceRoot);
    if (!fs.existsSync(this.workspaceRoot)) {
      fs.mkdirSync(this.workspaceRoot, { recursive: true });
    }

    const configuredBackend = policy?.backend || (process.env.EASYBOT_SANDBOX_BACKEND as any);
    let defaultBackend: 'cubesandbox' | 'docker' | 'local' = configuredBackend;
    if (!defaultBackend) {
      if (process.env.CUBESANDBOX_URL || policy?.cubeSandboxEndpoint) {
        defaultBackend = 'cubesandbox';
      } else {
        defaultBackend = 'local';
      }
    }
    const defaultAllowed = (defaultBackend === 'docker' || defaultBackend === 'cubesandbox')
      ? ['node', 'npm', 'pnpm', 'git', 'cat', 'ls', 'pwd', 'echo', 'grep', 'find', 'mkdir', 'rm', 'cp', 'mv', 'python3', 'python', 'tar', 'unzip', 'head', 'tail', 'diff', 'sort', 'uniq', 'wc', 'touch']
      : [...SAFE_LOCAL_COMMANDS];

    this.policy = {
      enabled: true,
      isolationLevel: 'strict',
      backend: defaultBackend,
      cubeSandboxEndpoint: policy?.cubeSandboxEndpoint || process.env.CUBESANDBOX_URL || 'http://127.0.0.1:49982',
      cubeSandboxApiKey: policy?.cubeSandboxApiKey || process.env.CUBESANDBOX_API_KEY,
      dockerImage: 'node:20-alpine',
      allowedCommands: defaultAllowed,
      blockedPatterns: [
        /\brm\s+-rf\s+\/(?:\s|$)/,      // Block rm -rf /
        /\bcurl\b.*\|\s*(?:bash|sh)/,   // Block pipe curl to shell
        /\bmkfs\b/,                     // Block format
        /\bdd\s+if=/,                   // Block direct disk write
        /\/Library\/Application Support\/com\.apple\.TCC/, // Block TCC access
        /~?\/\.(?:ssh|aws|gnupg)/,       // Block credential theft
        /\b(nc|ncat|netcat|socat)\b/,   // Block reverse shell tools
        /\/dev\/(?:tcp|udp)\//,         // Block raw socket shell redirect
        /\b(sudo|su)\b/,                // Block privilege escalation
        /\bchmod\s+([+]s|[0-7]?[421][0-7]{3})\b/, // Block SUID bit
        /python[0-9.]*\s+-c\s+['"].*import\s+socket/, // Block python reverse socket
        /\bnode\s+(?:-e|--eval)\b/,     // Block node inline eval
        /\bpython[0-9.]*\s+-c\b/,       // Block python inline eval
        /\b(?:bash|sh|zsh)\s+-c\b/,     // Block subshell inline execution
        /\beval\s+/,                    // Block eval keyword
        /\bperl\s+-e\b/                 // Block perl inline execution
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
    const validSessionId = SandboxEngine.sanitizeSessionId(sessionId);
    const sessionDir = path.resolve(this.workspaceRoot, validSessionId);

    const relative = path.relative(this.workspaceRoot, sessionDir);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new Error(`Security Violation: sessionId attempted directory escape: "${sessionId}"`);
    }

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
  public checkRequiresHITL(commandLine: string): { requiresHITL: boolean; riskLevel?: 'high' | 'critical'; reason?: string } {
    for (const rule of this.policy.hitlPatterns) {
      if (rule.pattern.test(commandLine)) {
        return {
          requiresHITL: true,
          riskLevel: rule.riskLevel,
          reason: rule.reason
        };
      }
    }

    // In local backend mode, any interpreter execution requires HITL approval
    if (this.policy.backend === 'local') {
      const binaries = SandboxEngine.parseCommandBinaries(commandLine);
      for (const b of binaries) {
        if (SCRIPT_INTERPRETER_COMMANDS.includes(b)) {
          return {
            requiresHITL: true,
            riskLevel: 'critical',
            reason: `宿主机执行代码解释器 [${b}] 存在越权及逃逸风险，必须经由导师或管理员审核批准`
          };
        }
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

    // 3. Allowed Command Check across entire command pipeline
    const invokedBinaries = SandboxEngine.parseCommandBinaries(commandLine);
    if (this.policy.isolationLevel === 'strict') {
      for (const baseBinary of invokedBinaries) {
        const isWhitelisted = this.policy.allowedCommands.includes(baseBinary);
        const isApprovedInterpreter = forceBypassHITL && SCRIPT_INTERPRETER_COMMANDS.includes(baseBinary);
        if (!isWhitelisted && !isApprovedInterpreter) {
          this.logAudit({
            sessionId,
            action: 'BLOCKED_ATTEMPT',
            command: commandLine,
            status: 'REJECTED',
            details: `Binary '${baseBinary}' in pipeline is not permitted in strict sandbox mode.`
          });
          throw new Error(`Execution Blocked: Command '${baseBinary}' is not permitted in strict sandbox mode.`);
        }
      }
    }

    this.logAudit({
      sessionId,
      action: 'EXECUTE',
      command: commandLine,
      status: 'ALLOWED'
    });

    // 4. Execution Dispatch: CubeSandbox vs Docker vs Local
    if (this.policy.backend === 'cubesandbox') {
      return this.executeInCubeSandbox(sessionId, sessionDir, commandLine, startTime, onOutput);
    } else if (this.policy.backend === 'docker') {
      return this.executeInDocker(sessionId, sessionDir, commandLine, startTime, onOutput);
    } else {
      return this.executeInLocal(sessionId, sessionDir, commandLine, startTime, onOutput);
    }
  }

  /**
   * Executes a command inside TencentCloud CubeSandbox (RustVMM + KVM hardware microVM)
   * Using official @cubesandbox/sdk Node.js client.
   * Full lifecycle: Sandbox.create() -> commands.run() -> sandbox.kill()
   * Enforces fail-closed enterprise boundary: if CubeSandbox is unreachable or fails,
   * host execution fallback is strictly prohibited.
   */
  private async executeInCubeSandbox(
    sessionId: string,
    sessionDir: string,
    commandLine: string,
    startTime: number,
    onOutput?: (chunk: string) => void
  ): Promise<{ exitCode: number; stdout: string; stderr: string; executionTimeMs: number }> {
    let sb: Sandbox | undefined;
    const endpoint = (this.policy.cubeSandboxEndpoint || 'http://127.0.0.1:49982').replace(/\/+$/, '');

    try {
      sb = await Sandbox.create({
        apiUrl: endpoint,
        config: {
          apiUrl: endpoint,
          apiKey: this.policy.cubeSandboxApiKey || process.env.CUBE_API_KEY || null,
        },
        timeout: Math.round(this.policy.maxExecutionTimeMs / 1000)
      });

      const res = await sb.commands.run(commandLine, {
        timeoutMs: this.policy.maxExecutionTimeMs
      });

      const duration = Date.now() - startTime;
      const stdout = res.stdout || '';
      const stderr = res.stderr || '';
      const exitCode = res.exitCode ?? 0;

      if (stdout && onOutput) onOutput(stdout);
      if (stderr && onOutput) onOutput(stderr);

      this.logAudit({
        sessionId,
        action: 'EXECUTE',
        command: `[CubeSandbox SDK] ${commandLine}`,
        status: exitCode === 0 ? 'COMPLETED' : 'FAILED',
        details: `SandboxID: ${sb.sandboxId}, ExitCode: ${exitCode}, Duration: ${duration}ms`
      });

      return {
        exitCode,
        stdout,
        stderr,
        executionTimeMs: duration
      };
    } catch (err: any) {
      this.logAudit({
        sessionId,
        action: 'BLOCKED_ATTEMPT',
        command: `[CubeSandbox SDK] ${commandLine}`,
        status: 'FAILED',
        details: `CubeSandbox microVM execution error via @cubesandbox/sdk: ${err.message}. Fail-closed enterprise policy prevents host fallback.`
      });
      throw new Error(`Security Violation: CubeSandbox microVM execution failed (@cubesandbox/sdk): ${err.message}. Fail-closed enterprise policy prohibits host fallback.`);
    } finally {
      if (sb) {
        try {
          await sb.kill();
        } catch {}
      }
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
        const isFailed = code !== 0;
        this.logAudit({
          sessionId,
          action: 'EXECUTE',
          command: `[Docker] ${commandLine}`,
          status: isFailed ? 'FAILED' : 'COMPLETED',
          details: `Exit code: ${code}, Duration: ${duration}ms`
        });

        if (isFailed && (stderr.includes('docker:') || stderr.includes('Error:') || stderr.includes('Cannot connect') || stderr.includes('Unable to find image') || code === 125 || code === 127)) {
          reject(new Error(`Docker container execution error (exit ${code}): ${stderr.trim() || stdout.trim() || 'Container startup failure'}`));
          return;
        }

        resolve({
          exitCode: code ?? 1,
          stdout,
          stderr,
          executionTimeMs: duration
        });
      });

      child.on('error', (err) => {
        clearTimeout(timer);
        this.logAudit({
          sessionId,
          action: 'BLOCKED_ATTEMPT',
          command: `[Docker] ${commandLine}`,
          status: 'FAILED',
          details: `Docker execution error: ${err.message}. Fail-closed security policy prevents local host fallback.`
        });
        reject(new Error(`Docker container execution error: ${err.message}. Fail-closed campus security policy prohibits host fallback.`));
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
          PATH: process.env.PATH || '/usr/local/bin:/usr/bin:/bin',
          LANG: 'en_US.UTF-8',
          NODE_ENV: 'production',
          EASYBOT_SANDBOX_SESSION: sessionId,
          EASYBOT_WORKSPACE: sessionDir
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
