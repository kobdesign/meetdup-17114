#!/usr/bin/env tsx

/**
 * Autonomous Migration Runner
 * 
 * This script executes SQL migrations against Supabase PostgreSQL directly.
 * Uses psql command to properly handle multi-statement migrations with
 * transaction control and DO blocks.
 * 
 * Usage: npm run migrate:run <migration-file>
 */

import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { resolve } from 'path';

async function runMigration(migrationFile: string) {
  const {
    PGHOST,
    PGPORT,
    PGUSER,
    PGPASSWORD,
    PGDATABASE,
  } = process.env;

  // Check for required environment variables
  if (!PGHOST || !PGPORT || !PGUSER || !PGPASSWORD || !PGDATABASE) {
    console.error('❌ Missing required PostgreSQL environment variables!');
    console.error('');
    console.error('Required variables:');
    console.error('  - PGHOST');
    console.error('  - PGPORT');
    console.error('  - PGUSER');
    console.error('  - PGPASSWORD');
    console.error('  - PGDATABASE');
    console.error('');
    console.error('Please ensure these are set in your Replit Secrets');
    process.exit(1);
  }

  console.log('🔧 PostgreSQL Migration Runner (psql)');
  console.log('📍 Target: Supabase PostgreSQL');
  console.log(`📍 Database: ${PGDATABASE}@${PGHOST}:${PGPORT}`);
  console.log('📄 Migration:', migrationFile);
  console.log('');

  // Verify migration file exists
  const migrationPath = resolve(process.cwd(), migrationFile);
  
  try {
    const migrationSql = readFileSync(migrationPath, 'utf-8');
    console.log('✓ Migration file loaded');
    console.log(`  Size: ${migrationSql.length} bytes`);
    console.log(`  Lines: ${migrationSql.split('\n').length}`);
    console.log('');
  } catch (error) {
    console.error('❌ Failed to read migration file:', error);
    process.exit(1);
  }

  try {
    console.log('🚀 Executing migration via psql...');
    console.log('');

    // Use psql to execute the migration file
    // psql properly handles multi-statement files with BEGIN/COMMIT and DO blocks
    // IMPORTANT: Pass PGPASSWORD via environment variables to avoid exposing it in process lists
    const command = `psql -h "${PGHOST}" -p "${PGPORT}" -U "${PGUSER}" -d "${PGDATABASE}" -f "${migrationPath}"`;
    
    const output = execSync(command, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        PGPASSWORD: PGPASSWORD,
      },
    });

    console.log('✅ Migration completed successfully!');
    console.log('');
    
    if (output && output.trim()) {
      console.log('📋 Migration output:');
      console.log(output);
      console.log('');
    }

  } catch (error: any) {
    console.error('');
    console.error('❌ Migration failed!');
    console.error('');
    
    if (error.stdout) {
      console.error('STDOUT:', error.stdout.toString());
    }
    if (error.stderr) {
      console.error('STDERR:', error.stderr.toString());
    }
    if (error.message) {
      console.error('Error:', error.message);
    }
    
    process.exit(1);
  }

  console.log('🎉 All done!');
  console.log('');
  console.log('📌 Post-migration steps:');
  console.log('  1. Reload PostgREST schema cache (if using Supabase)');
  console.log('     → NOTIFY pgrst, \'reload schema\';');
  console.log('  2. Restart the application workflow');
  console.log('  3. Test affected features');
  console.log('');
}

// Get migration file from command line args
const migrationFile = process.argv[2];

if (!migrationFile) {
  console.error('Usage: npm run migrate:run <migration-file>');
  console.error('Example: npm run migrate:run supabase/migrations/20251114_reconcile_schema_with_code.sql');
  process.exit(1);
}

runMigration(migrationFile);
