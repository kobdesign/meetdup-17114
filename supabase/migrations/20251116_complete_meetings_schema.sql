-- Complete meetings table schema alignment with TypeScript types
-- This migration adds all missing columns required by the application

-- Add meeting_time column (time of meeting)
ALTER TABLE meetings 
ADD COLUMN IF NOT EXISTS meeting_time TIME;

-- Add theme column (meeting theme/topic)
ALTER TABLE meetings
ADD COLUMN IF NOT EXISTS theme TEXT;

-- Add visitor_fee column (fee for visitors)
ALTER TABLE meetings
ADD COLUMN IF NOT EXISTS visitor_fee NUMERIC(10,2) DEFAULT 0;

-- Add recurrence_pattern column (none, daily, weekly, monthly)
ALTER TABLE meetings
ADD COLUMN IF NOT EXISTS recurrence_pattern TEXT;

-- Add recurrence_interval column (every X days/weeks/months)
ALTER TABLE meetings
ADD COLUMN IF NOT EXISTS recurrence_interval INTEGER;

-- Add recurrence_end_date column (when recurrence ends)
ALTER TABLE meetings
ADD COLUMN IF NOT EXISTS recurrence_end_date TIMESTAMP WITH TIME ZONE;

-- Add recurrence_days_of_week column (for weekly recurrence)
ALTER TABLE meetings
ADD COLUMN IF NOT EXISTS recurrence_days_of_week TEXT[];

-- Add parent_meeting_id column (for recurring meeting instances)
ALTER TABLE meetings
ADD COLUMN IF NOT EXISTS parent_meeting_id UUID REFERENCES meetings(meeting_id) ON DELETE CASCADE;

-- Add updated_at column if not exists
ALTER TABLE meetings
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create index on parent_meeting_id for better query performance
CREATE INDEX IF NOT EXISTS idx_meetings_parent_meeting_id ON meetings(parent_meeting_id);

-- Create index on meeting_date for better query performance
CREATE INDEX IF NOT EXISTS idx_meetings_date ON meetings(meeting_date);

-- Create index on tenant_id and meeting_date for common queries
CREATE INDEX IF NOT EXISTS idx_meetings_tenant_date ON meetings(tenant_id, meeting_date);

-- Add comments for clarity
COMMENT ON COLUMN meetings.meeting_time IS 'Time of the meeting (HH:MM format)';
COMMENT ON COLUMN meetings.theme IS 'Meeting theme or topic';
COMMENT ON COLUMN meetings.visitor_fee IS 'Fee charged to visitors attending the meeting';
COMMENT ON COLUMN meetings.recurrence_pattern IS 'Recurrence pattern: none, daily, weekly, monthly';
COMMENT ON COLUMN meetings.recurrence_interval IS 'Interval for recurrence (e.g., every 2 weeks)';
COMMENT ON COLUMN meetings.recurrence_end_date IS 'Date when recurrence should end';
COMMENT ON COLUMN meetings.recurrence_days_of_week IS 'Days of week for weekly recurrence (e.g., [1,3,5] for Mon,Wed,Fri)';
COMMENT ON COLUMN meetings.parent_meeting_id IS 'Reference to parent meeting for recurring instances';
