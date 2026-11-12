import test, { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { CryptoUtil } from '../core/auth/crypto-util.js';
import {
  normalizeRole,
  isRoleAuthorized,
  createSecurityContext,
  createSystemSecurityContext
} from '../core/auth/security-context.js';
import { LDAPProvider } from '../core/auth/ldap-provider.js';

describe('Unit Test: Enterprise Identity, Crypto & RBAC SecurityContext', () => {
  const secretKey = 'test_enterprise_jwt_secret_key_2026';

  it('7.1 should correctly hash and verify passwords using scrypt', () => {
    const rawPassword = 'SecurePassword!123456';
    const hash = CryptoUtil.hashPassword(rawPassword);

    assert.ok(hash.includes(':'));
    const [salt, hexHash] = hash.split(':');
    assert.equal(salt.length, 32);
    assert.equal(hexHash.length, 128);

    assert.equal(CryptoUtil.verifyPassword(rawPassword, hash), true);
    assert.equal(CryptoUtil.verifyPassword('WrongPassword', hash), false);
    assert.equal(CryptoUtil.verifyPassword('', hash), false);
  });

  it('7.2 should generate and verify signed JWT tokens', () => {
    const payload = {
      userId: 'usr_zhang_01',
      username: 'zhang_prof',
      displayName: '张首席科学家',
      role: 'manager',
      authSource: 'ldap',
      groups: ['grp_ai_lab', 'grp_senior']
    };

    const token = CryptoUtil.signJWT(payload, secretKey, 3600);
    assert.ok(token);
    assert.equal(token.split('.').length, 3);

    const verified = CryptoUtil.verifyJWT(token, secretKey);
    assert.ok(verified);
    assert.equal(verified?.userId, 'usr_zhang_01');
    assert.equal(verified?.username, 'zhang_prof');
    assert.equal(verified?.role, 'manager');
  });

  it('7.3 should reject JWT with invalid signature or wrong secret', () => {
    const payload = {
      userId: 'usr_02',
      username: 'test_user',
      displayName: '测试人员',
      role: 'member',
      authSource: 'local',
      groups: []
    };

    const token = CryptoUtil.signJWT(payload, secretKey);
    const verifiedWrong = CryptoUtil.verifyJWT(token, 'different_wrong_secret_key');
    assert.equal(verifiedWrong, null);
  });

  it('7.4 should reject tampered JWT payloads', () => {
    const payload = {
      userId: 'usr_03',
      username: 'normal_user',
      displayName: '普通用户',
      role: 'member',
      authSource: 'local',
      groups: []
    };

    const token = CryptoUtil.signJWT(payload, secretKey);
    const parts = token.split('.');

    // Tamper payload to elevate role to superadmin
    const tamperedPayload = Buffer.from(JSON.stringify({ ...payload, role: 'superadmin' })).toString('base64url');
    const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;

    assert.equal(CryptoUtil.verifyJWT(tamperedToken, secretKey), null);
  });

  it('7.5 should normalize all legacy and domain roles into standard enterprise tiers', () => {
    assert.equal(normalizeRole('superadmin'), 'superadmin');
    assert.equal(normalizeRole('root'), 'superadmin');
    assert.equal(normalizeRole('admin'), 'admin');
    assert.equal(normalizeRole('plant_manager'), 'admin');

    assert.equal(normalizeRole('manager'), 'manager');
    assert.equal(normalizeRole('teacher_pi'), 'manager');
    assert.equal(normalizeRole('pi'), 'manager');
    assert.equal(normalizeRole('supervisor'), 'manager');
    assert.equal(normalizeRole('engineer'), 'manager');

    assert.equal(normalizeRole('member'), 'member');
    assert.equal(normalizeRole('student'), 'member');
    assert.equal(normalizeRole('operator'), 'member');
    assert.equal(normalizeRole('researcher'), 'member');

    assert.equal(normalizeRole('guest'), 'guest');
    assert.equal(normalizeRole('visitor'), 'guest');
    assert.equal(normalizeRole('unknown_role'), 'member');
  });

  it('7.6 should verify role authorization via isRoleAuthorized()', () => {
    assert.equal(isRoleAuthorized('superadmin', ['superadmin']), true);
    assert.equal(isRoleAuthorized('superadmin', ['admin']), false);
    assert.equal(isRoleAuthorized('teacher_pi', ['manager']), true);
    assert.equal(isRoleAuthorized('student', ['member']), true);
    assert.equal(isRoleAuthorized('guest', ['admin', 'manager']), false);
  });

  it('7.7 should construct valid SecurityContext with defaults', () => {
    const ctx = createSecurityContext({
      userId: 'usr_dev_01',
      username: 'developer',
      role: 'engineer',
      groups: ['grp_dev']
    });

    assert.equal(ctx.userId, 'usr_dev_01');
    assert.equal(ctx.role, 'manager');
    assert.deepEqual(ctx.roles, ['manager']);
    assert.equal(ctx.displayName, 'developer');
    assert.equal(ctx.authSource, 'local');
    assert.deepEqual(ctx.groups, ['grp_dev']);
  });

  it('7.8 should create system kernel security context with superadmin privileges', () => {
    const sysCtx = createSystemSecurityContext();
    assert.equal(sysCtx.userId, 'usr_system');
    assert.equal(sysCtx.role, 'superadmin');
    assert.deepEqual(sysCtx.groups, ['*']);
    assert.equal(sysCtx.authSource, 'internal');
  });

  it('7.9 should prevent LDAP injection via escapeFilter()', () => {
    // Attack payloads containing LDAP filter metacharacters
    const raw1 = 'admin)(|(password=*';
    const escaped1 = LDAPProvider.escapeFilter(raw1);
    assert.ok(!escaped1.includes(')('));
    assert.ok(escaped1.includes('\\28'));
    assert.ok(escaped1.includes('\\29'));
    assert.ok(escaped1.includes('\\2a'));

    const raw2 = 'user\\*name';
    const escaped2 = LDAPProvider.escapeFilter(raw2);
    assert.ok(escaped2.includes('\\5c'));
    assert.ok(escaped2.includes('\\2a'));
  });

  it('7.10 should authenticate users in LDAP simulation mode', async () => {
    const provider = new LDAPProvider({ simulationMode: true });

    // Valid credentials (password >= 6 chars)
    const lead = await provider.authenticate('lead_engineer', 'password123');
    assert.ok(lead);
    assert.equal(lead?.username, 'lead_engineer');
    assert.equal(lead?.role, 'manager');
    assert.ok(lead?.groups.includes('grp_r_and_d'));

    const member = await provider.authenticate('user_bob', 'password123');
    assert.ok(member);
    assert.equal(member?.username, 'user_bob');
    assert.equal(member?.role, 'member');

    // Invalid short password
    const failed = await provider.authenticate('lead_engineer', '123');
    assert.equal(failed, null);
  });

  it('7.11 should support custom identity mappers in LDAPProvider', async () => {
    const provider = new LDAPProvider({ simulationMode: true });
    provider.setIdentityMapper((attrs) => ({
      role: 'admin',
      displayName: `特聘专家 (${attrs.username})`,
      department: '高级智库中心',
      groups: ['grp_experts', 'grp_all']
    }));

    const user = await provider.authenticate('expert_chen', 'password123');
    assert.ok(user);
    assert.equal(user?.role, 'admin');
    assert.equal(user?.displayName, '特聘专家 (expert_chen)');
    assert.equal(user?.department, '高级智库中心');
    assert.ok(user?.groups.includes('grp_experts'));
  });
});
