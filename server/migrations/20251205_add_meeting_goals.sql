-- Migration: Add Meeting-based Goals Support
-- This extends the chapter_goals system to support goals tied to specific meetings

-- Add new metric types for meeting-based goals
ALTER TYPE goal_metric_type ADD VALUE IF NOT EXISTS 'meeting_visitors';
ALTER TYPE goal_metric_type ADD VALUE IF NOT EXISTS 'meeting_checkins';

-- Add meeting_id column to chapter_goals
ALTER TABLE chapter_goals 
ADD COLUMN IF NOT EXISTS meeting_id UUID REFERENCES meetings(meeting_id) ON DELETE CASCADE;

-- Create index for meeting-based goals
CREATE INDEX IF NOT EXISTS idx_chapter_goals_meeting ON chapter_goals(meeting_id) WHERE meeting_id IS NOT NULL;

-- Add meeting-based goal templates
INSERT INTO goal_templates (metric_type, name_th, name_en, description_th, description_en, icon, default_target, sort_order) VALUES
    ('meeting_visitors', 'Visitor ประจำ Meeting', 'Meeting Visitors', 'จำนวน visitor ที่ลงทะเบียนเข้า meeting นี้', 'Visitors registered for this meeting', 'users', 5, 10),
    ('meeting_checkins', 'Check-in ประจำ Meeting', 'Meeting Check-ins', 'จำนวน check-in ใน meeting นี้', 'Check-ins for this meeting', 'calendar-check', 15, 11)
ON CONFLICT DO NOTHING;

-- Update existing templates sort order to make room for meeting-based templates
UPDATE goal_templates SET sort_order = sort_order + 10 WHERE metric_type NOT IN ('meeting_visitors', 'meeting_checkins');
