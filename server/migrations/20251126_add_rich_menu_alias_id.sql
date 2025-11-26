-- Add alias_id column to rich_menus table for Rich Menu switching
-- Run this migration in Supabase SQL Editor

ALTER TABLE rich_menus
ADD COLUMN IF NOT EXISTS alias_id VARCHAR(32) DEFAULT NULL;

-- Add comment explaining the purpose
COMMENT ON COLUMN rich_menus.alias_id IS 'LINE Rich Menu Alias ID for richmenuswitch action (1-32 chars, alphanumeric/dash/underscore)';
