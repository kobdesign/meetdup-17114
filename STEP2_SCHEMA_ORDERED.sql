-- =========================================================================
-- STEP 2: CREATE SCHEMA (เรียงลำดับถูกต้อง)
-- รันหลัง CLEAN_DATABASE.sql
-- =========================================================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =========================================================================
-- TYPES
-- =========================================================================

CREATE TYPE public.app_role AS ENUM (
    'super_admin',
    'chapter_admin',
    'member'
);

CREATE TYPE public.approval_status AS ENUM (
    'pending',
    'approved',
    'rejected'
);

CREATE TYPE public.checkin_status AS ENUM (
    'pending',
    'approved',
    'rejected'
);

CREATE TYPE public.line_event_type AS ENUM (
    'message',
    'follow',
    'unfollow',
    'join',
    'leave',
    'postback',
    'beacon',
    'accountLink',
    'things'
);

CREATE TYPE public.participant_status AS ENUM (
    'prospect',
    'visitor',
    'member',
    'alumni'
);

CREATE TYPE public.payment_method AS ENUM (
    'promptpay',
    'transfer',
    'cash'
);

CREATE TYPE public.payment_status AS ENUM (
    'pending',
    'completed',
    'failed',
    'refunded'
);

CREATE TYPE public.plan_type AS ENUM (
    'free',
    'basic',
    'premium'
);

CREATE TYPE public.refund_status AS ENUM (
    'pending',
    'approved',
    'rejected',
    'completed'
);

CREATE TYPE public.registration_status AS ENUM (
    'registered',
    'attended',
    'absent',
    'cancelled'
);

-- =========================================================================
-- TABLES (เรียงตาม Dependencies)
-- =========================================================================

