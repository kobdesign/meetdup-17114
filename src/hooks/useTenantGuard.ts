import { useParams, useLocation } from 'react-router-dom';
import { useTenantContext } from '@/contexts/TenantContext';

interface TenantGuardResult {
  tenant_slug: string | null;
  tenant_id: string | null;
  requiresResolution: boolean;
  isLoading: boolean;
}

/**
 * Hook that resolves tenant context from URL parameters or TenantContext
 * Priority:
 * 1. URL param /app/{tenant_slug}
 * 2. Subdomain {tenant_slug}.domain.com
 * 3. TenantContext (for logged-in admin users)
 */
export const useTenantGuard = (): TenantGuardResult => {
  const { effectiveTenantId, isLoading } = useTenantContext();
  const { tenant_slug } = useParams<{ tenant_slug?: string }>();
  const location = useLocation();
  
  const resolveTenantSlug = (): string | null => {
    // Priority 1: From URL parameter
    if (tenant_slug) {
      console.log('Tenant resolved from URL param:', tenant_slug);
      return tenant_slug;
    }
    
    // Priority 2: From subdomain
    const hostname = window.location.hostname;
    const parts = hostname.split('.');
    
    // If subdomain exists and not localhost/IP
    if (
      parts.length > 2 && 
      !hostname.includes('localhost') && 
      !hostname.match(/^\d+\.\d+\.\d+\.\d+$/) &&
      parts[0] !== 'www'
    ) {
      console.log('Tenant resolved from subdomain:', parts[0]);
      return parts[0];
    }
    
    // Priority 3: From TenantContext (admin panel)
    console.log('No tenant_slug in URL/subdomain, using TenantContext');
    return null;
  };
  
  const slug = resolveTenantSlug();
  
  return {
    tenant_slug: slug,
    tenant_id: effectiveTenantId,
    requiresResolution: !!slug && !effectiveTenantId,
    isLoading
  };
};
