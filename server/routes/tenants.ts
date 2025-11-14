import { Router } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { TenantService } from '../services/db';
import { DbError, UnauthorizedError, ValidationError } from '../services/db/types';

const router = Router();

/**
 * Create new tenant (super admin only)
 * Uses direct PostgreSQL connection to bypass PostgREST cache
 */
router.post('/create', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const authContext = req.authContext;

    if (!authContext) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { tenant_name, subdomain, language, currency, default_visitor_fee } = req.body;

    if (!tenant_name || !subdomain) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'tenant_name and subdomain are required',
      });
    }

    // Create tenant using TenantService (enforces super admin check)
    // Passing authContext avoids duplicate DB queries for authorization
    const tenant = await TenantService.create(authContext, {
      tenant_name,
      subdomain,
      language,
      currency,
      default_visitor_fee,
    });

    res.json({
      success: true,
      tenant: {
        tenant_id: tenant.tenant_id,
        tenant_name: tenant.tenant_name,
        subdomain: tenant.subdomain,
        settings: tenant.settings,
      },
    });
  } catch (error: any) {
    console.error('Error creating tenant:', error);

    if (error instanceof UnauthorizedError) {
      return res.status(403).json({
        error: 'Forbidden',
        message: error.message,
      });
    }

    if (error instanceof ValidationError) {
      return res.status(400).json({
        error: 'Validation error',
        message: error.message,
        details: error.details,
      });
    }

    // Check for duplicate subdomain from database constraint
    if (error.code === '23505') {
      return res.status(409).json({
        error: 'Subdomain already exists',
        message: 'This subdomain is already taken. Please choose another one.',
      });
    }

    res.status(500).json({
      error: 'Failed to create tenant',
      message: error.message,
    });
  }
});

/**
 * Get tenant by ID
 */
router.get('/:tenantId', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const authContext = req.authContext;
    const { tenantId } = req.params;

    if (!authContext) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Passing authContext avoids duplicate DB queries for authorization
    const tenant = await TenantService.getById(authContext, tenantId);

    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    res.json(tenant);
  } catch (error: any) {
    console.error('Error fetching tenant:', error);

    if (error instanceof UnauthorizedError) {
      return res.status(403).json({
        error: 'Forbidden',
        message: error.message,
      });
    }

    res.status(500).json({
      error: 'Failed to fetch tenant',
      message: error.message,
    });
  }
});

/**
 * Update tenant settings
 */
router.patch('/:tenantId/settings', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const authContext = req.authContext;
    const { tenantId } = req.params;

    if (!authContext) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Passing authContext avoids duplicate DB queries for authorization
    const settings = await TenantService.updateSettings(authContext, tenantId, req.body);

    res.json({
      success: true,
      settings,
    });
  } catch (error: any) {
    console.error('Error updating tenant settings:', error);

    if (error instanceof UnauthorizedError) {
      return res.status(403).json({
        error: 'Forbidden',
        message: error.message,
      });
    }

    if (error instanceof ValidationError) {
      return res.status(400).json({
        error: 'Validation error',
        message: error.message,
      });
    }

    res.status(500).json({
      error: 'Failed to update tenant settings',
      message: error.message,
    });
  }
});

export default router;
