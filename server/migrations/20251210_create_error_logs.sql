-- Create error_logs table for production debugging
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS error_logs (
  id SERIAL PRIMARY KEY,
  category VARCHAR(100) NOT NULL,
  tenant_id UUID REFERENCES tenants(tenant_id) ON DELETE SET NULL,
  error_message TEXT NOT NULL,
  error_stack TEXT,
  context JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_error_logs_created_at ON error_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_logs_category ON error_logs(category);
CREATE INDEX IF NOT EXISTS idx_error_logs_tenant ON error_logs(tenant_id);

-- Grant access for the application
GRANT SELECT, INSERT ON error_logs TO authenticated;
GRANT SELECT, INSERT ON error_logs TO anon;

-- Enable RLS
ALTER TABLE error_logs ENABLE ROW LEVEL SECURITY;

-- Allow all inserts (for logging)
CREATE POLICY "Allow insert for all" ON error_logs
  FOR INSERT WITH CHECK (true);

-- Allow select for admins
CREATE POLICY "Allow select for authenticated" ON error_logs
  FOR SELECT TO authenticated USING (true);
