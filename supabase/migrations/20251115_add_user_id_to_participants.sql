-- Migration: Add user_id to participants table for unified member approach
-- Date: 2025-11-15
-- Description: Links participants to auth.users for members while keeping visitors unlinked

-- Add user_id column (nullable for visitors who don't have accounts)
ALTER TABLE participants 
ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Create index for better query performance
CREATE INDEX idx_participants_user_id ON participants(user_id);

-- Add unique constraint to prevent duplicate participant records for same user in same tenant
CREATE UNIQUE INDEX idx_participants_user_tenant_unique 
ON participants(user_id, tenant_id) 
WHERE user_id IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN participants.user_id IS 'Links to auth.users for members with accounts. NULL for visitors/prospects without accounts.';
