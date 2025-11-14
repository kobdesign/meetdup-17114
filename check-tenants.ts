import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkTenants() {
  console.log('🔍 Checking all tenants in production...\n');

  const { data: tenants, error } = await supabase
    .from('tenants')
    .select('tenant_id, tenant_name, subdomain, status, created_at');

  if (error) {
    console.error('❌ Error:', error.message);
    return;
  }

  console.log(`✓ Found ${tenants?.length || 0} tenants:\n`);
  
  tenants?.forEach((t, i) => {
    console.log(`${i + 1}. ${t.tenant_name}`);
    console.log(`   ID: ${t.tenant_id}`);
    console.log(`   Subdomain: ${t.subdomain}`);
    console.log(`   Status: ${t.status}`);
    console.log(`   Created: ${t.created_at}\n`);
  });

  // Check the problematic tenant_id
  const problematicId = 'e2f4c38c-4dd1-4f05-9866-f18ba7028dfa';
  const exists = tenants?.find(t => t.tenant_id === problematicId);
  
  if (exists) {
    console.log(`✓ Tenant ${problematicId} EXISTS`);
  } else {
    console.log(`❌ Tenant ${problematicId} DOES NOT EXIST`);
    console.log('   This is why you got "Not authorized" error!');
  }
}

checkTenants().catch(console.error);
