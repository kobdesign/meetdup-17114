-- RPC Function to create tenant with settings (bypasses PostgREST cache)
-- This function handles tenant creation with proper transaction support

CREATE OR REPLACE FUNCTION create_tenant_with_settings(
  p_tenant_name TEXT,
  p_subdomain TEXT,
  p_language TEXT DEFAULT 'th',
  p_currency TEXT DEFAULT 'THB',
  p_default_visitor_fee NUMERIC DEFAULT 650
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tenant_id uuid;
  v_result jsonb;
BEGIN
  -- Insert tenant
  INSERT INTO tenants (tenant_name, subdomain)
  VALUES (p_tenant_name, p_subdomain)
  RETURNING tenant_id INTO v_tenant_id;
  
  -- Insert tenant settings
  INSERT INTO tenant_settings (
    tenant_id, 
    language, 
    currency, 
    default_visitor_fee,
    require_visitor_payment
  )
  VALUES (
    v_tenant_id, 
    p_language, 
    p_currency, 
    p_default_visitor_fee,
    true
  );
  
  -- Build result
  SELECT jsonb_build_object(
    'success', true,
    'tenant_id', v_tenant_id,
    'tenant_name', p_tenant_name,
    'subdomain', p_subdomain
  ) INTO v_result;
  
  RETURN v_result;
  
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'Subdomain already exists';
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Failed to create tenant: %', SQLERRM;
END;
$$;

-- Grant execute permission to service role
GRANT EXECUTE ON FUNCTION create_tenant_with_settings(TEXT, TEXT, TEXT, TEXT, NUMERIC) TO service_role;

-- Add comment
COMMENT ON FUNCTION create_tenant_with_settings IS 'Creates a new tenant with settings in a single transaction, bypassing PostgREST schema cache issues';
