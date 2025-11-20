-- Check for EXACT duplicate user_roles records
-- These are duplicate IDENTICAL roles (same user_id, tenant_id, AND role)
-- Note: Users CAN have multiple DIFFERENT roles in the same tenant legitimately
SELECT 
  user_id, 
  tenant_id,
  role,
  COUNT(*) as duplicate_count,
  ARRAY_AGG(role_id) as role_ids,
  ARRAY_AGG(created_at) as created_dates
FROM user_roles 
GROUP BY user_id, tenant_id, role
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;

-- To clean up duplicates (RUN THIS CAREFULLY!):
-- This keeps only the first role_id for each (user_id, tenant_id) pair
-- 
-- DELETE FROM user_roles
-- WHERE role_id IN (
--   SELECT role_id
--   FROM (
--     SELECT role_id,
--            ROW_NUMBER() OVER (PARTITION BY user_id, tenant_id ORDER BY created_at ASC) as rn
--     FROM user_roles
--   ) t
--   WHERE rn > 1
-- );
