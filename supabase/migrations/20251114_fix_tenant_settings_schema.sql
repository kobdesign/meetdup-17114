-- Fix tenant_settings table schema
-- This migration ensures the correct column-based schema is in place

-- Drop and recreate tenant_settings table with correct schema
DROP TABLE IF EXISTS public.tenant_settings CASCADE;

CREATE TABLE public.tenant_settings (
    tenant_id uuid NOT NULL,
    branding_color text DEFAULT '#1e40af'::text,
    logo_url text,
    default_visitor_fee numeric(10,2) DEFAULT 650,
    language text DEFAULT 'th'::text,
    currency text DEFAULT 'THB'::text,
    require_visitor_payment boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Add primary key constraint
ALTER TABLE ONLY public.tenant_settings
    ADD CONSTRAINT tenant_settings_pkey PRIMARY KEY (tenant_id);

-- Add foreign key constraint
ALTER TABLE ONLY public.tenant_settings
    ADD CONSTRAINT tenant_settings_tenant_id_fkey 
    FOREIGN KEY (tenant_id) REFERENCES public.tenants(tenant_id) ON DELETE CASCADE;

-- Enable RLS
ALTER TABLE public.tenant_settings ENABLE ROW LEVEL SECURITY;

-- Add comment to trigger schema reload
COMMENT ON TABLE public.tenant_settings IS 'Tenant configuration and preferences with column-based schema (fixed 2025-11-14)';

-- Force PostgREST schema reload
NOTIFY pgrst, 'reload schema';
