#!/usr/bin/env tsx
/**
 * Database Management Tools
 * 
 * Usage:
 *   npm run db:status         - Show database connection and schema status
 *   npm run db:check-sync     - Check if local and production schemas match
 *   npm run db:migrate-manual - Show manual migration instructions
 *   npm run db:list-migrations - List all available migration files
 */

import { performHealthCheck, printHealthCheckReport } from '../server/utils/dbHealthCheck';

const REQUIRED_BUSINESS_CARD_COLUMNS = [
  'position',
  'photo_url',
  'website_url',
  'business_address',
  'facebook_url',
  'instagram_url',
  'tagline'
];
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import { createClient } from '@supabase/supabase-js';

const command = process.argv[2];
const arg1 = process.argv[3]; // Optional migration filename

async function status() {
  console.log('\n🔍 Checking database status...\n');
  const result = await performHealthCheck();
  printHealthCheckReport(result);
}

async function checkSync() {
  console.log('\n🔄 Checking schema synchronization...\n');
  const result = await performHealthCheck();
  
  console.log('='.repeat(80));
  console.log('📊 SCHEMA SYNC CHECK');
  console.log('='.repeat(80));
  
  if (!result.connections.supabase.connected) {
    console.log('\n❌ Cannot check sync: Supabase not connected');
    console.log('   Error:', result.connections.supabase.error);
    process.exit(1);
  }
  
  // Check Supabase schema
  if (result.schema.supabase.missing.length > 0) {
    console.log('\n🚨 PRODUCTION SUPABASE IS OUT OF SYNC!');
    console.log('\n📋 Missing columns on Production Supabase:');
    result.schema.supabase.missing.forEach(col => {
      console.log(`   • ${col}`);
    });
    
    console.log(`\n📊 Status: ${result.schema.supabase.columns.length}/${REQUIRED_BUSINESS_CARD_COLUMNS.length} columns present`);
    
    console.log('\n🔧 To fix this:');
    console.log('   npm run db:migrate-manual');
    console.log('\n   This will show you how to manually run the migration on Production.');
    
    process.exit(1);
  }
  
  console.log('\n✅ PRODUCTION SUPABASE IS IN SYNC!');
  console.log(`   All ${result.schema.supabase.columns.length} business card columns present`);
  
  // Also check local if connected
  if (result.connections.postgres.connected) {
    if (result.schema.postgres.missing.length > 0) {
      console.log('\n⚠️  Local PostgreSQL is out of sync:');
      result.schema.postgres.missing.forEach(col => {
        console.log(`   • Missing: ${col}`);
      });
    } else {
      console.log(`   Local PostgreSQL also in sync (${result.schema.postgres.columns.length} columns)`);
    }
  }
  
  console.log('='.repeat(80) + '\n');
}

async function migrateProd() {
  console.log('\n⚠️  Automated migrations are not supported.\n');
  console.log('Production migrations must be run manually for safety.\n');
  
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  
  if (!supabaseUrl) {
    console.error('❌ Missing SUPABASE_URL environment variable');
    process.exit(1);
  }
  
  // Extract project ref from URL
  const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
  
  if (!projectRef) {
    console.error('❌ Could not parse project reference from SUPABASE_URL');
    process.exit(1);
  }
  
  // Get all migration files
  const migrationsDir = join(process.cwd(), 'supabase/migrations');
  const allMigrations = (await readdir(migrationsDir))
    .filter(f => f.endsWith('.sql'))
    .sort();
  
  if (allMigrations.length === 0) {
    console.error('❌ No migration files found in supabase/migrations/');
    process.exit(1);
  }
  
  let migrationFile: string;
  
  // If user specified a filename, use it
  if (arg1) {
    if (!allMigrations.includes(arg1)) {
      console.error(`❌ Migration file not found: ${arg1}`);
      console.error('\n📂 Available migrations:');
      allMigrations.forEach((f, i) => console.error(`   ${i+1}. ${f}`));
      process.exit(1);
    }
    migrationFile = arg1;
    console.log(`📌 Using specified migration: ${migrationFile}\n`);
  } else {
    // No argument - show list and ask user to specify
    console.log('📂 Available migrations:\n');
    allMigrations.forEach((f, i) => {
      const isCurrent = f.includes('business_card') || f.includes('20251116_add_business_card_fields');
      console.log(`   ${i+1}. ${f}${isCurrent ? ' 🎯' : ''}`);
    });
    
    console.log(`\n   Total: ${allMigrations.length} migration files`);
    console.log('   🎯 = Business card related\n');
    
    console.log('⚠️  Please specify which migration to run:\n');
    console.log('   npm run db:migrate-manual <filename>\n');
    console.log('Example:');
    console.log('   npm run db:migrate-manual 20251116_add_business_card_fields.sql\n');
    return;
  }
  
  const migrationPath = join(migrationsDir, migrationFile);
  
  console.log('📋 Manual Migration Steps:\n');
  console.log('1️⃣  Open Supabase SQL Editor:');
  console.log(`   https://supabase.com/dashboard/project/${projectRef}/sql/new\n`);
  console.log('2️⃣  Copy SQL from migration file:');
  console.log(`   ${migrationPath}\n`);
  
  try {
    const migrationSQL = await readFile(migrationPath, 'utf-8');
    console.log('3️⃣  SQL Preview (first few lines):');
    console.log('   ' + '-'.repeat(76));
    migrationSQL.split('\n').slice(0, 8).forEach(line => {
      console.log('   ' + line);
    });
    console.log('   ' + '-'.repeat(76));
    console.log('   ... (see full file for complete SQL)\n');
  } catch (error: any) {
    console.error(`   ❌ Could not read migration file: ${error.message}\n`);
  }
  
  console.log('4️⃣  Paste and click "Run" in the SQL Editor\n');
  console.log('5️⃣  After running, verify with:');
  console.log('   npm run db:check-sync\n');
  
  console.log('💡 Why manual?');
  console.log('   - Safer: Review SQL before execution');
  console.log('   - Transparent: See exactly what changes');
  console.log('   - Rollback-friendly: Can undo via Supabase dashboard\n');
}

async function listMigrations() {
  console.log('\n📂 Available migrations:\n');
  
  const migrationsDir = join(process.cwd(), 'supabase/migrations');
  const files = await readdir(migrationsDir);
  
  const sqlFiles = files.filter(f => f.endsWith('.sql')).sort();
  
  sqlFiles.forEach((file, index) => {
    const isBusinessCard = file.includes('business_card');
    const marker = isBusinessCard ? ' 🎯' : '';
    console.log(`   ${index + 1}. ${file}${marker}`);
  });
  
  console.log(`\n   Total: ${sqlFiles.length} migration files`);
  console.log('   🎯 = Business card related\n');
}

async function main() {
  try {
    switch (command) {
      case 'status':
        await status();
        break;
      
      case 'check-sync':
        await checkSync();
        break;
      
      case 'migrate-prod':
        await migrateProd();
        break;
      
      case 'list-migrations':
        await listMigrations();
        break;
      
      default:
        console.log('\n📚 Database Management Tools\n');
        console.log('Available commands:');
        console.log('   npm run db:status          - Show database status');
        console.log('   npm run db:check-sync      - Check schema sync');
        console.log('   npm run db:migrate-manual  - Get manual migration instructions');
        console.log('   npm run db:list-migrations - List all migration files\n');
        break;
    }
  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    if (error.stack) {
      console.error('\n' + error.stack);
    }
    process.exit(1);
  }
}

main();
