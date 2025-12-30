-- Lean Pipeline Stages Migration
-- Simplify from 12 stages to 8 stages (including archived)
-- New flow: Lead → Attended → Revisit → Follow-up → Application Submitted → Active Member → Onboarding → Archived

-- Step 1: Insert new stages that don't exist yet
INSERT INTO pipeline_stages (stage_key, stage_name, stage_name_th, description, stage_group, stage_order, color, icon, auto_move_days) VALUES
    ('lead', 'Lead', 'รายชื่อ Lead', 'Initial contact - from registration or admin add', 'lead_intake', 1, '#6B7280', 'UserPlus', 7),
    ('attended', 'Attended', 'เข้าประชุมแล้ว', 'Checked in to a meeting', 'engagement', 2, '#059669', 'Users', 3),
    ('revisit', 'Revisit', 'มาซ้ำ', 'Attended multiple meetings', 'engagement', 3, '#8B5CF6', 'RefreshCw', 5),
    ('follow_up', 'Follow-up', 'กำลังติดตาม', 'Admin following up after meeting', 'conversion', 4, '#F59E0B', 'MessageCircle', 7),
    ('application_submitted', 'Application Submitted', 'ยื่นใบสมัคร', 'Application submitted - includes qualification and payment', 'conversion', 5, '#EF4444', 'FileText', 14),
    ('active_member', 'Active Member', 'สมาชิก Active', 'Converted to active member', 'onboarding', 6, '#22C55E', 'Star', NULL),
    ('onboarding', 'Onboarding', 'Onboarding', 'New member onboarding in progress', 'onboarding', 7, '#6366F1', 'GraduationCap', 30),
    ('archived', 'Archived', 'Archive', 'No longer active in pipeline', 'retention', 8, '#9CA3AF', 'Archive', NULL)
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

-- Step 2: Map existing pipeline_records to new stages
-- lead_capture, prospect_qualified, invite_scheduled, rsvp_confirmed → lead
UPDATE pipeline_records SET current_stage = 'lead' 
WHERE current_stage IN ('lead_capture', 'prospect_qualified', 'invite_scheduled', 'rsvp_confirmed');

-- attended_meeting → attended
UPDATE pipeline_records SET current_stage = 'attended' 
WHERE current_stage = 'attended_meeting';

-- application_approved → active_member (already approved means they're a member)
UPDATE pipeline_records SET current_stage = 'active_member' 
WHERE current_stage = 'application_approved';

-- retention_watch → archived (with sub_status)
UPDATE pipeline_records SET current_stage = 'archived', current_sub_status = 're_engagement'
WHERE current_stage = 'retention_watch';

-- Step 3: Map pipeline_transitions history
UPDATE pipeline_transitions SET from_stage = 'lead' 
WHERE from_stage IN ('lead_capture', 'prospect_qualified', 'invite_scheduled', 'rsvp_confirmed');

UPDATE pipeline_transitions SET to_stage = 'lead' 
WHERE to_stage IN ('lead_capture', 'prospect_qualified', 'invite_scheduled', 'rsvp_confirmed');

UPDATE pipeline_transitions SET from_stage = 'attended' 
WHERE from_stage = 'attended_meeting';

UPDATE pipeline_transitions SET to_stage = 'attended' 
WHERE to_stage = 'attended_meeting';

UPDATE pipeline_transitions SET from_stage = 'active_member' 
WHERE from_stage = 'application_approved';

UPDATE pipeline_transitions SET to_stage = 'active_member' 
WHERE to_stage = 'application_approved';

UPDATE pipeline_transitions SET from_stage = 'archived' 
WHERE from_stage = 'retention_watch';

UPDATE pipeline_transitions SET to_stage = 'archived' 
WHERE to_stage = 'retention_watch';

-- Step 4: Deactivate old stages (soft delete - keep for history)
UPDATE pipeline_stages SET is_active = false 
WHERE stage_key IN (
    'lead_capture', 
    'prospect_qualified', 
    'invite_scheduled', 
    'rsvp_confirmed', 
    'attended_meeting', 
    'application_approved', 
    'retention_watch'
);

-- Step 5: Update sub-statuses for follow_up stage
DELETE FROM pipeline_sub_statuses WHERE stage_key = 'follow_up';
INSERT INTO pipeline_sub_statuses (stage_key, sub_status_key, sub_status_name, sub_status_name_th, display_order, color) VALUES
    ('follow_up', 'contacted', 'Contacted', 'ติดต่อแล้ว', 1, '#FCD34D'),
    ('follow_up', 'interested', 'Interested', 'สนใจ', 2, '#FB923C'),
    ('follow_up', 'ready_to_apply', 'Ready to Apply', 'พร้อมสมัคร', 3, '#4ADE80')
ON CONFLICT (stage_key, sub_status_key) DO UPDATE SET
    sub_status_name = EXCLUDED.sub_status_name,
    sub_status_name_th = EXCLUDED.sub_status_name_th,
    display_order = EXCLUDED.display_order,
    color = EXCLUDED.color;

-- Step 6: Update sub-statuses for application_submitted stage
INSERT INTO pipeline_sub_statuses (stage_key, sub_status_key, sub_status_name, sub_status_name_th, display_order, color) VALUES
    ('application_submitted', 'pending_review', 'Pending Review', 'รอตรวจสอบ', 1, '#FCD34D'),
    ('application_submitted', 'qualification_check', 'Qualification Check', 'ตรวจคุณสมบัติ', 2, '#FB923C'),
    ('application_submitted', 'payment_pending', 'Payment Pending', 'รอชำระเงิน', 3, '#EF4444'),
    ('application_submitted', 'approved', 'Approved', 'อนุมัติแล้ว', 4, '#4ADE80')
ON CONFLICT (stage_key, sub_status_key) DO UPDATE SET
    sub_status_name = EXCLUDED.sub_status_name,
    sub_status_name_th = EXCLUDED.sub_status_name_th,
    display_order = EXCLUDED.display_order,
    color = EXCLUDED.color;

-- Step 7: Update sub-statuses for onboarding stage
INSERT INTO pipeline_sub_statuses (stage_key, sub_status_key, sub_status_name, sub_status_name_th, display_order, color) VALUES
    ('onboarding', 'orientation', 'Orientation', 'ปฐมนิเทศ', 1, '#6366F1'),
    ('onboarding', 'training', 'Training', 'อบรม', 2, '#8B5CF6'),
    ('onboarding', 'completed', 'Completed', 'เสร็จสิ้น', 3, '#22C55E')
ON CONFLICT (stage_key, sub_status_key) DO UPDATE SET
    sub_status_name = EXCLUDED.sub_status_name,
    sub_status_name_th = EXCLUDED.sub_status_name_th,
    display_order = EXCLUDED.display_order,
    color = EXCLUDED.color;

-- Step 8: Ensure archived has terminal flag
UPDATE pipeline_stages SET is_terminal = true WHERE stage_key = 'archived';
UPDATE pipeline_stages SET is_terminal = false WHERE stage_key != 'archived';
