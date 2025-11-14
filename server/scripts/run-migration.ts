#!/usr/bin/env tsx

/**
 * Autonomous Migration Runner
 * 
 * This script executes SQL migrations against Supabase PostgreSQL directly.
 * It reads migration files and executes them using a PostgreSQL client.
 * 
 * Usage: npm run migrate:run <migration-file>
 */

import pg from 'pg';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const { Client } = pg;

async function runMigration(migrationFile: string) {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error('❌ Missing required environment variable: DATABASE_URL');
    console.error('');
    console.error('Please set DATABASE_URL in your Replit Secrets or .env file');
    console.error('Format: postgresql://postgres:[password]@[host]/postgres');
    process.exit(1);
  }

  console.log('🔧 PostgreSQL Migration Runner');
  console.log('📍 Target: Supabase PostgreSQL');
  console.log('📄 Migration:', migrationFile);
  console.log('');

  // Read migration file
  const migrationPath = resolve(process.cwd(), migrationFile);
  let migrationSql: string;
  
  try {
    migrationSql = readFileSync(migrationPath, 'utf-8');
    console.log('✓ Migration file loaded');
    console.log(`  Size: ${migrationSql.length} bytes`);
    console.log('');
  } catch (error) {
    console.error('❌ Failed to read migration file:', error);
    process.exit(1);
  }

  // Create PostgreSQL client
  const client = new Client({
    connectionString: databaseUrl,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    console.log('🔌 Connecting to database...');
    await client.connect();
    console.log('✓ Connected');
    console.log('');

    console.log('🚀 Executing migration...');
    console.log('');

    // Execute the entire migration SQL
    // The migration file is wrapped in BEGIN/COMMIT, so it's transactional
    const result = await client.query(migrationSql);
    
    console.log('✅ Migration completed successfully!');
    console.log('');
    
    // Show any notices from the migration
    if (client['_ending']) {
      console.log('Connection is ending...');
    }

  } catch (error: any) {
    console.error('');
    console.error('❌ Migration failed!');
    console.error('Error:', error.message || error);
    
    if (error.detail) {
      console.error('Detail:', error.detail);
    }
    if (error.hint) {
      console.error('Hint:', error.hint);
    }
    if (error.where) {
      console.error('Where:', error.where);
    }
    
    process.exit(1);
  } finally {
    await client.end();
    console.log('🔌 Database connection closed');
  }

  console.log('');
  console.log('🎉 All done!');
  console.log('');
  console.log('Next steps:');
  console.log('  1. Restart the application workflow');
  console.log('  2. Test tenant creation via AddTenantDialog');
  console.log('  3. Verify Settings page works correctly');
}

// Get migration file from command line args
const migrationFile = process.argv[2];

if (!migrationFile) {
  console.error('Usage: npm run migrate:run <migration-file>');
  console.error('Example: npm run migrate:run supabase/migrations/20251114_reconcile_schema_with_code.sql');
  process.exit(1);
}

runMigration(migrationFile);
