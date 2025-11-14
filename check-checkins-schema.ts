import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkCheckinsSchema() {
  console.log('🔍 Checking checkins table schema...\n');

  // Get table structure
  const { data, error } = await supabase
    .from('checkins')
    .select('*')
    .limit(1);

  if (error) {
    console.error('❌ Error:', error.message);
    return;
  }

  console.log('✓ Sample record from checkins:');
  console.log(JSON.stringify(data, null, 2));
  
  if (data && data.length > 0) {
    console.log('\n📋 Columns found:');
    Object.keys(data[0]).forEach(col => console.log(`  - ${col}`));
  } else {
    console.log('\n⚠️  No records in checkins table');
  }
}

checkCheckinsSchema().catch(console.error);
