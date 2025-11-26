-- Migration: Add enhanced profile fields for self-service editing
-- Date: 2024-11-26
-- Description: Adds tags array, onepage_url, member_type, and business_type_code columns
-- Note: photo_url already exists in participants table for avatar storage

-- Add tags column (text array for keywords search)
ALTER TABLE participants 
ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';

-- Add onepage_url column (URL to One Page infographic in Supabase Storage)
ALTER TABLE participants 
ADD COLUMN IF NOT EXISTS onepage_url text;

-- Add member_type column (Regular, Premium, Honorary, etc.)
ALTER TABLE participants 
ADD COLUMN IF NOT EXISTS member_type text DEFAULT 'regular';

-- Add business_type_code column (standardized business type code from dropdown)
ALTER TABLE participants 
ADD COLUMN IF NOT EXISTS business_type_code text;

-- Create index on tags for faster search
CREATE INDEX IF NOT EXISTS idx_participants_tags ON participants USING GIN (tags);

-- Create index on business_type_code for filtering
CREATE INDEX IF NOT EXISTS idx_participants_business_type_code ON participants (business_type_code);

-- Create index on member_type for filtering
CREATE INDEX IF NOT EXISTS idx_participants_member_type ON participants (member_type);

-- Add comment for documentation
COMMENT ON COLUMN participants.tags IS 'Keywords/tags for search (e.g., ["IT", "ซอฟต์แวร์", "Startup"])';
COMMENT ON COLUMN participants.onepage_url IS 'URL to One Page infographic stored in Supabase Storage';
COMMENT ON COLUMN participants.member_type IS 'Member type: regular, premium, honorary, founding';
COMMENT ON COLUMN participants.business_type_code IS 'Standardized business type code from dropdown (e.g., service_professional_it)';
