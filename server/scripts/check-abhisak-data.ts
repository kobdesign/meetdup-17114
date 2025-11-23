#!/usr/bin/env tsx
/**
 * Check Abhisak's data in Supabase Production
 */

import { supabaseAdmin } from "../utils/supabaseClient";

async function checkAbhisak() {
  console.log("🔍 Checking Abhisak's data in Supabase Production...\n");
  
  const { data, error } = await supabaseAdmin
    .from("participants")
    .select("participant_id, full_name, phone, email, user_id, line_user_id, status")
    .eq("phone", "0816763221")
    .maybeSingle();
  
  if (error) {
    console.error("❌ Error:", error.message);
    return;
  }
  
  if (!data) {
    console.log("❌ No participant found with phone 0816763221");
    return;
  }
  
  console.log("✅ Found Abhisak:\n");
  console.log(JSON.stringify(data, null, 2));
  
  console.log("\n─────────────────────────────────────");
  console.log("\n📊 Analysis:");
  console.log(`   Has user_id: ${data.user_id ? '✅ YES' : '❌ NO'}`);
  console.log(`   Has line_user_id: ${data.line_user_id ? '✅ YES' : '❌ NO'}`);
  console.log(`   Status: ${data.status}`);
  
  if (data.user_id) {
    console.log("\n⚠️  PROBLEM FOUND:");
    console.log("   Abhisak already has user_id set!");
    console.log("   This is why the system says 'already registered'");
    console.log("\n✅ SOLUTION: Use reset endpoint to clear user_id, line_user_id, auth user, user_roles");
  } else {
    console.log("\n✅ No user_id - ready for activation");
  }
}

checkAbhisak().then(() => process.exit(0));
