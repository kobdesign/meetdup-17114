-- ============================================================================
-- Migration: Add All Missing Columns (Comprehensive)
-- Date: 2024-11-14
-- Purpose: Add all columns that may be missing in production database
-- ============================================================================

-- This migration safely adds all columns that types.ts expects but may not
-- exist in production. Uses IF NOT EXISTS to make it idempotent and safe.
-- Can be run multiple times without causing errors.

BEGIN;

-- ============================================================================
-- PART 1: Fix tenant_settings table
-- ============================================================================

-- Add all potentially missing columns to tenant_settings
ALTER TABLE public.tenant_settings
ADD COLUMN IF NOT EXISTS branding_color TEXT,
ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'THB',
ADD COLUMN IF NOT EXISTS default_visitor_fee NUMERIC,
ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'en',
ADD COLUMN IF NOT EXISTS logo_url TEXT,
ADD COLUMN IF NOT EXISTS require_visitor_payment BOOLEAN DEFAULT true;

-- Set default values for existing rows that may have NULL
UPDATE public.tenant_settings 
SET currency = 'THB' 
WHERE currency IS NULL;

UPDATE public.tenant_settings 
SET language = 'en' 
WHERE language IS NULL;

UPDATE public.tenant_settings 
SET require_visitor_payment = true 
WHERE require_visitor_payment IS NULL;

-- ============================================================================
-- PART 2: Fix participants table
-- ============================================================================

-- Add business_type column if it doesn't exist
ALTER TABLE public.participants
ADD COLUMN IF NOT EXISTS business_type TEXT;

-- ============================================================================
-- PART 3: Verify changes
-- ============================================================================

DO $$
DECLARE
    settings_cols TEXT[];
    participants_cols TEXT[];
BEGIN
    -- Get tenant_settings columns
    SELECT array_agg(column_name ORDER BY column_name) INTO settings_cols
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tenant_settings';

    -- Get participants columns
    SELECT array_agg(column_name ORDER BY column_name) INTO participants_cols
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'participants';

    RAISE NOTICE '✅ Migration completed successfully!';
    RAISE NOTICE '';
    RAISE NOTICE '📋 tenant_settings columns: %', array_to_string(settings_cols, ', ');
    RAISE NOTICE '';
    RAISE NOTICE '📋 participants columns: %', array_to_string(participants_cols, ', ');
    RAISE NOTICE '';
    
    -- Verify critical columns exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'tenant_settings' 
        AND column_name = 'default_visitor_fee'
    ) THEN
        RAISE EXCEPTION '❌ FAILED: tenant_settings.default_visitor_fee not found!';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'participants' 
        AND column_name = 'business_type'
    ) THEN
        RAISE EXCEPTION '❌ FAILED: participants.business_type not found!';
    END IF;

    RAISE NOTICE '✅ Verification passed - all critical columns exist';
END $$;

COMMIT;
