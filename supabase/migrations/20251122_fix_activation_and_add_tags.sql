-- Migration: Add tags to participants (activation_tokens should already exist from 20251120 migration)
-- Date: 2024-11-22
-- Description: Adds tags array column to participants for enhanced business card search

-- ============================================================================
-- IMPORTANT: activation_tokens table creation is handled by 20251120_create_activation_tokens.sql
-- This migration only adds the tags column to participants
-- ============================================================================

-- ============================================================================
-- Add tags column to participants table
-- ============================================================================
-- Add tags column if it doesn't exist (for searchable keywords)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'participants' AND column_name = 'tags'
  ) THEN
    ALTER TABLE participants ADD COLUMN tags TEXT[] DEFAULT '{}';
    COMMENT ON COLUMN participants.tags IS 'Searchable keywords/tags for business card search (company keywords, specialties, etc.)';
  END IF;
END $$;

-- Create GIN index for fast text search on tags array
CREATE INDEX IF NOT EXISTS idx_participants_tags ON participants USING GIN(tags);
