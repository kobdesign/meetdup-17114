-- Migration: Clear old hierarchical business_type_code values
-- Date: 2024-11-30
-- Purpose: Reset business_type_code to NULL for all participants
--          so they can re-select using new simple 25-category system
-- 
-- Old format: hierarchical codes like "service_professional_legal", "manufacturing_heavy_construction"
-- New format: simple 2-digit codes like "01", "02", "14" matching business_categories table
--
-- This migration should be run ONCE on Supabase production dashboard

-- First, let's see what we're clearing (for verification)
-- SELECT DISTINCT business_type_code, COUNT(*) as cnt 
-- FROM participants 
-- WHERE business_type_code IS NOT NULL 
-- GROUP BY business_type_code;

-- Clear old hierarchical codes (those that don't match new 2-digit format)
UPDATE participants 
SET 
  business_type_code = NULL,
  business_type = NULL
WHERE business_type_code IS NOT NULL 
  AND business_type_code !~ '^[0-9]{2}$';

-- Verify the update
-- SELECT COUNT(*) as remaining FROM participants WHERE business_type_code IS NOT NULL;

-- Note: After running this, members will need to re-select their business type
-- using the new BusinessTypeSelector which shows 25 simple categories
