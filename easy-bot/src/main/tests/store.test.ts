import test, { describe, it, beforeEach, afterEach } from 'node:test';
import * as assert from 'node:assert/strict';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { SessionStore } from '../core/session-store.js';

describe('Unit Test: SessionStore SQLite WAL, Multi-Tenancy & Atomic Backups', () => {
  const testDataDir = path.join(process.cwd(), '.easybot_data_test_' + Date.now());
  let store: SessionStore;

  beforeEach(() => {
    if (!fs.existsSync(testDataDir)) {
      fs.mkdirSync(testDataDir, { recursive: true });
    }
    store = new SessionStore(testDataDir);
  });

  afterEach(() => {
    try {
      fs.rmSync(testDataDir, { recursive: true, force: true });
    } catch {}
  });

  it('8.1 should initialize database and create required schema tables', () => {
    const dbFile = path.join(testDataDir, 'easybot.db');
    assert.ok(fs.existsSync(dbFile));
  });

  it('8.2 should save and retrieve agent sessions', () => {
    store.saveSession({
      id: 'sess_diag_01',
      title: '数控系统智能故障诊断会话',
      backend: 'local',
      createdAt: new Date().toISOString(),
      workspacePath: '/tmp/ws/sess_diag_01',
      userId: 'usr_tech_01'
    });

    const sessions = store.getSessions('usr_tech_01');
    assert.ok(sessions.length >= 1);
    const s = sessions.find(item => item.id === 'sess_diag_01');
    assert.ok(s);
    assert.equal(s.title, '数控系统智能故障诊断会话');
    assert.equal(s.backend, 'local');
  });

  it('8.3 should persist and retrieve telemetry records with financial token accounting', () => {
    store.saveTelemetry({
      id: 'telem_01',
      timestamp: new Date().toISOString(),
      model: 'sensenova-6.8-flash-lite',
      promptTokens: 250,
      completionTokens: 800,
      totalTokens: 1050,
      latencyMs: 1850,
      estimatedCost: 0.0028,
      status: 'success',
      tokenSource: 'upstream_exact',
      task: 'Check tolerance bounds for CNC spindle'
    });

    const records = store.getTelemetry();
    assert.ok(records.length >= 1);
    const r = records.find(item => item.id === 'telem_01');
    assert.ok(r);
    assert.equal(r.model, 'sensenova-6.8-flash-lite');
    assert.equal(r.totalTokens, 1050);
    assert.equal(r.estimatedCost, 0.0028);
  });

  it('8.4 should manage multi-tenant user accounts with password hashes and roles', () => {
    const user = store.createUser({
      id: 'usr_eng_01',
      username: 'eng_zhou',
      displayName: '周总工',
      passwordHash: 'salt:hash123',
      role: 'manager',
      department: '智能装备工程院',
      authSource: 'local'
    });

    assert.equal(user.id, 'usr_eng_01');
    const fetchedById = store.getUserById('usr_eng_01');
    assert.ok(fetchedById);
    assert.equal(fetchedById?.username, 'eng_zhou');
    assert.equal(fetchedById?.display_name, '周总工');

    const fetchedByName = store.getUserByUsername('eng_zhou');
    assert.ok(fetchedByName);
    assert.equal(fetchedByName?.id, 'usr_eng_01');

    const allUsers = store.listUsers();
    assert.ok(allUsers.some(u => u.id === 'usr_eng_01'));
  });

  it('8.5 should update user password hash', () => {
    store.createUser({
      id: 'usr_pw_test',
      username: 'pw_user',
      displayName: '密码更新测试用户',
      passwordHash: 'old_salt:old_hash'
    });

    const updated = store.updateUserPassword('usr_pw_test', 'new_salt:new_hash');
    assert.equal(updated, true);

    const user = store.getUserById('usr_pw_test');
    assert.equal(user?.password_hash, 'new_salt:new_hash');
  });

  it('8.6 should create organizational groups and query memberships', () => {
    const group = store.createGroup({
      id: 'grp_optics_lab',
      name: '精密光学加工课题组',
      departmentOu: '先进制造研究院',
      description: '微纳光学与超精密加工'
    });

    assert.equal(group.id, 'grp_optics_lab');
    const groups = store.listGroups();
    assert.ok(groups.some(g => g.id === 'grp_optics_lab'));

    store.createUser({
      id: 'usr_optics_member',
      username: 'optics_dev',
      displayName: '光学研发人员',
      passwordHash: 'salt:hash'
    });

    store.addUserToGroup('usr_optics_member', 'grp_optics_lab');
    const userGroupIds = store.getUserGroupIds('usr_optics_member');
    assert.ok(userGroupIds.includes('grp_optics_lab'));
  });

  it('8.7 should manage fine-grained resource grants and access checking', () => {
    store.createGroup({
      id: 'grp_res_group',
      name: '资源授权测试组'
    });

    store.createResourceGrant({
      id: 'grant_01',
      resourceType: 'knowledge_space',
      resourceId: 'space_nano_optics',
      groupId: 'grp_res_group',
      permission: 'READ_WRITE'
    });

    // User with grp_res_group should have access
    const hasAccess = store.checkResourceAccess('knowledge_space', 'space_nano_optics', ['grp_res_group']);
    assert.equal(hasAccess, true);

    // User without grp_res_group should be rejected
    const noAccess = store.checkResourceAccess('knowledge_space', 'space_nano_optics', ['grp_other']);
    assert.equal(noAccess, false);

    const granted = store.listGrantedResources('knowledge_space', ['grp_res_group']);
    assert.ok(granted.includes('space_nano_optics'));
  });

  it('8.8 should create, list, and resolve Human-in-the-Loop (HITL) requests', () => {
    store.createHITLRequest({
      id: 'hitl_store_01',
      sessionId: 'sess_hitl_test',
      userId: 'usr_tech_worker',
      command: 'rm -rf ./build_cache',
      riskLevel: 'high',
      reason: '批量递归删除缓存'
    });

    const pending = store.listPendingHITLRequests();
    assert.ok(pending.some(p => p.id === 'hitl_store_01'));

    const req = store.getHITLRequestById('hitl_store_01');
    assert.ok(req);
    assert.equal(req?.status, 'pending');

    const resolved = store.resolveHITLRequest('hitl_store_01', 'usr_supervisor', true);
    assert.equal(resolved, true);

    const afterResolve = store.getHITLRequestById('hitl_store_01');
    assert.equal(afterResolve?.status, 'approved');
    assert.equal(afterResolve?.reviewer_id, 'usr_supervisor');
  });

  it('8.9 should manage confidential knowledge spaces and file metadata', () => {
    store.createKnowledgeSpace({
      id: 'space_classified',
      name: '涉密国家级重大专项空间',
      spaceType: 'confidential',
      ownerGroupId: 'grp_defense_team'
    });

    const spaces = store.listKnowledgeSpaces();
    assert.ok(spaces.some(s => s.id === 'space_classified'));

    store.saveKnowledgeMetadata({
      docId: 'doc_secret_01',
      filename: 'SECRET-PROJECT-BLUEPRINT.docx',
      spaceId: 'space_classified',
      ownerGroupId: 'grp_defense_team',
      uploadedBy: 'usr_pi'
    });

    const meta = store.getKnowledgeMetadata('doc_secret_01');
    assert.ok(meta);
    assert.equal(meta?.filename, 'SECRET-PROJECT-BLUEPRINT.docx');
    assert.equal(meta?.owner_group_id, 'grp_defense_team');
  });

  it('8.10 should perform atomic hot database backup to destination file', async () => {
    const backupTarget = path.join(testDataDir, 'backup_atomic.db');
    await store.backupDatabase(backupTarget);

    assert.ok(fs.existsSync(backupTarget));
    const stat = fs.statSync(backupTarget);
    assert.ok(stat.size > 0);
  });
});
