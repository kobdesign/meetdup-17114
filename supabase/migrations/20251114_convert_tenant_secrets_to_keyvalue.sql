-- Migration: Convert tenant_secrets from wide table to key-value pattern
-- Date: 2025-11-14
-- Reason: Server code expects secret_key/secret_value columns but table has wide columns
-- Safe: Migrates existing data if any, then recreates table structure

BEGIN;

-- ============================================================================
-- STEP 1: BACKUP EXISTING DATA (if wide table columns exist)
-- ============================================================================

DO $$
DECLARE
  has_wide_columns BOOLEAN;
  backup_count INTEGER := 0;
BEGIN
  -- Check if wide columns exist (line_access_token, etc.)
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenant_secrets' 
    AND column_name IN ('line_access_token', 'line_channel_secret', 'line_channel_id')
  ) INTO has_wide_columns;

  IF has_wide_columns THEN
    RAISE NOTICE '📦 Wide table columns detected - will migrate data...';
    
    -- Create temporary backup table
    CREATE TEMP TABLE tenant_secrets_backup AS 
    SELECT * FROM tenant_secrets;
    
    SELECT COUNT(*) INTO backup_count FROM tenant_secrets_backup;
    RAISE NOTICE '✓ Backed up % existing records', backup_count;
  ELSE
    RAISE NOTICE '  No wide columns found - will create fresh key-value structure';
  END IF;
END $$;

-- ============================================================================
-- STEP 2: DROP OLD TABLE AND RECREATE WITH KEY-VALUE PATTERN
-- ============================================================================

DROP TABLE IF EXISTS tenant_secrets CASCADE;

CREATE TABLE tenant_secrets (
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  secret_key TEXT NOT NULL,
  secret_value TEXT NOT NULL, -- Encrypted JSON
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, secret_key)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS tenant_secrets_tenant_id_idx ON tenant_secrets(tenant_id);
CREATE INDEX IF NOT EXISTS tenant_secrets_secret_key_idx ON tenant_secrets(secret_key);

-- ============================================================================
-- STEP 3: MIGRATE DATA FROM BACKUP (if exists)
-- ============================================================================

DO $$
DECLARE
  backup_exists BOOLEAN;
  rec RECORD;
  migrated_count INTEGER := 0;
BEGIN
  -- Check if backup table exists
  SELECT EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'pg_temp' 
    AND tablename LIKE 'tenant_secrets_backup%'
  ) INTO backup_exists;

  IF backup_exists THEN
    RAISE NOTICE '🔄 Migrating data from backup...';
    
    FOR rec IN SELECT * FROM tenant_secrets_backup LOOP
      -- Migrate line_access_token if exists
      IF rec.line_access_token IS NOT NULL THEN
        INSERT INTO tenant_secrets (tenant_id, secret_key, secret_value)
        VALUES (rec.tenant_id, 'line_channel_access_token', rec.line_access_token)
        ON CONFLICT (tenant_id, secret_key) DO UPDATE SET secret_value = EXCLUDED.secret_value;
      END IF;
      
      -- Migrate line_channel_secret if exists
      IF rec.line_channel_secret IS NOT NULL THEN
        INSERT INTO tenant_secrets (tenant_id, secret_key, secret_value)
        VALUES (rec.tenant_id, 'line_channel_secret', rec.line_channel_secret)
        ON CONFLICT (tenant_id, secret_key) DO UPDATE SET secret_value = EXCLUDED.secret_value;
      END IF;
      
      -- Migrate line_channel_id if exists
      IF rec.line_channel_id IS NOT NULL THEN
        INSERT INTO tenant_secrets (tenant_id, secret_key, secret_value)
        VALUES (rec.tenant_id, 'line_channel_id', rec.line_channel_id)
        ON CONFLICT (tenant_id, secret_key) DO UPDATE SET secret_value = EXCLUDED.secret_value;
      END IF;
      
      migrated_count := migrated_count + 1;
    END LOOP;
    
    RAISE NOTICE '✓ Migrated % tenant records', migrated_count;
  ELSE
    RAISE NOTICE '  No backup data to migrate';
  END IF;
END $$;

-- ============================================================================
-- STEP 4: ENABLE RLS
-- ============================================================================

ALTER TABLE tenant_secrets ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 5: GRANTS (with conditional checks for Supabase roles)
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON tenant_secrets FROM authenticated';
    EXECUTE 'REVOKE ALL ON tenant_secrets FROM anon';
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON tenant_secrets TO authenticated';
    EXECUTE 'GRANT ALL ON tenant_secrets TO service_role';
    
    RAISE NOTICE '✓ Granted permissions to Supabase roles';
  ELSE
    RAISE NOTICE '  Skipping GRANT/REVOKE - Supabase roles not found';
  END IF;
END $$;

-- ============================================================================
-- STEP 6: RLS POLICIES (conditional)
-- ============================================================================

DO $RLS$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'auth') THEN
    
    -- Only admins can manage tenant secrets
    EXECUTE $POLICY$
      CREATE POLICY "Chapter admins can manage their secrets" 
        ON tenant_secrets 
        USING (public.has_tenant_access(auth.uid(), tenant_id)) 
        WITH CHECK (public.has_tenant_access(auth.uid(), tenant_id))
    $POLICY$;
    
    RAISE NOTICE '✓ Created RLS policies for tenant_secrets';
  ELSE
    RAISE NOTICE '  Skipping RLS policies - auth schema not found';
  END IF;
END $RLS$;

-- ============================================================================
-- STEP 7: VERIFY SCHEMA
-- ============================================================================

DO $$
DECLARE
  column_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO column_count
  FROM information_schema.columns
  WHERE table_name = 'tenant_secrets'
  AND column_name IN ('tenant_id', 'secret_key', 'secret_value', 'created_at', 'updated_at');
  
  IF column_count = 5 THEN
    RAISE NOTICE '✅ Schema verification passed - all 5 columns present';
  ELSE
    RAISE WARNING '⚠️  Expected 5 columns, found %', column_count;
  END IF;
END $$;

COMMIT;

-- ============================================================================
-- POST-MIGRATION INSTRUCTIONS
-- ============================================================================

-- After running this migration, execute these commands:

-- 1. Reload PostgREST schema cache:
--    NOTIFY pgrst, 'reload schema';

-- 2. Verify schema:
--    SELECT column_name, data_type 
--    FROM information_schema.columns 
--    WHERE table_name = 'tenant_secrets'
--    ORDER BY ordinal_position;

-- Expected output:
--   tenant_id     | uuid
--   secret_key    | text
--   secret_value  | text
--   created_at    | timestamp with time zone
--   updated_at    | timestamp with time zone

-- 3. Test LINE config save:
--    - Go to /admin/line-config
--    - Enter Channel Access Token and Channel Secret
--    - Click "บันทึกการตั้งค่า"
--    - Should save successfully

-- 4. Verify data:
--    SELECT tenant_id, secret_key, length(secret_value) as encrypted_length
--    FROM tenant_secrets
--    ORDER BY tenant_id, secret_key;
