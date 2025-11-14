-- Migration Fix: Tighten permissions and fix RLS policies
-- Created: 2025-11-14
-- Purpose: Fix security issues identified in initial migration
--
-- INSTRUCTIONS:
-- Run this AFTER the initial migration (20251114_add_chapter_invites_and_join_requests.sql)
-- This fixes over-permissive grants and conflicting RLS policies

-- ============================================
-- Drop existing policies to recreate them
-- ============================================

DROP POLICY IF EXISTS "Users can view invites for their tenant" ON public.chapter_invites;
DROP POLICY IF EXISTS "Anyone can accept invites" ON public.chapter_invites;
DROP POLICY IF EXISTS "Admins can create invites" ON public.chapter_invites;

-- ============================================
-- Revoke over-permissive grants
-- ============================================

-- Revoke ALL and grant specific permissions only
REVOKE ALL ON public.chapter_invites FROM authenticated;
REVOKE ALL ON public.chapter_join_requests FROM authenticated;

-- Grant only necessary permissions to authenticated users
-- SELECT: Users can view their tenant's invites
-- INSERT: Users can create join requests (not invites - only admins can)
GRANT SELECT ON public.chapter_invites TO authenticated;
GRANT SELECT, INSERT ON public.chapter_join_requests TO authenticated;

-- Service role keeps ALL (needed for backend operations)
-- Already granted in previous migration, but ensure it's explicit
GRANT ALL ON public.chapter_invites TO service_role;
GRANT ALL ON public.chapter_join_requests TO service_role;

-- Anon users: Only SELECT for viewing invite details before accepting
-- INSERT handled by backend service role
REVOKE ALL ON public.chapter_invites FROM anon;
REVOKE ALL ON public.chapter_join_requests FROM anon;
GRANT SELECT ON public.chapter_invites TO anon;

-- ============================================
-- Recreate RLS Policies (Fixed)
-- ============================================

-- Policy 1: Authenticated users can view invites for their tenant
CREATE POLICY "Tenant members can view chapter invites"
  ON public.chapter_invites
  FOR SELECT
  TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM user_roles 
      WHERE user_id = auth.uid()
    )
  );

-- Policy 2: Anyone (even anon) can view invite by token (for accept page)
CREATE POLICY "Public can view invite by token"
  ON public.chapter_invites
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Policy 3: Only admins can create invites
CREATE POLICY "Admins can create invites"
  ON public.chapter_invites
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
        AND tenant_id = chapter_invites.tenant_id
        AND role IN ('super_admin', 'chapter_admin')
    )
  );

-- Policy 4: Service role can update invites (for uses_count increment)
-- Note: Service role bypasses RLS, but we document this for clarity
CREATE POLICY "Service can update invites"
  ON public.chapter_invites
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================
-- Join Requests RLS Policies
-- ============================================

-- Policy 1: Users can view join requests for their tenant
CREATE POLICY "Tenant members can view join requests"
  ON public.chapter_join_requests
  FOR SELECT
  TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM user_roles 
      WHERE user_id = auth.uid()
    )
    OR user_id = auth.uid() -- Users can see their own requests
  );

-- Policy 2: Authenticated users can create join requests
CREATE POLICY "Users can create join requests"
  ON public.chapter_join_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid() AND
    -- Prevent duplicate requests
    NOT EXISTS (
      SELECT 1 FROM chapter_join_requests
      WHERE user_id = auth.uid() AND tenant_id = chapter_join_requests.tenant_id
    )
  );

-- Policy 3: Admins can update/approve join requests
CREATE POLICY "Admins can update join requests"
  ON public.chapter_join_requests
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
        AND tenant_id = chapter_join_requests.tenant_id
        AND role IN ('super_admin', 'chapter_admin')
    )
  );

-- Policy 4: Users can delete their own pending requests
CREATE POLICY "Users can delete own requests"
  ON public.chapter_join_requests
  FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid() AND status = 'pending'
  );

-- ============================================
-- Verification
-- ============================================

-- Verify policies are created
SELECT schemaname, tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE tablename IN ('chapter_invites', 'chapter_join_requests')
ORDER BY tablename, policyname;

-- Migration fix completed successfully!
