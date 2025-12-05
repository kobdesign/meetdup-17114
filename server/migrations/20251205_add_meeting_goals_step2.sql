-- Migration Step 2: Add Meeting Goals Columns and Templates
-- RUN THIS AFTER step 1 has been committed

-- Add meeting_id column to chapter_goals
ALTER TABLE chapter_goals 
ADD COLUMN IF NOT EXISTS meeting_id UUID REFERENCES meetings(meeting_id) ON DELETE CASCADE;

-- Create index for meeting-based goals
CREATE INDEX IF NOT EXISTS idx_chapter_goals_meeting ON chapter_goals(meeting_id) WHERE meeting_id IS NOT NULL;

-- Add unique constraint on metric_type to prevent duplicates
ALTER TABLE goal_templates ADD CONSTRAINT IF NOT EXISTS goal_templates_metric_type_unique UNIQUE (metric_type);

-- Add meeting-based goal templates (will skip if metric_type already exists)
INSERT INTO goal_templates (metric_type, name_th, name_en, description_th, description_en, icon, default_target, sort_order) VALUES
    ('meeting_visitors', 'Visitor ประจำ Meeting', 'Meeting Visitors', 'จำนวน visitor ที่ลงทะเบียนเข้า meeting นี้', 'Visitors registered for this meeting', 'users', 5, 10),
    ('meeting_checkins', 'Check-in ประจำ Meeting', 'Meeting Check-ins', 'จำนวน check-in ใน meeting นี้', 'Check-ins for this meeting', 'calendar-check', 15, 11)
ON CONFLICT (metric_type) DO NOTHING;

-- Update existing templates sort order to make room for meeting-based templates
UPDATE goal_templates SET sort_order = sort_order + 10 WHERE metric_type NOT IN ('meeting_visitors', 'meeting_checkins');
