-- Add LINE integration fields to participants table
ALTER TABLE participants
ADD COLUMN IF NOT EXISTS line_user_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS line_display_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS line_picture_url TEXT;

-- Create index on line_user_id for fast lookups
CREATE INDEX IF NOT EXISTS idx_participants_line_user_id ON participants(line_user_id);

-- Create line_group_mappings table for mapping LINE groups to tenants
CREATE TABLE IF NOT EXISTS line_group_mappings (
  mapping_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  line_group_id VARCHAR(255) NOT NULL UNIQUE,
  line_group_name VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(tenant_id, line_group_id)
);

-- Create index for fast tenant lookups
CREATE INDEX IF NOT EXISTS idx_line_group_mappings_tenant_id ON line_group_mappings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_line_group_mappings_line_group_id ON line_group_mappings(line_group_id);

-- Add check-in source tracking to checkins table
ALTER TABLE checkins
ADD COLUMN IF NOT EXISTS checkin_source VARCHAR(50) DEFAULT 'qr_code';

COMMENT ON COLUMN checkins.checkin_source IS 'Source of check-in: qr_code, line_chat, line_group, manual';

-- Update tenant_secrets to store LINE webhook secret
COMMENT ON TABLE tenant_secrets IS 'Stores encrypted tenant-specific secrets including LINE credentials';
