import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkForeignKeys() {
  console.log('🔍 Checking Foreign Keys in Production...\n');

  const { data, error } = await supabase.rpc('exec_sql', {
    sql: `
      SELECT 
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name,
        tc.constraint_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public'
      ORDER BY tc.table_name, kcu.column_name;
    `
  });

  if (error) {
    console.error('❌ Error:', error.message);
    
    // Try direct query instead
    console.log('\n📝 Trying direct SQL query...\n');
    const query = `
      SELECT 
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name,
        tc.constraint_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public'
      ORDER BY tc.table_name, kcu.column_name;
    `;
    console.log('SQL:', query);
    console.log('\n⚠️  Note: You need to run this SQL in Supabase SQL Editor');
    return;
  }

  console.log('✓ Found foreign keys:\n');
  if (data && data.length > 0) {
    data.forEach((fk: any) => {
      console.log(`  ${fk.table_name}.${fk.column_name} → ${fk.foreign_table_name}.${fk.foreign_column_name}`);
      console.log(`    Constraint: ${fk.constraint_name}\n`);
    });
  } else {
    console.log('  ⚠️  No foreign keys found!\n');
  }
}

checkForeignKeys().catch(console.error);
