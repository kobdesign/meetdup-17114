-- Phase 2: Chapter Apps Marketplace
-- Create apps registry and chapter app settings tables

-- Apps Registry Table
CREATE TABLE IF NOT EXISTS apps (
  app_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  icon VARCHAR(50) NOT NULL DEFAULT 'layout-grid',
  route VARCHAR(200) NOT NULL UNIQUE,
  category VARCHAR(50) NOT NULL DEFAULT 'utility',
  is_active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chapter Apps Settings Table
CREATE TABLE IF NOT EXISTS chapter_apps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  app_id UUID NOT NULL REFERENCES apps(app_id) ON DELETE CASCADE,
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  enabled_at TIMESTAMPTZ,
  enabled_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, app_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_apps_is_active ON apps(is_active);
CREATE INDEX IF NOT EXISTS idx_apps_category ON apps(category);
CREATE INDEX IF NOT EXISTS idx_chapter_apps_tenant ON chapter_apps(tenant_id);
CREATE INDEX IF NOT EXISTS idx_chapter_apps_app ON chapter_apps(app_id);
CREATE INDEX IF NOT EXISTS idx_chapter_apps_enabled ON chapter_apps(is_enabled);

-- RLS Policies
ALTER TABLE apps ENABLE ROW LEVEL SECURITY;
ALTER TABLE chapter_apps ENABLE ROW LEVEL SECURITY;

-- Apps: Anyone authenticated can read active apps
DROP POLICY IF EXISTS "Anyone can read active apps" ON apps;
CREATE POLICY "Anyone can read active apps" ON apps
  FOR SELECT
  USING (is_active = true);

-- Apps: Super admin can manage all apps
DROP POLICY IF EXISTS "Super admin can manage apps" ON apps;
CREATE POLICY "Super admin can manage apps" ON apps
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role = 'super_admin'
    )
  );

-- Chapter Apps: Members can read their chapter's app settings
DROP POLICY IF EXISTS "Members can read chapter apps" ON chapter_apps;
CREATE POLICY "Members can read chapter apps" ON chapter_apps
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM user_roles 
      WHERE user_id = auth.uid()
    )
  );

-- Chapter Apps: Chapter admin can manage their chapter's apps
DROP POLICY IF EXISTS "Chapter admin can manage chapter apps" ON chapter_apps;
CREATE POLICY "Chapter admin can manage chapter apps" ON chapter_apps
  FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('chapter_admin', 'super_admin')
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('chapter_admin', 'super_admin')
    )
  );

-- Trigger to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_apps_updated_at ON apps;
CREATE TRIGGER update_apps_updated_at
    BEFORE UPDATE ON apps
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_chapter_apps_updated_at ON chapter_apps;
CREATE TRIGGER update_chapter_apps_updated_at
    BEFORE UPDATE ON chapter_apps
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Seed initial apps
INSERT INTO apps (name, description, icon, route, category, is_active) VALUES
  ('BOQ Estimator', 'ประเมินราคางานก่อสร้างเบื้องต้น', 'calculator', '/apps/boq-estimator', 'construction', true)
ON CONFLICT (route) DO NOTHING;

-- Comments
COMMENT ON TABLE apps IS 'Registry of available mini-applications in the marketplace';
COMMENT ON TABLE chapter_apps IS 'Per-chapter app installation and settings';
COMMENT ON COLUMN apps.icon IS 'Lucide icon name to display';
COMMENT ON COLUMN apps.route IS 'Frontend route path for the app';
COMMENT ON COLUMN apps.category IS 'App category for filtering (construction, finance, utility, etc)';
COMMENT ON COLUMN chapter_apps.is_enabled IS 'Whether this app is enabled for the chapter';
