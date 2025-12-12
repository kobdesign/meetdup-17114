-- Migration: Create PALMS Attendance System Tables
-- Date: 2025-12-12
-- Purpose: Support PALMS meeting attendance tracking (Present/Absent/Late/Managed/Substitute)

-- 1. Create PALMS status enum
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'palms_status') THEN
    CREATE TYPE palms_status AS ENUM ('P', 'A', 'L', 'M', 'S');
  END IF;
END $$;

-- 2. Create substitute_requests table
-- Stores advance notice from Members about sending a substitute
CREATE TABLE IF NOT EXISTS substitute_requests (
  request_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  meeting_id UUID NOT NULL REFERENCES meetings(meeting_id) ON DELETE CASCADE,
  member_participant_id UUID NOT NULL REFERENCES participants(participant_id) ON DELETE CASCADE,
  substitute_name VARCHAR(255) NOT NULL,
  substitute_phone VARCHAR(20) NOT NULL,
  substitute_email VARCHAR(255),
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, confirmed, cancelled
  confirmed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancel_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT unique_member_meeting_sub UNIQUE (meeting_id, member_participant_id)
);

-- 3. Create meeting_attendance table
-- Stores PALMS status for each member per meeting
CREATE TABLE IF NOT EXISTS meeting_attendance (
  attendance_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  meeting_id UUID NOT NULL REFERENCES meetings(meeting_id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES participants(participant_id) ON DELETE CASCADE,
  palms_status palms_status NOT NULL DEFAULT 'A',
  substitute_request_id UUID REFERENCES substitute_requests(request_id) ON DELETE SET NULL,
  managed_reason TEXT, -- Reason for M (Managed Absence)
  source VARCHAR(20) NOT NULL DEFAULT 'manual', -- qr, manual, auto
  recorded_by UUID REFERENCES auth.users(id), -- Who recorded this (admin user_id)
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT,
  
  CONSTRAINT unique_meeting_participant UNIQUE (meeting_id, participant_id)
);

-- 4. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_substitute_requests_tenant ON substitute_requests(tenant_id);
CREATE INDEX IF NOT EXISTS idx_substitute_requests_meeting ON substitute_requests(meeting_id);
CREATE INDEX IF NOT EXISTS idx_substitute_requests_phone ON substitute_requests(substitute_phone);
CREATE INDEX IF NOT EXISTS idx_substitute_requests_status ON substitute_requests(status);

CREATE INDEX IF NOT EXISTS idx_meeting_attendance_tenant ON meeting_attendance(tenant_id);
CREATE INDEX IF NOT EXISTS idx_meeting_attendance_meeting ON meeting_attendance(meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_attendance_participant ON meeting_attendance(participant_id);
CREATE INDEX IF NOT EXISTS idx_meeting_attendance_status ON meeting_attendance(palms_status);

-- 5. Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_substitute_requests_updated_at ON substitute_requests;
CREATE TRIGGER update_substitute_requests_updated_at
  BEFORE UPDATE ON substitute_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_meeting_attendance_updated_at ON meeting_attendance;
CREATE TRIGGER update_meeting_attendance_updated_at
  BEFORE UPDATE ON meeting_attendance
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 6. Add RLS policies
ALTER TABLE substitute_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_attendance ENABLE ROW LEVEL SECURITY;

-- Policy for substitute_requests: Members can see/edit their own, admins can see all in tenant
CREATE POLICY "substitute_requests_tenant_access" ON substitute_requests
  FOR ALL USING (
    tenant_id IN (
      SELECT tenant_id FROM user_roles WHERE user_id = auth.uid()
    )
  );

-- Policy for meeting_attendance: Admins can manage, members can view
CREATE POLICY "meeting_attendance_tenant_access" ON meeting_attendance
  FOR ALL USING (
    tenant_id IN (
      SELECT tenant_id FROM user_roles WHERE user_id = auth.uid()
    )
  );

-- Comment on tables
COMMENT ON TABLE substitute_requests IS 'Stores advance substitute requests from members for meetings';
COMMENT ON TABLE meeting_attendance IS 'Stores PALMS attendance status (Present/Absent/Late/Managed/Substitute) per member per meeting';
COMMENT ON COLUMN meeting_attendance.palms_status IS 'P=Present, A=Absent, L=Late, M=Managed Absence, S=Substitute';
