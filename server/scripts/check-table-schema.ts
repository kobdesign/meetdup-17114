import { supabaseAdmin } from "../utils/supabaseClient";

async function checkTableSchema() {
  console.log("🔍 Checking tenant_secrets table schema in Supabase...\n");

  try {
    const { data, error } = await supabaseAdmin
      .from("tenant_secrets")
      .select("*")
      .limit(1);

    if (error) {
      console.error("❌ Error:", error);
    } else {
      console.log("✅ Query successful!");
      console.log("\n📋 Available columns:");
      
      if (data && data.length > 0) {
        const columns = Object.keys(data[0]);
        columns.forEach(col => console.log(`   - ${col}`));
        console.log("\n📊 Sample data:");
        console.log(JSON.stringify(data[0], null, 2));
      } else {
        console.log("   Table exists but has no data yet");
        console.log("   Trying to insert a test row to see schema...");
        
        // Try to get table info from pg_catalog
        const { data: schemaData, error: schemaError } = await supabaseAdmin
          .rpc('exec_sql', { 
            sql: `
              SELECT column_name, data_type, is_nullable
              FROM information_schema.columns
              WHERE table_name = 'tenant_secrets'
              ORDER BY ordinal_position;
            `
          });
        
        if (schemaError) {
          console.log("   Could not retrieve schema info");
        } else {
          console.log("   Schema from information_schema:");
          console.log(schemaData);
        }
      }
    }

    // Also check all tables
    console.log("\n\n🗂️  All tables in database:");
    const { data: tables, error: tablesError } = await supabaseAdmin
      .rpc('exec_sql', { 
        sql: `
          SELECT table_name
          FROM information_schema.tables
          WHERE table_schema = 'public'
          ORDER BY table_name;
        `
      });
    
    if (!tablesError && tables) {
      console.log(tables);
    }

  } catch (error) {
    console.error("❌ Fatal error:", error);
  }
}

checkTableSchema();
