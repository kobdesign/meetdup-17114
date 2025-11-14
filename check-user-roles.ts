import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkUserRoles() {
  console.log('🔍 Checking user roles...\n');

  // Get current user's ID (kobdesign@gmail.com)
  const { data: users, error: userErr } = await supabase.auth.admin.listUsers();
  
  if (userErr) {
    console.error('❌ Error fetching users:', userErr.message);
    return;
  }

  const currentUser = users.users.find(u => u.email === 'kobdesign@gmail.com');
  
  if (!currentUser) {
    console.error('❌ User kobdesign@gmail.com not found');
    return;
  }

  console.log(`✓ User found: ${currentUser.email}`);
  console.log(`  ID: ${currentUser.id}\n`);

  // Check user_roles
  const { data: roles, error: roleErr } = await supabase
    .from('user_roles')
    .select('*')
    .eq('user_id', currentUser.id);

  if (roleErr) {
    console.error('❌ Error fetching roles:', roleErr.message);
    return;
  }

  console.log(`📋 User has ${roles?.length || 0} role(s):\n`);
  
  roles?.forEach((r, i) => {
    console.log(`${i + 1}. Role: ${r.role}`);
    console.log(`   Tenant ID: ${r.tenant_id || 'NULL (Super Admin)'}`);
    console.log(`   Created: ${r.created_at}\n`);
  });

  // Check if user has access to current tenant
  const currentTenantId = 'e2f4c38c-4dd1-4f05-9866-f18ba7028dfa';
  const hasAccess = roles?.some(r => 
    r.role === 'super_admin' || r.tenant_id === currentTenantId
  );

  console.log('---');
  if (hasAccess) {
    console.log(`✓ User HAS ACCESS to tenant ${currentTenantId}`);
  } else {
    console.log(`❌ User DOES NOT HAVE ACCESS to tenant ${currentTenantId}`);
    console.log('   👉 This causes "Not authorized" error!');
    console.log('\n💡 Solution: Add role for this tenant or make user super_admin');
  }
}

checkUserRoles().catch(console.error);
