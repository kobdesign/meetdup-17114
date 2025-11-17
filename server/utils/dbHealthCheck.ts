import { createClient } from "@supabase/supabase-js";
import pg from "pg";

const { Client } = pg;

interface HealthCheckResult {
  environment: {
    supabaseUrl: string | null;
    hasSupabaseServiceKey: boolean;
    hasDatabaseUrl: boolean;
    databaseHost: string | null;
  };
  connections: {
    supabase: {
      connected: boolean;
      error?: string;
      projectRef?: string;
    };
    postgres: {
      connected: boolean;
      error?: string;
      database?: string;
    };
  };
  schema: {
    supabase: {
      columns: string[];
      missing: string[];
      isInSync: boolean;
      totalColumns?: number;
    };
    postgres: {
      columns: string[];
      missing: string[];
      isInSync: boolean;
      totalColumns?: number;
    };
  };
}

const REQUIRED_BUSINESS_CARD_COLUMNS = [
  'position',
  'photo_url',
  'website_url',
  'business_address',
  'facebook_url',
  'instagram_url',
  'tagline'
];

export async function performHealthCheck(): Promise<HealthCheckResult> {
  const result: HealthCheckResult = {
    environment: {
      supabaseUrl: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || null,
      hasSupabaseServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      hasDatabaseUrl: !!process.env.DATABASE_URL,
      databaseHost: null
    },
    connections: {
      supabase: {
        connected: false
      },
      postgres: {
        connected: false
      }
    },
    schema: {
      supabase: {
        columns: [],
        missing: [],
        isInSync: false
      },
      postgres: {
        columns: [],
        missing: [],
        isInSync: false
      }
    }
  };

  // Check Supabase connection
  if (result.environment.supabaseUrl && result.environment.hasSupabaseServiceKey) {
    try {
      const supabase = createClient(
        result.environment.supabaseUrl,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false
          }
        }
      );

      // Extract project ref from URL
      const match = result.environment.supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/);
      if (match) {
        result.connections.supabase.projectRef = match[1];
      }

      // Test query to check participants table columns
      const { data, error } = await supabase
        .from('participants')
        .select('*')
        .limit(0);

      if (error) {
        result.connections.supabase.connected = false;
        result.connections.supabase.error = error.message;
      } else {
        result.connections.supabase.connected = true;
        
        // Check Supabase schema using information_schema query
        // This is more reliable than SELECT column approach
        const { data: schemaData, error: schemaError } = await supabase
          .from('information_schema.columns' as any)
          .select('column_name')
          .eq('table_name', 'participants')
          .eq('table_schema', 'public');
        
        if (schemaError) {
          // Fallback: Try direct pg client connection to Supabase
          console.warn('   ⚠️  Could not query information_schema, falling back to column test');
          
          const foundColumns: string[] = [];
          for (const col of REQUIRED_BUSINESS_CARD_COLUMNS) {
            const { error: colError } = await supabase
              .from('participants')
              .select(col)
              .limit(0);
            
            // Only count as found if no error
            if (!colError) {
              foundColumns.push(col);
            }
          }
          result.schema.supabase.columns = foundColumns;
        } else {
          // Got schema data successfully
          const allColumns = (schemaData || []).map((row: any) => row.column_name);
          const businessCardColumnsFound = REQUIRED_BUSINESS_CARD_COLUMNS.filter(
            col => allColumns.includes(col)
          );
          result.schema.supabase.columns = businessCardColumnsFound;
          result.schema.supabase.totalColumns = allColumns.length;
        }
        
        const missingInSupabase = REQUIRED_BUSINESS_CARD_COLUMNS.filter(
          col => !result.schema.supabase.columns.includes(col)
        );
        result.schema.supabase.missing = missingInSupabase;
        result.schema.supabase.isInSync = missingInSupabase.length === 0;
      }
    } catch (error: any) {
      result.connections.supabase.connected = false;
      result.connections.supabase.error = error.message;
    }
  }

  // Check local PostgreSQL connection
  if (process.env.DATABASE_URL) {
    try {
      const url = new URL(process.env.DATABASE_URL);
      result.environment.databaseHost = url.hostname;

      const client = new Client({
        connectionString: process.env.DATABASE_URL
      });

      await client.connect();

      const queryResult = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'participants'
        ORDER BY ordinal_position
      `);

      result.connections.postgres.connected = true;
      result.connections.postgres.database = client.database;
      
      const allPostgresColumns = queryResult.rows.map(r => r.column_name);
      
      // Find which required business card columns are present
      const businessCardColumnsFound = REQUIRED_BUSINESS_CARD_COLUMNS.filter(
        col => allPostgresColumns.includes(col)
      );
      
      result.schema.postgres.columns = businessCardColumnsFound;
      result.schema.postgres.totalColumns = allPostgresColumns.length;
      
      const missingInPostgres = REQUIRED_BUSINESS_CARD_COLUMNS.filter(
        col => !allPostgresColumns.includes(col)
      );
      result.schema.postgres.missing = missingInPostgres;
      result.schema.postgres.isInSync = missingInPostgres.length === 0;

      await client.end();
    } catch (error: any) {
      result.connections.postgres.connected = false;
      result.connections.postgres.error = error.message;
    }
  }

  return result;
}

export function printHealthCheckReport(result: HealthCheckResult): void {
  console.log('\n' + '='.repeat(80));
  console.log('🏥 DATABASE HEALTH CHECK');
  console.log('='.repeat(80));

  // Environment
  console.log('\n📋 ENVIRONMENT:');
  console.log(`   SUPABASE_URL: ${result.environment.supabaseUrl || '❌ NOT SET'}`);
  console.log(`   SUPABASE_SERVICE_ROLE_KEY: ${result.environment.hasSupabaseServiceKey ? '✅ SET' : '❌ NOT SET'}`);
  console.log(`   DATABASE_URL: ${result.environment.hasDatabaseUrl ? `✅ SET (${result.environment.databaseHost})` : '❌ NOT SET'}`);

  // Connections
  console.log('\n🔌 CONNECTIONS:');
  
  if (result.environment.supabaseUrl) {
    console.log(`   Supabase (${result.connections.supabase.projectRef || 'unknown'}): ${
      result.connections.supabase.connected ? '✅ Connected' : '❌ Failed'
    }`);
    if (result.connections.supabase.error) {
      console.log(`      Error: ${result.connections.supabase.error}`);
    }
  }

  if (result.environment.hasDatabaseUrl) {
    console.log(`   PostgreSQL (${result.connections.postgres.database || 'unknown'}): ${
      result.connections.postgres.connected ? '✅ Connected' : '❌ Failed'
    }`);
    if (result.connections.postgres.error) {
      console.log(`      Error: ${result.connections.postgres.error}`);
    }
  }

  // Schema Status
  console.log('\n📊 SCHEMA STATUS:');
  
  // Supabase schema
  if (result.connections.supabase.connected) {
    console.log(`   Supabase (Production):`);
    console.log(`      Status: ${result.schema.supabase.isInSync ? '✅ In Sync' : '❌ Out of Sync'}`);
    console.log(`      Business card columns: ${result.schema.supabase.columns.length}/${REQUIRED_BUSINESS_CARD_COLUMNS.length}`);
    
    if (result.schema.supabase.missing.length > 0) {
      console.log(`      Missing: ${result.schema.supabase.missing.join(', ')}`);
    }
  }
  
  // Local PostgreSQL schema
  if (result.connections.postgres.connected) {
    console.log(`   Local PostgreSQL:`);
    console.log(`      Status: ${result.schema.postgres.isInSync ? '✅ In Sync' : '❌ Out of Sync'}`);
    console.log(`      Business card columns: ${result.schema.postgres.columns.length}/${REQUIRED_BUSINESS_CARD_COLUMNS.length}`);
    if (result.schema.postgres.totalColumns) {
      console.log(`      Total columns in participants: ${result.schema.postgres.totalColumns}`);
    }
    
    if (result.schema.postgres.missing.length > 0) {
      console.log(`      Missing: ${result.schema.postgres.missing.join(', ')}`);
    }
  }
  
  // Warning if Supabase is out of sync
  if (result.connections.supabase.connected && !result.schema.supabase.isInSync) {
    console.log('\n   🚨 CRITICAL: Production Supabase is missing columns!');
    console.log('   This will cause "column does not exist" errors in production.');
    console.log('\n   🔧 To fix:');
    console.log('      npm run db:migrate-manual');
    console.log('\n   This will show you how to manually run the migration.');
  }

  // Summary
  console.log('\n' + '='.repeat(80));
  
  const productionOK = !result.connections.supabase.connected || result.schema.supabase.isInSync;
  const localOK = !result.connections.postgres.connected || result.schema.postgres.isInSync;
  const allConnected = result.connections.supabase.connected || result.connections.postgres.connected;
  
  if (productionOK && localOK && allConnected) {
    console.log('✅ ALL SYSTEMS OPERATIONAL');
  } else if (!productionOK) {
    console.log('🚨 PRODUCTION SCHEMA OUT OF SYNC - Action required!');
  } else {
    console.log('⚠️  ATTENTION REQUIRED - See warnings above');
  }
  console.log('='.repeat(80) + '\n');
}
