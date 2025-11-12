import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1';

export interface TenantContext {
  tenant_id: string;
  tenant_slug: string;
  tenant_name: string;
  status: string;
}

/**
 * Resolves tenant context from request URL
 * Priority: query param > subdomain > path segment
 */
export async function requireTenantContext(
  req: Request,
  supabase: SupabaseClient
): Promise<TenantContext | null> {
  const url = new URL(req.url);
  
  // Try from query param ?tenant_slug=xxx
  let tenant_slug = url.searchParams.get('tenant_slug');
  
  // Try from subdomain (e.g., bni-bangkok.domain.com)
  if (!tenant_slug) {
    const hostname = url.hostname;
    const parts = hostname.split('.');
    // If subdomain exists and not localhost/127.0.0.1
    if (parts.length > 2 && !hostname.includes('localhost') && !hostname.includes('127.0.0.1')) {
      tenant_slug = parts[0];
    }
  }
  
  // Try from path /app/{tenant_slug}/...
  if (!tenant_slug) {
    const pathMatch = url.pathname.match(/\/app\/([^\/]+)/);
    if (pathMatch) {
      tenant_slug = pathMatch[1];
    }
  }
  
  if (!tenant_slug) {
    console.warn('No tenant_slug found in request');
    return null;
  }
  
  console.log(`Resolving tenant: ${tenant_slug}`);
  
  // Resolve to tenant_id and verify active status
  const { data: tenant, error } = await supabase
    .from('tenants')
    .select('tenant_id, slug, name, status')
    .eq('slug', tenant_slug)
    .eq('status', 'active')
    .single();
  
  if (error || !tenant) {
    console.error('Tenant not found or inactive:', error);
    return null;
  }
  
  return {
    tenant_id: tenant.tenant_id,
    tenant_slug: tenant.slug,
    tenant_name: tenant.name,
    status: tenant.status
  };
}
