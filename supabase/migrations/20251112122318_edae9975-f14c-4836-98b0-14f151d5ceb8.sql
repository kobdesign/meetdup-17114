-- Create meeting_registrations table
CREATE TABLE public.meeting_registrations (
  registration_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES public.meetings(meeting_id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES public.participants(participant_id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(tenant_id) ON DELETE CASCADE,
  registered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  registration_status TEXT DEFAULT 'registered',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(meeting_id, participant_id)
);

-- Enable RLS
ALTER TABLE public.meeting_registrations ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Chapter users can view their registrations"
  ON public.meeting_registrations
  FOR SELECT
  USING (public.has_tenant_access(auth.uid(), tenant_id));

CREATE POLICY "Chapter users can manage their registrations"
  ON public.meeting_registrations
  FOR ALL
  USING (public.has_tenant_access(auth.uid(), tenant_id))
  WITH CHECK (public.has_tenant_access(auth.uid(), tenant_id));

-- Create indexes for performance
CREATE INDEX idx_meeting_registrations_meeting ON public.meeting_registrations(meeting_id);
CREATE INDEX idx_meeting_registrations_participant ON public.meeting_registrations(participant_id);
CREATE INDEX idx_meeting_registrations_tenant ON public.meeting_registrations(tenant_id);

-- Add description field to meetings table for rich content
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS description TEXT;