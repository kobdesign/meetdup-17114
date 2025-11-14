-- Migration: Restore foreign keys for checkins table
-- Date: 2025-11-14
-- Reason: DROP participants CASCADE destroyed foreign key relationships
--         causing PGRST200 errors in PostgREST
-- Safe: This only adds constraints back, doesn't modify data

BEGIN;

-- ============================================================================
-- RESTORE FOREIGN KEYS FOR CHECKINS TABLE
-- ============================================================================

-- Check if foreign keys already exist before adding
DO $$
BEGIN
  -- Add checkins -> participants foreign key if it doesn't exist
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

  -- Add checkins -> meetings foreign key if it doesn't exist
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

  -- Add checkins -> tenants foreign key if it doesn't exist
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
  RAISE NOTICE '✅ Foreign key restoration complete!';
END $$;

COMMIT;

-- ============================================================================
-- POST-MIGRATION INSTRUCTIONS
-- ============================================================================

-- After running this migration in Supabase SQL Editor:
-- 1. Reload PostgREST schema cache:
--    NOTIFY pgrst, 'reload schema';
-- 
-- 2. Verify foreign keys exist:
--    SELECT constraint_name, table_name 
--    FROM information_schema.table_constraints 
--    WHERE table_name = 'checkins' AND constraint_type = 'FOREIGN KEY';
--
-- 3. Test in frontend - PGRST200 errors should be gone
