-- Migration: Create platform_config table for LINE credentials
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)

CREATE TABLE IF NOT EXISTS platform_config (
  key VARCHAR(255) PRIMARY KEY,
  value TEXT,
  description TEXT,
  is_secret BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_platform_config_key ON platform_config(key);

-- Enable RLS
ALTER TABLE platform_config ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (for backend operations)
CREATE POLICY "Service role has full access" ON platform_config
  FOR ALL USING (auth.role() = 'service_role');

-- Insert default empty config
INSERT INTO platform_config (key, value, description, is_secret) VALUES
  ('LINE_CHANNEL_ACCESS_TOKEN', '', 'LINE Messaging API Channel Access Token', true),
  ('LINE_CHANNEL_SECRET', '', 'LINE Messaging API Channel Secret', true),
  ('LINE_CHANNEL_ID', '', 'LINE Channel ID', false),
  ('LIFF_ID', '', 'LIFF App ID', false)
ON CONFLICT (key) DO NOTHING;
