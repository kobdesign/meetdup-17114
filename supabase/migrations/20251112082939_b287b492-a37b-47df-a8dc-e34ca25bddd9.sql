-- Fix security issues: Add SELECT policies for participants and tenant_secrets tables

-- 1. Fix participants table - Restrict SELECT to authenticated chapter users only
CREATE POLICY "Chapter users can view their participants"
ON public.participants
FOR SELECT
USING (has_tenant_access(auth.uid(), tenant_id));

-- 2. Fix tenant_secrets table - Restrict SELECT to chapter admins only
CREATE POLICY "Chapter admins can view their secrets"
ON public.tenant_secrets
FOR SELECT
USING (has_tenant_access(auth.uid(), tenant_id));