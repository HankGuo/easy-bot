export type EnterpriseRole = 'superadmin' | 'admin' | 'manager' | 'member' | 'guest';

export interface SecurityContext {
  userId: string;
  username: string;
  displayName: string;
  role: EnterpriseRole;
  roles: EnterpriseRole[];
  authSource: string;
  department?: string;
  groups: string[];
  attributes?: Record<string, any>;
}

/**
 * Normalizes any legacy or domain-specific role alias into standard enterprise RBAC
 */
export function normalizeRole(role?: string | null): EnterpriseRole {
  if (!role) return 'member';
  const clean = role.trim().toLowerCase();
  
  // Platform & Tenant Administrators
  if (clean === 'superadmin' || clean === 'root') return 'superadmin';
  if (clean === 'admin' || clean === 'tenant_admin' || clean === 'dean' || clean === 'plant_manager') return 'admin';
  
  // Supervisors / Group Leads / Teachers / Engineers
  if (
    clean === 'manager' ||
    clean === 'teacher_pi' ||
    clean === 'pi' ||
    clean === 'supervisor' ||
    clean === 'lead' ||
    clean === 'engineer' ||
    clean === 'director'
  ) {
    return 'manager';
  }
  
  // Standard Members / Students / Operators
  if (
    clean === 'member' ||
    clean === 'student' ||
    clean === 'employee' ||
    clean === 'operator' ||
    clean === 'ta' ||
    clean === 'researcher'
  ) {
    return 'member';
  }
  
  if (clean === 'guest' || clean === 'visitor' || clean === 'anonymous') return 'guest';
  
  return 'member';
}

/**
 * Verifies whether a user's role satisfies any of the required role tiers
 */
export function isRoleAuthorized(userRole: string | EnterpriseRole, requiredRoles: (EnterpriseRole | string)[]): boolean {
  const normalizedUserRole = normalizeRole(userRole);
  return requiredRoles.some(req => {
    const normalizedReq = normalizeRole(req);
    return normalizedReq === normalizedUserRole || req === userRole;
  });
}

/**
 * Factory for creating a standard SecurityContext
 */
export function createSecurityContext(params: {
  userId: string;
  username: string;
  displayName?: string;
  role?: string | EnterpriseRole;
  authSource?: string;
  department?: string;
  groups?: string[];
  attributes?: Record<string, any>;
}): SecurityContext {
  const normRole = normalizeRole(params.role);
  return {
    userId: params.userId,
    username: params.username,
    displayName: params.displayName || params.username,
    role: normRole,
    roles: [normRole],
    authSource: params.authSource || 'local',
    department: params.department,
    groups: params.groups || [],
    attributes: params.attributes || {}
  };
}

export function createSystemSecurityContext(): SecurityContext {
  return {
    userId: 'usr_system',
    username: 'system',
    displayName: 'EasyBot System Kernel',
    role: 'superadmin',
    roles: ['superadmin'],
    authSource: 'internal',
    groups: ['*'],
    attributes: { internal: true }
  };
}
