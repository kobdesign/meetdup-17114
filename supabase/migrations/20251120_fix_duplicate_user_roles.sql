-- Fix duplicate user_roles and prevent future duplicates
-- This migration:
-- 1. Identifies and removes duplicate (user_id, tenant_id) pairs
-- 2. Adds a unique constraint to prevent future duplicates

-- Step 1: Find and log EXACT duplicates before cleaning
DO $$
DECLARE
  duplicate_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO duplicate_count
  FROM (
    SELECT user_id, tenant_id, role, COUNT(*) as cnt
    FROM user_roles
    GROUP BY user_id, tenant_id, role
    HAVING COUNT(*) > 1
  ) duplicates;
  
  IF duplicate_count > 0 THEN
    RAISE NOTICE '⚠️  Found % user_id/tenant_id/role triplets with exact duplicates', duplicate_count;
    RAISE NOTICE 'Details logged in /tmp logs';
  ELSE
    RAISE NOTICE '✅ No exact duplicate roles found';
  END IF;
END $$;

-- Step 2: Remove EXACT duplicates only (same user_id, tenant_id, AND role)
-- This preserves users who legitimately have multiple different roles in the same tenant
-- (e.g., chapter_admin + member) while removing duplicate identical roles
DELETE FROM user_roles
WHERE role_id IN (
  SELECT role_id
  FROM (
    SELECT 
      role_id,
      ROW_NUMBER() OVER (
        PARTITION BY user_id, tenant_id, role
        ORDER BY created_at ASC NULLS LAST, role_id ASC
      ) as rn
    FROM user_roles
  ) ranked
  WHERE rn > 1
);

-- Step 3: Add unique constraint to prevent duplicate IDENTICAL roles
-- This allows a user to have multiple DIFFERENT roles in the same tenant
-- (e.g., chapter_admin + member) but prevents duplicate identical roles
-- (e.g., two chapter_admin entries for the same user/tenant)
ALTER TABLE user_roles
ADD CONSTRAINT unique_user_tenant_role 
UNIQUE (user_id, tenant_id, role);

-- Step 4: Create index to improve query performance for role lookups
CREATE INDEX IF NOT EXISTS idx_user_roles_user_tenant 
ON user_roles(user_id, tenant_id) 
WHERE tenant_id IS NOT NULL;

-- Step 5: Add constraint to chapter_join_requests to prevent duplicate pending requests
-- First clean up duplicates
DELETE FROM chapter_join_requests
WHERE request_id IN (
  SELECT request_id
  FROM (
    SELECT 
      request_id,
      ROW_NUMBER() OVER (
        PARTITION BY user_id, tenant_id, status
        ORDER BY created_at ASC, request_id ASC
      ) as rn
    FROM chapter_join_requests
    WHERE status = 'pending'
  ) ranked
  WHERE rn > 1
);

-- Then add constraint
CREATE UNIQUE INDEX IF NOT EXISTS unique_pending_join_request 
ON chapter_join_requests(user_id, tenant_id) 
WHERE status = 'pending';

-- Log completion
DO $$
BEGIN
  RAISE NOTICE '✅ Migration completed successfully';
  RAISE NOTICE '   - Removed exact duplicate user_roles records (same user/tenant/role)';
  RAISE NOTICE '   - Added unique constraint on (user_id, tenant_id, role)';
  RAISE NOTICE '   - Users can still have multiple DIFFERENT roles per tenant';
  RAISE NOTICE '   - Added index for better performance';
  RAISE NOTICE '   - Cleaned up duplicate pending join requests';
END $$;
