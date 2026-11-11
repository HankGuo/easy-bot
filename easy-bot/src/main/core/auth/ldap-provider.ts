import { Client } from 'ldapts';

export interface LDAPConfig {
  enabled: boolean;
  url: string;
  bindDN?: string;
  bindPassword?: string;
  searchBase: string;
  userFilter: string; // e.g. "(&(objectClass=person)(uid={username}))"
  attributes?: string[];
  roleMapping?: Record<string, string>; // e.g. { "ou=faculty": "teacher_pi", "ou=students": "student" }
  simulationMode?: boolean; // For offline campus demo & testing
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

export class LDAPProvider {
  private config: LDAPConfig;

  constructor(config?: Partial<LDAPConfig>) {
    this.config = {
      enabled: config?.enabled ?? false,
      url: config?.url || 'ldap://127.0.0.1:389',
      searchBase: config?.searchBase || 'dc=univ,dc=edu,dc=cn',
      userFilter: config?.userFilter || '(&(objectClass=person)(uid={username}))',
      attributes: config?.attributes || ['dn', 'uid', 'cn', 'displayName', 'mail', 'department', 'ou', 'memberOf'],
      roleMapping: config?.roleMapping || {
        'ou=faculty': 'teacher_pi',
        'ou=admin': 'college_admin',
        'ou=students': 'student'
      },
      simulationMode: config?.simulationMode ?? false
    };
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

    // 1. Campus Simulation Mode for offline air-gapped demo & tests
    if (this.config.simulationMode) {
      if (password.length >= 6) {
        const isFaculty = safeUsername.startsWith('t') || safeUsername.includes('prof') || safeUsername.includes('tea');
        const role = isFaculty ? 'teacher_pi' : 'student';
        const department = isFaculty ? '人工智能国家重点实验室' : '计算机科学与技术学院';
        return {
          username: safeUsername,
          displayName: isFaculty ? `张教授 (${safeUsername})` : `学生小李 (${safeUsername})`,
          email: `${safeUsername}@univ.edu.cn`,
          department,
          role,
          dn: `uid=${safeUsername},ou=${isFaculty ? 'faculty' : 'students'},${this.config.searchBase}`,
          groups: isFaculty ? ['grp_ai_lab', 'grp_college_faculty'] : ['grp_college_students']
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
      let role = 'student';
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
