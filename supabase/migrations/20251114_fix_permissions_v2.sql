-- Migration Fix V2: Correct permissions and secure RLS policies
-- Created: 2025-11-14
-- Purpose: Fix over-permissive and under-permissive grants
--
-- Issues addressed:
-- 1. Restore INSERT grant for admins to create invites
-- 2. Add UPDATE/DELETE grants for join request management
-- 3. Tighten anon SELECT policy to prevent data exposure
-- 4. Maintain least-privilege principle

-- ============================================
-- Drop existing policies to recreate them
-- ============================================

DROP POLICY IF EXISTS "Users can view invites for their tenant" ON public.chapter_invites;
DROP POLICY IF EXISTS "Anyone can accept invites" ON public.chapter_invites;
DROP POLICY IF EXISTS "Public can view invite by token" ON public.chapter_invites;
DROP POLICY IF EXISTS "Tenant members can view chapter invites" ON public.chapter_invites;
DROP POLICY IF EXISTS "Admins can create invites" ON public.chapter_invites;
DROP POLICY IF EXISTS "Service can update invites" ON public.chapter_invites;

DROP POLICY IF EXISTS "Users can view join requests for their tenant" ON public.chapter_join_requests;
DROP POLICY IF EXISTS "Tenant members can view join requests" ON public.chapter_join_requests;
DROP POLICY IF EXISTS "Authenticated users can create join requests" ON public.chapter_join_requests;
DROP POLICY IF EXISTS "Users can create join requests" ON public.chapter_join_requests;
DROP POLICY IF EXISTS "Admins can update join requests" ON public.chapter_join_requests;
DROP POLICY IF EXISTS "Users can delete own requests" ON public.chapter_join_requests;

-- ============================================
-- Revoke over-permissive grants
-- ============================================

REVOKE ALL ON public.chapter_invites FROM authenticated;
REVOKE ALL ON public.chapter_join_requests FROM authenticated;
REVOKE ALL ON public.chapter_invites FROM anon;
REVOKE ALL ON public.chapter_join_requests FROM anon;

-- ============================================
-- Grant appropriate permissions
-- ============================================

-- Authenticated users can:
-- - SELECT invites (filtered by RLS to their tenant)
-- - INSERT invites (filtered by RLS to admins only)
-- - No UPDATE/DELETE (service role handles uses_count, admins can delete via service role)
GRANT SELECT, INSERT ON public.chapter_invites TO authenticated;

-- Authenticated users can:
-- - SELECT join requests (filtered by RLS)
-- - INSERT join requests (create membership requests)
-- - UPDATE join requests (admins approve/reject)
-- - DELETE join requests (users withdraw pending requests)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chapter_join_requests TO authenticated;

-- Anonymous users can:
-- - No direct access (invite acceptance goes through service role backend)
-- This prevents exposing all invite metadata to public
-- Backend API will handle token validation and acceptance

-- Service role keeps ALL for backend operations
GRANT ALL ON public.chapter_invites TO service_role;
GRANT ALL ON public.chapter_join_requests TO service_role;

-- ============================================
-- Chapter Invites RLS Policies
-- ============================================

-- Policy 1: Tenant members can view their chapter's invites
CREATE POLICY "Tenant members view chapter invites"
  ON public.chapter_invites
  FOR SELECT
  TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM user_roles 
      WHERE user_id = auth.uid()
    )
  );

-- Policy 2: Admins can create invites for their chapter
CREATE POLICY "Admins create invites"
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

-- Note: No anon SELECT policy - invite acceptance goes through backend API
-- This prevents exposing invite metadata (tenant_id, uses, expiry) to public
-- Backend will use service role to validate token and process acceptance

-- ============================================
-- Chapter Join Requests RLS Policies  
-- ============================================

-- Policy 1: Users can view requests for their tenant OR their own requests
CREATE POLICY "View join requests"
  ON public.chapter_join_requests
  FOR SELECT
  TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM user_roles 
      WHERE user_id = auth.uid()
    )
    OR user_id = auth.uid()
  );

-- Policy 2: Authenticated users can create join requests
CREATE POLICY "Create join request"
  ON public.chapter_join_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
  );

-- Policy 3: Admins can approve/reject requests for their chapter
CREATE POLICY "Admins update join requests"
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
CREATE POLICY "Delete own pending request"
  ON public.chapter_join_requests
  FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid() AND status = 'pending'
  );

-- ============================================
-- Verification Queries
-- ============================================

-- Verify policies
SELECT 
  schemaname, 
  tablename, 
  policyname, 
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename IN ('chapter_invites', 'chapter_join_requests')
ORDER BY tablename, policyname;

-- Verify grants
SELECT 
  grantee, 
  table_name, 
  string_agg(privilege_type, ', ' ORDER BY privilege_type) as privileges
FROM information_schema.table_privileges
WHERE table_schema = 'public' 
  AND table_name IN ('chapter_invites', 'chapter_join_requests')
GROUP BY grantee, table_name
ORDER BY table_name, grantee;

-- Migration fix V2 completed successfully!
