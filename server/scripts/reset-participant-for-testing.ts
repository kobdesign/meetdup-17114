#!/usr/bin/env tsx
/**
 * Reset Participant for Testing
 * 
 * Clears all activation-related data for a participant to allow re-testing:
 * - Deletes Supabase auth user
 * - Deletes user_roles entries
 * - Clears user_id and line_user_id from participants
 * - Deletes all activation tokens
 * 
 * Usage: npx tsx server/scripts/reset-participant-for-testing.ts <phone_number>
 * Example: npx tsx server/scripts/reset-participant-for-testing.ts 0816763221
 */

import { supabaseAdmin } from "../utils/supabaseClient";

const phone = process.argv[2];

if (!phone) {
  console.error("❌ Error: Phone number is required");
  console.log("\nUsage: npx tsx server/scripts/reset-participant-for-testing.ts <phone_number>");
  console.log("Example: npx tsx server/scripts/reset-participant-for-testing.ts 0816763221\n");
  process.exit(1);
}

async function resetParticipant() {
  console.log("╔═══════════════════════════════════════════════════════════╗");
  console.log("║   RESET PARTICIPANT FOR TESTING                           ║");
  console.log("╚═══════════════════════════════════════════════════════════╝\n");
  
  console.log(`📱 Phone: ${phone}`);
  console.log(`🗄️  Database: ${process.env.SUPABASE_URL}\n`);
  console.log("─────────────────────────────────────────────────────────────\n");

  try {
    // Step 1: Find participant
    console.log("Step 1: Finding participant...\n");
    
    const { data: participant, error: findError } = await supabaseAdmin
      .from("participants")
      .select("participant_id, full_name, phone, user_id, line_user_id, tenant_id, email")
      .eq("phone", phone)
      .maybeSingle();

    if (findError) {
      console.error("❌ Database error:", findError.message);
      process.exit(1);
    }

    if (!participant) {
      console.log("❌ No participant found with this phone number");
      process.exit(1);
    }

    console.log("✅ Found participant:");
    console.log(`   Name: ${participant.full_name}`);
    console.log(`   Email: ${participant.email || 'N/A'}`);
    console.log(`   User ID: ${participant.user_id || 'N/A'}`);
    console.log(`   LINE User ID: ${participant.line_user_id ? 'Linked' : 'Not linked'}`);
    console.log();

    // Step 2: Delete auth user if exists
    if (participant.user_id) {
      console.log("Step 2: Deleting Supabase auth user...\n");
      
      // Delete user_roles first
      const { error: roleDeleteError } = await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", participant.user_id);

      if (roleDeleteError) {
        console.log(`   ⚠️  Warning: Could not delete user_roles: ${roleDeleteError.message}`);
      } else {
        console.log("   ✅ Deleted user_roles");
      }

      // Delete auth user
      const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(
        participant.user_id
      );

      if (authDeleteError) {
        console.log(`   ⚠️  Warning: Could not delete auth user: ${authDeleteError.message}`);
      } else {
        console.log("   ✅ Deleted auth user");
      }
      console.log();
    } else {
      console.log("Step 2: No auth user to delete\n");
    }

    // Step 3: Clear participant links
    console.log("Step 3: Clearing participant links...\n");
    
    const { error: updateError } = await supabaseAdmin
      .from("participants")
      .update({ 
        user_id: null,
        line_user_id: null
      })
      .eq("participant_id", participant.participant_id);

    if (updateError) {
      console.error(`   ❌ Error: ${updateError.message}`);
      process.exit(1);
    }
    
    console.log("   ✅ Cleared user_id and line_user_id");
    console.log();

    // Step 4: Delete activation tokens
    console.log("Step 4: Deleting activation tokens...\n");
    
    const { error: deleteTokenError } = await supabaseAdmin
      .from("activation_tokens")
      .delete()
      .eq("participant_id", participant.participant_id);

    if (deleteTokenError) {
      console.log(`   ⚠️  Warning: Could not delete tokens: ${deleteTokenError.message}`);
    } else {
      console.log("   ✅ Deleted all activation tokens");
    }
    console.log();

    // Summary
    console.log("─────────────────────────────────────────────────────────────");
    console.log("\n✅ RESET COMPLETE");
    console.log("\nParticipant is now ready for re-testing:");
    console.log("   ✅ Auth user deleted");
    console.log("   ✅ User roles deleted");
    console.log("   ✅ User ID cleared");
    console.log("   ✅ LINE User ID cleared");
    console.log("   ✅ Activation tokens deleted");
    console.log("\n🧪 You can now test the activation flow again!");
    console.log("─────────────────────────────────────────────────────────────\n");

  } catch (error: any) {
    console.error("❌ Fatal error:", error.message);
    console.error("\nStack trace:", error.stack);
    process.exit(1);
  }
}

resetParticipant().then(() => process.exit(0));
