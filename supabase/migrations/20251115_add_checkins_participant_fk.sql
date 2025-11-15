-- Migration: Add Foreign Key constraint for checkins.participant_id
-- Date: 2025-11-15
-- Description: Establishes referential integrity between checkins and participants tables

-- Add Foreign Key constraint from checkins to participants
ALTER TABLE checkins 
ADD CONSTRAINT checkins_participant_id_fkey 
FOREIGN KEY (participant_id) 
REFERENCES participants(participant_id) 
ON DELETE CASCADE;

-- Add index for better query performance on participant_id lookups
CREATE INDEX IF NOT EXISTS idx_checkins_participant_id ON checkins(participant_id);

-- Add comment for documentation
COMMENT ON CONSTRAINT checkins_participant_id_fkey ON checkins IS 'Ensures every check-in is linked to a valid participant. Cascades delete when participant is removed.';
