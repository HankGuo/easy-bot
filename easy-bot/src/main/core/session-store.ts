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
    `);
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
