-- ============================================================================
-- Migration: Fix Visitor Pipeline - Add Missing Column and Enum Value
-- Date: 2025-11-16
-- Purpose: Add referred_by_participant_id column and 'declined' enum value
-- 
-- This migration combines:
-- 1. Add 'declined' to participant_status enum
-- 2. Add referred_by_participant_id column for referral tracking
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: Add 'declined' to participant_status enum (if not exists)
-- ============================================================================

DO $$
BEGIN
  -- Check if 'declined' already exists
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'participant_status'
    AND e.enumlabel = 'declined'
  ) THEN
    -- Add 'declined' value to enum
    ALTER TYPE participant_status ADD VALUE IF NOT EXISTS 'declined';
    RAISE NOTICE '✓ Added ''declined'' to participant_status enum';
  ELSE
    RAISE NOTICE '  ''declined'' already exists in participant_status enum';
  END IF;
END $$;

-- ============================================================================
-- STEP 2: Add referred_by_participant_id column (if not exists)
-- ============================================================================

DO $$
BEGIN
  -- Check if column already exists
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'participants'
    AND column_name = 'referred_by_participant_id'
  ) THEN
    -- Add column
    ALTER TABLE participants 
      ADD COLUMN referred_by_participant_id UUID;
    
    -- Add foreign key constraint
    ALTER TABLE participants
      ADD CONSTRAINT fk_participants_referred_by
      FOREIGN KEY (referred_by_participant_id)
      REFERENCES participants(participant_id)
      ON DELETE SET NULL;
    
    -- Create index for faster lookups
    CREATE INDEX participants_referred_by_idx 
      ON participants(referred_by_participant_id);
    
    -- Add comment for documentation
    COMMENT ON COLUMN participants.referred_by_participant_id 
      IS 'Member who referred this visitor/prospect to the chapter';
    
    RAISE NOTICE '✓ Added referred_by_participant_id column with FK and index';
  ELSE
    RAISE NOTICE '  referred_by_participant_id column already exists';
  END IF;
END $$;

COMMIT;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
DECLARE
  enum_exists BOOLEAN;
  column_exists BOOLEAN;
BEGIN
  -- Verify 'declined' enum value
  SELECT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'participant_status'
    AND e.enumlabel = 'declined'
  ) INTO enum_exists;
  
  -- Verify column exists
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'participants'
    AND column_name = 'referred_by_participant_id'
  ) INTO column_exists;
  
  -- Report results
  IF enum_exists AND column_exists THEN
    RAISE NOTICE '✅ VERIFICATION PASSED - All changes applied successfully';
    RAISE NOTICE '  ✓ Enum value ''declined'' exists';
    RAISE NOTICE '  ✓ Column referred_by_participant_id exists';
  ELSE
    IF NOT enum_exists THEN
      RAISE WARNING '❌ Enum value ''declined'' not found';
    END IF;
    IF NOT column_exists THEN
      RAISE WARNING '❌ Column referred_by_participant_id not found';
    END IF;
    RAISE EXCEPTION 'Verification failed - please check the migration';
  END IF;
END $$;

-- ============================================================================
-- POST-MIGRATION NOTES
-- ============================================================================

-- After running this migration:
-- 1. Verify participant_status enum values:
--    SELECT enumlabel FROM pg_enum e
--    JOIN pg_type t ON e.enumtypid = t.oid
--    WHERE t.typname = 'participant_status'
--    ORDER BY enumsortorder;
--    Expected: prospect, visitor, member, alumni, declined
--
-- 2. Verify referred_by_participant_id column:
--    SELECT column_name, data_type, is_nullable
--    FROM information_schema.columns
--    WHERE table_name = 'participants'
--    AND column_name = 'referred_by_participant_id';
--
-- 3. Test the Visitor Pipeline API:
--    - Navigate to /admin/visitors
--    - Should load without errors
--    - Referral tracking should work
