import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkEnum() {
  console.log('🔍 Checking participant_status enum values...\n');

  const { data, error } = await supabase.rpc('exec_sql', {
    sql: `
      SELECT enumlabel 
      FROM pg_enum e
      JOIN pg_type t ON e.enumtypid = t.oid
      WHERE t.typname = 'participant_status'
      ORDER BY enumsortorder;
    `
  });

  if (error) {
    console.log('⚠️  Cannot use RPC, need to check manually in SQL Editor\n');
    console.log('Run this query:');
    console.log(`
      SELECT enumlabel 
      FROM pg_enum e
      JOIN pg_type t ON e.enumtypid = t.oid
      WHERE t.typname = 'participant_status'
      ORDER BY enumsortorder;
    `);
  } else {
    console.log('✓ Current enum values:');
    data?.forEach((row: any) => console.log(`  - ${row.enumlabel}`));
  }
}

checkEnum().catch(console.error);
