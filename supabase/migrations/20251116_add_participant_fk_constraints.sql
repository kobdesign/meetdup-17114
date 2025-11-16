-- Migration: Add Foreign Key Constraints for participant_id
-- Date: 2025-11-16
-- Purpose: Add FK constraints to meeting_registrations and checkins tables to enable PostgREST nested queries

-- Add FK constraint for meeting_registrations.participant_id -> participants.participant_id
ALTER TABLE meeting_registrations
ADD CONSTRAINT fk_meeting_registrations_participant
FOREIGN KEY (participant_id) 
REFERENCES participants(participant_id)
ON DELETE CASCADE;

-- Add FK constraint for checkins.participant_id -> participants.participant_id
ALTER TABLE checkins
ADD CONSTRAINT fk_checkins_participant
FOREIGN KEY (participant_id) 
REFERENCES participants(participant_id)
ON DELETE CASCADE;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_meeting_registrations_participant_id 
ON meeting_registrations(participant_id);

CREATE INDEX IF NOT EXISTS idx_checkins_participant_id 
ON checkins(participant_id);
