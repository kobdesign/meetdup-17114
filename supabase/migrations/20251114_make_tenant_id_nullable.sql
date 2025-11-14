-- Migration: Make tenant_id nullable for Super Admin support
-- Created: 2025-11-14
-- Purpose: Restructure user_roles to support global Super Admin (tenant_id = NULL)
--
-- This enables:
-- - Global Super Admin accounts (tenant_id = NULL)
-- - Chapter Admin accounts (tenant_id = specific chapter)
-- - Regular Member accounts (tenant_id = specific chapter)
--
-- CRITICAL: Must follow exact order to avoid constraint violations

-- ============================================
-- Step 1: Add serial ID column as new primary key
-- ============================================

-- Add id column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_roles' AND column_name = 'id'
  ) THEN
    ALTER TABLE user_roles ADD COLUMN id serial;
    RAISE NOTICE 'Added id column';
  ELSE
    RAISE NOTICE 'id column already exists, skipping';
  END IF;
END $$;

-- ============================================
-- Step 2: Drop old composite primary key
-- ============================================

-- This must happen BEFORE we can make tenant_id nullable
ALTER TABLE user_roles DROP CONSTRAINT IF EXISTS user_roles_pkey;

COMMENT ON TABLE user_roles IS 
  'Dropped composite primary key (user_id, tenant_id). Will use serial id instead.';

-- ============================================
-- Step 3: Add new primary key using id column
-- ============================================

-- Only add if not already exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'user_roles_pkey' 
      AND conrelid = 'user_roles'::regclass
  ) THEN
    ALTER TABLE user_roles ADD PRIMARY KEY (id);
    RAISE NOTICE 'Added primary key on id column';
  ELSE
    RAISE NOTICE 'Primary key already exists, skipping';
  END IF;
END $$;

-- ============================================
-- Step 4: NOW we can safely modify tenant_id
-- ============================================

-- Drop NOT NULL constraint (now that it's not part of PK)
ALTER TABLE user_roles ALTER COLUMN tenant_id DROP NOT NULL;

COMMENT ON COLUMN user_roles.tenant_id IS 
  'Tenant (chapter) ID. NULL for super_admin role, specific tenant_id for chapter_admin and member roles.';

-- ============================================
-- Step 5: Add unique constraints for data integrity
-- ============================================

-- Prevent duplicate (user_id, tenant_id) pairs for chapter roles
-- This replaces the old composite primary key functionality
DROP INDEX IF EXISTS user_roles_user_tenant_unique;
CREATE UNIQUE INDEX user_roles_user_tenant_unique 
  ON user_roles (user_id, tenant_id) 
  WHERE tenant_id IS NOT NULL;

COMMENT ON INDEX user_roles_user_tenant_unique IS
  'Ensures one role per user per tenant (for chapter_admin and member roles)';

-- Prevent duplicate super_admin roles for same user
DROP INDEX IF EXISTS user_roles_super_admin_unique;
CREATE UNIQUE INDEX user_roles_super_admin_unique 
  ON user_roles (user_id) 
  WHERE tenant_id IS NULL;

COMMENT ON INDEX user_roles_super_admin_unique IS
  'Ensures only one super_admin role per user';

-- ============================================
-- Step 6: Add check constraint for role validation
-- ============================================

-- Ensure super_admin role always has NULL tenant_id
-- and other roles always have a tenant_id
ALTER TABLE user_roles DROP CONSTRAINT IF EXISTS check_super_admin_null_tenant;

ALTER TABLE user_roles 
  ADD CONSTRAINT check_super_admin_null_tenant 
  CHECK (
    (role = 'super_admin' AND tenant_id IS NULL) OR
    (role != 'super_admin' AND tenant_id IS NOT NULL)
  );

COMMENT ON CONSTRAINT check_super_admin_null_tenant ON user_roles IS
  'Ensures super_admin role always has tenant_id = NULL, and other roles always have a tenant_id';

-- ============================================
-- Verification Queries
-- ============================================

-- Show table structure
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'user_roles' 
ORDER BY ordinal_position;

-- Show constraints
SELECT 
  conname as constraint_name,
  contype as constraint_type,
  pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid = 'user_roles'::regclass
ORDER BY conname;

-- Show indexes
SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'user_roles'
ORDER BY indexname;

-- Show sample data
SELECT 
  id,
  user_id,
  tenant_id,
  role,
  CASE 
    WHEN tenant_id IS NULL THEN 'SUPER ADMIN 🌟'
    ELSE 'Chapter: ' || tenant_id::text
  END as scope
FROM user_roles
ORDER BY id;

-- ============================================
-- Migration Summary
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Migration completed successfully!';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Changes made:';
  RAISE NOTICE '  1. Added serial id column as primary key';
  RAISE NOTICE '  2. Removed composite PK (user_id, tenant_id)';
  RAISE NOTICE '  3. Made tenant_id nullable';
  RAISE NOTICE '  4. Added unique indexes for data integrity';
  RAISE NOTICE '  5. Added check constraint for role validation';
  RAISE NOTICE '';
  RAISE NOTICE 'You can now:';
  RAISE NOTICE '  - Run: npm run set-super-admin';
  RAISE NOTICE '  - Assign users as super_admin with tenant_id = NULL';
  RAISE NOTICE '';
END $$;

-- Final table comment
COMMENT ON TABLE user_roles IS 
  'User roles table. Supports multi-tenant chapter admins/members and global super admins. Super admins have tenant_id = NULL. Uses serial id as PK.';
