-- System Settings Table for global configuration (LIFF ID, etc.)
-- This table stores system-wide settings that are not tenant-specific
-- Run this migration in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS system_settings (
  setting_key VARCHAR(100) PRIMARY KEY,
  setting_value TEXT,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default LIFF ID setting (empty, needs to be configured by Super Admin)
INSERT INTO system_settings (setting_key, setting_value, description)
VALUES 
  ('liff_id', '', 'LIFF Application ID from LINE Developers Console'),
  ('liff_channel_id', '', 'LINE Login Channel ID (for LIFF)'),
  ('liff_enabled', 'false', 'Enable/Disable LIFF SDK integration')
ON CONFLICT (setting_key) DO NOTHING;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_system_settings_key ON system_settings(setting_key);

-- Add RLS policies
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- Allow read for all authenticated users (needed for frontend to get LIFF ID)
CREATE POLICY "Allow read for authenticated users" ON system_settings
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow update only for super_admin (will be enforced via API)
CREATE POLICY "Allow update for service role" ON system_settings
  FOR ALL
  TO service_role
  USING (true);
