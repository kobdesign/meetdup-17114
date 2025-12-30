-- Chapter Growth Pipeline System
-- Track visitor/prospect journey from lead to active member

-- Pipeline Stages Configuration
CREATE TABLE IF NOT EXISTS pipeline_stages (
    id SERIAL PRIMARY KEY,
    stage_key VARCHAR(50) UNIQUE NOT NULL,
    stage_name VARCHAR(100) NOT NULL,
    stage_name_th VARCHAR(100) NOT NULL,
    description TEXT,
    stage_group VARCHAR(50) NOT NULL, -- lead_intake, engagement, conversion, onboarding, retention
    stage_order INTEGER NOT NULL,
    color VARCHAR(20) DEFAULT '#6B7280',
    icon VARCHAR(50),
    is_active BOOLEAN DEFAULT true,
    is_terminal BOOLEAN DEFAULT false, -- true for archive/churn stages
    auto_move_days INTEGER, -- days before auto-reminder or escalation
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pipeline Sub-statuses (for stages that need more granularity)
CREATE TABLE IF NOT EXISTS pipeline_sub_statuses (
    id SERIAL PRIMARY KEY,
    stage_key VARCHAR(50) NOT NULL REFERENCES pipeline_stages(stage_key) ON DELETE CASCADE,
    sub_status_key VARCHAR(50) NOT NULL,
    sub_status_name VARCHAR(100) NOT NULL,
    sub_status_name_th VARCHAR(100) NOT NULL,
    display_order INTEGER DEFAULT 0,
    color VARCHAR(20),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(stage_key, sub_status_key)
);

-- Pipeline Records - tracks each person's journey
CREATE TABLE IF NOT EXISTS pipeline_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    
    -- Person identification (can be visitor or participant)
    participant_id UUID, -- if already a participant
    visitor_id UUID, -- if from meeting_registrations
    
    -- Contact info (for leads not yet in system)
    full_name VARCHAR(200),
    phone VARCHAR(50),
    email VARCHAR(200),
    line_id VARCHAR(100),
    
    -- Current position in pipeline
    current_stage VARCHAR(50) NOT NULL REFERENCES pipeline_stages(stage_key),
    current_sub_status VARCHAR(50),
    stage_entered_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ownership
    owner_user_id UUID, -- who is responsible for this record
    referrer_participant_id UUID, -- who referred this person
    
    -- Source tracking
    source VARCHAR(50), -- referral, walk_in, website, event, etc.
    source_details TEXT,
    
    -- Meeting tracking
    first_meeting_id UUID,
    meetings_attended INTEGER DEFAULT 0,
    last_meeting_id UUID,
    last_meeting_date DATE,
    
    -- Notes and tags
    notes TEXT,
    tags TEXT[], -- array of tags for filtering
    
    -- Application tracking
    application_date DATE,
    application_status VARCHAR(50), -- pending, approved, rejected
    
    -- Dates
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    archived_at TIMESTAMPTZ,
    archive_reason VARCHAR(200),
    
    -- Constraints
    CONSTRAINT valid_person CHECK (
        participant_id IS NOT NULL OR 
        visitor_id IS NOT NULL OR 
        (full_name IS NOT NULL AND (phone IS NOT NULL OR email IS NOT NULL))
    )
);

-- Pipeline Transitions - audit log of all stage changes
CREATE TABLE IF NOT EXISTS pipeline_transitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pipeline_record_id UUID NOT NULL REFERENCES pipeline_records(id) ON DELETE CASCADE,
    
    -- Transition details
    from_stage VARCHAR(50),
    from_sub_status VARCHAR(50),
    to_stage VARCHAR(50) NOT NULL,
    to_sub_status VARCHAR(50),
    
    -- Who and why
    changed_by_user_id UUID,
    change_reason TEXT,
    is_automatic BOOLEAN DEFAULT false,
    
    -- Timing
    transitioned_at TIMESTAMPTZ DEFAULT NOW(),
    time_in_previous_stage INTERVAL
);

