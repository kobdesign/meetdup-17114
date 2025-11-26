/**
 * Script to clean up orphaned auth users
 * Usage: npx tsx server/scripts/cleanup-orphan-user.ts <email>
 * 
 * This script finds and deletes auth users that have no corresponding participant record
 * Only deletes truly orphaned users (no participant links, no roles)
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

interface AuthUser {
  id: string;
  email: string;
  created_at: string;
}

async function findUserByEmail(email: string): Promise<AuthUser | null> {
  let page = 1;
  const perPage = 1000;

  while (true) {
    console.log(`   Searching page ${page}...`);
    
    const listResult = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage
    });

    if (listResult.error) {
      console.error("Failed to list users:", listResult.error);
      return null;
    }

    const users = listResult.data?.users || [];
    
    if (users.length === 0) {
      // No more users to check
      return null;
    }

    const found = users.find((u: any) => u.email === email);
    if (found) {
      return {
        id: found.id,
        email: found.email || email,
        created_at: found.created_at
      };
    }

    // If less than perPage users returned, we've reached the end
    if (users.length < perPage) {
      return null;
    }

    page++;
  }
}

async function cleanupOrphanUser(email: string) {
  console.log(`\n🔍 Looking for auth user with email: ${email}`);

  const targetUser = await findUserByEmail(email);
  
  if (!targetUser) {
    console.log(`✅ No auth user found with email: ${email}`);
    return;
  }

  console.log(`📋 Found auth user:`);
  console.log(`   - ID: ${targetUser.id}`);
  console.log(`   - Email: ${targetUser.email}`);
  console.log(`   - Created: ${targetUser.created_at}`);

  // Check if user has any participant records
  const { data: participants } = await supabaseAdmin
    .from("participants")
    .select("participant_id, tenant_id, full_name")
    .eq("user_id", targetUser.id);

  if (participants && participants.length > 0) {
    console.log(`\n⚠️  User has linked participant records:`);
    participants.forEach(p => {
      console.log(`   - ${p.full_name} (${p.participant_id}) in tenant ${p.tenant_id}`);
    });
    console.log(`\n❌ Cannot delete - user has active participant links`);
    console.log(`   Use the admin UI to delete the participant first.`);
    return;
  }

  // Check if user has any roles
  const { data: roles } = await supabaseAdmin
    .from("user_roles")
    .select("role_id, role, tenant_id")
    .eq("user_id", targetUser.id);

  if (roles && roles.length > 0) {
    console.log(`\n⚠️  User has active roles:`);
    roles.forEach(r => {
      console.log(`   - ${r.role} in tenant ${r.tenant_id || 'global'}`);
    });
    console.log(`\n❌ Cannot delete - user has active roles.`);
    console.log(`   To clean up, first delete user_roles manually or use the admin UI.`);
    return;
  }

  // User is truly orphaned - safe to delete
  console.log(`\n✅ User is orphaned (no participants, no roles)`);
  console.log(`\n🗑️  Deleting auth user...`);
  const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(targetUser.id);

  if (deleteError) {
    console.error(`❌ Failed to delete auth user:`, deleteError);
    return;
  }

  console.log(`✅ Successfully deleted auth user: ${email}`);
  console.log(`\n🎉 Cleanup complete! User can now register again with this email.`);
}

// Get email from command line
const email = process.argv[2];

if (!email) {
  console.log("Usage: npx tsx server/scripts/cleanup-orphan-user.ts <email>");
  console.log("Example: npx tsx server/scripts/cleanup-orphan-user.ts user@example.com");
  process.exit(1);
}

cleanupOrphanUser(email).catch(console.error);
