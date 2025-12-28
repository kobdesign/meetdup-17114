-- Migration: Create tenant_subscriptions table
-- Purpose: Track subscription status per tenant for billing integration

-- Create tenant_subscriptions table
CREATE TABLE IF NOT EXISTS tenant_subscriptions (
  tenant_id UUID PRIMARY KEY REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  plan_id TEXT NOT NULL DEFAULT 'free',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('trialing', 'active', 'past_due', 'canceled', 'incomplete')),
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  trial_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_tenant_subscriptions_stripe_customer 
  ON tenant_subscriptions(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_tenant_subscriptions_stripe_subscription 
  ON tenant_subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_tenant_subscriptions_status 
  ON tenant_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_tenant_subscriptions_plan 
  ON tenant_subscriptions(plan_id);

-- Add comments
COMMENT ON TABLE tenant_subscriptions IS 'Tracks subscription status for each tenant';
COMMENT ON COLUMN tenant_subscriptions.plan_id IS 'Plan identifier: free, starter, pro';
COMMENT ON COLUMN tenant_subscriptions.status IS 'Subscription status from Stripe';

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