-- Pipeline Tasks - follow-up actions
CREATE TABLE IF NOT EXISTS pipeline_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pipeline_record_id UUID NOT NULL REFERENCES pipeline_records(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL,
    
    task_type VARCHAR(50) NOT NULL, -- call, message, meeting, follow_up, send_info
    title VARCHAR(200) NOT NULL,
    description TEXT,
    
    due_date DATE,
    due_time TIME,
    
    assigned_to_user_id UUID,
    
    status VARCHAR(20) DEFAULT 'pending', -- pending, completed, cancelled
    completed_at TIMESTAMPTZ,
    completed_by_user_id UUID,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_pipeline_records_tenant ON pipeline_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_records_stage ON pipeline_records(current_stage);
CREATE INDEX IF NOT EXISTS idx_pipeline_records_owner ON pipeline_records(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_records_participant ON pipeline_records(participant_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_records_visitor ON pipeline_records(visitor_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_transitions_record ON pipeline_transitions(pipeline_record_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_tasks_record ON pipeline_tasks(pipeline_record_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_tasks_tenant ON pipeline_tasks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_tasks_due ON pipeline_tasks(due_date) WHERE status = 'pending';

-- Seed initial stages
INSERT INTO pipeline_stages (stage_key, stage_name, stage_name_th, description, stage_group, stage_order, color, icon, auto_move_days) VALUES
    ('lead_capture', 'Lead Capture', 'รับข้อมูล Lead', 'Initial contact information collected', 'lead_intake', 1, '#6B7280', 'UserPlus', 3),
    ('prospect_qualified', 'Prospect Qualified', 'Qualify แล้ว', 'Contacted and confirmed interest', 'lead_intake', 2, '#3B82F6', 'CheckCircle', 5),
    ('invite_scheduled', 'Invite Scheduled', 'ส่งคำเชิญแล้ว', 'Invited to attend a meeting', 'engagement', 3, '#8B5CF6', 'Calendar', 7),
    ('rsvp_confirmed', 'RSVP Confirmed', 'ตอบรับแล้ว', 'Confirmed attendance for meeting', 'engagement', 4, '#10B981', 'CalendarCheck', NULL),
    ('attended_meeting', 'Attended Meeting', 'เข้าประชุมแล้ว', 'Successfully attended a meeting', 'engagement', 5, '#059669', 'Users', 2),
    ('follow_up', 'Follow-up', 'Follow-up', 'Post-meeting follow-up in progress', 'conversion', 6, '#F59E0B', 'MessageCircle', 7),
    ('application_submitted', 'Application Submitted', 'ยื่นใบสมัครแล้ว', 'Membership application submitted', 'conversion', 7, '#EF4444', 'FileText', 14),
    ('application_approved', 'Application Approved', 'อนุมัติแล้ว', 'Application approved by committee', 'conversion', 8, '#10B981', 'CheckCircle2', NULL),
    ('onboarding', 'Onboarding', 'สมาชิก Onboarding', 'New member onboarding in progress', 'onboarding', 9, '#6366F1', 'GraduationCap', 30),
    ('active_member', 'Active Member', 'สมาชิก Active', 'Active contributing member', 'onboarding', 10, '#22C55E', 'Star', NULL),
    ('retention_watch', 'Retention Watch', 'เฝ้าระวัง', 'At risk of churning', 'retention', 11, '#F97316', 'AlertTriangle', 14),
    ('archived', 'Archived', 'Archive', 'No longer active in pipeline', 'retention', 12, '#9CA3AF', 'Archive', NULL)
ON CONFLICT (stage_key) DO UPDATE SET
    stage_name = EXCLUDED.stage_name,
    stage_name_th = EXCLUDED.stage_name_th,
    description = EXCLUDED.description,
    stage_group = EXCLUDED.stage_group,
    stage_order = EXCLUDED.stage_order,
    color = EXCLUDED.color,
    icon = EXCLUDED.icon,
    auto_move_days = EXCLUDED.auto_move_days,
    updated_at = NOW();

-- Seed sub-statuses for follow_up stage
INSERT INTO pipeline_sub_statuses (stage_key, sub_status_key, sub_status_name, sub_status_name_th, display_order, color) VALUES
    ('follow_up', 'nurturing', 'Nurturing', 'ให้ข้อมูลเพิ่ม', 1, '#FCD34D'),
    ('follow_up', 'interested', 'Interested', 'สนใจ', 2, '#FB923C'),
    ('follow_up', 'ready_to_apply', 'Ready to Apply', 'พร้อมสมัคร', 3, '#4ADE80')
ON CONFLICT (stage_key, sub_status_key) DO UPDATE SET
    sub_status_name = EXCLUDED.sub_status_name,
    sub_status_name_th = EXCLUDED.sub_status_name_th,
    display_order = EXCLUDED.display_order,
    color = EXCLUDED.color;

-- Seed sub-statuses for archived stage
INSERT INTO pipeline_sub_statuses (stage_key, sub_status_key, sub_status_name, sub_status_name_th, display_order, color) VALUES
    ('archived', 'declined', 'Declined', 'ปฏิเสธ', 1, '#EF4444'),
    ('archived', 'not_qualified', 'Not Qualified', 'ไม่ผ่าน', 2, '#F97316'),
    ('archived', 'lost_contact', 'Lost Contact', 'ติดต่อไม่ได้', 3, '#9CA3AF'),
    ('archived', 'resigned', 'Resigned', 'ลาออก', 4, '#6B7280'),
    ('archived', 're_engagement', 'Re-engagement', 'รอติดต่อใหม่', 5, '#3B82F6')
ON CONFLICT (stage_key, sub_status_key) DO UPDATE SET
    sub_status_name = EXCLUDED.sub_status_name,
    sub_status_name_th = EXCLUDED.sub_status_name_th,
    display_order = EXCLUDED.display_order,
    color = EXCLUDED.color;

-- Mark archived as terminal stage
UPDATE pipeline_stages SET is_terminal = true WHERE stage_key = 'archived';

-- Create updated_at trigger function if not exists
CREATE OR REPLACE FUNCTION update_pipeline_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to tables with updated_at column
DROP TRIGGER IF EXISTS update_pipeline_records_updated_at ON pipeline_records;
CREATE TRIGGER update_pipeline_records_updated_at
    BEFORE UPDATE ON pipeline_records
    FOR EACH ROW
    EXECUTE FUNCTION update_pipeline_updated_at();

DROP TRIGGER IF EXISTS update_pipeline_tasks_updated_at ON pipeline_tasks;
CREATE TRIGGER update_pipeline_tasks_updated_at
    BEFORE UPDATE ON pipeline_tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_pipeline_updated_at();

DROP TRIGGER IF EXISTS update_pipeline_stages_updated_at ON pipeline_stages;
CREATE TRIGGER update_pipeline_stages_updated_at
    BEFORE UPDATE ON pipeline_stages
    FOR EACH ROW
    EXECUTE FUNCTION update_pipeline_updated_at();
