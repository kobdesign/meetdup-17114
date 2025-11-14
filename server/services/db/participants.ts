import { query, transaction } from './pool';
import { enforceTenantAccess } from './auth';
import { DbError, NotFoundError, ValidationError, PaginatedResult, AuthContext } from './types';

/**
 * Participant (member/visitor)
 */
export interface Participant {
  participant_id: string;
  tenant_id: string;
  full_name: string;
  line_user_id?: string;
  phone_number?: string;
  email?: string;
  business_type?: string;
  company_name?: string;
  status: 'prospect' | 'visitor' | 'member' | 'alumni' | 'declined';
  created_at: Date;
  updated_at: Date;
}

export interface CreateParticipantInput {
  tenant_id: string;
  full_name: string;
  line_user_id?: string;
  phone_number?: string;
  email?: string;
  business_type?: string;
  company_name?: string;
  status?: 'prospect' | 'visitor' | 'member' | 'alumni' | 'declined';
}

export interface UpdateParticipantInput {
  full_name?: string;
  line_user_id?: string;
  phone_number?: string;
  email?: string;
  business_type?: string;
  company_name?: string;
  status?: 'prospect' | 'visitor' | 'member' | 'alumni' | 'declined';
}

/**
 * Participant Service - bypasses PostgREST cache
 */
export class ParticipantService {
  /**
   * Create participant
   * Accepts AuthContext (from middleware) or userId (fallback)
   */
  static async create(
    userIdOrContext: string | AuthContext,
    input: CreateParticipantInput
  ): Promise<Participant> {
    // Verify user has access to tenant (uses cached AuthContext if provided)
    await enforceTenantAccess(userIdOrContext, input.tenant_id);

    const result = await query<Participant>(
      `INSERT INTO participants (
        tenant_id,
        full_name,
        line_user_id,
        phone_number,
        email,
        business_type,
        company_name,
        status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        input.tenant_id,
        input.full_name,
        input.line_user_id || null,
        input.phone_number || null,
        input.email || null,
        input.business_type || null,
        input.company_name || null,
        input.status || 'prospect',
      ]
    );

    return result.rows[0];
  }

  /**
   * Get participant by ID
   * Accepts AuthContext (from middleware) or userId (fallback)
   */
  static async getById(
    userIdOrContext: string | AuthContext,
    participantId: string
  ): Promise<Participant | null> {
    // Extract userId from context or use directly
    const userId = typeof userIdOrContext === 'object'
      ? userIdOrContext.userId
      : userIdOrContext;

    const result = await query<Participant>(
      `SELECT p.* FROM participants p
       JOIN user_roles ur ON (
         ur.tenant_id = p.tenant_id OR 
         (ur.role = 'super_admin' AND ur.tenant_id IS NULL)
       )
       WHERE p.participant_id = $1 AND ur.user_id = $2
       LIMIT 1`,
      [participantId, userId]
    );

    return result.rows[0] || null;
  }

  /**
   * Get participants for a tenant with pagination
   * Accepts AuthContext (from middleware) or userId (fallback)
   */
  static async getByTenant(
    userIdOrContext: string | AuthContext,
    tenantId: string,
    options: {
      status?: string;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<PaginatedResult<Participant>> {
    // Verify access (uses cached AuthContext if provided)
    await enforceTenantAccess(userIdOrContext, tenantId);

    const limit = Math.min(options.limit || 50, 100);
    const offset = options.offset || 0;

    // Build WHERE clause
    const conditions = ['tenant_id = $1'];
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (options.status) {
      conditions.push(`status = $${paramIndex}`);
      params.push(options.status);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');

    // Get total count
    const countResult = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM participants WHERE ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    // Get participants
    const result = await query<Participant>(
      `SELECT * FROM participants 
       WHERE ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );

    return {
      data: result.rows,
      total,
      limit,
      offset,
    };
  }

