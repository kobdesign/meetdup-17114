-- Migration: Add ai_conversations table for AI Chapter Data Assistant conversation memory
-- Created: 2025-12-27

CREATE TABLE IF NOT EXISTS ai_conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  line_user_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 minutes')
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_ai_conv_tenant_user ON ai_conversations(tenant_id, line_user_id);
CREATE INDEX IF NOT EXISTS idx_ai_conv_expires ON ai_conversations(expires_at);
CREATE INDEX IF NOT EXISTS idx_ai_conv_created ON ai_conversations(created_at);

-- Enable RLS
ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Allow service role full access (for backend operations)
CREATE POLICY "Service role has full access to ai_conversations"
  ON ai_conversations
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Comment on table
COMMENT ON TABLE ai_conversations IS 'Stores conversation history for AI Chapter Data Assistant (LINE Bot)';
