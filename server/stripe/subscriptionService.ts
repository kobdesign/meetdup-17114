// Stripe Integration - subscriptionService.ts
// Handles subscription business logic for multi-tenant SaaS

import { getUncachableStripeClient, getStripePublishableKey } from './stripeClient';
import { supabaseAdmin } from '../utils/supabaseClient';

export interface SubscriptionPlan {
  id: string;
  name: string;
  description: string;
  features: string[];
  prices: {
    monthly: { id: string; amount: number };
    yearly: { id: string; amount: number };
  };
  limits: {
    members: number;
    meetings_per_month: number;
    ai_queries_per_month: number;
    storage_gb: number;
  };
}

export interface TenantSubscription {
  tenant_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  plan_id: string;
  status: 'trialing' | 'active' | 'past_due' | 'canceled' | 'incomplete';
  current_period_start: string | null;
  current_period_end: string | null;
  trial_end: string | null;
  cancel_at_period_end: boolean;
}

// NOTE: Price IDs should be configured via environment variables
// These are placeholders - set STRIPE_STARTER_MONTHLY_PRICE_ID, etc in Replit Secrets
const getPriceIds = () => ({
  starter_monthly: process.env.STRIPE_STARTER_MONTHLY_PRICE_ID || '',
  starter_yearly: process.env.STRIPE_STARTER_YEARLY_PRICE_ID || '',
  pro_monthly: process.env.STRIPE_PRO_MONTHLY_PRICE_ID || '',
  pro_yearly: process.env.STRIPE_PRO_YEARLY_PRICE_ID || '',
});

export const TRIAL_PERIOD_DAYS = 30;

export const getSubscriptionPlans = (): SubscriptionPlan[] => {
  const priceIds = getPriceIds();
  
  return [
    {
      id: 'free',
      name: 'Free',
      description: 'Get started with basic features',
      features: [
        'Up to 10 members',
        'Basic meeting management',
        'Member check-in',
        'Email support'
      ],
      prices: {
        monthly: { id: '', amount: 0 },
        yearly: { id: '', amount: 0 }
      },
      limits: {
        members: 10,
        meetings_per_month: 4,
        ai_queries_per_month: 0,
        storage_gb: 1
      }
    },
    {
      id: 'starter',
      name: 'Starter',
      description: 'Perfect for growing chapters',
      features: [
        'Up to 30 members',
        'Visitor management',
        'Payment tracking',
        'Basic analytics',
        'LINE integration',
        'Priority email support'
      ],
      prices: {
        monthly: { id: priceIds.starter_monthly, amount: 1990 }, // $19.90
        yearly: { id: priceIds.starter_yearly, amount: 19900 }  // $199 (2 months free)
      },
      limits: {
        members: 30,
        meetings_per_month: 8,
        ai_queries_per_month: 50,
        storage_gb: 5
      }
    },
    {
      id: 'pro',
      name: 'Pro',
      description: 'Full power for established chapters',
      features: [
        'Unlimited members',
        'AI Growth Co-Pilot',
        'Advanced analytics',
        'Custom branding',
        'RSVP & notifications',
        'Apps marketplace',
        'API access',
        '24/7 priority support'
      ],
      prices: {
        monthly: { id: priceIds.pro_monthly, amount: 4990 }, // $49.90
        yearly: { id: priceIds.pro_yearly, amount: 49900 }  // $499 (2 months free)
      },
      limits: {
        members: -1, // unlimited
        meetings_per_month: -1, // unlimited
        ai_queries_per_month: 500,
        storage_gb: 50
      }
    }
  ];
};

export const SUBSCRIPTION_PLANS = getSubscriptionPlans();