-- 1. tenants (ไม่มี dependencies)
CREATE TABLE public.tenants (
    tenant_id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_name text NOT NULL,
    subdomain text NOT NULL UNIQUE,
    line_bot_basic_id text,
    logo_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- 2. profiles (depends on auth.users - Supabase built-in)
CREATE TABLE public.profiles (
    id uuid NOT NULL PRIMARY KEY,
    full_name text,
    avatar_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- 3. user_roles (depends on tenants, profiles)
CREATE TABLE public.user_roles (
    user_id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    role public.app_role NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    PRIMARY KEY (user_id, tenant_id),
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
    FOREIGN KEY (tenant_id) REFERENCES public.tenants(tenant_id) ON DELETE CASCADE
);

-- 4. participants (depends on tenants only)
CREATE TABLE public.participants (
    participant_id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid NOT NULL,
    full_name text NOT NULL,
    email text,
    phone text,
    company text,
    profession text,
    line_user_id text,
    status public.participant_status DEFAULT 'prospect' NOT NULL,
    invited_by uuid,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    FOREIGN KEY (tenant_id) REFERENCES public.tenants(tenant_id) ON DELETE CASCADE,
    FOREIGN KEY (invited_by) REFERENCES public.participants(participant_id)
);

-- 5. meetings (depends on tenants, participants)
CREATE TABLE public.meetings (
    meeting_id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid NOT NULL,
    meeting_name text NOT NULL,
    meeting_date timestamp with time zone NOT NULL,
    venue text,
    venue_lat numeric,
    venue_lng numeric,
    organizer_id uuid,
    recurrence_rule text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    FOREIGN KEY (tenant_id) REFERENCES public.tenants(tenant_id) ON DELETE CASCADE,
    FOREIGN KEY (organizer_id) REFERENCES public.participants(participant_id)
);

-- 6. checkins (depends on participants, meetings)
CREATE TABLE public.checkins (
    checkin_id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    participant_id uuid NOT NULL,
    meeting_id uuid NOT NULL,
    checkin_time timestamp with time zone DEFAULT now() NOT NULL,
    status public.checkin_status DEFAULT 'approved' NOT NULL,
    notes text,
    FOREIGN KEY (participant_id) REFERENCES public.participants(participant_id) ON DELETE CASCADE,
    FOREIGN KEY (meeting_id) REFERENCES public.meetings(meeting_id) ON DELETE CASCADE
);

-- 7. meeting_registrations (depends on participants, meetings)
CREATE TABLE public.meeting_registrations (
    registration_id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    participant_id uuid NOT NULL,
    meeting_id uuid NOT NULL,
    registration_status public.registration_status DEFAULT 'registered' NOT NULL,
    registered_at timestamp with time zone DEFAULT now() NOT NULL,
    FOREIGN KEY (participant_id) REFERENCES public.participants(participant_id) ON DELETE CASCADE,
    FOREIGN KEY (meeting_id) REFERENCES public.meetings(meeting_id) ON DELETE CASCADE
);

-- 8. status_audit (depends on participants)
CREATE TABLE public.status_audit (
    audit_id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    participant_id uuid NOT NULL,
    previous_status public.participant_status,
    new_status public.participant_status NOT NULL,
    changed_by uuid,
    changed_at timestamp with time zone DEFAULT now() NOT NULL,
    notes text,
    FOREIGN KEY (participant_id) REFERENCES public.participants(participant_id) ON DELETE CASCADE,
    FOREIGN KEY (changed_by) REFERENCES auth.users(id)
);

-- 9. payments (depends on participants)
CREATE TABLE public.payments (
    payment_id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    participant_id uuid NOT NULL,
    amount numeric(10,2) NOT NULL,
    payment_method public.payment_method NOT NULL,
    payment_status public.payment_status DEFAULT 'pending' NOT NULL,
    payment_slip_url text,
    payment_date timestamp with time zone,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    FOREIGN KEY (participant_id) REFERENCES public.participants(participant_id) ON DELETE CASCADE
);

-- 10. refund_requests (depends on payments)
CREATE TABLE public.refund_requests (
    refund_id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    payment_id uuid NOT NULL,
    reason text NOT NULL,
    refund_status public.refund_status DEFAULT 'pending' NOT NULL,
    requested_at timestamp with time zone DEFAULT now() NOT NULL,
    processed_at timestamp with time zone,
    processed_by uuid,
    admin_notes text,
    FOREIGN KEY (payment_id) REFERENCES public.payments(payment_id) ON DELETE CASCADE,
    FOREIGN KEY (processed_by) REFERENCES auth.users(id)
);

-- 11. invoices (depends on payments)
CREATE TABLE public.invoices (
    invoice_id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    payment_id uuid NOT NULL,
    invoice_number text NOT NULL UNIQUE,
    issued_date timestamp with time zone DEFAULT now() NOT NULL,
    due_date timestamp with time zone,
    total_amount numeric(10,2) NOT NULL,
    invoice_url text,
    FOREIGN KEY (payment_id) REFERENCES public.payments(payment_id) ON DELETE CASCADE
);

-- 12. plans (independent)
CREATE TABLE public.plans (
    plan_id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    plan_name text NOT NULL,
    plan_type public.plan_type NOT NULL,
    price numeric(10,2) NOT NULL,
    max_members integer,
    features jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- 13. subscriptions (depends on tenants, plans)
CREATE TABLE public.subscriptions (
    subscription_id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid NOT NULL,
    plan_id uuid NOT NULL,
    start_date timestamp with time zone DEFAULT now() NOT NULL,
    end_date timestamp with time zone,
    auto_renew boolean DEFAULT false NOT NULL,
    FOREIGN KEY (tenant_id) REFERENCES public.tenants(tenant_id) ON DELETE CASCADE,
    FOREIGN KEY (plan_id) REFERENCES public.plans(plan_id)
);

-- 14. usage_metrics (depends on tenants)
CREATE TABLE public.usage_metrics (
    metric_id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid NOT NULL,
    metric_type text NOT NULL,
    metric_value integer NOT NULL,
    recorded_at timestamp with time zone DEFAULT now() NOT NULL,
    FOREIGN KEY (tenant_id) REFERENCES public.tenants(tenant_id) ON DELETE CASCADE
);

-- 15. tenant_settings (depends on tenants)
CREATE TABLE public.tenant_settings (
    setting_id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid NOT NULL,
    setting_key text NOT NULL,
    setting_value jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    FOREIGN KEY (tenant_id) REFERENCES public.tenants(tenant_id) ON DELETE CASCADE,
    UNIQUE (tenant_id, setting_key)
);

-- 16. tenant_secrets (depends on tenants) - encrypted LINE credentials
CREATE TABLE public.tenant_secrets (
    secret_id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid NOT NULL,
    line_channel_id text,
    line_channel_secret_encrypted text,
    line_access_token_encrypted text,
    encryption_key_version integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    FOREIGN KEY (tenant_id) REFERENCES public.tenants(tenant_id) ON DELETE CASCADE,
    UNIQUE (tenant_id)
);

-- 17. integration_logs (depends on tenants)
CREATE TABLE public.integration_logs (
    log_id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid,
    event_type public.line_event_type NOT NULL,
    event_data jsonb NOT NULL,
    response_data jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    FOREIGN KEY (tenant_id) REFERENCES public.tenants(tenant_id) ON DELETE SET NULL
);

-- 18. LINE integration tables (depends on tenants)
CREATE TABLE public.line_group_mappings (
    mapping_id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid NOT NULL,
    line_group_id text NOT NULL,
    group_name text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    FOREIGN KEY (tenant_id) REFERENCES public.tenants(tenant_id) ON DELETE CASCADE,
    UNIQUE (tenant_id, line_group_id)
);

CREATE TABLE public.rich_menus (
    menu_id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid NOT NULL,
    line_rich_menu_id text NOT NULL,
    name text NOT NULL,
    chat_bar_text text NOT NULL,
    template jsonb NOT NULL,
    is_default boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    FOREIGN KEY (tenant_id) REFERENCES public.tenants(tenant_id) ON DELETE CASCADE
);

-- =========================================================================
-- FUNCTIONS
-- =========================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$;

-- =========================================================================
-- TRIGGERS
-- =========================================================================

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- =========================================================================
-- INDEXES
-- =========================================================================

CREATE INDEX idx_checkins_participant ON public.checkins(participant_id);
CREATE INDEX idx_checkins_meeting ON public.checkins(meeting_id);
CREATE INDEX idx_integration_logs_tenant ON public.integration_logs(tenant_id);
CREATE INDEX idx_integration_logs_created ON public.integration_logs(created_at);
CREATE INDEX idx_line_group_mappings_tenant ON public.line_group_mappings(tenant_id);
CREATE INDEX idx_line_group_mappings_group ON public.line_group_mappings(line_group_id);
CREATE INDEX idx_meeting_registrations_participant ON public.meeting_registrations(participant_id);
CREATE INDEX idx_meeting_registrations_meeting ON public.meeting_registrations(meeting_id);
CREATE INDEX idx_meetings_tenant ON public.meetings(tenant_id);
CREATE INDEX idx_meetings_date ON public.meetings(meeting_date);
CREATE INDEX idx_participants_tenant ON public.participants(tenant_id);
CREATE INDEX idx_participants_status ON public.participants(status);
CREATE INDEX idx_participants_line_user ON public.participants(line_user_id);
CREATE INDEX idx_payments_participant ON public.payments(participant_id);
CREATE INDEX idx_payments_status ON public.payments(payment_status);
CREATE INDEX idx_refund_requests_payment ON public.refund_requests(payment_id);
CREATE INDEX idx_refund_requests_status ON public.refund_requests(refund_status);
CREATE INDEX idx_rich_menus_tenant ON public.rich_menus(tenant_id);
CREATE INDEX idx_status_audit_participant ON public.status_audit(participant_id);
CREATE INDEX idx_subscriptions_tenant ON public.subscriptions(tenant_id);
CREATE INDEX idx_tenant_secrets_tenant ON public.tenant_secrets(tenant_id);
CREATE INDEX idx_tenant_settings_tenant ON public.tenant_settings(tenant_id);
CREATE INDEX idx_usage_metrics_tenant ON public.usage_metrics(tenant_id);
CREATE INDEX idx_user_roles_tenant ON public.user_roles(tenant_id);

-- =========================================================================
-- ROW LEVEL SECURITY (RLS)
-- =========================================================================

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.status_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refund_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.line_group_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rich_menus ENABLE ROW LEVEL SECURITY;

-- =========================================================================
-- RLS POLICIES (Basic - Allow service role full access)
-- =========================================================================

-- Tenants
CREATE POLICY "Service role can manage tenants" ON public.tenants
  USING (true) WITH CHECK (true);

-- Profiles
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Other tables: Service role full access (for Express backend)
CREATE POLICY "Service role full access" ON public.user_roles USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON public.participants USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON public.meetings USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON public.checkins USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON public.meeting_registrations USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON public.status_audit USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON public.payments USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON public.refund_requests USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON public.invoices USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON public.plans USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON public.subscriptions USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON public.usage_metrics USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON public.tenant_settings USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON public.tenant_secrets USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON public.integration_logs USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON public.line_group_mappings USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON public.rich_menus USING (true) WITH CHECK (true);

-- ✅ Migration complete!
