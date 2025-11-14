-- ============================================================================
-- Migration: Reconcile Schema with Code Expectations
-- Date: 2024-11-14
-- Purpose: Fix schema mismatches between migration files and application code
-- ============================================================================

-- This migration fixes critical schema drift issues:
-- 1. tenants table: Rename columns and add missing fields
-- 2. tenant_settings table: Add missing currency and require_visitor_payment
-- 3. Ensure indexes and constraints are correct

BEGIN;

-- ============================================================================
-- PART 1: Fix tenants table
-- ============================================================================

-- Check if we need to rename columns (they might already be renamed)
DO $$ 
BEGIN
    -- Rename 'name' to 'tenant_name' if needed
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'tenants' 
        AND column_name = 'name'
    ) THEN
        ALTER TABLE public.tenants RENAME COLUMN name TO tenant_name;
        RAISE NOTICE 'Renamed tenants.name → tenant_name';
    END IF;

    -- Rename 'slug' to 'subdomain' if needed
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'tenants' 
        AND column_name = 'slug'
    ) THEN
        ALTER TABLE public.tenants RENAME COLUMN slug TO subdomain;
        RAISE NOTICE 'Renamed tenants.slug → subdomain';
    END IF;
END $$;

-- Add missing columns to tenants table
ALTER TABLE public.tenants 
ADD COLUMN IF NOT EXISTS line_bot_basic_id TEXT,
ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- Create unique index on subdomain (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE schemaname = 'public' 
        AND tablename = 'tenants' 
        AND indexname = 'tenants_subdomain_unique'
    ) THEN
        CREATE UNIQUE INDEX tenants_subdomain_unique ON public.tenants(subdomain);
        RAISE NOTICE 'Created unique index on tenants.subdomain';
    END IF;
END $$;

-- Drop unused columns if they exist and have no data
DO $$
BEGIN
    -- Only drop if column exists
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'tenants' 
        AND column_name = 'country'
    ) THEN
        -- Check if column has any non-default values
        IF NOT EXISTS (SELECT 1 FROM public.tenants WHERE country IS NOT NULL AND country != 'TH' LIMIT 1) THEN
            ALTER TABLE public.tenants DROP COLUMN IF EXISTS country;
            RAISE NOTICE 'Dropped unused column: tenants.country';
        ELSE
            RAISE NOTICE 'Kept tenants.country - contains data';
        END IF;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'tenants' 
        AND column_name = 'timezone'
    ) THEN
        IF NOT EXISTS (SELECT 1 FROM public.tenants WHERE timezone IS NOT NULL AND timezone != 'Asia/Bangkok' LIMIT 1) THEN
            ALTER TABLE public.tenants DROP COLUMN IF EXISTS timezone;
            RAISE NOTICE 'Dropped unused column: tenants.timezone';
        ELSE
            RAISE NOTICE 'Kept tenants.timezone - contains data';
        END IF;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'tenants' 
        AND column_name = 'status'
    ) THEN
        IF NOT EXISTS (SELECT 1 FROM public.tenants WHERE status IS NOT NULL AND status::text != 'active' LIMIT 1) THEN
            ALTER TABLE public.tenants DROP COLUMN IF EXISTS status;
            RAISE NOTICE 'Dropped unused column: tenants.status';
        ELSE
            RAISE NOTICE 'Kept tenants.status - contains data';
        END IF;
    END IF;
END $$;

-- ============================================================================
-- PART 2: Fix tenant_settings table
-- ============================================================================

-- Add missing columns to tenant_settings
ALTER TABLE public.tenant_settings
ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'THB',
ADD COLUMN IF NOT EXISTS require_visitor_payment BOOLEAN DEFAULT true;

-- Ensure existing rows have default values
UPDATE public.tenant_settings 
SET currency = 'THB' 
WHERE currency IS NULL;

UPDATE public.tenant_settings 
SET require_visitor_payment = true 
WHERE require_visitor_payment IS NULL;

-- ============================================================================
-- PART 3: Verify changes
-- ============================================================================

DO $$
DECLARE
    tenants_cols TEXT[];
    settings_cols TEXT[];
BEGIN
    -- Get tenants columns
    SELECT array_agg(column_name ORDER BY column_name) INTO tenants_cols
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tenants';

    -- Get tenant_settings columns
    SELECT array_agg(column_name ORDER BY column_name) INTO settings_cols
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tenant_settings';

    RAISE NOTICE 'Migration completed successfully!';
    RAISE NOTICE 'tenants columns: %', array_to_string(tenants_cols, ', ');
    RAISE NOTICE 'tenant_settings columns: %', array_to_string(settings_cols, ', ');
END $$;

COMMIT;
