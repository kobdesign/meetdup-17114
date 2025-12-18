-- Event Notification Settings (per tenant)
CREATE TABLE IF NOT EXISTS event_notification_settings (
  setting_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  
  -- Notification toggles
  notify_7_days_before BOOLEAN DEFAULT true,
  notify_1_day_before BOOLEAN DEFAULT true,
  notify_2_hours_before BOOLEAN DEFAULT false,
  
  -- Notification time (for 7 days and 1 day notifications)
  notification_time TIME DEFAULT '09:00:00',
  
  -- Target settings
  send_to_group BOOLEAN DEFAULT false,  -- If true, also send to LINE group
  group_line_id VARCHAR(255),           -- LINE group ID for group notifications
  
  -- Message customization
  custom_message_template TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(tenant_id)
);

-- Meeting RSVP Records
CREATE TABLE IF NOT EXISTS meeting_rsvp (
  rsvp_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  meeting_id UUID NOT NULL REFERENCES meetings(meeting_id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES participants(participant_id) ON DELETE CASCADE,
  
  -- RSVP status
  rsvp_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (rsvp_status IN ('pending', 'confirmed', 'declined', 'leave')),
  
  -- For leave requests
  leave_reason TEXT,
  
  -- Tracking
  responded_at TIMESTAMPTZ,
  responded_via VARCHAR(20) CHECK (responded_via IN ('line', 'web', 'auto')),
  
  -- Notification tracking
  last_notified_at TIMESTAMPTZ,
  notification_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(meeting_id, participant_id)
);

-- Notification Log (track sent notifications)
CREATE TABLE IF NOT EXISTS event_notification_log (
  log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  meeting_id UUID NOT NULL REFERENCES meetings(meeting_id) ON DELETE CASCADE,
  
  notification_type VARCHAR(20) NOT NULL CHECK (notification_type IN ('7_days', '1_day', '2_hours', 'manual')),
  target_type VARCHAR(20) NOT NULL CHECK (target_type IN ('individual', 'group')),
  
  -- Stats
  total_sent INTEGER DEFAULT 0,
  total_failed INTEGER DEFAULT 0,
  
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Prevent duplicate notifications
  UNIQUE(meeting_id, notification_type, target_type)
);

-- Add leave_reason to meeting_attendance if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'meeting_attendance' AND column_name = 'leave_reason'
  ) THEN
    ALTER TABLE meeting_attendance ADD COLUMN leave_reason TEXT;
  END IF;
END $$;

-- Add rsvp_status to meeting_attendance for quick reference
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'meeting_attendance' AND column_name = 'rsvp_status'
  ) THEN
    ALTER TABLE meeting_attendance ADD COLUMN rsvp_status VARCHAR(20);
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_meeting_rsvp_meeting ON meeting_rsvp(meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_rsvp_participant ON meeting_rsvp(participant_id);
CREATE INDEX IF NOT EXISTS idx_meeting_rsvp_status ON meeting_rsvp(rsvp_status);
CREATE INDEX IF NOT EXISTS idx_event_notification_log_meeting ON event_notification_log(meeting_id);

-- Add comments
COMMENT ON TABLE event_notification_settings IS 'Per-tenant settings for event notifications';
COMMENT ON TABLE meeting_rsvp IS 'RSVP responses from members for meetings';
COMMENT ON TABLE event_notification_log IS 'Log of sent event notifications to prevent duplicates';
COMMENT ON COLUMN meeting_rsvp.rsvp_status IS 'pending=no response, confirmed=will attend, declined=cannot attend, leave=requesting leave';
