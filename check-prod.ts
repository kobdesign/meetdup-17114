import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkProduction() {
  console.log('\n🔍 Production Supabase Check\n');
  console.log('URL:', supabaseUrl, '\n');

  // 1. Check tenants
  console.log('1️⃣ Checking tenants...');
  const { data: tenants, error: tenantsErr } = await supabase
    .from('tenants')
    .select('tenant_id, tenant_name, subdomain');
  
  if (tenantsErr) {
    console.error('❌ Tenants error:', tenantsErr.message);
  } else {
    console.log(`✓ Found ${tenants?.length || 0} tenants`);
    tenants?.forEach(t => console.log(`  - ${t.tenant_name} (${t.tenant_id})`));
  }

  // 2. Check tenant_settings
  console.log('\n2️⃣ Checking tenant_settings...');
  const { data: settings, error: settingsErr } = await supabase
    .from('tenant_settings')
    .select('*');
  
  if (settingsErr) {
    console.error('❌ Settings error:', settingsErr.message);
  } else {
    console.log(`✓ Found ${settings?.length || 0} settings records`);
    if (settings && settings.length > 0) {
      settings.forEach(s => console.log(`  - tenant_id: ${s.tenant_id}, currency: ${s.currency}`));
    }
  }

  // 3. Check participants  
  console.log('\n3️⃣ Checking participants...');
  const { data: participants, error: pErr } = await supabase
    .from('participants')
    .select('participant_id, full_name, tenant_id')
    .limit(5);
  
  if (pErr) {
    console.error('❌ Participants error:', pErr.message);
  } else {
    console.log(`✓ Found participants (showing first 5)`);
    participants?.forEach(p => console.log(`  - ${p.full_name} (tenant: ${p.tenant_id})`));
  }

  // 4. Check for missing tenant_settings
  console.log('\n4️⃣ Checking for missing tenant_settings...');
  if (tenants && tenants.length > 0) {
    for (const tenant of tenants) {
      const hasSettings = settings?.find(s => s.tenant_id === tenant.tenant_id);
      if (!hasSettings) {
        console.log(`⚠️  MISSING: ${tenant.tenant_name} (${tenant.tenant_id}) needs tenant_settings!`);
      } else {
        console.log(`✓ ${tenant.tenant_name} has settings`);
      }
    }
  }
}

checkProduction().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
