import { createClient } from "@supabase/supabase-js";

// Validate environment variables
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ ERROR: Missing Supabase credentials");
  console.error("   Required environment variables:");
  console.error("   - VITE_SUPABASE_URL");
  console.error("   - SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkData() {
  console.log("📊 Supabase Data Report\n");
  console.log("=".repeat(80));

  // 1. Check Tenants/Chapters
  console.log("\n1️⃣  CHAPTERS (tenants table)");
  const { data: tenants, error: tenantsError } = await supabase
    .from("tenants")
    .select("*")
    .order("created_at", { ascending: false });

  if (tenantsError) {
    console.error(`   ❌ ERROR: ${tenantsError.message}`);
    console.error(`      Code: ${tenantsError.code}`);
    console.error(`      Details: ${tenantsError.details}`);
  } else {
    console.log(`   Total: ${tenants?.length || 0}`);
    tenants?.forEach((t: any, i: number) => {
      console.log(`   ${i + 1}. ${t.tenant_name} (${t.subdomain})`);
      console.log(`      ID: ${t.tenant_id}`);
      console.log(`      Created: ${new Date(t.created_at).toLocaleString()}`);
    });
  }

  // 2. Check User Roles
  console.log("\n2️⃣  USER ROLES (user_roles table)");
  const { data: roles, error: rolesError } = await supabase
    .from("user_roles")
    .select("*")
    .order("created_at", { ascending: false });

  if (rolesError) {
    console.error(`   ❌ ERROR: ${rolesError.message}`);
  } else {
    console.log(`   Total: ${roles?.length || 0}`);
    roles?.forEach((r: any, i: number) => {
      console.log(`   ${i + 1}. User: ${r.user_id.slice(0, 8)}...`);
      console.log(`      Role: ${r.role}`);
      console.log(`      Tenant: ${r.tenant_id || "(Global Super Admin)"}`);
    });
  }

  // 3. Check Profiles
  console.log("\n3️⃣  PROFILES (profiles table)");
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("*");

  if (profilesError) {
    console.error(`   ❌ ERROR: ${profilesError.message}`);
  } else {
    console.log(`   Total: ${profiles?.length || 0}`);
    profiles?.forEach((p: any, i: number) => {
      console.log(`   ${i + 1}. ${p.full_name || "(No name)"}`);
      console.log(`      ID: ${p.id.slice(0, 8)}...`);
    });
  }

  // 4. Check Chapter Invites
  console.log("\n4️⃣  CHAPTER INVITES (chapter_invites table)");
  const { data: invites, error: invitesError } = await supabase
    .from("chapter_invites")
    .select("*")
    .order("created_at", { ascending: false });

  if (invitesError) {
    console.error(`   ❌ ERROR: ${invitesError.message}`);
  } else {
    console.log(`   Total: ${invites?.length || 0}`);
    invites?.forEach((inv: any, i: number) => {
      console.log(`   ${i + 1}. Token: ${inv.token.slice(0, 12)}...`);
      console.log(`      Tenant ID: ${inv.tenant_id.slice(0, 8)}...`);
      console.log(`      Uses: ${inv.uses_count}/${inv.max_uses}`);
      console.log(`      Expires: ${inv.expires_at ? new Date(inv.expires_at).toLocaleString() : "Never"}`);
    });
  }

  // 5. Check Join Requests
  console.log("\n5️⃣  JOIN REQUESTS (chapter_join_requests table)");
  const { data: requests, error: requestsError } = await supabase
    .from("chapter_join_requests")
    .select("*")
    .order("created_at", { ascending: false });

  if (requestsError) {
    console.error(`   ❌ ERROR: ${requestsError.message}`);
  } else {
    console.log(`   Total: ${requests?.length || 0}`);
    requests?.forEach((req: any, i: number) => {
      console.log(`   ${i + 1}. User: ${req.user_id.slice(0, 8)}...`);
      console.log(`      Status: ${req.status}`);
      console.log(`      Tenant: ${req.tenant_id.slice(0, 8)}...`);
    });
  }

  console.log("\n" + "=".repeat(80));
  console.log("✅ Data check complete!\n");
}

checkData().catch(console.error);
