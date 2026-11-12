import { Client } from 'ldapts';
import { normalizeRole, EnterpriseRole, SecurityContext } from './security-context.js';

export interface LDAPConfig {
  enabled: boolean;
  url: string;
  bindDN?: string;
  bindPassword?: string;
  searchBase: string;
  userFilter: string; // e.g. "(&(objectClass=person)(uid={username}))"
  attributes?: string[];
  roleMapping?: Record<string, string>; // e.g. { "ou=managers": "manager", "ou=members": "member" }
  simulationMode?: boolean; // For offline enterprise demo & testing
}

export interface LDAPUserRecord {
  username: string;
  displayName: string;
  email?: string;
  department?: string;
  role: string;
  dn: string;
  groups: string[];
}

export type LDAPIdentityMapper = (attrs: Record<string, any>) => Partial<SecurityContext> | { role: string; department?: string; groups: string[]; displayName?: string };

export class LDAPProvider {
  private config: LDAPConfig;
  private customMapper?: LDAPIdentityMapper;

  constructor(config?: Partial<LDAPConfig>, customMapper?: LDAPIdentityMapper) {
    this.customMapper = customMapper;
    this.config = {
      enabled: config?.enabled ?? false,
      url: config?.url || 'ldap://127.0.0.1:389',
      searchBase: config?.searchBase || 'dc=enterprise,dc=com',
      userFilter: config?.userFilter || '(&(objectClass=person)(uid={username}))',
      attributes: config?.attributes || ['dn', 'uid', 'cn', 'displayName', 'mail', 'department', 'ou', 'memberOf'],
      roleMapping: config?.roleMapping || {
        'ou=managers': 'manager',
        'ou=admin': 'admin',
        'ou=members': 'member',
        'ou=engineering': 'manager',
        'ou=contractors': 'guest'
      },
      simulationMode: config?.simulationMode ?? false
    };
  }

  public setIdentityMapper(mapper: LDAPIdentityMapper) {
    this.customMapper = mapper;
  }

  public updateConfig(config: Partial<LDAPConfig>) {
    this.config = { ...this.config, ...config };
  }

  public getConfig(): LDAPConfig {
    return { ...this.config };
  }

  public static escapeFilter(input: string): string {
    return input.replace(/([\\*()/\0])/g, (match) => {
      switch (match) {
        case '\\': return '\\5c';
        case '*': return '\\2a';
        case '(': return '\\28';
        case ')': return '\\29';
        case '/': return '\\2f';
        case '\0': return '\\00';
        default: return match;
      }
    });
  }

  public async authenticate(username: string, password: string): Promise<LDAPUserRecord | null> {
    if (!this.config.enabled && !this.config.simulationMode) {
      return null;
    }

    const safeUsername = LDAPProvider.escapeFilter(username);

    // 1. Simulation Mode for offline air-gapped demo & tests
    if (this.config.simulationMode) {
      if (password.length >= 6) {
        if (this.customMapper) {
          const custom = this.customMapper({ username: safeUsername });
          return {
            username: safeUsername,
            displayName: custom.displayName || `用户 (${safeUsername})`,
            email: `${safeUsername}@enterprise.local`,
            department: custom.department || '业务部门',
            role: custom.role || 'member',
            dn: `uid=${safeUsername},ou=users,${this.config.searchBase}`,
            groups: custom.groups || ['grp_all']
          };
        }

        const isLead = safeUsername.startsWith('m') || safeUsername.includes('lead') || safeUsername.includes('mgr') || safeUsername.startsWith('t') || safeUsername.includes('prof');
        const role = isLead
          ? (this.config.roleMapping?.['ou=managers'] || 'manager')
          : (this.config.roleMapping?.['ou=members'] || 'member');
        const department = isLead ? '技术研发与核心工程中心' : '业务与综合技术部';
        return {
          username: safeUsername,
          displayName: isLead ? `项目主管 (${safeUsername})` : `工程师 (${safeUsername})`,
          email: `${safeUsername}@enterprise.local`,
          department,
          role,
          dn: `uid=${safeUsername},ou=${isLead ? 'managers' : 'members'},${this.config.searchBase}`,
          groups: isLead ? ['grp_all', 'grp_r_and_d'] : ['grp_all']
        };
      }
      return null;
    }

    // 2. Real Enterprise LDAP Two-Stage Bind
    const client = new Client({ url: this.config.url });
    try {
      if (this.config.bindDN && this.config.bindPassword) {
        await client.bind(this.config.bindDN, this.config.bindPassword);
      }

      const filter = this.config.userFilter.replace('{username}', safeUsername);
      const searchResult = await client.search(this.config.searchBase, {
        filter,
        scope: 'sub',
        attributes: this.config.attributes
      });

      if (!searchResult.searchEntries || searchResult.searchEntries.length === 0) {
        return null;
      }

      const entry = searchResult.searchEntries[0];
      const userDN = entry.dn;

      // Re-bind with user's actual password
      const userClient = new Client({ url: this.config.url });
      try {
        await userClient.bind(userDN, password);
        await userClient.unbind();
      } catch {
        return null; // Invalid user credentials
      }

      // Map roles
      let role = this.config.roleMapping?.['ou=members'] || 'member';
      const ou = String(entry.ou || entry.department || '').toLowerCase();
      const memberOf = Array.isArray(entry.memberOf) ? entry.memberOf.map(String) : [String(entry.memberOf || '')];

      for (const [key, mappedRole] of Object.entries(this.config.roleMapping || {})) {
        if (userDN.toLowerCase().includes(key.toLowerCase()) || ou.includes(key.toLowerCase())) {
          role = mappedRole;
          break;
        }
      }

      return {
        username: safeUsername,
        displayName: String(entry.displayName || entry.cn || safeUsername),
        email: entry.mail ? String(entry.mail) : `${safeUsername}@campus.edu.cn`,
        department: String(entry.department || entry.ou || '通用教学组'),
        role,
        dn: userDN,
        groups: memberOf.filter(Boolean)
      };
    } catch (err) {
      console.error('[LDAPProvider] Authentication failed:', err);
      return null;
    } finally {
      try {
        await client.unbind();
      } catch {
        // ignore unbind errors
      }
    }
  }
}
