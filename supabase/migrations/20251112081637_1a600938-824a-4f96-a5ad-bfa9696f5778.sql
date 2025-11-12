-- Update RLS policies to allow public access to tenant and meeting information

-- Allow anyone to view active tenants (for public profile pages)
CREATE POLICY "Anyone can view active tenants"
ON public.tenants
FOR SELECT
USING (status = 'active');

-- Allow anyone to view tenant settings (for public branding)
CREATE POLICY "Anyone can view tenant settings"
ON public.tenant_settings
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.tenants
    WHERE tenants.tenant_id = tenant_settings.tenant_id
    AND tenants.status = 'active'
  )
);

-- Allow anyone to view meetings for active tenants (for public calendar)
CREATE POLICY "Anyone can view meetings of active tenants"
ON public.meetings
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.tenants
    WHERE tenants.tenant_id = meetings.tenant_id
    AND tenants.status = 'active'
  )
);