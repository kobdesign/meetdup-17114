-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create enums
CREATE TYPE app_role AS ENUM ('super_admin', 'chapter_admin', 'member');
CREATE TYPE tenant_status AS ENUM ('active', 'suspended', 'cancelled');
CREATE TYPE participant_status AS ENUM ('prospect', 'invited', 'visitor_pending_payment', 'visitor_paid', 'visitor_attended', 'member_pending', 'member_active', 'member_suspended', 'alumni');
CREATE TYPE payment_status AS ENUM ('pending', 'paid', 'waived', 'failed', 'refunded');
CREATE TYPE checkin_source AS ENUM ('qr', 'line', 'manual');
CREATE TYPE payment_method AS ENUM ('promptpay', 'transfer', 'cash');
CREATE TYPE subscription_status AS ENUM ('active', 'canceled', 'past_due');
CREATE TYPE invoice_status AS ENUM ('paid', 'unpaid', 'void');

-- Create user_roles table (RBAC)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  tenant_id UUID NULL, -- NULL for super_admin, required for chapter_admin/member
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role, tenant_id)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Function to check user role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Function to check tenant access
CREATE OR REPLACE FUNCTION public.has_tenant_access(_user_id UUID, _tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND (tenant_id = _tenant_id OR role = 'super_admin')
  )
$$;

-- RLS policies for user_roles
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Super admins can manage all roles"
  ON public.user_roles FOR ALL
  USING (public.has_role(auth.uid(), 'super_admin'));

