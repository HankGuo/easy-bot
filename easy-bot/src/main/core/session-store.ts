import Database from 'better-sqlite3';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { normalizeRole, isRoleAuthorized } from './auth/security-context.js';

export interface UserRow {
  id: string;
  username: string;
  password_hash: string | null;
  display_name: string;
  email: string | null;
  role: string;
  auth_source: string;
  department: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserGroupRow {
  id: string;
  name: string;
  department_ou: string | null;
  description: string | null;
  created_at: string;
}

export interface ResourceGrantRow {
  id: string;
  resource_type: string;
  resource_id: string;
  group_id: string;
  permission: string;
  granted_at: string;
}

export interface HITLRequestRow {
  id: string;
  session_id: string;
  user_id: string;
  command: string;
  risk_level: string;
  reason: string;
  status: string;
  reviewer_id: string | null;
  created_at: string;
  resolved_at: string | null;
}

export interface KnowledgeFileMetadataRow {
  doc_id: string;
  filename: string;
  space_id: string;
  owner_group_id: string | null;
  uploaded_by: string | null;
  created_at: string;
}

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
        workspace_path TEXT NOT NULL,
        user_id TEXT DEFAULT 'usr_admin'
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

      -- Organization & Multi-Tenancy Tables (Standard Enterprise RBAC Schema)
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT,
        display_name TEXT NOT NULL,
        email TEXT,
        role TEXT NOT NULL DEFAULT 'member',
        auth_source TEXT NOT NULL DEFAULT 'local',
        department TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS user_groups (
        id TEXT PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        department_ou TEXT,
        description TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS user_group_members (
        group_id TEXT NOT NULL REFERENCES user_groups(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        joined_at TEXT NOT NULL,
        PRIMARY KEY (group_id, user_id)
      );

      CREATE TABLE IF NOT EXISTS resource_grants (
        id TEXT PRIMARY KEY,
        resource_type TEXT NOT NULL,
        resource_id TEXT NOT NULL,
        group_id TEXT NOT NULL REFERENCES user_groups(id) ON DELETE CASCADE,
        permission TEXT NOT NULL DEFAULT 'read',
        granted_at TEXT NOT NULL,
        UNIQUE(resource_type, resource_id, group_id)
      );

      CREATE TABLE IF NOT EXISTS hitl_requests (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        command TEXT NOT NULL,
        risk_level TEXT NOT NULL,
        reason TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        reviewer_id TEXT,
        created_at TEXT NOT NULL,
        resolved_at TEXT
      );

      CREATE TABLE IF NOT EXISTS knowledge_spaces (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        space_type TEXT NOT NULL DEFAULT 'public',
        owner_group_id TEXT,
        description TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS knowledge_file_metadata (
        doc_id TEXT PRIMARY KEY,
        filename TEXT NOT NULL,
        space_id TEXT NOT NULL DEFAULT 'public',
        owner_group_id TEXT,
        uploaded_by TEXT,
        created_at TEXT NOT NULL
      );
    `);

    // Schema migration: ensure sessions table has user_id
    try {
      const info = this.db.pragma('table_info(sessions)') as any[];
      const hasUserId = info.some((col: any) => col.name === 'user_id');
      if (!hasUserId) {
        this.db.exec(`ALTER TABLE sessions ADD COLUMN user_id TEXT DEFAULT 'usr_admin';`);
      }
    } catch {}
  }

  // --- Telemetry Methods ---
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

  // --- Session & Audit Methods ---
  public saveSession(session: { id: string; title: string; backend: string; createdAt: string; workspacePath: string; userId?: string }) {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO sessions (id, title, backend, created_at, workspace_path, user_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(session.id, session.title, session.backend, session.createdAt, session.workspacePath, session.userId || 'usr_admin');
  }

  public getSessions(userId?: string, role?: string): any[] {
    if (isRoleAuthorized(role || '', ['superadmin', 'admin']) || !userId) {
      return this.db.prepare('SELECT * FROM sessions ORDER BY created_at DESC').all();
    }
    return this.db.prepare('SELECT * FROM sessions WHERE user_id = ? ORDER BY created_at DESC').all(userId);
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

  // --- Organization & Multi-Tenancy Methods ---
  public createUser(user: {
    id: string;
    username: string;
    passwordHash: string | null;
    displayName: string;
    email?: string;
    role?: string;
    authSource?: string;
    department?: string;
  }): UserRow {
    const now = new Date().toISOString();
    const role = normalizeRole(user.role || 'member');
    const authSource = user.authSource || 'local';
    const email = user.email || null;
    const department = user.department || null;

    const stmt = this.db.prepare(`
      INSERT INTO users (id, username, password_hash, display_name, email, role, auth_source, department, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(user.id, user.username, user.passwordHash, user.displayName, email, role, authSource, department, now, now);
    return this.getUserById(user.id)!;
  }

  public getUserById(id: string): UserRow | null {
    const row = this.db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    return (row as UserRow) || null;
  }

  public getUserByUsername(username: string): UserRow | null {
    const row = this.db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    return (row as UserRow) || null;
  }

  public updateUserPassword(userId: string, passwordHash: string): boolean {
    const now = new Date().toISOString();
    const res = this.db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?').run(passwordHash, now, userId);
    return res.changes > 0;
  }

  public listUsers(): UserRow[] {
    return this.db.prepare('SELECT * FROM users ORDER BY created_at DESC').all() as UserRow[];
  }

  public createGroup(group: { id: string; name: string; departmentOu?: string; description?: string }): UserGroupRow {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO user_groups (id, name, department_ou, description, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(group.id, group.name, group.departmentOu || null, group.description || null, now);
    return this.db.prepare('SELECT * FROM user_groups WHERE id = ?').get(group.id) as UserGroupRow;
  }

  public listGroups(): UserGroupRow[] {
    return this.db.prepare('SELECT * FROM user_groups ORDER BY created_at DESC').all() as UserGroupRow[];
  }

  public addUserToGroup(userId: string, groupId: string) {
    const now = new Date().toISOString();
    this.db.prepare(`
      INSERT OR IGNORE INTO user_group_members (group_id, user_id, joined_at)
      VALUES (?, ?, ?)
    `).run(groupId, userId, now);
  }

  public getUserGroupIds(userId: string): string[] {
    const rows = this.db.prepare('SELECT group_id FROM user_group_members WHERE user_id = ?').all(userId) as { group_id: string }[];
    return rows.map(r => r.group_id);
  }

  public createResourceGrant(grant: {
    id: string;
    resourceType: string;
    resourceId: string;
    groupId: string;
    permission?: string;
  }): ResourceGrantRow {
    const now = new Date().toISOString();
    const permission = grant.permission || 'read';
    this.db.prepare(`
      INSERT OR REPLACE INTO resource_grants (id, resource_type, resource_id, group_id, permission, granted_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(grant.id, grant.resourceType, grant.resourceId, grant.groupId, permission, now);
    return this.db.prepare('SELECT * FROM resource_grants WHERE id = ?').get(grant.id) as ResourceGrantRow;
  }

  public checkResourceAccess(resourceType: string, resourceId: string, userGroupIds: string[]): boolean {
    if (userGroupIds.length === 0) return false;
    const placeholders = userGroupIds.map(() => '?').join(',');
    const row = this.db.prepare(`
      SELECT COUNT(*) as count FROM resource_grants
      WHERE resource_type = ? AND resource_id = ? AND group_id IN (${placeholders})
    `).get(resourceType, resourceId, ...userGroupIds) as { count: number };
    return row.count > 0;
  }

  public listGrantedResources(resourceType: string, userGroupIds: string[]): string[] {
    if (userGroupIds.length === 0) return [];
    const placeholders = userGroupIds.map(() => '?').join(',');
    const rows = this.db.prepare(`
      SELECT DISTINCT resource_id FROM resource_grants
      WHERE resource_type = ? AND group_id IN (${placeholders})
    `).all(resourceType, ...userGroupIds) as { resource_id: string }[];
    return rows.map(r => r.resource_id);
  }

  // --- HITL (Human-in-the-Loop) Methods ---
  public createHITLRequest(req: {
    id: string;
    sessionId: string;
    userId: string;
    command: string;
    riskLevel: string;
    reason: string;
  }): HITLRequestRow {
    const now = new Date().toISOString();
    this.db.prepare(`
      INSERT INTO hitl_requests (id, session_id, user_id, command, risk_level, reason, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)
    `).run(req.id, req.sessionId, req.userId, req.command, req.riskLevel, req.reason, now);
    return this.db.prepare('SELECT * FROM hitl_requests WHERE id = ?').get(req.id) as HITLRequestRow;
  }

  public listPendingHITLRequests(): HITLRequestRow[] {
    return this.db.prepare(`SELECT * FROM hitl_requests WHERE status = 'pending' ORDER BY created_at ASC`).all() as HITLRequestRow[];
  }

  public getHITLRequestById(id: string): HITLRequestRow | null {
    const row = this.db.prepare('SELECT * FROM hitl_requests WHERE id = ?').get(id);
    return (row as HITLRequestRow) || null;
  }

  public deleteUser(id: string): boolean {
    const res = this.db.prepare('DELETE FROM users WHERE id = ?').run(id);
    return res.changes > 0;
  }

  public deleteGroup(id: string): boolean {
    const res = this.db.prepare('DELETE FROM user_groups WHERE id = ?').run(id);
    return res.changes > 0;
  }

  public async backupDatabase(destinationFile: string): Promise<void> {
    await this.db.backup(destinationFile);
  }

  public resolveHITLRequest(id: string, reviewerId: string, approved: boolean): boolean {
    const now = new Date().toISOString();
    const status = approved ? 'approved' : 'rejected';
    const result = this.db.prepare(`
      UPDATE hitl_requests
      SET status = ?, reviewer_id = ?, resolved_at = ?
      WHERE id = ? AND status = 'pending'
    `).run(status, reviewerId, now, id);
    return result.changes > 0;
  }

  // --- Knowledge Spaces ---
  public createKnowledgeSpace(space: { id: string; name: string; spaceType: string; ownerGroupId?: string; description?: string }) {
    const now = new Date().toISOString();
    this.db.prepare(`
      INSERT OR REPLACE INTO knowledge_spaces (id, name, space_type, owner_group_id, description, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(space.id, space.name, space.spaceType, space.ownerGroupId || null, space.description || null, now);
  }

  public listKnowledgeSpaces(): any[] {
    return this.db.prepare('SELECT * FROM knowledge_spaces ORDER BY created_at DESC').all();
  }

  // --- Knowledge File Metadata Persistence ---
  public saveKnowledgeMetadata(meta: {
    docId: string;
    filename: string;
    spaceId: string;
    ownerGroupId?: string;
    uploadedBy?: string;
  }): void {
    const now = new Date().toISOString();
    this.db.prepare(`
      INSERT OR REPLACE INTO knowledge_file_metadata (doc_id, filename, space_id, owner_group_id, uploaded_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      meta.docId,
      meta.filename,
      meta.spaceId || 'public',
      meta.ownerGroupId || null,
      meta.uploadedBy || null,
      now
    );
  }

  public getKnowledgeMetadata(docId: string): KnowledgeFileMetadataRow | null {
    const row = this.db.prepare('SELECT * FROM knowledge_file_metadata WHERE doc_id = ?').get(docId);
    return (row as KnowledgeFileMetadataRow) || null;
  }

  public getKnowledgeMetadataByFilename(filename: string): KnowledgeFileMetadataRow | null {
    const row = this.db.prepare('SELECT * FROM knowledge_file_metadata WHERE filename = ?').get(filename);
    return (row as KnowledgeFileMetadataRow) || null;
  }

  public deleteKnowledgeMetadata(docId: string): boolean {
    const res = this.db.prepare('DELETE FROM knowledge_file_metadata WHERE doc_id = ?').run(docId);
    return res.changes > 0;
  }

  public listAllKnowledgeMetadata(): KnowledgeFileMetadataRow[] {
    return this.db.prepare('SELECT * FROM knowledge_file_metadata ORDER BY created_at DESC').all() as KnowledgeFileMetadataRow[];
  }
}
