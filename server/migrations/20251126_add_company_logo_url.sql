-- Migration: Add company_logo_url column to participants table
-- Run this SQL in Supabase SQL Editor (Dashboard > SQL Editor)
-- Date: 2024-11-26

-- Add company_logo_url column
ALTER TABLE public.participants
ADD COLUMN IF NOT EXISTS company_logo_url text;

-- Add comment for documentation
COMMENT ON COLUMN public.participants.company_logo_url IS 'URL to participant company logo image stored in Supabase Storage';
