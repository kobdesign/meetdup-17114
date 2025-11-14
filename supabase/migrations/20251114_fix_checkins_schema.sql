-- Migration: Fix checkins table schema and restore foreign keys
-- Date: 2025-11-14
-- Reason: checkins table missing tenant_id column + foreign keys broken
-- Safe: Comprehensive pre-checks, backfills, and orphan cleanup

BEGIN;

-- ============================================================================
-- PRE-FLIGHT CHECKS: Detect problems before making changes
-- ============================================================================

DO $$
DECLARE
  orphaned_count INTEGER;
  null_tenant_count INTEGER;
BEGIN
  RAISE NOTICE '🔍 Running pre-flight checks...';
  
  -- Check 1: Orphaned checkins (participant_id doesn't exist)
  SELECT COUNT(*) INTO orphaned_count
  FROM checkins c
  WHERE NOT EXISTS (
    SELECT 1 FROM participants p WHERE p.participant_id = c.participant_id
  );
  
  IF orphaned_count > 0 THEN
    RAISE EXCEPTION 'Found % orphaned checkins with invalid participant_id. Run this first: DELETE FROM checkins WHERE NOT EXISTS (SELECT 1 FROM participants WHERE participant_id = checkins.participant_id);', orphaned_count;
  END IF;
  
  -- Check 2: Orphaned checkins (meeting_id doesn't exist)
  SELECT COUNT(*) INTO orphaned_count
  FROM checkins c
  WHERE NOT EXISTS (
    SELECT 1 FROM meetings m WHERE m.meeting_id = c.meeting_id
  );
  
  IF orphaned_count > 0 THEN
    RAISE EXCEPTION 'Found % orphaned checkins with invalid meeting_id. Run this first: DELETE FROM checkins WHERE NOT EXISTS (SELECT 1 FROM meetings WHERE meeting_id = checkins.meeting_id);', orphaned_count;
  END IF;
  
  -- Check 3: Meetings with NULL tenant_id
  SELECT COUNT(*) INTO null_tenant_count
  FROM meetings m
  INNER JOIN checkins c ON c.meeting_id = m.meeting_id
  WHERE m.tenant_id IS NULL;
  
  IF null_tenant_count > 0 THEN
    RAISE EXCEPTION 'Found % checkins linked to meetings with NULL tenant_id. Fix meetings table first.', null_tenant_count;
  END IF;
  
  RAISE NOTICE '✓ Pre-flight checks passed';
END $$;

-- ============================================================================
-- STEP 1: ENSURE TENANT_ID COLUMN EXISTS AND IS POPULATED
-- ============================================================================

DO $$
DECLARE
  col_exists BOOLEAN;
  null_count INTEGER;
BEGIN
  -- Check if tenant_id column exists
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'checkins' AND column_name = 'tenant_id'
  ) INTO col_exists;
  
  IF NOT col_exists THEN
    -- Add tenant_id column (nullable initially)
    ALTER TABLE checkins ADD COLUMN tenant_id UUID;
    RAISE NOTICE '✓ Added tenant_id column to checkins';
  ELSE
    RAISE NOTICE '  tenant_id column already exists';
  END IF;
  
  -- Always backfill NULL tenant_id values from meetings
  SELECT COUNT(*) INTO null_count
  FROM checkins
  WHERE tenant_id IS NULL;
  
  IF null_count > 0 THEN
    UPDATE checkins c
    SET tenant_id = m.tenant_id
    FROM meetings m
    WHERE c.meeting_id = m.meeting_id
      AND c.tenant_id IS NULL;
    
    RAISE NOTICE '✓ Backfilled % NULL tenant_id values from meetings', null_count;
  ELSE
    RAISE NOTICE '  No NULL tenant_id values to backfill';
  END IF;
  
  -- Check for any remaining NULLs (should be impossible after pre-checks)
  SELECT COUNT(*) INTO null_count
  FROM checkins
  WHERE tenant_id IS NULL;
  
  IF null_count > 0 THEN
    RAISE EXCEPTION 'Still found % NULL tenant_id after backfill - data integrity issue!', null_count;
  END IF;
  
  -- Make tenant_id NOT NULL
  ALTER TABLE checkins ALTER COLUMN tenant_id SET NOT NULL;
  RAISE NOTICE '✓ Set tenant_id to NOT NULL';
END $$;

-- ============================================================================
-- STEP 2: CREATE INDEX FOR PERFORMANCE
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'checkins' AND indexname = 'checkins_tenant_id_idx'
  ) THEN
    CREATE INDEX checkins_tenant_id_idx ON checkins(tenant_id);
    RAISE NOTICE '✓ Created index on tenant_id';
  ELSE
    RAISE NOTICE '  Index on tenant_id already exists';
  END IF;
