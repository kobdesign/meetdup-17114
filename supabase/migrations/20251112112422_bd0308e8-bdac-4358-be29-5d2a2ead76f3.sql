-- Fix has_tenant_access function to properly support Super Admin access
-- by checking role = 'super_admin' first before checking tenant_id match

CREATE OR REPLACE FUNCTION public.has_tenant_access(_user_id uuid, _tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND (
        role = 'super_admin' 
        OR tenant_id = _tenant_id
      )
  )
$$;