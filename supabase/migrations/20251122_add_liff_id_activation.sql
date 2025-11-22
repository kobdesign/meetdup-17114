-- Add liff_id_activation column to tenant_secrets table
-- This allows each tenant to have their own LIFF app for member activation
-- Migration: 20251122_add_liff_id_activation

ALTER TABLE tenant_secrets 
ADD COLUMN IF NOT EXISTS liff_id_activation TEXT;

COMMENT ON COLUMN tenant_secrets.liff_id_activation IS 'Encrypted LIFF ID for member activation flow (each tenant can use their own LINE channel)';
