-- Create activation_tokens table for member self-activation
CREATE TABLE IF NOT EXISTS activation_tokens (
  token_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token VARCHAR UNIQUE NOT NULL,
  participant_id UUID NOT NULL REFERENCES participants(participant_id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_activation_tokens_token ON activation_tokens(token);
CREATE INDEX IF NOT EXISTS idx_activation_tokens_participant ON activation_tokens(participant_id);
CREATE INDEX IF NOT EXISTS idx_activation_tokens_tenant ON activation_tokens(tenant_id);

-- RLS Policies
ALTER TABLE activation_tokens ENABLE ROW LEVEL SECURITY;

-- Admin can manage tokens
DROP POLICY IF EXISTS "Admin can manage activation tokens" ON activation_tokens;
CREATE POLICY "Admin can manage activation tokens" ON activation_tokens
  FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('chapter_admin', 'super_admin')
    )
  );

-- NO PUBLIC READ ACCESS
-- Activation tokens are accessed ONLY via backend API (service role)
-- This prevents token enumeration attacks

COMMENT ON TABLE activation_tokens IS 'Stores activation links for imported members to self-register';
COMMENT ON COLUMN activation_tokens.token IS 'Unique token sent to member for account activation';
COMMENT ON COLUMN activation_tokens.expires_at IS 'Token expiration time (default 7 days)';
COMMENT ON COLUMN activation_tokens.used_at IS 'Timestamp when token was used to activate account';
