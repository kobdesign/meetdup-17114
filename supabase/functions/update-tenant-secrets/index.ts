import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`User ${user.id} attempting to update tenant secrets`);

    // Parse request body
    const { tenant_id, secrets } = await req.json();

    if (!tenant_id) {
      return new Response(
        JSON.stringify({ error: 'tenant_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify tenant access using RLS-safe function
    const { data: hasAccess, error: accessError } = await supabase
      .rpc('has_tenant_access', { 
        _user_id: user.id, 
        _tenant_id: tenant_id 
      });

    if (accessError || !hasAccess) {
      console.error('Access denied:', accessError);
      return new Response(
        JSON.stringify({ error: 'Forbidden: You do not have access to this tenant' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Access granted for tenant ${tenant_id}`);

    // Prepare secrets object (only include provided fields)
    const secretsToUpdate: any = {
      tenant_id,
      updated_at: new Date().toISOString()
    };

    // Only include fields that are provided in the request
    if (secrets.line_channel_id !== undefined) secretsToUpdate.line_channel_id = secrets.line_channel_id;
    if (secrets.line_channel_secret !== undefined) secretsToUpdate.line_channel_secret = secrets.line_channel_secret;
    if (secrets.line_access_token !== undefined) secretsToUpdate.line_access_token = secrets.line_access_token;
    if (secrets.liff_id_share !== undefined) secretsToUpdate.liff_id_share = secrets.liff_id_share;
    if (secrets.liff_id_checkin !== undefined) secretsToUpdate.liff_id_checkin = secrets.liff_id_checkin;
    if (secrets.payment_qr_payload !== undefined) secretsToUpdate.payment_qr_payload = secrets.payment_qr_payload;
    if (secrets.payment_provider_keys !== undefined) {
      secretsToUpdate.payment_provider_keys = typeof secrets.payment_provider_keys === 'string' 
        ? JSON.parse(secrets.payment_provider_keys)
        : secrets.payment_provider_keys;
    }

    // Upsert secrets (insert or update)
    const { error: updateError } = await supabase
      .from('tenant_secrets')
      .upsert(secretsToUpdate, {
        onConflict: 'tenant_id'
      });

    if (updateError) {
      console.error('Update error:', updateError);
      throw updateError;
    }

    console.log(`Successfully updated secrets for tenant ${tenant_id}`);

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Tenant secrets updated successfully'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in update-tenant-secrets:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
