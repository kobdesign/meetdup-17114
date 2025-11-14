-- Migration: Add 'declined' to participant_status enum
-- Date: 2025-11-14
-- Reason: Code uses 'declined' status but enum doesn't have it
-- Safe: Only adds new enum value, doesn't modify existing data

BEGIN;

-- ============================================================================
-- ADD 'declined' TO participant_status ENUM
-- ============================================================================

DO $$
BEGIN
  -- Check if 'declined' already exists in the enum
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'participant_status'
    AND e.enumlabel = 'declined'
  ) THEN
    -- Add 'declined' after 'visitor'
    ALTER TYPE participant_status ADD VALUE 'declined' AFTER 'visitor';
    
    RAISE NOTICE '✓ Added ''declined'' to participant_status enum';
  ELSE
    RAISE NOTICE '  ''declined'' already exists in participant_status enum';
  END IF;
END $$;

COMMIT;

-- ============================================================================
-- VERIFY
-- ============================================================================

DO $$
BEGIN
  -- Verify 'declined' exists
  IF EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'participant_status'
    AND e.enumlabel = 'declined'
  ) THEN
    RAISE NOTICE '✅ Verification passed - ''declined'' exists in enum';
  ELSE
    RAISE EXCEPTION 'Verification failed - ''declined'' not found in enum';
  END IF;
END $$;

-- ============================================================================
-- POST-MIGRATION NOTES
-- ============================================================================

-- After running this migration:
-- 1. Reload PostgREST schema cache:
--    NOTIFY pgrst, 'reload schema';
--
-- 2. Verify enum values:
--    SELECT enumlabel 
--    FROM pg_enum e
--    JOIN pg_type t ON e.enumtypid = t.oid
--    WHERE t.typname = 'participant_status'
--    ORDER BY enumsortorder;
--
-- Expected values: prospect, visitor, declined, member, alumni