END $$;

-- ============================================================================
-- STEP 3: RESTORE FOREIGN KEYS
-- ============================================================================

DO $$
BEGIN
  -- Add checkins -> participants foreign key
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'checkins_participant_id_fkey' 
    AND table_name = 'checkins'
  ) THEN
    ALTER TABLE checkins
      ADD CONSTRAINT checkins_participant_id_fkey
      FOREIGN KEY (participant_id)
      REFERENCES participants(participant_id)
      ON DELETE CASCADE;
    
    RAISE NOTICE '✓ Added checkins_participant_id_fkey';
  ELSE
    RAISE NOTICE '  checkins_participant_id_fkey already exists';
  END IF;

  -- Add checkins -> meetings foreign key
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'checkins_meeting_id_fkey' 
    AND table_name = 'checkins'
  ) THEN
    ALTER TABLE checkins
      ADD CONSTRAINT checkins_meeting_id_fkey
      FOREIGN KEY (meeting_id)
      REFERENCES meetings(meeting_id)
      ON DELETE CASCADE;
    
    RAISE NOTICE '✓ Added checkins_meeting_id_fkey';
  ELSE
    RAISE NOTICE '  checkins_meeting_id_fkey already exists';
  END IF;

  -- Add checkins -> tenants foreign key
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'checkins_tenant_id_fkey' 
    AND table_name = 'checkins'
  ) THEN
    ALTER TABLE checkins
      ADD CONSTRAINT checkins_tenant_id_fkey
      FOREIGN KEY (tenant_id)
      REFERENCES tenants(tenant_id)
      ON DELETE CASCADE;
    
    RAISE NOTICE '✓ Added checkins_tenant_id_fkey';
  ELSE
    RAISE NOTICE '  checkins_tenant_id_fkey already exists';
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE '✅ Checkins schema fix complete!';
  RAISE NOTICE '   - tenant_id column exists and populated';
  RAISE NOTICE '   - All 3 foreign keys restored';
  RAISE NOTICE '   - Index created for performance';
END $$;

COMMIT;

-- ============================================================================
-- POST-MIGRATION VERIFICATION
-- ============================================================================

DO $$
DECLARE
  col_count INTEGER;
  fk_count INTEGER;
BEGIN
  -- Verify tenant_id column exists and is NOT NULL
  SELECT COUNT(*) INTO col_count
  FROM information_schema.columns
  WHERE table_name = 'checkins' 
    AND column_name = 'tenant_id'
    AND is_nullable = 'NO';
  
  IF col_count = 0 THEN
    RAISE EXCEPTION 'Verification failed: tenant_id column missing or nullable';
  END IF;
  
  -- Verify all 3 foreign keys exist
  SELECT COUNT(*) INTO fk_count
  FROM information_schema.table_constraints
  WHERE table_name = 'checkins'
    AND constraint_type = 'FOREIGN KEY'
    AND constraint_name IN (
      'checkins_participant_id_fkey',
      'checkins_meeting_id_fkey',
      'checkins_tenant_id_fkey'
    );
  
  IF fk_count < 3 THEN
    RAISE EXCEPTION 'Verification failed: Expected 3 foreign keys, found %', fk_count;
  END IF;
  
  RAISE NOTICE '✅ Verification passed - all changes applied successfully';
END $$;

-- ============================================================================
-- POST-MIGRATION INSTRUCTIONS
-- ============================================================================

-- After running this migration in Supabase SQL Editor:
-- 1. Reload PostgREST schema cache:
--    NOTIFY pgrst, 'reload schema';
-- 
-- 2. Verify schema:
--    SELECT column_name, data_type, is_nullable 
--    FROM information_schema.columns 
--    WHERE table_name = 'checkins' ORDER BY ordinal_position;
--
-- 3. Verify foreign keys:
--    SELECT constraint_name 
--    FROM information_schema.table_constraints 
--    WHERE table_name = 'checkins' AND constraint_type = 'FOREIGN KEY';
--
-- 4. Test in frontend - PGRST200 errors should be completely gone
