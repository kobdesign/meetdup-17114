-- Query to check Super Admins in each tenant
-- Run this BEFORE clearing members to verify who will be kept

SELECT 
  t.tenant_name,
  t.tenant_id,
  p.full_name,
  p.phone,
  p.email,
  ur.role,
  CASE 
    WHEN ur.role = 'super_admin' THEN '✅ WILL BE KEPT'
    ELSE '❌ WILL BE DELETED'
  END as status
FROM tenants t
LEFT JOIN user_roles ur ON ur.tenant_id = t.tenant_id
LEFT JOIN participants p ON p.user_id = ur.user_id AND p.tenant_id = t.tenant_id
ORDER BY t.tenant_name, ur.role DESC, p.full_name;

-- Summary by tenant
SELECT 
  t.tenant_name,
  COUNT(DISTINCT CASE WHEN ur.role = 'super_admin' THEN ur.user_id END) as super_admins,
  COUNT(DISTINCT CASE WHEN ur.role = 'chapter_admin' THEN ur.user_id END) as chapter_admins,
  COUNT(DISTINCT CASE WHEN ur.role = 'member' THEN ur.user_id END) as members,
  COUNT(DISTINCT p.participant_id) as total_participants
FROM tenants t
LEFT JOIN participants p ON p.tenant_id = t.tenant_id
LEFT JOIN user_roles ur ON ur.tenant_id = t.tenant_id AND ur.user_id = p.user_id
GROUP BY t.tenant_id, t.tenant_name
ORDER BY t.tenant_name;
