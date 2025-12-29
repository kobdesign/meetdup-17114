-- Create notification_logs table for tracking sent notifications
-- This prevents duplicate notifications being sent on the same day

CREATE TABLE IF NOT EXISTS notification_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  notification_type varchar(100) NOT NULL,
  details jsonb DEFAULT '{}',
  created_at timestamp with time zone DEFAULT now()
);

-- Index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_notification_logs_tenant_type 
ON notification_logs(tenant_id, notification_type, created_at DESC);

-- Comment
COMMENT ON TABLE notification_logs IS 'Tracks sent notifications to prevent duplicates';
