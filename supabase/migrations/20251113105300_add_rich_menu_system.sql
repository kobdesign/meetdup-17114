-- Create rich_menus table for storing Rich Menu configurations
CREATE TABLE IF NOT EXISTS rich_menus (
  rich_menu_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  
  -- LINE Rich Menu identifiers
  line_rich_menu_id VARCHAR(255) UNIQUE, -- LINE's rich menu ID after creation
  
  -- Rich Menu metadata
  name VARCHAR(300) NOT NULL, -- Rich menu name (internal, not shown to users)
  chat_bar_text VARCHAR(14) NOT NULL, -- Text shown on chat bar
  
  -- Rich Menu display settings
  selected BOOLEAN DEFAULT false, -- Auto-open when linked to user
  is_default BOOLEAN DEFAULT false, -- Set as default for all users in tenant
  is_active BOOLEAN DEFAULT true, -- Enable/disable without deleting
  
  -- Image information
  image_url TEXT, -- URL to uploaded image (for display in admin UI)
  image_width INTEGER NOT NULL DEFAULT 2500, -- Must be 2500
  image_height INTEGER NOT NULL CHECK (image_height IN (843, 1686)), -- Must be 843 or 1686
  
  -- Rich Menu configuration (stored as JSONB for flexibility)
  areas JSONB NOT NULL, -- Array of tappable areas with bounds and actions
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  
  -- Constraints
  CONSTRAINT valid_image_dimensions CHECK (image_width = 2500),
  CONSTRAINT one_default_per_tenant UNIQUE NULLS NOT DISTINCT (tenant_id, is_default) 
    WHERE is_default = true
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_rich_menus_tenant_id ON rich_menus(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rich_menus_line_rich_menu_id ON rich_menus(line_rich_menu_id);
CREATE INDEX IF NOT EXISTS idx_rich_menus_is_default ON rich_menus(tenant_id, is_default) WHERE is_default = true;

-- Comments
COMMENT ON TABLE rich_menus IS 'Stores LINE Rich Menu configurations per tenant';
COMMENT ON COLUMN rich_menus.line_rich_menu_id IS 'LINE API rich menu ID (populated after creation)';
COMMENT ON COLUMN rich_menus.areas IS 'JSONB array of rich menu areas: [{bounds: {x, y, width, height}, action: {type, ...}}]';
COMMENT ON COLUMN rich_menus.is_default IS 'Default rich menu linked to all new users in this tenant';

-- Create quick_reply_templates table for reusable Quick Reply buttons
CREATE TABLE IF NOT EXISTS quick_reply_templates (
  template_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  
  -- Template metadata
  template_name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(50), -- e.g., 'checkin', 'payment', 'general', 'meeting'
  
  -- Quick Reply items (stored as JSONB)
  items JSONB NOT NULL, -- Array of quick reply items: [{type: "action", imageUrl?, action: {...}}]
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  
  -- Constraints
  CONSTRAINT unique_template_name_per_tenant UNIQUE(tenant_id, template_name)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_quick_reply_templates_tenant_id ON quick_reply_templates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_quick_reply_templates_category ON quick_reply_templates(tenant_id, category);

-- Comments
COMMENT ON TABLE quick_reply_templates IS 'Reusable Quick Reply button templates per tenant';
COMMENT ON COLUMN quick_reply_templates.items IS 'JSONB array of quick reply items (max 13): [{type: "action", imageUrl?, action: {type, label, ...}}]';
COMMENT ON COLUMN quick_reply_templates.category IS 'Template category for organization: checkin, payment, general, meeting, etc.';

-- Add updated_at trigger for rich_menus
CREATE OR REPLACE FUNCTION update_rich_menus_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_rich_menus_updated_at
  BEFORE UPDATE ON rich_menus
  FOR EACH ROW
  EXECUTE FUNCTION update_rich_menus_updated_at();

-- Add updated_at trigger for quick_reply_templates
CREATE OR REPLACE FUNCTION update_quick_reply_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_quick_reply_templates_updated_at
  BEFORE UPDATE ON quick_reply_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_quick_reply_templates_updated_at();
