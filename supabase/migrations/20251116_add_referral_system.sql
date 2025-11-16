-- Migration: Add referral system to participants
-- Date: 2025-11-16
-- Reason: Add referred_by_participant_id column to track who referred each visitor

BEGIN;

-- Add referred_by_participant_id column to participants table
ALTER TABLE participants 
  ADD COLUMN IF NOT EXISTS referred_by_participant_id UUID REFERENCES participants(participant_id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS participants_referred_by_idx ON participants(referred_by_participant_id);

-- Add comment for documentation
COMMENT ON COLUMN participants.referred_by_participant_id IS 'Member who referred this visitor/prospect to the chapter';

COMMIT;
