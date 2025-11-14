import { query, transaction } from './pool';
import { enforceSuperAdmin, enforceTenantAccess } from './auth';
import { DbError, NotFoundError, ValidationError, AuthContext } from './types';

/**
 * Tenant with settings
 */
export interface Tenant {
  tenant_id: string;
  tenant_name: string;
  subdomain: string;
  created_at: Date;
  updated_at: Date;
}

export interface TenantSettings {
  tenant_id: string;
  branding_color?: string;
  logo_url?: string;
  default_visitor_fee?: number;
  language?: string;
  currency?: string;
  require_visitor_payment?: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CreateTenantInput {
  tenant_name: string;
  subdomain: string;
  language?: string;
  currency?: string;
  default_visitor_fee?: number;
}

export interface TenantWithSettings extends Tenant {
  settings: TenantSettings;
}

/**
 * Tenant Service - bypasses PostgREST cache
 */
export class TenantService {
  /**
   * Create tenant with settings (super admin only)
   * Accepts AuthContext (from middleware) or userId (fallback)
   */
  static async create(
    userIdOrContext: string | AuthContext,
    input: CreateTenantInput
  ): Promise<TenantWithSettings> {
    // Verify super admin (uses cached AuthContext if provided)
    await enforceSuperAdmin(userIdOrContext);

    // Validate subdomain format
    const subdomainRegex = /^[a-z0-9-]+$/;
    if (!subdomainRegex.test(input.subdomain)) {
      throw new ValidationError(
        'Subdomain must contain only lowercase letters, numbers, and hyphens'
      );
    }

    return await transaction(async (client) => {
      // Check if subdomain exists
      const existing = await client.query(
        'SELECT tenant_id FROM tenants WHERE subdomain = $1',
        [input.subdomain]
      );

      if (existing.rows.length > 0) {
        throw new ValidationError('Subdomain already exists');
      }

      // Insert tenant
      const tenantResult = await client.query<Tenant>(
        `INSERT INTO tenants (tenant_name, subdomain)
         VALUES ($1, $2)
         RETURNING *`,
        [input.tenant_name, input.subdomain]
      );

      const tenant = tenantResult.rows[0];

      // Insert tenant settings
      const settingsResult = await client.query<TenantSettings>(
        `INSERT INTO tenant_settings (
          tenant_id, 
          language, 
          currency, 
          default_visitor_fee,
          require_visitor_payment
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *`,
        [
          tenant.tenant_id,
          input.language || 'th',
          input.currency || 'THB',
          input.default_visitor_fee || 650,
          true,
        ]
      );

      return {
        ...tenant,
        settings: settingsResult.rows[0],
      };
    });
  }

  /**
   * Get tenant by ID with settings (requires authorization)
   * Accepts AuthContext (from middleware) or userId (fallback)
   */
  static async getById(
    userIdOrContext: string | AuthContext,
    tenantId: string
  ): Promise<TenantWithSettings | null> {
    // Verify user has access to this tenant (uses cached AuthContext if provided)
    await enforceTenantAccess(userIdOrContext, tenantId);

    const result = await query<TenantWithSettings>(
      `SELECT 
        t.*,
        json_build_object(
          'tenant_id', ts.tenant_id,
          'branding_color', ts.branding_color,
          'logo_url', ts.logo_url,
          'default_visitor_fee', ts.default_visitor_fee,
          'language', ts.language,
          'currency', ts.currency,
          'require_visitor_payment', ts.require_visitor_payment,
          'created_at', ts.created_at,
          'updated_at', ts.updated_at
        ) as settings
       FROM tenants t
       LEFT JOIN tenant_settings ts ON t.tenant_id = ts.tenant_id
       WHERE t.tenant_id = $1`,
      [tenantId]
    );

    return result.rows[0] || null;
  }

  /**
   * Get all tenants (super admin only)
   * Accepts AuthContext (from middleware) or userId (fallback)
   */
  static async getAll(userIdOrContext: string | AuthContext): Promise<Tenant[]> {
    await enforceSuperAdmin(userIdOrContext);

    const result = await query<Tenant>(
      `SELECT * FROM tenants ORDER BY created_at DESC`
    );

    return result.rows;
  }

  /**
   * Update tenant settings (requires authorization)
   * Accepts AuthContext (from middleware) or userId (fallback)
   */
  static async updateSettings(
    userIdOrContext: string | AuthContext,
    tenantId: string,
    settings: Partial<Omit<TenantSettings, 'tenant_id' | 'created_at' | 'updated_at'>>
  ): Promise<TenantSettings> {
    // Verify user has access to this tenant (uses cached AuthContext if provided)
    await enforceTenantAccess(userIdOrContext, tenantId);

    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    // Build dynamic UPDATE query
    Object.entries(settings).forEach(([key, value]) => {
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
    values.push(tenantId);

    const result = await query<TenantSettings>(
      `UPDATE tenant_settings 
       SET ${fields.join(', ')}
       WHERE tenant_id = $${paramIndex}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('Tenant settings');
    }

    return result.rows[0];
  }
}
