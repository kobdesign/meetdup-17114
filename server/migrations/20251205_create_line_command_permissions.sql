-- Migration: Create line_command_permissions table for LINE bot command authorization
-- Run this in Supabase SQL Editor

-- Create access level enum if not exists
DO $$ BEGIN
    CREATE TYPE command_access_level AS ENUM ('public', 'member', 'admin');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create line_command_permissions table
CREATE TABLE IF NOT EXISTS line_command_permissions (
    id SERIAL PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    command_key VARCHAR(100) NOT NULL,
    command_name VARCHAR(200) NOT NULL,
    command_description TEXT,
    access_level command_access_level NOT NULL DEFAULT 'admin',
    allow_group BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Unique constraint per tenant + command
    UNIQUE(tenant_id, command_key)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_line_command_permissions_tenant 
    ON line_command_permissions(tenant_id);

CREATE INDEX IF NOT EXISTS idx_line_command_permissions_lookup 
    ON line_command_permissions(tenant_id, command_key);

-- Enable RLS
ALTER TABLE line_command_permissions ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Admins can view/edit their chapter's permissions
CREATE POLICY "Chapter admins can manage command permissions"
    ON line_command_permissions
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM user_roles ur
            WHERE ur.tenant_id = line_command_permissions.tenant_id
            AND ur.user_id = auth.uid()
            AND ur.role IN ('super_admin', 'chapter_admin')
        )
    );

-- Function to seed default permissions for a tenant
CREATE OR REPLACE FUNCTION seed_default_command_permissions(p_tenant_id UUID)
RETURNS void AS $$
BEGIN
    -- Insert default commands if they don't exist
    INSERT INTO line_command_permissions (tenant_id, command_key, command_name, command_description, access_level, allow_group)
    VALUES 
        (p_tenant_id, 'goals_summary', 'สรุปเป้าหมาย', 'ดูสรุปความคืบหน้าเป้าหมายของ Chapter', 'member', true),
        (p_tenant_id, 'business_card_search', 'ค้นหานามบัตร', 'ค้นหานามบัตรสมาชิกในระบบ', 'member', true),
        (p_tenant_id, 'category_search', 'ค้นหาประเภทธุรกิจ', 'ค้นหาสมาชิกตามประเภทธุรกิจ', 'member', true),
        (p_tenant_id, 'checkin', 'เช็คอิน', 'เช็คอินเข้าร่วมประชุม', 'public', true),
        (p_tenant_id, 'link_phone', 'ผูกเบอร์โทร', 'ผูกเบอร์โทรศัพท์กับบัญชี LINE', 'public', false)
    ON CONFLICT (tenant_id, command_key) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- Seed permissions for existing tenants
DO $$
DECLARE
    tenant_record RECORD;
BEGIN
    FOR tenant_record IN SELECT tenant_id FROM tenants LOOP
        PERFORM seed_default_command_permissions(tenant_record.tenant_id);
    END LOOP;
END $$;

-- Trigger to auto-seed permissions for new tenants
CREATE OR REPLACE FUNCTION trigger_seed_command_permissions()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM seed_default_command_permissions(NEW.tenant_id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS after_tenant_insert_seed_permissions ON tenants;
CREATE TRIGGER after_tenant_insert_seed_permissions
    AFTER INSERT ON tenants
    FOR EACH ROW
    EXECUTE FUNCTION trigger_seed_command_permissions();

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_line_command_permissions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_line_command_permissions_updated_at ON line_command_permissions;
CREATE TRIGGER set_line_command_permissions_updated_at
    BEFORE UPDATE ON line_command_permissions
    FOR EACH ROW
    EXECUTE FUNCTION update_line_command_permissions_updated_at();

-- Grant permissions
GRANT ALL ON line_command_permissions TO authenticated;
GRANT ALL ON line_command_permissions TO service_role;
