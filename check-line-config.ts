import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkLineConfig() {
  console.log('🔍 Checking LINE configuration...\n');

  const tenantId = 'e2f4c38c-4dd1-4f05-9866-f18ba7028dfa';

  // 1. Check tenant_secrets structure
  console.log('1️⃣ Checking tenant_secrets table...');
  const { data: secrets, error: secretsErr } = await supabase
    .from('tenant_secrets')
    .select('*')
    .eq('tenant_id', tenantId);

  if (secretsErr) {
    console.error('❌ Error:', secretsErr.message);
  } else {
    console.log(`✓ Found ${secrets?.length || 0} secret records`);
    if (secrets && secrets.length > 0) {
      secrets.forEach(s => {
        console.log(`  - Secret type: ${s.secret_type}`);
        console.log(`    Encrypted: ${s.encrypted_value ? 'Yes (hidden)' : 'No'}`);
      });
    }
  }

  // 2. Check if LINE secrets exist
  console.log('\n2️⃣ Checking LINE-specific secrets...');
  const { data: lineSecrets, error: lineErr } = await supabase
    .from('tenant_secrets')
    .select('secret_type, created_at')
    .eq('tenant_id', tenantId)
    .in('secret_type', ['line_channel_access_token', 'line_channel_secret']);

  if (lineErr) {
    console.error('❌ Error:', lineErr.message);
  } else {
    if (lineSecrets && lineSecrets.length > 0) {
      console.log('✓ LINE secrets found:');
      lineSecrets.forEach(s => console.log(`  - ${s.secret_type}`));
    } else {
      console.log('⚠️  No LINE secrets found - this causes "LINE not configured" error');
    }
  }

  console.log('\n3️⃣ Recommended fix:');
  console.log('- Add UI to save LINE credentials (Channel Access Token & Secret)');
  console.log('- Or manually insert test data to tenant_secrets table');
}

checkLineConfig().catch(console.error);
