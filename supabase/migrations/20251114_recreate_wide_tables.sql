-- Migration: Recreate tenant_settings and participants as wide tables
-- Date: 2025-11-14
-- Reason: Production database has key-value pattern (setting_key, setting_value jsonb)
--         but TypeScript code expects wide table with direct columns
-- Safe to DROP: User confirmed NO DATA exists in production yet
--
-- ⚠️ IMPORTANT: This migration is for SUPABASE PRODUCTION only!
-- - Uses Supabase-specific roles: authenticated, anon, service_role
-- - Development (Neon) database doesn't have these roles
-- - Run this in Supabase Dashboard → SQL Editor

BEGIN;

-- ============================================================================
-- DROP OLD TABLES (key-value pattern from Lovable)
-- ============================================================================

DROP TABLE IF EXISTS tenant_settings CASCADE;
DROP TABLE IF EXISTS participants CASCADE;

-- ============================================================================
-- CREATE tenant_settings (wide table - 9 columns)
-- ============================================================================

CREATE TABLE tenant_settings (
  tenant_id UUID PRIMARY KEY REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  branding_color TEXT,
  currency TEXT DEFAULT 'THB',
  default_visitor_fee NUMERIC,
  language TEXT DEFAULT 'th',
  logo_url TEXT,
  require_visitor_payment BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for faster lookups
CREATE UNIQUE INDEX IF NOT EXISTS tenant_settings_tenant_id_idx ON tenant_settings(tenant_id);

-- ============================================================================
-- CREATE participants (wide table - 15 columns)
-- ============================================================================

CREATE TABLE participants (
  participant_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  company TEXT,
  nickname TEXT,
  goal TEXT,
  notes TEXT,
  business_type TEXT,
  invited_by UUID REFERENCES participants(participant_id) ON DELETE SET NULL,
  status participant_status NOT NULL DEFAULT 'member',
  line_user_id TEXT,
  joined_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for query performance
CREATE INDEX IF NOT EXISTS participants_tenant_id_status_idx ON participants(tenant_id, status);
CREATE INDEX IF NOT EXISTS participants_line_user_id_idx ON participants(line_user_id);
CREATE INDEX IF NOT EXISTS participants_invited_by_idx ON participants(invited_by);

-- Unique constraint for email per tenant (optional - can be removed if not needed)
-- CREATE UNIQUE INDEX IF NOT EXISTS participants_tenant_email_unique 
--   ON participants(tenant_id, email) 
--   WHERE email IS NOT NULL;

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on both tables
ALTER TABLE tenant_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE participants ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- GRANTS (with conditional checks for Supabase roles)
-- ============================================================================

DO $$
BEGIN
  -- Only run if Supabase roles exist (production)
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    -- Revoke all permissions first
    EXECUTE 'REVOKE ALL ON tenant_settings FROM authenticated';
    EXECUTE 'REVOKE ALL ON participants FROM authenticated';
    EXECUTE 'REVOKE ALL ON tenant_settings FROM anon';
    EXECUTE 'REVOKE ALL ON participants FROM anon';
    
    -- Grant appropriate permissions to authenticated users
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON tenant_settings TO authenticated';
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON participants TO authenticated';
    
    -- Grant full access to service role
    EXECUTE 'GRANT ALL ON tenant_settings TO service_role';
    EXECUTE 'GRANT ALL ON participants TO service_role';
    
    RAISE NOTICE '✓ Granted permissions to Supabase roles (authenticated, anon, service_role)';
  ELSE
    RAISE NOTICE '⚠ Skipping GRANT/REVOKE - Supabase roles not found (development environment)';
  END IF;
END $$;

-- ============================================================================
-- RLS POLICIES (conditional - only in Supabase with auth schema)
-- ============================================================================

DO $RLS$
BEGIN
  -- Only create RLS policies if auth schema exists (Supabase production)
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'auth') THEN
    
    -- tenant_settings policies
    EXECUTE $POLICY$
      CREATE POLICY "Anyone can view tenant settings" 
        ON tenant_settings 
        FOR SELECT 
        USING (
          EXISTS (
            SELECT 1 FROM tenants
            WHERE tenants.tenant_id = tenant_settings.tenant_id
          )
        )
    $POLICY$;
    
    EXECUTE $POLICY$
      CREATE POLICY "Chapter admins can manage their settings" 
        ON tenant_settings 
        USING (public.has_tenant_access(auth.uid(), tenant_id)) 
        WITH CHECK (public.has_tenant_access(auth.uid(), tenant_id))
    $POLICY$;
    
    -- participants policies
    EXECUTE $POLICY$
      CREATE POLICY "Chapter users can manage their participants" 
        ON participants 
        USING (public.has_tenant_access(auth.uid(), tenant_id)) 
        WITH CHECK (public.has_tenant_access(auth.uid(), tenant_id))
    $POLICY$;
    
    RAISE NOTICE '✓ Created RLS policies for tenant_settings and participants';
  ELSE
    RAISE NOTICE '⚠ Skipping RLS policies - auth schema not found (development environment)';
    RAISE NOTICE '  Note: Tables still have RLS ENABLED but no policies = deny all access';
    RAISE NOTICE '  Use service_role or disable RLS for development testing';
  END IF;
END $RLS$;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
BEGIN
  -- Verify tenant_settings columns
  RAISE NOTICE '✓ Verifying tenant_settings schema...';
  
  IF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='tenant_settings' AND column_name='tenant_id') THEN
    RAISE EXCEPTION 'tenant_settings.tenant_id column missing!';
  END IF;
  
  IF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='tenant_settings' AND column_name='branding_color') THEN
    RAISE EXCEPTION 'tenant_settings.branding_color column missing!';
  END IF;
  
  IF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='tenant_settings' AND column_name='currency') THEN
    RAISE EXCEPTION 'tenant_settings.currency column missing!';
  END IF;
  
  IF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='tenant_settings' AND column_name='default_visitor_fee') THEN
    RAISE EXCEPTION 'tenant_settings.default_visitor_fee column missing!';
  END IF;
  
  IF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='tenant_settings' AND column_name='language') THEN
    RAISE EXCEPTION 'tenant_settings.language column missing!';
  END IF;
  
  IF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='tenant_settings' AND column_name='require_visitor_payment') THEN
    RAISE EXCEPTION 'tenant_settings.require_visitor_payment column missing!';
  END IF;
  
  -- Verify participants columns (including the 3 missing ones: nickname, goal, joined_date)
  RAISE NOTICE '✓ Verifying participants schema...';
  
  IF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='participants' AND column_name='participant_id') THEN
    RAISE EXCEPTION 'participants.participant_id column missing!';
  END IF;
  
  IF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='participants' AND column_name='nickname') THEN
    RAISE EXCEPTION 'participants.nickname column missing!';
  END IF;
  
  IF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='participants' AND column_name='goal') THEN
    RAISE EXCEPTION 'participants.goal column missing!';
  END IF;
  
  IF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='participants' AND column_name='business_type') THEN
    RAISE EXCEPTION 'participants.business_type column missing!';
  END IF;
  
  IF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='participants' AND column_name='joined_date') THEN
    RAISE EXCEPTION 'participants.joined_date column missing!';
  END IF;
  
  RAISE NOTICE '✅ All columns verified successfully!';
  RAISE NOTICE '✅ tenant_settings: 9 columns created';
  RAISE NOTICE '✅ participants: 15 columns created (including nickname, goal, joined_date)';
END $$;

COMMIT;

-- ============================================================================
-- POST-MIGRATION NOTES
-- ============================================================================

-- After running this migration in production:
-- 1. Run in SQL Editor: NOTIFY pgrst, 'reload schema';
-- 2. Verify with: SELECT column_name FROM information_schema.columns WHERE table_name='tenant_settings';
-- 3. Verify with: SELECT column_name FROM information_schema.columns WHERE table_name='participants';
-- 4. Test Settings.tsx and ParticipantsManagement.tsx
