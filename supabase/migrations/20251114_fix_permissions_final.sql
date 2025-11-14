-- Migration Fix FINAL: Admin-only invite access + proper deletion
-- Created: 2025-11-14
-- Purpose: Restrict invite visibility to admins only
--
-- Security model:
-- - Only admins can view/create/delete invites
-- - Invite acceptance goes through backend service role (no client access)
-- - Regular members cannot see invite tokens
-- - Admins can revoke compromised invites

-- ============================================
-- Drop all existing policies
-- ============================================

DROP POLICY IF EXISTS "Users can view invites for their tenant" ON public.chapter_invites;
DROP POLICY IF EXISTS "Anyone can accept invites" ON public.chapter_invites;
DROP POLICY IF EXISTS "Public can view invite by token" ON public.chapter_invites;
DROP POLICY IF EXISTS "Tenant members can view chapter invites" ON public.chapter_invites;
DROP POLICY IF EXISTS "Tenant members view chapter invites" ON public.chapter_invites;
DROP POLICY IF EXISTS "Admins can create invites" ON public.chapter_invites;
DROP POLICY IF EXISTS "Admins create invites" ON public.chapter_invites;
DROP POLICY IF EXISTS "Service can update invites" ON public.chapter_invites;

DROP POLICY IF EXISTS "Users can view join requests for their tenant" ON public.chapter_join_requests;
DROP POLICY IF EXISTS "Tenant members can view join requests" ON public.chapter_join_requests;
DROP POLICY IF EXISTS "View join requests" ON public.chapter_join_requests;
DROP POLICY IF EXISTS "Authenticated users can create join requests" ON public.chapter_join_requests;
DROP POLICY IF EXISTS "Users can create join requests" ON public.chapter_join_requests;
DROP POLICY IF EXISTS "Create join request" ON public.chapter_join_requests;
DROP POLICY IF EXISTS "Admins can update join requests" ON public.chapter_join_requests;
DROP POLICY IF EXISTS "Admins update join requests" ON public.chapter_join_requests;
DROP POLICY IF EXISTS "Users can delete own requests" ON public.chapter_join_requests;
DROP POLICY IF EXISTS "Delete own pending request" ON public.chapter_join_requests;

-- ============================================
-- Revoke and re-grant with proper permissions
-- ============================================

REVOKE ALL ON public.chapter_invites FROM authenticated;
REVOKE ALL ON public.chapter_join_requests FROM authenticated;
REVOKE ALL ON public.chapter_invites FROM anon;
REVOKE ALL ON public.chapter_join_requests FROM anon;

-- Chapter Invites: SELECT, INSERT, DELETE for authenticated
-- (RLS restricts to admins only)
GRANT SELECT, INSERT, DELETE ON public.chapter_invites TO authenticated;

-- Join Requests: Full CRUD for authenticated
-- (RLS applies appropriate filters)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chapter_join_requests TO authenticated;

-- Service role: Full access for backend operations
GRANT ALL ON public.chapter_invites TO service_role;
GRANT ALL ON public.chapter_join_requests TO service_role;

-- ============================================
-- Chapter Invites RLS Policies (ADMIN ONLY)
-- ============================================

-- Policy 1: ONLY admins can view invites
CREATE POLICY "Only admins view invites"
  ON public.chapter_invites
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
        AND tenant_id = chapter_invites.tenant_id
        AND role IN ('super_admin', 'chapter_admin')
    )
  );

-- Policy 2: ONLY admins can create invites
CREATE POLICY "Only admins create invites"
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

-- Policy 3: ONLY admins can delete invites (revoke compromised/expired invites)
CREATE POLICY "Only admins delete invites"
  ON public.chapter_invites
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
        AND tenant_id = chapter_invites.tenant_id
        AND role IN ('super_admin', 'chapter_admin')
    )
  );

-- Note: No anon policies - invite acceptance handled by backend service role
-- This prevents:
-- - Public enumeration of invite tokens
-- - Exposure of invite metadata (uses, expiry, etc.)
-- - Brute force token guessing

-- ============================================
-- Chapter Join Requests RLS Policies
-- ============================================

-- Policy 1: Admins see all requests for their chapter; Users see only their own
CREATE POLICY "View join requests"
  ON public.chapter_join_requests
  FOR SELECT
  TO authenticated
  USING (
    -- Admins can see all requests for their chapter
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
        AND tenant_id = chapter_join_requests.tenant_id
        AND role IN ('super_admin', 'chapter_admin')
    )
    OR
    -- Users can see only their own requests
    user_id = auth.uid()
  );

-- Policy 2: Authenticated users can create join requests
CREATE POLICY "Create join request"
  ON public.chapter_join_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
  );

-- Policy 3: ONLY admins can update join requests (approve/reject)
CREATE POLICY "Admins update requests"
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

-- Policy 4: Users can withdraw their own pending requests
CREATE POLICY "Delete own pending request"
  ON public.chapter_join_requests
  FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid() AND status = 'pending'
  );

-- ============================================
-- Security Summary
-- ============================================

/*
INVITE TOKENS (chapter_invites):
- Visibility: Admins ONLY (members cannot see tokens)
- Creation: Admins ONLY
- Deletion: Admins ONLY (for revocation)
- Acceptance: Backend service role ONLY (prevents token enumeration)

JOIN REQUESTS (chapter_join_requests):
- Visibility: Admins see all for their chapter; Users see their own
- Creation: Any authenticated user
- Approval/Rejection: Admins ONLY
- Withdrawal: Users can delete their own pending requests

BACKEND API RESPONSIBILITIES:
- /api/chapters/invite/accept/:token
  → Uses service role to validate token
  → Checks expiration, usage limits
  → Creates user_roles entry
  → Increments uses_count
  → Prevents brute force via rate limiting (recommended)

- /api/chapters/join-request
  → Creates join request
  → Notifies admins (optional)

- /api/chapters/join-requests/:id (PATCH)
  → Admins approve/reject
  → Creates user_roles on approval
  → Updates request status
*/

-- ============================================
-- Verification Queries
-- ============================================

-- Show all policies
SELECT 
  schemaname, 
  tablename, 
  policyname, 
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename IN ('chapter_invites', 'chapter_join_requests')
ORDER BY tablename, policyname;

-- Show all grants
SELECT 
  grantee, 
  table_name, 
  string_agg(privilege_type, ', ' ORDER BY privilege_type) as privileges
FROM information_schema.table_privileges
WHERE table_schema = 'public' 
  AND table_name IN ('chapter_invites', 'chapter_join_requests')
GROUP BY grantee, table_name
ORDER BY table_name, grantee;

-- Test queries (run as admin)
-- SELECT * FROM chapter_invites; -- Should work for admins
-- SELECT * FROM chapter_join_requests; -- Should work for admins

-- Test queries (run as member - should fail/return empty)
-- SELECT * FROM chapter_invites; -- Should return 0 rows (not admin)

-- Migration FINAL completed successfully!
