import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

// Load environment variables
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ Missing Supabase credentials");
  process.exit(1);
}

// Create Supabase admin client
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function runMigration() {
  try {
    console.log("🚀 Running Supabase migration...\n");

    // Read migration file (from workspace root, not server/scripts)
    const migrationPath = path.join(
      __dirname,
      "../../supabase/migrations/20251114_add_chapter_invites_and_join_requests.sql"
    );
    const sqlContent = fs.readFileSync(migrationPath, "utf-8");

    // Split SQL into individual statements (rough split by semicolons)
    const statements = sqlContent
      .split(";")
      .map((s) => s.trim())
      .filter(
        (s) =>
          s.length > 0 &&
          !s.startsWith("--") &&
          s !== "Success!" &&
          !s.match(/^[\s\n\r]*$/)
      );

    console.log(`📝 Found ${statements.length} SQL statements to execute\n`);

    // Execute each statement using Supabase REST API
    // Note: Supabase client doesn't support raw SQL execution directly
    // We need to use the postgres connection or REST API

    console.log("⚠️  Important Note:");
    console.log("   The Supabase JavaScript client doesn't support DDL operations.");
    console.log("   You need to run this migration manually in Supabase Dashboard.\n");
    console.log("📋 Steps:");
    console.log("   1. Go to: https://supabase.com/dashboard/project/sbknunooplaezvwtyooi");
    console.log("   2. Navigate to: SQL Editor");
    console.log("   3. Create a new query");
    console.log("   4. Paste the content from:");
    console.log(`      ${migrationPath}`);
    console.log("   5. Click 'Run'\n");

    // Alternative: Show the SQL content for quick copy
    console.log("💡 Or copy this SQL directly:\n");
    console.log("=" .repeat(80));
    console.log(sqlContent);
    console.log("=".repeat(80));

    // Test if tables exist (will fail if migration hasn't run)
    console.log("\n🔍 Checking if tables exist...");
    const { data: invites, error: invitesError } = await supabase
      .from("chapter_invites")
      .select("invite_id")
      .limit(1);

    const { data: requests, error: requestsError } = await supabase
      .from("chapter_join_requests")
      .select("request_id")
      .limit(1);

    if (!invitesError && !requestsError) {
      console.log("✅ Tables exist! Migration already completed.");
    } else {
      console.log("❌ Tables don't exist yet. Please run the migration manually.");
      console.log(`   Invite error: ${invitesError?.message}`);
      console.log(`   Request error: ${requestsError?.message}`);
    }
  } catch (error: any) {
    console.error("❌ Migration failed:", error.message);
    process.exit(1);
  }
}

runMigration();
