import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1';
import { requireTenantContext } from '../_shared/tenantGuard.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TenantSecretsResponse {
  tenant_id: string;
  tenant_slug: string;
  tenant_name: string;
  settings: {
    branding_color?: string;
    logo_url?: string;
    currency?: string;
    language?: string;
    default_visitor_fee?: number;
    require_visitor_payment?: boolean;
  };
  public_secrets: {
    liff_id_share?: string;
    liff_id_checkin?: string;
  };
}

// Simple in-memory cache: Map<cache_key, { data, expires }>
const cache = new Map<string, { data: TenantSecretsResponse; expires: number }>();
const CACHE_TTL = 60000; // 60 seconds

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse request
    const { tenant_slug, tenant_id } = await req.json();
    
    if (!tenant_slug && !tenant_id) {
      return new Response(
        JSON.stringify({ error: 'Either tenant_slug or tenant_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const cacheKey = tenant_slug || tenant_id;
    const now = Date.now();
    
    // Check cache
    if (cache.has(cacheKey)) {
      const cached = cache.get(cacheKey)!;
      if (cached.expires > now) {
        console.log(`Cache HIT for tenant: ${cacheKey}`);
        return new Response(
          JSON.stringify(cached.data),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else {
        // Expired, remove from cache
        cache.delete(cacheKey);
      }
    }

    console.log(`Cache MISS for tenant: ${cacheKey}, fetching from DB`);

    // Resolve tenant_id from slug if needed
    let resolvedTenantId = tenant_id;
    let resolvedSlug = tenant_slug;
    let resolvedName = '';
    
    if (tenant_slug && !tenant_id) {
      const { data: tenant, error } = await supabase
        .from('tenants')
        .select('tenant_id, slug, name')
        .eq('slug', tenant_slug)
        .eq('status', 'active')
        .single();
      
      if (error || !tenant) {
        return new Response(
          JSON.stringify({ error: 'Tenant not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      resolvedTenantId = tenant.tenant_id;
      resolvedSlug = tenant.slug;
      resolvedName = tenant.name;
    } else {
      // Fetch tenant info
      const { data: tenant } = await supabase
        .from('tenants')
        .select('slug, name')
        .eq('tenant_id', resolvedTenantId)
        .single();
      
      if (tenant) {
        resolvedSlug = tenant.slug;
        resolvedName = tenant.name;
      }
    }

    // Fetch settings and secrets in parallel
    const [settingsResult, secretsResult] = await Promise.all([
      supabase
        .from('tenant_settings')
        .select('branding_color, logo_url, currency, language, default_visitor_fee, require_visitor_payment')
        .eq('tenant_id', resolvedTenantId)
        .single(),
      supabase
        .from('tenant_secrets')
        .select('liff_id_share, liff_id_checkin')
        .eq('tenant_id', resolvedTenantId)
        .single()
    ]);

    const response: TenantSecretsResponse = {
      tenant_id: resolvedTenantId,
      tenant_slug: resolvedSlug,
      tenant_name: resolvedName,
      settings: settingsResult.data || {},
      public_secrets: {
        liff_id_share: secretsResult.data?.liff_id_share,
        liff_id_checkin: secretsResult.data?.liff_id_checkin
      }
    };

    // Cache for 60 seconds
    cache.set(cacheKey, { data: response, expires: now + CACHE_TTL });

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in resolve-tenant-secrets:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