// Cache for database-sourced plans (refreshes every 5 minutes)
let cachedDbPlans: SubscriptionPlan[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Fetch plans from database tables (plan_definitions, plan_features, plan_limits)
async function getPlansFromDatabase(): Promise<SubscriptionPlan[] | null> {
  try {
    // Check cache first
    if (cachedDbPlans && Date.now() - cacheTimestamp < CACHE_TTL_MS) {
      return cachedDbPlans;
    }

    const priceIds = getPriceIds();

    // Fetch plan definitions
    const { data: planDefs, error: planDefsError } = await supabaseAdmin
      .from('plan_definitions')
      .select('*')
      .order('display_order', { ascending: true });

    if (planDefsError || !planDefs || planDefs.length === 0) {
      console.log('[subscriptionService] No plan definitions found in database, using defaults');
      return null;
    }

    // Fetch plan features
    const { data: planFeatures } = await supabaseAdmin
      .from('plan_features')
      .select('plan_id, feature_key, enabled');

    // Fetch plan limits
    const { data: planLimits } = await supabaseAdmin
      .from('plan_limits')
      .select('plan_id, limit_key, limit_value');

    // Fetch feature catalog for display names
    const { data: featureCatalog } = await supabaseAdmin
      .from('feature_catalog')
      .select('feature_key, display_name');

    const featureNames = new Map(featureCatalog?.map(f => [f.feature_key, f.display_name]) || []);

    // Build plans from database
    const plans: SubscriptionPlan[] = planDefs.map(def => {
      const planId = def.id; // column is 'id' not 'plan_id'
      
      // Get enabled features for this plan
      const enabledFeatures = (planFeatures || [])
        .filter(pf => pf.plan_id === planId && pf.enabled)
        .map(pf => featureNames.get(pf.feature_key) || pf.feature_key);

      // Get limits for this plan
      const limitsMap = new Map(
        (planLimits || [])
          .filter(pl => pl.plan_id === planId)
          .map(pl => [pl.limit_key, pl.limit_value])
      );

      // Get price IDs based on plan (from DB or env vars)
      let monthlyPriceId = def.stripe_monthly_price_id || '';
      let yearlyPriceId = def.stripe_yearly_price_id || '';
      if (!monthlyPriceId && planId === 'starter') {
        monthlyPriceId = priceIds.starter_monthly;
        yearlyPriceId = priceIds.starter_yearly;
      } else if (!monthlyPriceId && planId === 'pro') {
        monthlyPriceId = priceIds.pro_monthly;
        yearlyPriceId = priceIds.pro_yearly;
      }

      return {
        id: planId,
        name: def.name,
        description: def.description || '',
        features: enabledFeatures.length > 0 ? enabledFeatures : getDefaultFeatures(planId),
        prices: {
          monthly: { id: monthlyPriceId, amount: def.monthly_price_cents || 0 },
          yearly: { id: yearlyPriceId, amount: def.yearly_price_cents || 0 }
        },
        limits: {
          members: limitsMap.get('members') ?? getDefaultLimit(planId, 'members'),
          meetings_per_month: limitsMap.get('meetings_per_month') ?? getDefaultLimit(planId, 'meetings_per_month'),
          ai_queries_per_month: limitsMap.get('ai_queries_per_month') ?? getDefaultLimit(planId, 'ai_queries_per_month'),
          storage_gb: limitsMap.get('storage_gb') ?? getDefaultLimit(planId, 'storage_gb')
        }
      };
    });

    // Update cache
    cachedDbPlans = plans;
    cacheTimestamp = Date.now();
    console.log('[subscriptionService] Loaded plans from database:', plans.map(p => p.id));

    return plans;
  } catch (error) {
    console.error('[subscriptionService] Error fetching plans from database:', error);
    return null;
  }
}

function getDefaultFeatures(planId: string): string[] {
  const defaults: Record<string, string[]> = {
    free: ['Up to 10 members', 'Basic meeting management', 'Member check-in', 'Email support'],
    starter: ['Up to 30 members', 'Visitor management', 'Payment tracking', 'Basic analytics', 'LINE integration', 'Priority email support'],
    pro: ['Unlimited members', 'AI Growth Co-Pilot', 'Advanced analytics', 'Custom branding', 'RSVP & notifications', 'Apps marketplace', 'API access', '24/7 priority support']
  };
  return defaults[planId] || [];
}

function getDefaultLimit(planId: string, limitKey: string): number {
  const defaults: Record<string, Record<string, number>> = {
    free: { members: 10, meetings_per_month: 4, ai_queries_per_month: 0, storage_gb: 1 },
    starter: { members: 30, meetings_per_month: 8, ai_queries_per_month: 50, storage_gb: 5 },
    pro: { members: -1, meetings_per_month: -1, ai_queries_per_month: 500, storage_gb: 50 }
  };
  return defaults[planId]?.[limitKey] ?? 0;
}

// Clear cache (useful when admin updates plan config)
export function clearPlanCache() {
  cachedDbPlans = null;
  cacheTimestamp = 0;
  console.log('[subscriptionService] Plan cache cleared');
}

export class SubscriptionService {
  async getPublishableKey(): Promise<string> {
    return await getStripePublishableKey();
  }

  async getPlans(): Promise<SubscriptionPlan[]> {
    // Try to get plans from database first, fallback to hardcoded
    const dbPlans = await getPlansFromDatabase();
    return dbPlans || getSubscriptionPlans();
  }

  async getTenantSubscription(tenantId: string): Promise<TenantSubscription | null> {
    const { data, error } = await supabaseAdmin
      .from('tenant_subscriptions')
      .select('*')
      .eq('tenant_id', tenantId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching tenant subscription:', error);
      return null;
    }

    return data;
  }

  async createOrGetCustomer(tenantId: string, email: string, tenantName: string): Promise<string> {
    const existing = await this.getTenantSubscription(tenantId);
    
    if (existing?.stripe_customer_id) {
      return existing.stripe_customer_id;
    }

    const stripe = await getUncachableStripeClient();
    const customer = await stripe.customers.create({
      email,
      name: tenantName,
      metadata: {
        tenant_id: tenantId
      }
    });

    await supabaseAdmin
      .from('tenant_subscriptions')
      .upsert({
        tenant_id: tenantId,
        stripe_customer_id: customer.id,
        plan_id: 'free',
        status: 'active'
      }, {
        onConflict: 'tenant_id'
      });

    return customer.id;
  }

  async createCheckoutSession(
    tenantId: string,
    priceId: string,
    successUrl: string,
    cancelUrl: string
  ): Promise<{ url: string }> {
    // Validate price ID is configured
    if (!priceId || priceId.trim() === '') {
      throw new Error('Invalid price ID. Please configure Stripe price IDs in environment variables.');
    }

    // Verify price ID matches a known plan (from database or fallback)
    const plans = await this.getPlans();
    const validPriceIds = plans.flatMap(p => [p.prices.monthly.id, p.prices.yearly.id]).filter(Boolean);
    
    if (!validPriceIds.includes(priceId)) {
      throw new Error(
        'Price ID not recognized. Please ensure Stripe price IDs are configured in Plan Configuration ' +
        'or set STRIPE_STARTER_MONTHLY_PRICE_ID, STRIPE_STARTER_YEARLY_PRICE_ID, ' +
        'STRIPE_PRO_MONTHLY_PRICE_ID, and STRIPE_PRO_YEARLY_PRICE_ID in Replit Secrets.'
      );
    }

    const { data: tenant } = await supabaseAdmin
      .from('tenants')
      .select('tenant_name, admin_email')
      .eq('tenant_id', tenantId)
      .single();

    if (!tenant) {
      throw new Error('Tenant not found');
    }

    const customerId = await this.createOrGetCustomer(
      tenantId,
      tenant.admin_email || `admin@${tenantId}.meetdup.app`,
      tenant.tenant_name
    );

    const stripe = await getUncachableStripeClient();
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: successUrl,
      cancel_url: cancelUrl,
      subscription_data: {
        trial_period_days: 30,
        metadata: {
          tenant_id: tenantId
        }
      },
      metadata: {
        tenant_id: tenantId
      }
    });

    return { url: session.url! };
  }

  async createCustomerPortalSession(
    tenantId: string,
    returnUrl: string
  ): Promise<{ url: string }> {
    const subscription = await this.getTenantSubscription(tenantId);
    
    if (!subscription?.stripe_customer_id) {
      throw new Error('No Stripe customer found for this tenant');
    }

    const stripe = await getUncachableStripeClient();
    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.stripe_customer_id,
      return_url: returnUrl
    });

    return { url: session.url };
  }

  async updateSubscriptionFromWebhook(
    stripeSubscriptionId: string,
    status: string,
    currentPeriodStart: number,
    currentPeriodEnd: number,
    trialEnd: number | null,
    cancelAtPeriodEnd: boolean,
    priceId: string
  ): Promise<void> {
    const planId = await this.getPlanIdFromPrice(priceId);

    // Build update object, only include plan_id if we have a valid one
    const updateData: Record<string, any> = {
      stripe_subscription_id: stripeSubscriptionId,
      status: status,
      current_period_start: new Date(currentPeriodStart * 1000).toISOString(),
      current_period_end: new Date(currentPeriodEnd * 1000).toISOString(),
      trial_end: trialEnd ? new Date(trialEnd * 1000).toISOString() : null,
      cancel_at_period_end: cancelAtPeriodEnd,
      updated_at: new Date().toISOString()
    };

    // Only update plan_id if we have a valid one (non-empty)
    // This preserves existing plan_id for events that don't include price data
    if (planId && planId !== '') {
      updateData.plan_id = planId;
    }

    await supabaseAdmin
      .from('tenant_subscriptions')
      .update(updateData)
      .eq('stripe_subscription_id', stripeSubscriptionId);
  }

  async getPlanIdFromPrice(priceId: string): Promise<string> {
    if (!priceId) {
      // Return null/empty signals caller to preserve existing plan
      return '';
    }
    // Use database-sourced plans (with fallback to hardcoded)
    const plans = await this.getPlans();
    for (const plan of plans) {
      if (plan.prices.monthly.id === priceId || plan.prices.yearly.id === priceId) {
        return plan.id;
      }
    }
    // Default to starter if price not found (safer than pro)
    return 'starter';
  }

  async cancelSubscription(stripeSubscriptionId: string): Promise<void> {
    // Only update status to canceled, preserve plan_id
    await supabaseAdmin
      .from('tenant_subscriptions')
      .update({
        status: 'canceled',
        cancel_at_period_end: false,
        updated_at: new Date().toISOString()
      })
      .eq('stripe_subscription_id', stripeSubscriptionId);
  }

  async checkFeatureAccess(tenantId: string, feature: string): Promise<boolean> {
    const subscription = await this.getTenantSubscription(tenantId);
    
    if (!subscription) {
      return await this.isFeatureInPlanFromDB('free', feature);
    }

    // Allow access during trial or active subscription
    if (subscription.status === 'trialing' || subscription.status === 'active') {
      return await this.isFeatureInPlanFromDB(subscription.plan_id, feature);
    }

    // Past due gets limited access
    if (subscription.status === 'past_due') {
      return await this.isFeatureInPlanFromDB('free', feature);
    }

    return false;
  }

  async isFeatureInPlanFromDB(planId: string, feature: string): Promise<boolean> {
    try {
      const { data, error } = await supabaseAdmin
        .from('plan_features')
        .select('enabled')
        .eq('plan_id', planId)
        .eq('feature_key', feature)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error checking feature from DB:', error);
        return this.isFeatureInPlanFallback(planId, feature);
      }

      return data?.enabled ?? false;
    } catch (error) {
      console.error('Error checking feature from DB:', error);
      return this.isFeatureInPlanFallback(planId, feature);
    }
  }

  isFeatureInPlanFallback(planId: string, feature: string): boolean {
    const featuresByPlan: Record<string, string[]> = {
      free: ['basic_meetings', 'member_checkin', 'basic_reports'],
      starter: [
        'basic_meetings', 'member_checkin', 'basic_reports',
        'visitor_management', 'payment_tracking', 'line_integration',
        'basic_analytics'
      ],
      pro: [
        'basic_meetings', 'member_checkin', 'basic_reports',
        'visitor_management', 'payment_tracking', 'line_integration',
        'basic_analytics', 'ai_copilot', 'advanced_analytics',
        'custom_branding', 'rsvp_notifications', 'apps_marketplace',
        'api_access'
      ]
    };

    return featuresByPlan[planId]?.includes(feature) || false;
  }

  // Sync version - uses fallback for backwards compatibility
  // Prefer using isFeatureInPlanFromDB for database-backed checks
  isFeatureInPlan(planId: string, feature: string): boolean {
    return this.isFeatureInPlanFallback(planId, feature);
  }

  // Async version that checks database first, falls back to hardcoded
  async checkPlanFeature(planId: string, feature: string): Promise<boolean> {
    return await this.isFeatureInPlanFromDB(planId, feature);
  }

  // Async version for getting limit from database
  async checkPlanLimit(planId: string, limitKey: string): Promise<number> {
    return await this.getLimitFromDB(planId, limitKey);
  }

  async getLimitFromDB(planId: string, limitKey: string): Promise<number> {
    try {
      const { data, error } = await supabaseAdmin
        .from('plan_limits')
        .select('limit_value')
        .eq('plan_id', planId)
        .eq('limit_key', limitKey)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error getting limit from DB:', error);
        return this.getLimitFallback(planId, limitKey);
      }

      return data?.limit_value ?? 0;
    } catch (error) {
      console.error('Error getting limit from DB:', error);
      return this.getLimitFallback(planId, limitKey);
    }
  }

  getLimitFallback(planId: string, limitKey: string): number {
    const limitsByPlan: Record<string, Record<string, number>> = {
      free: { members: 10, meetings_per_month: 4, ai_queries_per_month: 0, storage_gb: 1 },
      starter: { members: 30, meetings_per_month: 8, ai_queries_per_month: 50, storage_gb: 5 },
      pro: { members: -1, meetings_per_month: -1, ai_queries_per_month: 500, storage_gb: 50 }
    };

    return limitsByPlan[planId]?.[limitKey] ?? 0;
  }

  async getPlanConfigFromDB(planId: string): Promise<{ features: string[]; limits: Record<string, number> }> {
    try {
      const [featuresResult, limitsResult] = await Promise.all([
        supabaseAdmin
          .from('plan_features')
          .select('feature_key')
          .eq('plan_id', planId)
          .eq('enabled', true),
        supabaseAdmin
          .from('plan_limits')
          .select('limit_key, limit_value')
          .eq('plan_id', planId)
      ]);

      const features = featuresResult.data?.map(f => f.feature_key) || [];
      const limits: Record<string, number> = {};
      limitsResult.data?.forEach(l => {
        limits[l.limit_key] = l.limit_value;
      });

      return { features, limits };
    } catch (error) {
      console.error('Error getting plan config from DB:', error);
      return { features: [], limits: {} };
    }
  }

  async getUsageLimits(tenantId: string): Promise<{
    plan: SubscriptionPlan;
    usage: {
      members: number;
      meetings_this_month: number;
      ai_queries_this_month: number;
    };
  }> {
    const subscription = await this.getTenantSubscription(tenantId);
    const planId = subscription?.plan_id || 'free';
    
    // Get plans from database (with fallback to hardcoded)
    const plans = await this.getPlans();
    const plan = plans.find(p => p.id === planId) || plans[0];

    const { count: memberCount } = await supabaseAdmin
      .from('participants')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('status', 'member');

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const endOfMonth = new Date(startOfMonth);
    endOfMonth.setMonth(endOfMonth.getMonth() + 1);

    const { count: meetingCount } = await supabaseAdmin
      .from('meetings')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .gte('meeting_date', startOfMonth.toISOString())
      .lt('meeting_date', endOfMonth.toISOString());

    const { count: aiQueryCount } = await supabaseAdmin
      .from('ai_conversations')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('role', 'user')
      .gte('created_at', startOfMonth.toISOString());

    return {
      plan,
      usage: {
        members: memberCount || 0,
        meetings_this_month: meetingCount || 0,
        ai_queries_this_month: aiQueryCount || 0
      }
    };
  }

  getTrialDaysRemaining(subscription: TenantSubscription | null): number | null {
    if (!subscription?.trial_end) return null;
    
    const trialEnd = new Date(subscription.trial_end);
    const now = new Date();
    const diff = trialEnd.getTime() - now.getTime();
    
    if (diff <= 0) return 0;
    
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  async checkLimitExceeded(tenantId: string, limitType: 'members' | 'meetings' | 'ai_queries'): Promise<{
    exceeded: boolean;
    current: number;
    limit: number;
    percentage: number;
  }> {
    const { plan, usage } = await this.getUsageLimits(tenantId);
    const planConfig = await this.getPlanConfigFromDB(plan.id);
    
    let current = 0;
    let limit = Infinity;

    switch (limitType) {
      case 'members':
        current = usage.members;
        limit = planConfig.limits['members_limit'] ?? plan.limits.members;
        break;
      case 'meetings':
        current = usage.meetings_this_month;
        limit = planConfig.limits['meetings_limit'] ?? plan.limits.meetings_per_month;
        break;
      case 'ai_queries':
        current = usage.ai_queries_this_month;
        limit = planConfig.limits['ai_queries_limit'] ?? plan.limits.ai_queries_per_month;
        break;
    }

    if (limit === -1 || limit === Infinity) {
      return { exceeded: false, current, limit: -1, percentage: 0 };
    }

    const percentage = Math.round((current / limit) * 100);
    return {
      exceeded: current >= limit,
      current,
      limit,
      percentage
    };
  }

  async getWarningLevel(tenantId: string, limitType: 'members' | 'meetings' | 'ai_queries'): Promise<{
    level: 'ok' | 'warning' | 'critical' | 'exceeded';
    message: string;
    current: number;
    limit: number;
  }> {
    const check = await this.checkLimitExceeded(tenantId, limitType);
    
    if (check.limit === -1) {
      return { level: 'ok', message: 'Unlimited', current: check.current, limit: check.limit };
    }
    
    if (check.exceeded) {
      return { level: 'exceeded', message: `Limit reached (${check.current}/${check.limit})`, current: check.current, limit: check.limit };
    }
    
    if (check.percentage >= 90) {
      return { level: 'critical', message: `Almost at limit (${check.percentage}%)`, current: check.current, limit: check.limit };
    }
    
    if (check.percentage >= 80) {
      return { level: 'warning', message: `${check.percentage}% of limit used`, current: check.current, limit: check.limit };
    }
    
    return { level: 'ok', message: `${check.current} of ${check.limit} used`, current: check.current, limit: check.limit };
  }
}

export const subscriptionService = new SubscriptionService();
