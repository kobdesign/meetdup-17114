import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

// Supabase connection details
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ Missing Supabase credentials");
  console.error("   Required: VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

// Extract project ID from URL
const projectId = supabaseUrl!.replace('https://', '').split('.')[0];

async function displayMigrationGuide() {
  console.log("\n🔧 Supabase Production Migration Guide");
  console.log("📍 Target:", supabaseUrl);
  console.log("🆔 Project ID:", projectId, "\n");

  // Read migration file
  const migrationFile = process.argv[2] || "supabase/migrations/20251114_recreate_wide_tables.sql";
  const migrationPath = path.resolve(process.cwd(), migrationFile);
  
  console.log("📄 Migration file:", migrationFile);
  const sql = fs.readFileSync(migrationPath, "utf-8");
  console.log("📊 Size:", sql.length, "bytes\n");

  // Display instructions
  console.log("═".repeat(80));
  console.log("                    🚀 MANUAL DEPLOYMENT REQUIRED");
  console.log("═".repeat(80));
  console.log("\nℹ️  Supabase does not allow DDL execution via REST API for security.");
  console.log("   You must run this migration in the Supabase SQL Editor.\n");

  console.log("📋 STEPS TO DEPLOY:\n");
  console.log("1️⃣  Open Supabase SQL Editor:");
  console.log("   👉 https://supabase.com/dashboard/project/" + projectId + "/sql/new\n");

  console.log("2️⃣  Copy the migration SQL:");
  console.log("   • The SQL is displayed below");
  console.log("   • Or read from: " + migrationFile + "\n");

  console.log("3️⃣  Paste and Run:");
  console.log("   • Paste the SQL into the editor");
  console.log("   • Click 'Run' button");
  console.log("   • Wait for 'Success' message\n");

  console.log("4️⃣  Reload Schema Cache:");
  console.log("   • Run in SQL Editor:");
  console.log("     NOTIFY pgrst, 'reload schema';\n");

  console.log("5️⃣  Verify (optional):");
  console.log("   • Run in SQL Editor:");
  console.log("     SELECT COUNT(*) FROM information_schema.columns");
  console.log("     WHERE table_name IN ('tenant_settings', 'participants');");
  console.log("   • Expected: 25 (9 + 16)\n");

  console.log("═".repeat(80));
  console.log("                         📝 MIGRATION SQL");
  console.log("═".repeat(80));
  console.log("\n" + sql + "\n");
  console.log("═".repeat(80));

  // Try to verify current state with Supabase client
  console.log("\n🔍 Checking current database state...\n");
  
  const supabase = createClient(supabaseUrl!, supabaseServiceKey!, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  try {
    // Check if tables exist
    const { data: tenantSettings, error: tsError } = await supabase
      .from('tenant_settings')
      .select('tenant_id')
      .limit(1);

    const { data: participants, error: pError } = await supabase
      .from('participants')
      .select('participant_id')
      .limit(1);

    if (!tsError && !pError) {
      console.log("✅ tenant_settings table exists");
      console.log("✅ participants table exists");
      console.log("\n⚠️  Tables found! Migration may have already been run.");
      console.log("   Check column count to verify schema is correct.");
    } else if (tsError?.message?.includes('does not exist') || pError?.message?.includes('does not exist')) {
      console.log("ℹ️  Tables not found - migration needs to be run.");
    } else if (tsError?.message?.includes('currency') || pError?.message?.includes('nickname')) {
      console.log("⚠️  Schema mismatch detected!");
      console.log("   Error:", tsError?.message || pError?.message);
      console.log("\n   👉 This confirms you need to run the migration above!");
    } else {
      console.log("ℹ️  Could not determine current state");
      if (tsError) console.log("   tenant_settings:", tsError.message);
      if (pError) console.log("   participants:", pError.message);
    }

  } catch (err: any) {
    console.log("⚠️  Could not check database state:", err.message);
  }

  console.log("\n✨ Ready to deploy! Follow the steps above.\n");
}

displayMigrationGuide();
