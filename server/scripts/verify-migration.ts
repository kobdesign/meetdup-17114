import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function verifyMigration() {
  console.log("🔍 Verifying Supabase Migration Status\n");
  console.log(`📡 Supabase URL: ${supabaseUrl}\n`);

  try {
    // Check chapter_invites table
    console.log("1️⃣  Checking chapter_invites table...");
    const { data: invites, error: invitesError } = await supabase
      .from("chapter_invites")
      .select("invite_id")
      .limit(1);

    if (invitesError) {
      console.log(`   ❌ Table doesn't exist: ${invitesError.message}\n`);
    } else {
      console.log("   ✅ Table exists!\n");
    }

    // Check chapter_join_requests table
    console.log("2️⃣  Checking chapter_join_requests table...");
    const { data: requests, error: requestsError } = await supabase
      .from("chapter_join_requests")
      .select("request_id")
      .limit(1);

    if (requestsError) {
      console.log(`   ❌ Table doesn't exist: ${requestsError.message}\n`);
    } else {
      console.log("   ✅ Table exists!\n");
    }

    // Check tenants table (should already exist)
    console.log("3️⃣  Checking tenants table...");
    const { data: tenants, error: tenantsError } = await supabase
      .from("tenants")
      .select("tenant_id, tenant_name, subdomain")
      .limit(5);

    if (tenantsError) {
      console.log(`   ❌ Error: ${tenantsError.message}\n`);
    } else {
      console.log(`   ✅ Table exists! Found ${tenants?.length || 0} chapters\n`);
      if (tenants && tenants.length > 0) {
        console.log("   Chapters:");
        tenants.forEach((t: any) => {
          console.log(`     - ${t.tenant_name} (${t.subdomain})`);
        });
        console.log();
      }
    }

    // Summary
    console.log("=" .repeat(80));
    if (!invitesError && !requestsError) {
      console.log("✅ Migration completed successfully!");
      console.log("   All required tables exist in Supabase.");
    } else {
      console.log("❌ Migration not completed yet!");
      console.log("\n📋 Next Steps:");
      console.log("   1. Go to Supabase Dashboard:");
      console.log("      https://supabase.com/dashboard/project/sbknunooplaezvwtyooi");
      console.log("   2. Click 'SQL Editor' in the left menu");
      console.log("   3. Click 'New Query'");
      console.log("   4. Copy the SQL from:");
      console.log("      supabase/migrations/20251114_add_chapter_invites_and_join_requests.sql");
      console.log("   5. Paste and click 'Run'");
      console.log("   6. Run this script again to verify: npm run verify-migration\n");

      // Show the migration file path
      const migrationPath = path.join(
        __dirname,
        "../../supabase/migrations/20251114_add_chapter_invites_and_join_requests.sql"
      );
      console.log(`   Migration file location: ${migrationPath}`);
    }
    console.log("=" .repeat(80));
  } catch (error: any) {
    console.error("❌ Verification failed:", error.message);
    process.exit(1);
  }
}

verifyMigration();
