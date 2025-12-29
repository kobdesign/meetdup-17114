import { Router, Response } from 'express';
import { supabaseAdmin } from '../utils/supabaseClient';
import { verifySupabaseAuth, AuthenticatedRequest } from '../utils/auth';

const router = Router();

async function verifySuperAdmin(req: AuthenticatedRequest, res: Response): Promise<boolean> {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }

  const { data: userRole } = await supabaseAdmin
    .from('user_roles')
    .select('role')
    .eq('user_id', req.user.id)
    .single();

  if (!userRole || userRole.role !== 'super_admin') {
    res.status(403).json({ error: 'Super admin access required' });
    return false;
  }

  return true;
}

export interface FeatureCatalogItem {
  id: number;
  feature_key: string;
  display_name: string;
  description: string | null;
  category: string;
  display_order: number;
  is_active: boolean;
}

export interface LimitCatalogItem {
  id: number;
  limit_key: string;
  display_name: string;
  description: string | null;
  unit: string;
  display_order: number;
  is_active: boolean;
}

export interface PlanDefinition {
  id: string;
  name: string;
  description: string | null;
  display_order: number;
  is_active: boolean;
  stripe_monthly_price_id: string | null;
  stripe_yearly_price_id: string | null;
  monthly_price_cents: number;
  yearly_price_cents: number;
}

export interface PlanFeature {
  plan_id: string;
  feature_key: string;
  enabled: boolean;
}

export interface PlanLimit {
  plan_id: string;
  limit_key: string;
  limit_value: number;
}

export interface PlanConfigFull {
  plans: PlanDefinition[];
  features: FeatureCatalogItem[];
  limits: LimitCatalogItem[];
  planFeatures: PlanFeature[];
  planLimits: PlanLimit[];
}

// GET /api/plan-config - Get full plan configuration (public, for pricing page)
// NOTE: Filters out Stripe price IDs for security - only shows public-facing plan info
router.get('/', async (req, res) => {
  try {
    const [plansResult, featuresResult, limitsResult, planFeaturesResult, planLimitsResult] = await Promise.all([
      supabaseAdmin.from('plan_definitions')
        .select('id, name, description, display_order, is_active, monthly_price_cents, yearly_price_cents')
        .eq('is_active', true)
        .order('display_order'),
      supabaseAdmin.from('feature_catalog').select('*').eq('is_active', true).order('display_order'),
      supabaseAdmin.from('limit_catalog').select('*').eq('is_active', true).order('display_order'),
      supabaseAdmin.from('plan_features').select('plan_id, feature_key, enabled'),
      supabaseAdmin.from('plan_limits').select('plan_id, limit_key, limit_value'),
    ]);

    if (plansResult.error) throw plansResult.error;
    if (featuresResult.error) throw featuresResult.error;
    if (limitsResult.error) throw limitsResult.error;
    if (planFeaturesResult.error) throw planFeaturesResult.error;
    if (planLimitsResult.error) throw planLimitsResult.error;

    const config: PlanConfigFull = {
      plans: (plansResult.data || []).map(p => ({
        ...p,
        stripe_monthly_price_id: null,
        stripe_yearly_price_id: null,
      })) as PlanDefinition[],
      features: featuresResult.data || [],
      limits: limitsResult.data || [],
      planFeatures: planFeaturesResult.data || [],
      planLimits: planLimitsResult.data || [],
    };

    res.json(config);
  } catch (error: any) {
    console.error('Error fetching plan config:', error);
    res.status(500).json({ error: 'Failed to fetch plan configuration' });
  }
});

// GET /api/plan-config/admin - Get full config including inactive items (super admin only)
router.get('/admin', verifySupabaseAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!(await verifySuperAdmin(req, res))) return;

    const [plansResult, featuresResult, limitsResult, planFeaturesResult, planLimitsResult] = await Promise.all([
      supabaseAdmin.from('plan_definitions').select('*').order('display_order'),
      supabaseAdmin.from('feature_catalog').select('*').order('display_order'),
      supabaseAdmin.from('limit_catalog').select('*').order('display_order'),
      supabaseAdmin.from('plan_features').select('*'),
      supabaseAdmin.from('plan_limits').select('*'),
    ]);

    if (plansResult.error) throw plansResult.error;
    if (featuresResult.error) throw featuresResult.error;
    if (limitsResult.error) throw limitsResult.error;
    if (planFeaturesResult.error) throw planFeaturesResult.error;
    if (planLimitsResult.error) throw planLimitsResult.error;

    res.json({
      plans: plansResult.data || [],
      features: featuresResult.data || [],
      limits: limitsResult.data || [],
      planFeatures: planFeaturesResult.data || [],
      planLimits: planLimitsResult.data || [],
    });
  } catch (error: any) {
    console.error('Error fetching admin plan config:', error);
    res.status(500).json({ error: 'Failed to fetch plan configuration' });
  }
});

// PUT /api/plan-config/plans/:planId - Update a plan definition (super admin only)
router.put('/plans/:planId', verifySupabaseAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!(await verifySuperAdmin(req, res))) return;

    const { planId } = req.params;
    const { name, description, display_order, is_active, monthly_price_cents, yearly_price_cents, stripe_monthly_price_id, stripe_yearly_price_id } = req.body;

    const { data, error } = await supabaseAdmin
      .from('plan_definitions')
      .update({
        name,
        description,
        display_order,
        is_active,
        monthly_price_cents,
        yearly_price_cents,
        stripe_monthly_price_id,
        stripe_yearly_price_id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', planId)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error: any) {
    console.error('Error updating plan:', error);
    res.status(500).json({ error: 'Failed to update plan' });
  }
});

