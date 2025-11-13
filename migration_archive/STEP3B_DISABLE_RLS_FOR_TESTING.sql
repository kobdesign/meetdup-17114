-- =========================================================================
-- STEP 3B: DISABLE RLS (สำหรับทดสอบ)
-- รันเพื่อทดสอบการเชื่อมต่อ database
-- =========================================================================

-- Disable RLS for all tables (เฉพาะการทดสอบ)
ALTER TABLE public.tenants DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.participants DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.meetings DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.checkins DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_registrations DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.status_audit DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.refund_requests DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.plans DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_metrics DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_secrets DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.line_group_mappings DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.rich_menus DISABLE ROW LEVEL SECURITY;

-- ✅ RLS disabled for testing
