-- Add parent_meeting_id column to meetings table for recurring instances
ALTER TABLE meetings 
ADD COLUMN parent_meeting_id UUID REFERENCES meetings(meeting_id) ON DELETE CASCADE;

-- Add index for better query performance
CREATE INDEX idx_meetings_parent_id ON meetings(parent_meeting_id);

-- Add comment
COMMENT ON COLUMN meetings.parent_meeting_id IS 'Reference to parent meeting for recurring instances';