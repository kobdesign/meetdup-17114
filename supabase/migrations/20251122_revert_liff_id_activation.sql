-- Revert: Remove liff_id_activation column from tenant_secrets
-- This column was added for multi-tenant LIFF but is not needed since we'll use shared activation flow
-- Migration: 20251122_revert_liff_id_activation

ALTER TABLE tenant_secrets 
DROP COLUMN IF EXISTS liff_id_activation;
