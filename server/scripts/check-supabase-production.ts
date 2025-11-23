#!/usr/bin/env tsx
/**
 * Verification Script: Check Supabase Production Schema & Data
 * 
 * Purpose: Verify actual database state before making assumptions
 * Usage: npx tsx server/scripts/check-supabase-production.ts [table_name]
 * 
 * CRITICAL: Always run this before claiming:
 * - A column exists or doesn't exist
 * - A migration has run or hasn't run
 * - Data state in production
 */

import { supabaseAdmin } from "../utils/supabaseClient";

const tableName = process.argv[2] || "participants";

async function checkSupabaseProduction() {
  console.log("╔═══════════════════════════════════════════════════════════╗");
  console.log("║   SUPABASE PRODUCTION VERIFICATION                        ║");
  console.log("╚═══════════════════════════════════════════════════════════╝\n");
  
  console.log(`📊 Database: ${process.env.SUPABASE_URL}`);
  console.log(`🔍 Table: ${tableName}\n`);
  console.log("─────────────────────────────────────────────────────────────\n");

  try {
    // Step 1: Try to query the table with all columns
    console.log("Step 1: Querying table to discover actual columns...\n");
    
    const { data, error } = await supabaseAdmin
      .from(tableName)
      .select("*")
      .limit(1);

    if (error) {
      console.error("❌ Error querying table:", error.message);
      console.error("\nThis could mean:");
      console.error("  - Table doesn't exist");
      console.error("  - Permission issues");
      console.error("  - Connection problems\n");
      process.exit(1);
    }

    // Step 2: Show actual columns from real data
    if (data && data.length > 0) {
      const columns = Object.keys(data[0]);
      console.log(`✅ Table exists with ${columns.length} columns:\n`);
      
      columns.forEach((col, idx) => {
        const value = data[0][col];
        const type = value === null ? "null" : typeof value;
        console.log(`   ${(idx + 1).toString().padStart(2)}. ${col.padEnd(30)} (${type})`);
      });
      
      console.log("\n📋 Sample row:");
      console.log(JSON.stringify(data[0], null, 2));
    } else {
      console.log("⚠️  Table exists but has no data yet\n");
      console.log("Attempting to get schema from information_schema...\n");
      
      // Fallback: query information_schema
      // Note: This requires RPC function or direct access
      console.log("💡 To see schema without data, check Supabase Dashboard > Table Editor");
    }

    // Step 3: Test specific columns if checking participants
    if (tableName === "participants") {
      console.log("\n─────────────────────────────────────────────────────────────");
      console.log("\n🔎 Specific Column Checks:\n");
      
      const columnsToCheck = ["user_id", "line_user_id", "phone", "email"];
      
      for (const col of columnsToCheck) {
        const { data: testData, error: testError } = await supabaseAdmin
          .from(tableName)
          .select(col)
          .limit(1);
        
        if (testError) {
          console.log(`   ❌ ${col.padEnd(20)} - DOES NOT EXIST`);
          console.log(`      Error: ${testError.message}\n`);
        } else {
          console.log(`   ✅ ${col.padEnd(20)} - EXISTS`);
        }
      }
    }

    console.log("\n─────────────────────────────────────────────────────────────");
    console.log("\n✅ Verification complete - this is the actual production state");
    console.log("─────────────────────────────────────────────────────────────\n");

  } catch (error: any) {
    console.error("❌ Fatal error:", error.message);
    console.error("\nStack trace:", error.stack);
    process.exit(1);
  }
}

checkSupabaseProduction().then(() => process.exit(0));
