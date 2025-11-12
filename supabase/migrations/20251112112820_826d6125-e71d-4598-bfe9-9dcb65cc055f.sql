-- Fix RLS policies to include WITH CHECK for INSERT/UPDATE operations
-- This ensures Super Admin and Chapter Admin can properly manage data

-- participants
DROP POLICY IF EXISTS "Chapter users can manage their participants" ON public.participants;
CREATE POLICY "Chapter users can manage their participants"
ON public.participants
FOR ALL
USING (public.has_tenant_access(auth.uid(), tenant_id))
WITH CHECK (public.has_tenant_access(auth.uid(), tenant_id));

-- checkins
DROP POLICY IF EXISTS "Chapter users can manage their checkins" ON public.checkins;
CREATE POLICY "Chapter users can manage their checkins"
ON public.checkins
FOR ALL
USING (public.has_tenant_access(auth.uid(), tenant_id))
WITH CHECK (public.has_tenant_access(auth.uid(), tenant_id));

-- meetings
DROP POLICY IF EXISTS "Chapter users can manage their meetings" ON public.meetings;
CREATE POLICY "Chapter users can manage their meetings"
ON public.meetings
FOR ALL
USING (public.has_tenant_access(auth.uid(), tenant_id))
WITH CHECK (public.has_tenant_access(auth.uid(), tenant_id));

-- payments
DROP POLICY IF EXISTS "Chapter users can manage their payments" ON public.payments;
CREATE POLICY "Chapter users can manage their payments"
ON public.payments
FOR ALL
USING (public.has_tenant_access(auth.uid(), tenant_id))
WITH CHECK (public.has_tenant_access(auth.uid(), tenant_id));

-- tenant_settings
DROP POLICY IF EXISTS "Chapter admins can manage their settings" ON public.tenant_settings;
CREATE POLICY "Chapter admins can manage their settings"
ON public.tenant_settings
FOR ALL
USING (public.has_tenant_access(auth.uid(), tenant_id))
WITH CHECK (public.has_tenant_access(auth.uid(), tenant_id));

-- tenant_secrets
DROP POLICY IF EXISTS "Chapter admins can manage their secrets" ON public.tenant_secrets;
CREATE POLICY "Chapter admins can manage their secrets"
ON public.tenant_secrets
FOR ALL
USING (public.has_tenant_access(auth.uid(), tenant_id))
WITH CHECK (public.has_tenant_access(auth.uid(), tenant_id));