-- Create tenants table
CREATE TABLE public.tenants (
  tenant_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  country TEXT NOT NULL DEFAULT 'TH',
  timezone TEXT NOT NULL DEFAULT 'Asia/Bangkok',
  status tenant_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can manage tenants"
  ON public.tenants FOR ALL
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Chapter admins can view their tenant"
  ON public.tenants FOR SELECT
  USING (public.has_tenant_access(auth.uid(), tenant_id));

-- Create plans table
CREATE TABLE public.plans (
  plan_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  monthly_price NUMERIC(10, 2) NOT NULL,
  features JSONB DEFAULT '[]'::jsonb,
  limits JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can manage plans"
  ON public.plans FOR ALL
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Anyone can view plans"
  ON public.plans FOR SELECT
  USING (true);

-- Create subscriptions table
CREATE TABLE public.subscriptions (
  subscription_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(tenant_id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.plans(plan_id),
  status subscription_status NOT NULL DEFAULT 'active',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  current_period_end TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can manage subscriptions"
  ON public.subscriptions FOR ALL
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Chapter admins can view their subscriptions"
  ON public.subscriptions FOR SELECT
  USING (public.has_tenant_access(auth.uid(), tenant_id));

-- Create tenant_settings table
CREATE TABLE public.tenant_settings (
  tenant_id UUID PRIMARY KEY REFERENCES public.tenants(tenant_id) ON DELETE CASCADE,
  branding_color TEXT DEFAULT '#1e40af',
  logo_url TEXT,
  default_visitor_fee NUMERIC(10, 2) DEFAULT 650,
  language TEXT DEFAULT 'th',
  currency TEXT DEFAULT 'THB',
  require_visitor_payment BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tenant_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Chapter admins can manage their settings"
  ON public.tenant_settings FOR ALL
  USING (public.has_tenant_access(auth.uid(), tenant_id));

-- Create tenant_secrets table (encrypted fields)
CREATE TABLE public.tenant_secrets (
  tenant_id UUID PRIMARY KEY REFERENCES public.tenants(tenant_id) ON DELETE CASCADE,
  line_channel_id TEXT,
  line_channel_secret TEXT, -- Should be encrypted via vault
  line_access_token TEXT, -- Should be encrypted via vault
  liff_id_share TEXT,
  liff_id_checkin TEXT,
  payment_qr_payload TEXT,
  payment_provider_keys JSONB DEFAULT '{}'::jsonb, -- Encrypted JSON
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tenant_secrets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Chapter admins can manage their secrets"
  ON public.tenant_secrets FOR ALL
  USING (public.has_tenant_access(auth.uid(), tenant_id));

-- Create invoices table
CREATE TABLE public.invoices (
  invoice_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(tenant_id) ON DELETE CASCADE,
  amount NUMERIC(10, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'THB',
  status invoice_status NOT NULL DEFAULT 'unpaid',
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can manage invoices"
  ON public.invoices FOR ALL
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Chapter admins can view their invoices"
  ON public.invoices FOR SELECT
  USING (public.has_tenant_access(auth.uid(), tenant_id));

-- Create usage_metrics table
CREATE TABLE public.usage_metrics (
  metric_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(tenant_id) ON DELETE CASCADE,
  date DATE NOT NULL,
  active_members INTEGER DEFAULT 0,
  visitors_checked_in INTEGER DEFAULT 0,
  messages_sent INTEGER DEFAULT 0,
  api_calls INTEGER DEFAULT 0,
  storage_mb NUMERIC(10, 2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, date)
);

CREATE INDEX idx_usage_metrics_tenant_date ON public.usage_metrics(tenant_id, date);

ALTER TABLE public.usage_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can manage usage metrics"
  ON public.usage_metrics FOR ALL
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Chapter admins can view their metrics"
  ON public.usage_metrics FOR SELECT
  USING (public.has_tenant_access(auth.uid(), tenant_id));

-- Create participants table
CREATE TABLE public.participants (
  participant_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(tenant_id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  nickname TEXT,
  company TEXT,
  business_type TEXT,
  phone TEXT,
  email TEXT,
  goal TEXT,
  invited_by UUID REFERENCES public.participants(participant_id),
  status participant_status NOT NULL DEFAULT 'prospect',
  payment_status payment_status DEFAULT 'pending',
  joined_date DATE,
  line_user_id TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_participants_tenant ON public.participants(tenant_id);
CREATE INDEX idx_participants_tenant_status ON public.participants(tenant_id, status);
CREATE INDEX idx_participants_line_user ON public.participants(tenant_id, line_user_id);

ALTER TABLE public.participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Chapter users can manage their participants"
  ON public.participants FOR ALL
  USING (public.has_tenant_access(auth.uid(), tenant_id));

-- Create meetings table
CREATE TABLE public.meetings (
  meeting_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(tenant_id) ON DELETE CASCADE,
  meeting_date DATE NOT NULL,
  venue TEXT,
  theme TEXT,
  visitor_fee NUMERIC(10, 2) DEFAULT 650,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_meetings_tenant_date ON public.meetings(tenant_id, meeting_date DESC);

ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Chapter users can manage their meetings"
  ON public.meetings FOR ALL
  USING (public.has_tenant_access(auth.uid(), tenant_id));

-- Create checkins table
CREATE TABLE public.checkins (
  checkin_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(tenant_id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES public.participants(participant_id) ON DELETE CASCADE,
  meeting_id UUID NOT NULL REFERENCES public.meetings(meeting_id) ON DELETE CASCADE,
  checkin_time TIMESTAMPTZ NOT NULL DEFAULT now(),
  source checkin_source NOT NULL DEFAULT 'manual',
  UNIQUE (tenant_id, participant_id, meeting_id)
);

CREATE INDEX idx_checkins_tenant_meeting ON public.checkins(tenant_id, meeting_id);
CREATE INDEX idx_checkins_participant ON public.checkins(participant_id);

ALTER TABLE public.checkins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Chapter users can manage their checkins"
  ON public.checkins FOR ALL
  USING (public.has_tenant_access(auth.uid(), tenant_id));

-- Create payments table
CREATE TABLE public.payments (
  payment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(tenant_id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES public.participants(participant_id) ON DELETE CASCADE,
  meeting_id UUID REFERENCES public.meetings(meeting_id),
  amount NUMERIC(10, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'THB',
  method payment_method NOT NULL,
  status payment_status NOT NULL DEFAULT 'pending',
  provider_ref TEXT,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_payments_tenant ON public.payments(tenant_id);
CREATE INDEX idx_payments_participant ON public.payments(participant_id);
CREATE INDEX idx_payments_meeting ON public.payments(meeting_id);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Chapter users can manage their payments"
  ON public.payments FOR ALL
  USING (public.has_tenant_access(auth.uid(), tenant_id));

-- Create status_audit table
CREATE TABLE public.status_audit (
  audit_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(tenant_id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES public.participants(participant_id) ON DELETE CASCADE,
  from_status participant_status,
  to_status participant_status NOT NULL,
  reason TEXT,
  changed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_status_audit_tenant ON public.status_audit(tenant_id);
CREATE INDEX idx_status_audit_participant ON public.status_audit(participant_id);

ALTER TABLE public.status_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Chapter users can view their audit logs"
  ON public.status_audit FOR SELECT
  USING (public.has_tenant_access(auth.uid(), tenant_id));

CREATE POLICY "Chapter users can insert audit logs"
  ON public.status_audit FOR INSERT
  WITH CHECK (public.has_tenant_access(auth.uid(), tenant_id));

-- Create trigger function for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at triggers
CREATE TRIGGER update_tenants_updated_at
  BEFORE UPDATE ON public.tenants
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tenant_settings_updated_at
  BEFORE UPDATE ON public.tenant_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tenant_secrets_updated_at
  BEFORE UPDATE ON public.tenant_secrets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_participants_updated_at
  BEFORE UPDATE ON public.participants
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default plans
INSERT INTO public.plans (name, monthly_price, features, limits) VALUES
  ('Starter', 0, '["Basic chapter management", "Up to 50 members", "Email support"]'::jsonb, '{"max_members": 50, "max_storage_mb": 100}'::jsonb),
  ('Professional', 2900, '["Unlimited members", "LINE integration", "Priority support", "Advanced analytics"]'::jsonb, '{"max_members": null, "max_storage_mb": 1000}'::jsonb),
  ('Enterprise', 9900, '["All Professional features", "Custom branding", "Dedicated support", "API access"]'::jsonb, '{"max_members": null, "max_storage_mb": 10000}'::jsonb);