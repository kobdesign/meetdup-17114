import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkSchema() {
  console.log('🔍 Checking tenant_secrets table schema...\n');

  // Try to select all columns to see what exists
  const { data, error } = await supabase
    .from('tenant_secrets')
    .select('*')
    .limit(0);

  if (error) {
    console.error('❌ Error:', error.message);
    console.log('\n💡 Run this in Supabase SQL Editor to see columns:');
    console.log('   SELECT column_name, data_type, is_nullable');
    console.log('   FROM information_schema.columns');
    console.log('   WHERE table_name = \'tenant_secrets\';');
  } else {
    console.log('✓ Table exists (but might be empty)');
    console.log('  Columns check needed via SQL Editor');
  }
}

checkSchema().catch(console.error);
