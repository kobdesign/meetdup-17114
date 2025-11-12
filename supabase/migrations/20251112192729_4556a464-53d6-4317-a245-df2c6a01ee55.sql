-- Create integration_logs table for tenant-scoped API and webhook logs
CREATE TABLE public.integration_logs (
  log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(tenant_id) ON DELETE CASCADE,
  source TEXT NOT NULL, -- 'line', 'payment_gateway', 'api', etc.
  event_type TEXT NOT NULL, -- 'webhook', 'message', 'follow', 'unfollow', etc.
  payload JSONB, -- Full event payload
  metadata JSONB, -- Additional context: user_id, status, error, etc.
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for efficient queries
CREATE INDEX idx_integration_logs_tenant_id ON public.integration_logs(tenant_id);
CREATE INDEX idx_integration_logs_source ON public.integration_logs(source);
CREATE INDEX idx_integration_logs_created_at ON public.integration_logs(created_at DESC);
CREATE INDEX idx_integration_logs_tenant_source ON public.integration_logs(tenant_id, source);

-- Enable RLS
ALTER TABLE public.integration_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Chapter admins can view their integration logs"
ON public.integration_logs
FOR SELECT
USING (has_tenant_access(auth.uid(), tenant_id));

CREATE POLICY "System can insert integration logs"
ON public.integration_logs
FOR INSERT
WITH CHECK (true);

-- Only allow read and insert, no updates or deletes
-- Logs should be immutable for audit purposes

COMMENT ON TABLE public.integration_logs IS 'Tenant-scoped logs for external integrations (LINE, payments, APIs)';
COMMENT ON COLUMN public.integration_logs.source IS 'Integration source: line, payment_gateway, api, etc.';
COMMENT ON COLUMN public.integration_logs.event_type IS 'Event type: webhook, message, follow, payment, etc.';
COMMENT ON COLUMN public.integration_logs.payload IS 'Full event payload from external service';
COMMENT ON COLUMN public.integration_logs.metadata IS 'Additional context: user_id, status, error details, etc.';