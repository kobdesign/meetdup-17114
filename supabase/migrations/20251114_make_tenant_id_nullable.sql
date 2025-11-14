-- Migration: Make tenant_id nullable for Super Admin support
-- Created: 2025-11-14
-- Purpose: Allow user_roles.tenant_id to be NULL for super_admin role
--
-- This enables:
-- - Global Super Admin accounts (tenant_id = NULL)
-- - Chapter Admin accounts (tenant_id = specific chapter)
-- - Regular Member accounts (tenant_id = specific chapter)

-- ============================================
-- Step 1: Modify tenant_id to allow NULL
-- ============================================

ALTER TABLE user_roles 
  ALTER COLUMN tenant_id DROP NOT NULL;

COMMENT ON COLUMN user_roles.tenant_id IS 
  'Tenant (chapter) ID. NULL for super_admin role, specific tenant_id for chapter_admin and member roles.';

-- ============================================
-- Step 2: Drop existing unique constraint (if exists)
-- ============================================

-- Drop old composite primary key (user_id, tenant_id) if it exists
ALTER TABLE user_roles DROP CONSTRAINT IF EXISTS user_roles_pkey;

-- ============================================
-- Step 3: Add new unique constraints
-- ============================================

-- Prevent duplicate (user_id, tenant_id) pairs for chapter roles
CREATE UNIQUE INDEX IF NOT EXISTS user_roles_user_tenant_unique 
  ON user_roles (user_id, tenant_id) 
  WHERE tenant_id IS NOT NULL;

-- Prevent duplicate super_admin roles for same user
CREATE UNIQUE INDEX IF NOT EXISTS user_roles_super_admin_unique 
  ON user_roles (user_id) 
  WHERE tenant_id IS NULL;

-- ============================================
-- Step 4: Add check constraint
-- ============================================

-- Ensure super_admin role always has NULL tenant_id
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

-- Show modified column
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'user_roles' 
  AND column_name = 'tenant_id';

-- Show constraints
SELECT 
  conname as constraint_name,
  contype as constraint_type,
  pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid = 'user_roles'::regclass;

-- Show indexes
SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'user_roles'
ORDER BY indexname;

-- Migration completed successfully!
COMMENT ON TABLE user_roles IS 
  'User roles table. Supports multi-tenant chapter admins/members and global super admins. Super admins have tenant_id = NULL.';
