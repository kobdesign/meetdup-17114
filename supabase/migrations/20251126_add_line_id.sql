-- Migration: Add line_id field to participants table
-- Date: 2024-11-26
-- Purpose: Store public LINE ID (e.g., "yim_smile") for profile links
-- Note: This is different from line_user_id which is internal webhook ID

-- Add line_id column (public LINE ID that users set themselves)
ALTER TABLE participants 
ADD COLUMN IF NOT EXISTS line_id VARCHAR(50);

-- Add comment for clarity
COMMENT ON COLUMN participants.line_id IS 'Public LINE ID set by user (e.g., yim_smile). Used for profile link: line.me/R/ti/p/~{line_id}. Different from line_user_id which is internal webhook ID.';
