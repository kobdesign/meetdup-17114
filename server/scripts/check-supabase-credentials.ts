import { supabaseAdmin } from "../utils/supabaseClient";

async function checkSupabaseCredentials() {
  console.log("🔍 Checking LINE credentials in Supabase...\n");

  try {
    // Check tenant_secrets table
    const { data: secrets, error: secretsError } = await supabaseAdmin
      .from("tenant_secrets")
      .select("tenant_id, secret_key, secret_value, created_at, updated_at");

    if (secretsError) {
      console.error("❌ Error querying tenant_secrets:", secretsError);
    } else {
      console.log("📊 tenant_secrets table:");
      console.log(`   Total records: ${secrets?.length || 0}`);
      
      if (secrets && secrets.length > 0) {
        // Group by tenant_id
        const byTenant = secrets.reduce((acc: any, secret: any) => {
          if (!acc[secret.tenant_id]) acc[secret.tenant_id] = [];
          acc[secret.tenant_id].push(secret);
          return acc;
        }, {});

        Object.entries(byTenant).forEach(([tenantId, tenantSecrets]: [string, any]) => {
          console.log(`\n   Tenant: ${tenantId}`);
          tenantSecrets.forEach((secret: any) => {
            const preview = secret.secret_value.substring(0, 50);
            console.log(`   - ${secret.secret_key}: ${preview}...`);
          });
        });
      } else {
        console.log("   ⚠️  No LINE credentials found");
      }
    }

    console.log("\n");

    // Check participants with LINE userId
    const { data: participants, error: participantsError } = await supabaseAdmin
      .from("participants")
      .select("participant_id, full_name, line_user_id, phone, status, tenant_id")
      .not("line_user_id", "is", null)
      .limit(10);

    if (participantsError) {
      console.error("❌ Error querying participants:", participantsError);
    } else {
      console.log("👥 Participants with LINE userId:");
      console.log(`   Total records: ${participants?.length || 0}`);
      
      if (participants && participants.length > 0) {
        participants.forEach((participant, idx) => {
          console.log(`\n   Participant ${idx + 1}:`);
          console.log(`   - name: ${participant.full_name}`);
          console.log(`   - line_user_id: ${participant.line_user_id}`);
          console.log(`   - phone: ${participant.phone}`);
          console.log(`   - status: ${participant.status}`);
        });
      } else {
        console.log("   ⚠️  No participants with LINE userId");
      }
    }

    console.log("\n");

    // Check tenants
    const { data: tenants, error: tenantsError } = await supabaseAdmin
      .from("tenants")
      .select("tenant_id, tenant_name, created_at");

    if (tenantsError) {
      console.error("❌ Error querying tenants:", tenantsError);
    } else {
      console.log("🏢 Tenants:");
      console.log(`   Total tenants: ${tenants?.length || 0}`);
      
      if (tenants && tenants.length > 0) {
        tenants.forEach((tenant, idx) => {
          const hasSecrets = secrets?.some(s => 
            s.tenant_id === tenant.tenant_id && 
            (s.secret_key === 'line_channel_id' || s.secret_key === 'line_channel_access_token')
          );
          console.log(`\n   Tenant ${idx + 1}:`);
          console.log(`   - name: ${tenant.tenant_name}`);
          console.log(`   - tenant_id: ${tenant.tenant_id}`);
          console.log(`   - LINE configured: ${hasSecrets ? '✅' : '❌'}`);
        });
      }
    }

    console.log("\n✅ Check complete!");

  } catch (error) {
    console.error("❌ Fatal error:", error);
  }
}

checkSupabaseCredentials();
