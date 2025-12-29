-- Plan Configuration System
-- Dynamic package/plan feature and limit management

-- Feature catalog: all available features in the system
CREATE TABLE IF NOT EXISTS feature_catalog (
    id SERIAL PRIMARY KEY,
    feature_key VARCHAR(100) UNIQUE NOT NULL,
    display_name VARCHAR(200) NOT NULL,
    description TEXT,
    category VARCHAR(50) DEFAULT 'general',
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Limit catalog: all available limits in the system
CREATE TABLE IF NOT EXISTS limit_catalog (
    id SERIAL PRIMARY KEY,
    limit_key VARCHAR(100) UNIQUE NOT NULL,
    display_name VARCHAR(200) NOT NULL,
    description TEXT,
    unit VARCHAR(50) DEFAULT 'count',
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Plan definitions: the subscription plans
CREATE TABLE IF NOT EXISTS plan_definitions (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    stripe_monthly_price_id VARCHAR(255),
    stripe_yearly_price_id VARCHAR(255),
    monthly_price_cents INTEGER DEFAULT 0,
    yearly_price_cents INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Plan features: which features are enabled for each plan
CREATE TABLE IF NOT EXISTS plan_features (
    id SERIAL PRIMARY KEY,
    plan_id VARCHAR(50) NOT NULL REFERENCES plan_definitions(id) ON DELETE CASCADE,
    feature_key VARCHAR(100) NOT NULL REFERENCES feature_catalog(feature_key) ON DELETE CASCADE,
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(plan_id, feature_key)
);

-- Plan limits: the limit values for each plan
CREATE TABLE IF NOT EXISTS plan_limits (
    id SERIAL PRIMARY KEY,
    plan_id VARCHAR(50) NOT NULL REFERENCES plan_definitions(id) ON DELETE CASCADE,
    limit_key VARCHAR(100) NOT NULL REFERENCES limit_catalog(limit_key) ON DELETE CASCADE,
    limit_value INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(plan_id, limit_key)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_plan_features_plan_id ON plan_features(plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_features_feature_key ON plan_features(feature_key);
CREATE INDEX IF NOT EXISTS idx_plan_limits_plan_id ON plan_limits(plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_limits_limit_key ON plan_limits(limit_key);

-- Seed initial data: Feature catalog
INSERT INTO feature_catalog (feature_key, display_name, description, category, display_order) VALUES
    ('basic_meetings', 'Basic Meeting Management', 'Create and manage meetings', 'core', 1),
    ('member_checkin', 'Member Check-in', 'QR code and manual check-in for members', 'core', 2),
    ('basic_reports', 'Basic Reports', 'View attendance and basic reports', 'core', 3),
    ('visitor_management', 'Visitor Management', 'Track and manage visitors', 'visitors', 10),
    ('payment_tracking', 'Payment Tracking', 'Track member dues and visitor fees', 'finance', 20),
    ('line_integration', 'LINE Integration', 'Connect with LINE for notifications', 'integrations', 30),
    ('basic_analytics', 'Basic Analytics', 'View basic performance metrics', 'analytics', 40),
    ('ai_copilot', 'AI Growth Co-Pilot', 'AI-powered insights and assistance', 'ai', 50),
    ('advanced_analytics', 'Advanced Analytics', 'Detailed performance analytics and trends', 'analytics', 41),
    ('custom_branding', 'Custom Branding', 'Customize chapter branding and logos', 'customization', 60),
    ('rsvp_notifications', 'RSVP & Notifications', 'Meeting RSVP and automated notifications', 'meetings', 5),
    ('apps_marketplace', 'Apps Marketplace', 'Access to chapter apps and extensions', 'extensions', 70),
    ('api_access', 'API Access', 'Access to REST API for custom integrations', 'integrations', 80)
ON CONFLICT (feature_key) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    display_order = EXCLUDED.display_order,
    updated_at = NOW();

-- Seed initial data: Limit catalog
INSERT INTO limit_catalog (limit_key, display_name, description, unit, display_order) VALUES
    ('members', 'Members', 'Maximum number of active members', 'members', 1),
    ('meetings_per_month', 'Meetings per Month', 'Maximum meetings that can be created per month', 'meetings', 2),
    ('ai_queries_per_month', 'AI Queries per Month', 'Maximum AI assistant queries per month', 'queries', 3),
    ('storage_gb', 'Storage', 'Storage space for files and images', 'GB', 4)
ON CONFLICT (limit_key) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    unit = EXCLUDED.unit,
    display_order = EXCLUDED.display_order,
    updated_at = NOW();

-- Seed initial data: Plan definitions
INSERT INTO plan_definitions (id, name, description, display_order, monthly_price_cents, yearly_price_cents) VALUES
    ('free', 'Free', 'Get started with basic features', 1, 0, 0),
    ('starter', 'Starter', 'Perfect for growing chapters', 2, 1990, 19900),
    ('pro', 'Pro', 'Full power for established chapters', 3, 4990, 49900)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    display_order = EXCLUDED.display_order,
    monthly_price_cents = EXCLUDED.monthly_price_cents,
    yearly_price_cents = EXCLUDED.yearly_price_cents,
    updated_at = NOW();

-- Seed initial data: Plan features
-- Free plan features
INSERT INTO plan_features (plan_id, feature_key, enabled) VALUES
    ('free', 'basic_meetings', true),
    ('free', 'member_checkin', true),
    ('free', 'basic_reports', true),
    ('free', 'visitor_management', false),
    ('free', 'payment_tracking', false),
    ('free', 'line_integration', false),
    ('free', 'basic_analytics', false),
    ('free', 'ai_copilot', false),
    ('free', 'advanced_analytics', false),
    ('free', 'custom_branding', false),
    ('free', 'rsvp_notifications', false),
    ('free', 'apps_marketplace', false),
    ('free', 'api_access', false)
ON CONFLICT (plan_id, feature_key) DO UPDATE SET
    enabled = EXCLUDED.enabled,
    updated_at = NOW();

-- Starter plan features
INSERT INTO plan_features (plan_id, feature_key, enabled) VALUES
    ('starter', 'basic_meetings', true),
    ('starter', 'member_checkin', true),
    ('starter', 'basic_reports', true),
    ('starter', 'visitor_management', true),
    ('starter', 'payment_tracking', true),
    ('starter', 'line_integration', true),
    ('starter', 'basic_analytics', true),
    ('starter', 'ai_copilot', false),
    ('starter', 'advanced_analytics', false),
    ('starter', 'custom_branding', false),
    ('starter', 'rsvp_notifications', false),
    ('starter', 'apps_marketplace', false),
    ('starter', 'api_access', false)
ON CONFLICT (plan_id, feature_key) DO UPDATE SET
    enabled = EXCLUDED.enabled,
    updated_at = NOW();

-- Pro plan features
INSERT INTO plan_features (plan_id, feature_key, enabled) VALUES
    ('pro', 'basic_meetings', true),
    ('pro', 'member_checkin', true),
    ('pro', 'basic_reports', true),
    ('pro', 'visitor_management', true),
    ('pro', 'payment_tracking', true),
    ('pro', 'line_integration', true),
    ('pro', 'basic_analytics', true),
    ('pro', 'ai_copilot', true),
    ('pro', 'advanced_analytics', true),
    ('pro', 'custom_branding', true),
    ('pro', 'rsvp_notifications', true),
    ('pro', 'apps_marketplace', true),
    ('pro', 'api_access', true)
ON CONFLICT (plan_id, feature_key) DO UPDATE SET
    enabled = EXCLUDED.enabled,
    updated_at = NOW();

-- Seed initial data: Plan limits
-- Free plan limits
INSERT INTO plan_limits (plan_id, limit_key, limit_value) VALUES
    ('free', 'members', 10),
    ('free', 'meetings_per_month', 4),
    ('free', 'ai_queries_per_month', 0),
    ('free', 'storage_gb', 1)
ON CONFLICT (plan_id, limit_key) DO UPDATE SET
    limit_value = EXCLUDED.limit_value,
    updated_at = NOW();

-- Starter plan limits
INSERT INTO plan_limits (plan_id, limit_key, limit_value) VALUES
    ('starter', 'members', 30),
    ('starter', 'meetings_per_month', 8),
    ('starter', 'ai_queries_per_month', 50),
    ('starter', 'storage_gb', 5)
ON CONFLICT (plan_id, limit_key) DO UPDATE SET
    limit_value = EXCLUDED.limit_value,
    updated_at = NOW();

-- Pro plan limits (-1 means unlimited)
INSERT INTO plan_limits (plan_id, limit_key, limit_value) VALUES
    ('pro', 'members', -1),
    ('pro', 'meetings_per_month', -1),
    ('pro', 'ai_queries_per_month', 500),
    ('pro', 'storage_gb', 50)
ON CONFLICT (plan_id, limit_key) DO UPDATE SET
    limit_value = EXCLUDED.limit_value,
    updated_at = NOW();
