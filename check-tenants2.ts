import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkTenants() {
  console.log('🔍 Checking all tenants in production...\n');

  const { data: tenants, error } = await supabase
    .from('tenants')
    .select('*');

  if (error) {
    console.error('❌ Error:', error.message);
    return;
  }

  console.log(`✓ Found ${tenants?.length || 0} tenants:\n`);
  
  tenants?.forEach((t, i) => {
    console.log(`${i + 1}. ${t.tenant_name}`);
    console.log(`   ID: ${t.tenant_id}`);
    console.log(`   Subdomain: ${t.subdomain || 'N/A'}`);
    console.log(`   Created: ${t.created_at || 'N/A'}\n`);
  });

  // Check the problematic tenant_id
  const problematicId = 'e2f4c38c-4dd1-4f05-9866-f18ba7028dfa';
  const correctId = '7bf383e7-e3f5-43ff-87a6-cc0c341fc7f2';
  
  const problemExists = tenants?.find(t => t.tenant_id === problematicId);
  const correctExists = tenants?.find(t => t.tenant_id === correctId);
  
  console.log('---');
  if (problemExists) {
    console.log(`✓ Problematic tenant ${problematicId} EXISTS`);
  } else {
    console.log(`❌ Problematic tenant ${problematicId} NOT FOUND`);
    console.log('   👉 This is why "Not authorized" error!');
  }
  
  if (correctExists) {
    console.log(`✓ Correct tenant ${correctId} EXISTS (${correctExists.tenant_name})`);
    console.log('   👉 User should select this tenant instead');
  }
}

checkTenants().catch(console.error);
