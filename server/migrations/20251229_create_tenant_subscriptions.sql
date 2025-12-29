-- Create tenant_subscriptions table for storing subscription data per tenant
-- This is the core table for tracking Stripe subscriptions and plan assignments
-- NOTE: tenants table uses tenant_id as primary key, not id

CREATE TABLE IF NOT EXISTS tenant_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  stripe_customer_id text,
  stripe_subscription_id text,
  plan_id varchar(50) NOT NULL DEFAULT 'free' REFERENCES plan_definitions(id),
  status varchar(20) NOT NULL DEFAULT 'trialing' CHECK (status IN ('trialing', 'active', 'past_due', 'canceled', 'incomplete')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  trial_end timestamptz,
  cancel_at_period_end boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Ensure one subscription per tenant
CREATE UNIQUE INDEX IF NOT EXISTS idx_tenant_subscriptions_tenant_id 
ON tenant_subscriptions(tenant_id);

-- Index for Stripe webhook lookups
CREATE INDEX IF NOT EXISTS idx_tenant_subscriptions_stripe_sub_id 
ON tenant_subscriptions(stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL;

-- Index for finding expiring trials
CREATE INDEX IF NOT EXISTS idx_tenant_subscriptions_trial_end 
ON tenant_subscriptions(trial_end) WHERE trial_end IS NOT NULL;

-- Enable Row Level Security
ALTER TABLE tenant_subscriptions ENABLE ROW LEVEL SECURITY;