// POST /api/plan-config/features - Create a new feature (super admin only)
router.post('/features', verifySupabaseAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!(await verifySuperAdmin(req, res))) return;

    const { feature_key, display_name, description, category, display_order } = req.body;

    const { data, error } = await supabaseAdmin
      .from('feature_catalog')
      .insert({
        feature_key,
        display_name,
        description,
        category: category || 'general',
        display_order: display_order || 0,
      })
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error: any) {
    console.error('Error creating feature:', error);
    res.status(500).json({ error: 'Failed to create feature' });
  }
});

// PUT /api/plan-config/features/:featureKey - Update a feature (super admin only)
router.put('/features/:featureKey', verifySupabaseAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!(await verifySuperAdmin(req, res))) return;

    const { featureKey } = req.params;
    const { display_name, description, category, display_order, is_active } = req.body;

    const { data, error } = await supabaseAdmin
      .from('feature_catalog')
      .update({
        display_name,
        description,
        category,
        display_order,
        is_active,
        updated_at: new Date().toISOString(),
      })
      .eq('feature_key', featureKey)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error: any) {
    console.error('Error updating feature:', error);
    res.status(500).json({ error: 'Failed to update feature' });
  }
});

// POST /api/plan-config/limits - Create a new limit (super admin only)
router.post('/limits', verifySupabaseAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!(await verifySuperAdmin(req, res))) return;

    const { limit_key, display_name, description, unit, display_order } = req.body;

    const { data, error } = await supabaseAdmin
      .from('limit_catalog')
      .insert({
        limit_key,
        display_name,
        description,
        unit: unit || 'count',
        display_order: display_order || 0,
      })
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error: any) {
    console.error('Error creating limit:', error);
    res.status(500).json({ error: 'Failed to create limit' });
  }
});

// PUT /api/plan-config/limits/:limitKey - Update a limit (super admin only)
router.put('/limits/:limitKey', verifySupabaseAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!(await verifySuperAdmin(req, res))) return;

    const { limitKey } = req.params;
    const { display_name, description, unit, display_order, is_active } = req.body;

    const { data, error } = await supabaseAdmin
      .from('limit_catalog')
      .update({
        display_name,
        description,
        unit,
        display_order,
        is_active,
        updated_at: new Date().toISOString(),
      })
      .eq('limit_key', limitKey)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error: any) {
    console.error('Error updating limit:', error);
    res.status(500).json({ error: 'Failed to update limit' });
  }
});

// PUT /api/plan-config/plan-features - Bulk update plan features (super admin only)
router.put('/plan-features', verifySupabaseAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!(await verifySuperAdmin(req, res))) return;

    const { updates } = req.body as { updates: PlanFeature[] };

    for (const update of updates) {
      await supabaseAdmin
        .from('plan_features')
        .upsert({
          plan_id: update.plan_id,
          feature_key: update.feature_key,
          enabled: update.enabled,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'plan_id,feature_key',
        });
    }

    res.json({ success: true, updated: updates.length });
  } catch (error: any) {
    console.error('Error updating plan features:', error);
    res.status(500).json({ error: 'Failed to update plan features' });
  }
});

// PUT /api/plan-config/plan-limits - Bulk update plan limits (super admin only)
router.put('/plan-limits', verifySupabaseAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!(await verifySuperAdmin(req, res))) return;

    const { updates } = req.body as { updates: PlanLimit[] };

    for (const update of updates) {
      await supabaseAdmin
        .from('plan_limits')
        .upsert({
          plan_id: update.plan_id,
          limit_key: update.limit_key,
          limit_value: update.limit_value,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'plan_id,limit_key',
        });
    }

    res.json({ success: true, updated: updates.length });
  } catch (error: any) {
    console.error('Error updating plan limits:', error);
    res.status(500).json({ error: 'Failed to update plan limits' });
  }
});

// GET /api/plan-config/check-feature/:planId/:featureKey - Check if a feature is enabled for a plan
router.get('/check-feature/:planId/:featureKey', async (req, res) => {
  try {
    const { planId, featureKey } = req.params;

    const { data, error } = await supabaseAdmin
      .from('plan_features')
      .select('enabled')
      .eq('plan_id', planId)
      .eq('feature_key', featureKey)
      .single();

    if (error && error.code !== 'PGRST116') throw error;

    res.json({ enabled: data?.enabled ?? false });
  } catch (error: any) {
    console.error('Error checking feature:', error);
    res.status(500).json({ error: 'Failed to check feature' });
  }
});

// GET /api/plan-config/check-limit/:planId/:limitKey - Get limit value for a plan
router.get('/check-limit/:planId/:limitKey', async (req, res) => {
  try {
    const { planId, limitKey } = req.params;

    const { data, error } = await supabaseAdmin
      .from('plan_limits')
      .select('limit_value')
      .eq('plan_id', planId)
      .eq('limit_key', limitKey)
      .single();

    if (error && error.code !== 'PGRST116') throw error;

    res.json({ limit_value: data?.limit_value ?? 0 });
  } catch (error: any) {
    console.error('Error checking limit:', error);
    res.status(500).json({ error: 'Failed to check limit' });
  }
});

export default router;
