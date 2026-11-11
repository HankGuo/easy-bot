import Database from 'better-sqlite3';
import * as path from 'node:path';
import * as fs from 'node:fs';

export class SessionStore {
  private db: Database.Database;

  constructor(dbDir: string) {
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    const dbPath = path.join(dbDir, 'easybot.db');
    this.db = new Database(dbPath);
    this.initSchema();
  }

  private initSchema() {
    this.db.pragma('journal_mode = WAL');

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        backend TEXT NOT NULL,
        created_at TEXT NOT NULL,
        workspace_path TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        action TEXT NOT NULL,
        target_path TEXT,
        command TEXT,
        status TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        details TEXT
      );

      CREATE TABLE IF NOT EXISTS knowledge_docs (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS telemetry_records (
        id TEXT PRIMARY KEY,
        timestamp TEXT NOT NULL,
        model TEXT NOT NULL,
        prompt_tokens INTEGER NOT NULL,
        completion_tokens INTEGER NOT NULL,
        total_tokens INTEGER NOT NULL,
        latency_ms INTEGER NOT NULL,
        estimated_cost REAL NOT NULL,
        task TEXT NOT NULL,
        status TEXT NOT NULL,
        token_source TEXT NOT NULL
      );
    `);
  }

  public saveTelemetry(record: {
    id: string;
    timestamp: string;
    model: string;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    latencyMs: number;
    estimatedCost: number;
    task: string;
    status: string;
    tokenSource: string;
  }) {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO telemetry_records (
        id, timestamp, model, prompt_tokens, completion_tokens, total_tokens, latency_ms, estimated_cost, task, status, token_source
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      record.id,
      record.timestamp,
      record.model,
      record.promptTokens,
      record.completionTokens,
      record.totalTokens,
      record.latencyMs,
      record.estimatedCost,
      record.task,
      record.status,
      record.tokenSource
    );
  }

  public getTelemetry(limit: number = 100): any[] {
    const rows = this.db.prepare('SELECT * FROM telemetry_records ORDER BY rowid DESC LIMIT ?').all(limit);
    return rows.map((r: any) => ({
      id: r.id,
      timestamp: r.timestamp,
      model: r.model,
      promptTokens: r.prompt_tokens,
      completionTokens: r.completion_tokens,
      totalTokens: r.total_tokens,
      latencyMs: r.latency_ms,
      estimatedCost: r.estimated_cost,
      task: r.task,
      status: r.status,
      tokenSource: r.token_source
    }));
  }

  public clearTelemetry() {
    this.db.prepare('DELETE FROM telemetry_records').run();
  }

  public saveSession(session: { id: string; title: string; backend: string; createdAt: string; workspacePath: string }) {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO sessions (id, title, backend, created_at, workspace_path)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(session.id, session.title, session.backend, session.createdAt, session.workspacePath);
  }

  public getSessions(): any[] {
    return this.db.prepare('SELECT * FROM sessions ORDER BY created_at DESC').all();
  }

  public saveAuditLog(log: any) {
    const stmt = this.db.prepare(`
      INSERT INTO audit_logs (id, session_id, action, target_path, command, status, timestamp, details)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(log.id, log.sessionId, log.action, log.targetPath || null, log.command || null, log.status, log.timestamp, log.details || null);
  }

  public getAuditLogs(sessionId?: string): any[] {
    if (sessionId) {
      return this.db.prepare('SELECT * FROM audit_logs WHERE session_id = ? ORDER BY timestamp DESC LIMIT 100').all(sessionId);
    }
    return this.db.prepare('SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 100').all();
  }
}