  /**
   * Update participant
   * Accepts AuthContext (from middleware) or userId (fallback)
   */
  static async update(
    userIdOrContext: string | AuthContext,
    participantId: string,
    updates: UpdateParticipantInput
  ): Promise<Participant> {
    // First get participant to check access
    const existing = await this.getById(userIdOrContext, participantId);
    if (!existing) {
      throw new NotFoundError('Participant');
    }

    // Build dynamic UPDATE query
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined) {
        fields.push(`${key} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    });

    if (fields.length === 0) {
      throw new ValidationError('No fields to update');
    }

    fields.push(`updated_at = NOW()`);
    values.push(participantId);

    const result = await query<Participant>(
      `UPDATE participants 
       SET ${fields.join(', ')}
       WHERE participant_id = $${paramIndex}
       RETURNING *`,
      values
    );

    return result.rows[0];
  }

  /**
   * Delete participant
   * Accepts AuthContext (from middleware) or userId (fallback)
   */
  static async delete(
    userIdOrContext: string | AuthContext,
    participantId: string
  ): Promise<void> {
    // First get participant to check access
    const existing = await this.getById(userIdOrContext, participantId);
    if (!existing) {
      throw new NotFoundError('Participant');
    }

    await query(
      `DELETE FROM participants WHERE participant_id = $1`,
      [participantId]
    );
  }

  /**
   * Get visitor analytics for a tenant with check-in metrics
   * Accepts AuthContext (from middleware) or userId (fallback)
   */
  static async getVisitorAnalytics(
    userIdOrContext: string | AuthContext,
    tenantId: string
  ): Promise<any> {
    // Verify access (uses cached AuthContext if provided)
    await enforceTenantAccess(userIdOrContext, tenantId);

    // Get status counts
    const statusResult = await query<{
      prospects: string;
      visitors: string;
      members: string;
      declined: string;
      alumni: string;
    }>(
      `SELECT 
        COUNT(*) FILTER (WHERE status = 'prospect') as prospects,
        COUNT(*) FILTER (WHERE status = 'visitor') as visitors,
        COUNT(*) FILTER (WHERE status = 'member') as members,
        COUNT(*) FILTER (WHERE status = 'declined') as declined,
        COUNT(*) FILTER (WHERE status = 'alumni') as alumni
       FROM participants
       WHERE tenant_id = $1`,
      [tenantId]
    );

    const statusCounts = statusResult.rows[0];
    const prospects = parseInt(statusCounts.prospects);
    const visitors = parseInt(statusCounts.visitors);
    const members = parseInt(statusCounts.members);
    const declined = parseInt(statusCounts.declined);
    const alumni = parseInt(statusCounts.alumni);

    // Get check-in metrics for visitors only
    const checkinResult = await query<{
      total_checkins: string;
      visitors_with_checkins: string;
      engaged_visitors: string;
    }>(
      `WITH visitor_checkins AS (
        SELECT 
          p.participant_id,
          COUNT(c.checkin_id) as checkin_count
        FROM participants p
        LEFT JOIN checkins c ON p.participant_id = c.participant_id
        WHERE p.tenant_id = $1 AND p.status = 'visitor'
        GROUP BY p.participant_id
      )
      SELECT 
        COALESCE(SUM(checkin_count), 0)::text as total_checkins,
        COUNT(CASE WHEN checkin_count > 0 THEN 1 END)::text as visitors_with_checkins,
        COUNT(CASE WHEN checkin_count >= 2 THEN 1 END)::text as engaged_visitors
      FROM visitor_checkins`,
      [tenantId]
    );

    const checkinMetrics = checkinResult.rows[0];
    const totalCheckins = parseInt(checkinMetrics.total_checkins || '0');
    const visitorsWithCheckins = parseInt(checkinMetrics.visitors_with_checkins || '0');
    const engagedVisitors = parseInt(checkinMetrics.engaged_visitors || '0');

    const avgCheckinsPerVisitor = visitors > 0
      ? parseFloat((totalCheckins / visitors).toFixed(1))
      : 0;

    const totalInPipeline = prospects + visitors;

    return {
      prospects,
      visitors,
      visitorsWithCheckins,
      engagedVisitors,
      members,
      declined,
      alumni,
      avgCheckinsPerVisitor,
      totalInPipeline,
    };
  }
}
