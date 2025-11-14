-- Migration: Add chapter_invites and chapter_join_requests tables
-- Created: 2025-11-14
-- Purpose: Enable multi-path user onboarding system (Pioneer, Invite, Discovery flows)
--
-- INSTRUCTIONS:
-- 1. Go to your Supabase Dashboard: https://supabase.com/dashboard/project/sbknunooplaezvwtyooi
-- 2. Navigate to: SQL Editor
-- 3. Paste this entire file and run it
-- 4. Verify tables are created successfully

-- ============================================
-- Table: chapter_invites
-- Purpose: Manage invite tokens for joining chapters
-- ============================================

CREATE TABLE IF NOT EXISTS public.chapter_invites (
  invite_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  token text NOT NULL UNIQUE,
  created_by uuid NOT NULL,
  max_uses integer DEFAULT 1,
  uses_count integer DEFAULT 0,
  expires_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Add foreign key constraint
ALTER TABLE public.chapter_invites
  ADD CONSTRAINT chapter_invites_tenant_id_fkey 
  FOREIGN KEY (tenant_id) 
  REFERENCES public.tenants(tenant_id) 
  ON DELETE CASCADE;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_chapter_invites_tenant_id 
  ON public.chapter_invites(tenant_id);

CREATE INDEX IF NOT EXISTS idx_chapter_invites_token 
  ON public.chapter_invites(token);

-- ============================================
-- Table: chapter_join_requests
-- Purpose: Manage membership requests to join chapters
-- ============================================

CREATE TABLE IF NOT EXISTS public.chapter_join_requests (
  request_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  message text,
  approved_by uuid,
  approved_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Add foreign key constraint
ALTER TABLE public.chapter_join_requests
  ADD CONSTRAINT chapter_join_requests_tenant_id_fkey 
  FOREIGN KEY (tenant_id) 
  REFERENCES public.tenants(tenant_id) 
  ON DELETE CASCADE;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_chapter_join_requests_tenant_id 
  ON public.chapter_join_requests(tenant_id);

CREATE INDEX IF NOT EXISTS idx_chapter_join_requests_user_id 
  ON public.chapter_join_requests(user_id);

CREATE INDEX IF NOT EXISTS idx_chapter_join_requests_status 
  ON public.chapter_join_requests(status);

-- ============================================
-- Grant Permissions
-- ============================================

-- Grant permissions to authenticated users (via RLS policies)
GRANT ALL ON public.chapter_invites TO authenticated;
GRANT ALL ON public.chapter_join_requests TO authenticated;

-- Grant permissions to service_role (for server-side operations)
GRANT ALL ON public.chapter_invites TO service_role;
GRANT ALL ON public.chapter_join_requests TO service_role;

-- Grant permissions to anon (for public invite acceptance)
GRANT SELECT, INSERT ON public.chapter_invites TO anon;
GRANT SELECT, INSERT ON public.chapter_join_requests TO anon;

-- ============================================
-- Enable Row Level Security (RLS)
-- ============================================

ALTER TABLE public.chapter_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chapter_join_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view invites for their tenant
CREATE POLICY "Users can view invites for their tenant"
  ON public.chapter_invites
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM user_roles 
      WHERE user_id = auth.uid()
    )
  );

-- RLS Policy: Admins can create invites
CREATE POLICY "Admins can create invites"
  ON public.chapter_invites
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
        AND tenant_id = chapter_invites.tenant_id
        AND role IN ('super_admin', 'chapter_admin')
    )
  );

-- RLS Policy: Anyone can accept invites (read token)
CREATE POLICY "Anyone can accept invites"
  ON public.chapter_invites
  FOR SELECT
  USING (true);

-- RLS Policy: Users can view join requests for their tenant
CREATE POLICY "Users can view join requests for their tenant"
  ON public.chapter_join_requests
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM user_roles 
      WHERE user_id = auth.uid()
    )
  );

-- RLS Policy: Authenticated users can create join requests
CREATE POLICY "Authenticated users can create join requests"
  ON public.chapter_join_requests
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- RLS Policy: Admins can update join requests
CREATE POLICY "Admins can update join requests"
  ON public.chapter_join_requests
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
        AND tenant_id = chapter_join_requests.tenant_id
        AND role IN ('super_admin', 'chapter_admin')
    )
  );

-- ============================================
-- Verification Queries
-- ============================================

-- Run these to verify the migration succeeded:
-- SELECT COUNT(*) FROM public.chapter_invites;
-- SELECT COUNT(*) FROM public.chapter_join_requests;
-- SHOW search_path;

-- Migration completed successfully!
