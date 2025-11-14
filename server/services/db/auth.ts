import { query } from './pool';
import { AuthContext, UnauthorizedError } from './types';

/**
 * Get user authorization context
 */
export async function getAuthContext(userId: string): Promise<AuthContext> {
  const result = await query<{
    role: string;
    tenant_id: string | null;
  }>(
    `SELECT role, tenant_id FROM user_roles WHERE user_id = $1`,
    [userId]
  );

  if (result.rows.length === 0) {
    throw new UnauthorizedError('User has no assigned roles');
  }

  // Check if super admin (role='super_admin' AND tenant_id IS NULL)
  const isSuperAdmin = result.rows.some(
    (r) => r.role === 'super_admin' && r.tenant_id === null
  );

  // Get all tenant IDs (excluding null from super admin role)
  const tenantIds = result.rows
    .filter((r) => r.tenant_id !== null)
    .map((r) => r.tenant_id as string);

  // Get primary tenant (first non-null tenant_id or null for super admin)
  const primaryTenantId = tenantIds[0] || null;
  const role = result.rows[0].role;

  return {
    userId,
    tenantIds,
    primaryTenantId,
    role,
    isSuperAdmin,
  };
}

/**
 * Check if user has access to a specific tenant
 */
export async function canAccessTenant(
  userId: string,
  tenantId: string
): Promise<boolean> {
  const result = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM user_roles 
     WHERE user_id = $1 
     AND (tenant_id = $2 OR (role = 'super_admin' AND tenant_id IS NULL))`,
    [userId, tenantId]
  );

  return parseInt(result.rows[0].count) > 0;
}

/**
 * Enforce tenant access (throws if unauthorized)
 * Accepts either AuthContext (cached) or userId (will query DB)
 */
export async function enforceTenantAccess(
  userIdOrContext: string | AuthContext,
  tenantId: string
): Promise<void> {
  // If AuthContext provided, use cached data (no DB query)
  if (typeof userIdOrContext === 'object') {
    const ctx = userIdOrContext;
    // Check if user is super admin OR tenant is in their tenant list
    const hasAccess =
      ctx.isSuperAdmin ||
      ctx.tenantIds.includes(tenantId);

    if (!hasAccess) {
      throw new UnauthorizedError(
        `User ${ctx.userId} does not have access to tenant ${tenantId}`
      );
    }
    return;
  }

  // Fallback: userId provided, query DB
  const userId = userIdOrContext;
  const hasAccess = await canAccessTenant(userId, tenantId);
  
  if (!hasAccess) {
    throw new UnauthorizedError(
      `User ${userId} does not have access to tenant ${tenantId}`
    );
  }
}

/**
 * Check if user is super admin
 */
export async function isSuperAdmin(userId: string): Promise<boolean> {
  const result = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM user_roles 
     WHERE user_id = $1 AND role = 'super_admin' AND tenant_id IS NULL`,
    [userId]
  );

  return parseInt(result.rows[0].count) > 0;
}

/**
 * Enforce super admin access (throws if not super admin)
 * Accepts either AuthContext (cached) or userId (will query DB)
 */
export async function enforceSuperAdmin(userIdOrContext: string | AuthContext): Promise<void> {
  // If AuthContext provided, use cached data (no DB query)
  if (typeof userIdOrContext === 'object') {
    const ctx = userIdOrContext;
    if (!ctx.isSuperAdmin) {
      throw new UnauthorizedError('Only super admins can perform this action');
    }
    return;
  }

  // Fallback: userId provided, query DB
  const userId = userIdOrContext;
  const isAdmin = await isSuperAdmin(userId);
  
  if (!isAdmin) {
    throw new UnauthorizedError('Only super admins can perform this action');
  }
}
