-- Script to clear all members except Super Admins from each tenant
-- WARNING: This will delete participant and user_role data (except Super Admins)
-- Make sure to backup your data before running this script!

-- Step 1: Show current stats before deletion
SELECT 
  t.tenant_name,
  COUNT(DISTINCT p.participant_id) as total_participants,
  COUNT(DISTINCT CASE WHEN ur.role = 'super_admin' THEN ur.user_id END) as super_admins,
  COUNT(DISTINCT CASE WHEN ur.role != 'super_admin' OR ur.role IS NULL THEN p.participant_id END) as members_to_delete
FROM tenants t
LEFT JOIN participants p ON p.tenant_id = t.tenant_id
LEFT JOIN user_roles ur ON ur.tenant_id = t.tenant_id AND ur.user_id = p.user_id
GROUP BY t.tenant_id, t.tenant_name
ORDER BY t.tenant_name;

-- Step 2: Delete user_roles that are NOT super_admin
DELETE FROM user_roles
WHERE role != 'super_admin'
RETURNING tenant_id, user_id, role;

-- Step 3: Delete participants that are NOT linked to a Super Admin
-- (Keep participants whose user_id has super_admin role in that tenant)
DELETE FROM participants p
WHERE NOT EXISTS (
  SELECT 1 
  FROM user_roles ur 
  WHERE ur.user_id = p.user_id 
    AND ur.tenant_id = p.tenant_id 
    AND ur.role = 'super_admin'
)
RETURNING participant_id, tenant_id, full_name, user_id;

-- Step 4: Show final stats after deletion
SELECT 
  t.tenant_name,
  COUNT(DISTINCT p.participant_id) as remaining_participants,
  COUNT(DISTINCT ur.user_id) as remaining_super_admins
FROM tenants t
LEFT JOIN participants p ON p.tenant_id = t.tenant_id
LEFT JOIN user_roles ur ON ur.tenant_id = t.tenant_id AND ur.role = 'super_admin'
GROUP BY t.tenant_id, t.tenant_name
ORDER BY t.tenant_name;
