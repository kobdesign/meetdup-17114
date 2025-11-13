--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: app_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.app_role AS ENUM (
    'super_admin',
    'chapter_admin',
    'member'
);


--
-- Name: approval_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.approval_status AS ENUM (
    'pending',
    'approved',
    'rejected'
);


--
-- Name: checkin_source; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.checkin_source AS ENUM (
    'qr',
    'line',
    'manual'
);


--
-- Name: invoice_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.invoice_status AS ENUM (
    'paid',
    'unpaid',
    'void'
);


--
-- Name: participant_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.participant_status AS ENUM (
    'prospect',
    'visitor',
    'declined',
    'member',
    'alumni'
);


--
-- Name: payment_method; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.payment_method AS ENUM (
    'promptpay',
    'transfer',
    'cash'
);


--
-- Name: payment_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.payment_status AS ENUM (
    'pending',
    'paid',
    'waived',
    'failed',
    'refunded'
);


--
-- Name: subscription_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.subscription_status AS ENUM (
    'active',
    'canceled',
    'past_due'
);


--
-- Name: tenant_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.tenant_status AS ENUM (
    'active',
    'suspended',
    'cancelled'
);


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'full_name'
  );
  RETURN new;
END;
$$;


--
-- Name: has_role(uuid, public.app_role); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;


--
-- Name: has_tenant_access(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_tenant_access(_user_id uuid, _tenant_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND (
        role = 'super_admin' 
        OR tenant_id = _tenant_id
      )
  )
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


SET default_table_access_method = heap;

--
-- Name: checkins; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.checkins (
    checkin_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    participant_id uuid NOT NULL,
    meeting_id uuid NOT NULL,
    checkin_time timestamp with time zone DEFAULT now() NOT NULL,
    source public.checkin_source DEFAULT 'manual'::public.checkin_source NOT NULL
);


--
-- Name: integration_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.integration_logs (
    log_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    source text NOT NULL,
    event_type text NOT NULL,
    payload jsonb,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: invoices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invoices (
    invoice_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    amount numeric(10,2) NOT NULL,
    currency text DEFAULT 'THB'::text NOT NULL,
    status public.invoice_status DEFAULT 'unpaid'::public.invoice_status NOT NULL,
    period_start timestamp with time zone NOT NULL,
    period_end timestamp with time zone NOT NULL,
    issued_at timestamp with time zone DEFAULT now() NOT NULL,
    paid_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: meeting_registrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.meeting_registrations (
    registration_id uuid DEFAULT gen_random_uuid() NOT NULL,
    meeting_id uuid NOT NULL,
    participant_id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    registered_at timestamp with time zone DEFAULT now(),
    registration_status text DEFAULT 'registered'::text,
    notes text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: meetings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.meetings (
    meeting_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    meeting_date date NOT NULL,
    venue text,
    theme text,
    visitor_fee numeric(10,2) DEFAULT 650,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    recurrence_pattern text,
    recurrence_interval integer DEFAULT 1,
    recurrence_end_date date,
    recurrence_days_of_week text[],
    location_details text,
    location_lat numeric(10,8),
    location_lng numeric(11,8),
    meeting_time time without time zone,
    description text,
    parent_meeting_id uuid,
    CONSTRAINT meetings_recurrence_pattern_check CHECK ((recurrence_pattern = ANY (ARRAY['none'::text, 'daily'::text, 'weekly'::text, 'monthly'::text, 'yearly'::text, 'weekdays'::text, 'custom'::text])))
);


--
-- Name: participants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.participants (
    participant_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    full_name text NOT NULL,
    nickname text,
    company text,
    business_type text,
    phone text,
    email text,
    goal text,
    invited_by uuid,
    joined_date date,
    line_user_id text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    status public.participant_status DEFAULT 'prospect'::public.participant_status NOT NULL
);


--
-- Name: payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payments (
    payment_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    participant_id uuid NOT NULL,
    meeting_id uuid,
    amount numeric(10,2) NOT NULL,
    currency text DEFAULT 'THB'::text NOT NULL,
    method public.payment_method NOT NULL,
    status public.payment_status DEFAULT 'pending'::public.payment_status NOT NULL,
    provider_ref text,
    paid_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    slip_url text,
    notes text
);


--
-- Name: plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.plans (
    plan_id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    monthly_price numeric(10,2) NOT NULL,
    features jsonb DEFAULT '[]'::jsonb,
    limits jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    full_name text,
    avatar_url text,
    phone text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: refund_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.refund_requests (
    request_id uuid DEFAULT gen_random_uuid() NOT NULL,
    payment_id uuid NOT NULL,
    requested_by uuid NOT NULL,
    approved_by uuid,
    reason text NOT NULL,
    status public.approval_status DEFAULT 'pending'::public.approval_status NOT NULL,
    requested_at timestamp with time zone DEFAULT now() NOT NULL,
    processed_at timestamp with time zone,
    admin_notes text,
    tenant_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: status_audit; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.status_audit (
    audit_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    participant_id uuid NOT NULL,
    reason text,
    changed_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscriptions (
    subscription_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    plan_id uuid NOT NULL,
    status public.subscription_status DEFAULT 'active'::public.subscription_status NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    current_period_end timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: tenant_secrets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenant_secrets (
    tenant_id uuid NOT NULL,
    line_channel_id text,
    line_channel_secret text,
    line_access_token text,
    liff_id_share text,
    liff_id_checkin text,
    payment_qr_payload text,
    payment_provider_keys jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: tenant_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenant_settings (
    tenant_id uuid NOT NULL,
    branding_color text DEFAULT '#1e40af'::text,
    logo_url text,
    default_visitor_fee numeric(10,2) DEFAULT 650,
    language text DEFAULT 'th'::text,
    currency text DEFAULT 'THB'::text,
    require_visitor_payment boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: tenants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenants (
    tenant_id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    country text DEFAULT 'TH'::text NOT NULL,
    timezone text DEFAULT 'Asia/Bangkok'::text NOT NULL,
    status public.tenant_status DEFAULT 'active'::public.tenant_status NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: usage_metrics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.usage_metrics (
    metric_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    date date NOT NULL,
    active_members integer DEFAULT 0,
    visitors_checked_in integer DEFAULT 0,
    messages_sent integer DEFAULT 0,
    api_calls integer DEFAULT 0,
    storage_mb numeric(10,2) DEFAULT 0,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role public.app_role NOT NULL,
    tenant_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: checkins checkins_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checkins
    ADD CONSTRAINT checkins_pkey PRIMARY KEY (checkin_id);


--
-- Name: checkins checkins_tenant_id_participant_id_meeting_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checkins
    ADD CONSTRAINT checkins_tenant_id_participant_id_meeting_id_key UNIQUE (tenant_id, participant_id, meeting_id);


--
-- Name: integration_logs integration_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.integration_logs
    ADD CONSTRAINT integration_logs_pkey PRIMARY KEY (log_id);


--
-- Name: invoices invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_pkey PRIMARY KEY (invoice_id);


--
-- Name: meeting_registrations meeting_registrations_meeting_id_participant_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meeting_registrations
    ADD CONSTRAINT meeting_registrations_meeting_id_participant_id_key UNIQUE (meeting_id, participant_id);


--
-- Name: meeting_registrations meeting_registrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meeting_registrations
    ADD CONSTRAINT meeting_registrations_pkey PRIMARY KEY (registration_id);


--
-- Name: meetings meetings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meetings
    ADD CONSTRAINT meetings_pkey PRIMARY KEY (meeting_id);


--
-- Name: participants participants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.participants
    ADD CONSTRAINT participants_pkey PRIMARY KEY (participant_id);


--
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (payment_id);


--
-- Name: plans plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plans
    ADD CONSTRAINT plans_pkey PRIMARY KEY (plan_id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: refund_requests refund_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refund_requests
    ADD CONSTRAINT refund_requests_pkey PRIMARY KEY (request_id);


--
-- Name: status_audit status_audit_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.status_audit
    ADD CONSTRAINT status_audit_pkey PRIMARY KEY (audit_id);


--
-- Name: subscriptions subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_pkey PRIMARY KEY (subscription_id);


--
-- Name: tenant_secrets tenant_secrets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_secrets
    ADD CONSTRAINT tenant_secrets_pkey PRIMARY KEY (tenant_id);


--
-- Name: tenant_settings tenant_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_settings
    ADD CONSTRAINT tenant_settings_pkey PRIMARY KEY (tenant_id);


--
-- Name: tenants tenants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_pkey PRIMARY KEY (tenant_id);


--
-- Name: tenants tenants_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_slug_key UNIQUE (slug);


--
-- Name: participants unique_tenant_line_user; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.participants
    ADD CONSTRAINT unique_tenant_line_user UNIQUE (tenant_id, line_user_id);


--
-- Name: usage_metrics usage_metrics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usage_metrics
    ADD CONSTRAINT usage_metrics_pkey PRIMARY KEY (metric_id);


--
-- Name: usage_metrics usage_metrics_tenant_id_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usage_metrics
    ADD CONSTRAINT usage_metrics_tenant_id_date_key UNIQUE (tenant_id, date);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_user_id_role_tenant_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_role_tenant_id_key UNIQUE (user_id, role, tenant_id);


--
-- Name: idx_checkins_participant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_checkins_participant ON public.checkins USING btree (participant_id);


--
-- Name: idx_checkins_tenant_meeting; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_checkins_tenant_meeting ON public.checkins USING btree (tenant_id, meeting_id);


--
-- Name: idx_integration_logs_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_integration_logs_created_at ON public.integration_logs USING btree (created_at DESC);


--
-- Name: idx_integration_logs_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_integration_logs_source ON public.integration_logs USING btree (source);


--
-- Name: idx_integration_logs_tenant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_integration_logs_tenant_id ON public.integration_logs USING btree (tenant_id);


--
-- Name: idx_integration_logs_tenant_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_integration_logs_tenant_source ON public.integration_logs USING btree (tenant_id, source);


--
-- Name: idx_meeting_registrations_meeting; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_meeting_registrations_meeting ON public.meeting_registrations USING btree (meeting_id);


--
-- Name: idx_meeting_registrations_participant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_meeting_registrations_participant ON public.meeting_registrations USING btree (participant_id);


--
-- Name: idx_meeting_registrations_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_meeting_registrations_tenant ON public.meeting_registrations USING btree (tenant_id);


--
-- Name: idx_meetings_parent_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_meetings_parent_id ON public.meetings USING btree (parent_meeting_id);


--
-- Name: idx_meetings_tenant_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_meetings_tenant_date ON public.meetings USING btree (tenant_id, meeting_date DESC);


--
-- Name: idx_participants_line_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_participants_line_user ON public.participants USING btree (tenant_id, line_user_id);


--
-- Name: idx_participants_line_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_participants_line_user_id ON public.participants USING btree (line_user_id) WHERE (line_user_id IS NOT NULL);


--
-- Name: idx_participants_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_participants_tenant ON public.participants USING btree (tenant_id);


--
-- Name: idx_payments_meeting; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payments_meeting ON public.payments USING btree (meeting_id);


--
-- Name: idx_payments_participant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payments_participant ON public.payments USING btree (participant_id);


--
-- Name: idx_payments_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payments_tenant ON public.payments USING btree (tenant_id);


--
-- Name: idx_refund_requests_payment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_refund_requests_payment ON public.refund_requests USING btree (payment_id);


--
-- Name: idx_refund_requests_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_refund_requests_status ON public.refund_requests USING btree (status);


--
-- Name: idx_refund_requests_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_refund_requests_tenant ON public.refund_requests USING btree (tenant_id);


--
-- Name: idx_status_audit_participant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_status_audit_participant ON public.status_audit USING btree (participant_id);


--
-- Name: idx_status_audit_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_status_audit_tenant ON public.status_audit USING btree (tenant_id);


--
-- Name: idx_usage_metrics_tenant_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_usage_metrics_tenant_date ON public.usage_metrics USING btree (tenant_id, date);


--
-- Name: participants update_participants_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_participants_updated_at BEFORE UPDATE ON public.participants FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: profiles update_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: refund_requests update_refund_requests_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_refund_requests_updated_at BEFORE UPDATE ON public.refund_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: tenant_secrets update_tenant_secrets_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_tenant_secrets_updated_at BEFORE UPDATE ON public.tenant_secrets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: tenant_settings update_tenant_settings_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_tenant_settings_updated_at BEFORE UPDATE ON public.tenant_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: tenants update_tenants_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON public.tenants FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: checkins checkins_meeting_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checkins
    ADD CONSTRAINT checkins_meeting_id_fkey FOREIGN KEY (meeting_id) REFERENCES public.meetings(meeting_id) ON DELETE CASCADE;


--
-- Name: checkins checkins_participant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checkins
    ADD CONSTRAINT checkins_participant_id_fkey FOREIGN KEY (participant_id) REFERENCES public.participants(participant_id) ON DELETE CASCADE;


--
-- Name: checkins checkins_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checkins
    ADD CONSTRAINT checkins_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(tenant_id) ON DELETE CASCADE;


--
-- Name: integration_logs integration_logs_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.integration_logs
    ADD CONSTRAINT integration_logs_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(tenant_id) ON DELETE CASCADE;


--
-- Name: invoices invoices_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(tenant_id) ON DELETE CASCADE;


--
-- Name: meeting_registrations meeting_registrations_meeting_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meeting_registrations
    ADD CONSTRAINT meeting_registrations_meeting_id_fkey FOREIGN KEY (meeting_id) REFERENCES public.meetings(meeting_id) ON DELETE CASCADE;


--
-- Name: meeting_registrations meeting_registrations_participant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meeting_registrations
    ADD CONSTRAINT meeting_registrations_participant_id_fkey FOREIGN KEY (participant_id) REFERENCES public.participants(participant_id) ON DELETE CASCADE;


--
-- Name: meeting_registrations meeting_registrations_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meeting_registrations
    ADD CONSTRAINT meeting_registrations_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(tenant_id) ON DELETE CASCADE;


--
-- Name: meetings meetings_parent_meeting_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meetings
    ADD CONSTRAINT meetings_parent_meeting_id_fkey FOREIGN KEY (parent_meeting_id) REFERENCES public.meetings(meeting_id) ON DELETE CASCADE;


--
-- Name: meetings meetings_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meetings
    ADD CONSTRAINT meetings_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(tenant_id) ON DELETE CASCADE;


--
-- Name: participants participants_invited_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.participants
    ADD CONSTRAINT participants_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES public.participants(participant_id);


--
-- Name: participants participants_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.participants
    ADD CONSTRAINT participants_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(tenant_id) ON DELETE CASCADE;


--
-- Name: payments payments_meeting_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_meeting_id_fkey FOREIGN KEY (meeting_id) REFERENCES public.meetings(meeting_id);


--
-- Name: payments payments_participant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_participant_id_fkey FOREIGN KEY (participant_id) REFERENCES public.participants(participant_id) ON DELETE CASCADE;


--
-- Name: payments payments_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(tenant_id) ON DELETE CASCADE;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: refund_requests refund_requests_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refund_requests
    ADD CONSTRAINT refund_requests_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: refund_requests refund_requests_payment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refund_requests
    ADD CONSTRAINT refund_requests_payment_id_fkey FOREIGN KEY (payment_id) REFERENCES public.payments(payment_id) ON DELETE CASCADE;


--
-- Name: refund_requests refund_requests_requested_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refund_requests
    ADD CONSTRAINT refund_requests_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: refund_requests refund_requests_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refund_requests
    ADD CONSTRAINT refund_requests_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(tenant_id) ON DELETE CASCADE;


--
-- Name: status_audit status_audit_changed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.status_audit
    ADD CONSTRAINT status_audit_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES auth.users(id);


--
-- Name: status_audit status_audit_participant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.status_audit
    ADD CONSTRAINT status_audit_participant_id_fkey FOREIGN KEY (participant_id) REFERENCES public.participants(participant_id) ON DELETE CASCADE;


--
-- Name: status_audit status_audit_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.status_audit
    ADD CONSTRAINT status_audit_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(tenant_id) ON DELETE CASCADE;


--
-- Name: subscriptions subscriptions_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.plans(plan_id);


--
-- Name: subscriptions subscriptions_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(tenant_id) ON DELETE CASCADE;


--
-- Name: tenant_secrets tenant_secrets_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_secrets
    ADD CONSTRAINT tenant_secrets_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(tenant_id) ON DELETE CASCADE;


--
-- Name: tenant_settings tenant_settings_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_settings
    ADD CONSTRAINT tenant_settings_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(tenant_id) ON DELETE CASCADE;


--
-- Name: usage_metrics usage_metrics_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usage_metrics
    ADD CONSTRAINT usage_metrics_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(tenant_id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: tenants Anyone can view active tenants; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view active tenants" ON public.tenants FOR SELECT USING ((status = 'active'::public.tenant_status));


--
-- Name: meetings Anyone can view meetings of active tenants; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view meetings of active tenants" ON public.meetings FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.tenants
  WHERE ((tenants.tenant_id = meetings.tenant_id) AND (tenants.status = 'active'::public.tenant_status)))));


--
-- Name: plans Anyone can view plans; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view plans" ON public.plans FOR SELECT USING (true);


--
-- Name: tenant_settings Anyone can view tenant settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view tenant settings" ON public.tenant_settings FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.tenants
  WHERE ((tenants.tenant_id = tenant_settings.tenant_id) AND (tenants.status = 'active'::public.tenant_status)))));


--
-- Name: tenant_secrets Chapter admins can manage their secrets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Chapter admins can manage their secrets" ON public.tenant_secrets USING (public.has_tenant_access(auth.uid(), tenant_id)) WITH CHECK (public.has_tenant_access(auth.uid(), tenant_id));


--
-- Name: tenant_settings Chapter admins can manage their settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Chapter admins can manage their settings" ON public.tenant_settings USING (public.has_tenant_access(auth.uid(), tenant_id)) WITH CHECK (public.has_tenant_access(auth.uid(), tenant_id));


--
-- Name: integration_logs Chapter admins can view their integration logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Chapter admins can view their integration logs" ON public.integration_logs FOR SELECT USING (public.has_tenant_access(auth.uid(), tenant_id));


--
-- Name: invoices Chapter admins can view their invoices; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Chapter admins can view their invoices" ON public.invoices FOR SELECT USING (public.has_tenant_access(auth.uid(), tenant_id));


--
-- Name: usage_metrics Chapter admins can view their metrics; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Chapter admins can view their metrics" ON public.usage_metrics FOR SELECT USING (public.has_tenant_access(auth.uid(), tenant_id));


--
-- Name: tenant_secrets Chapter admins can view their secrets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Chapter admins can view their secrets" ON public.tenant_secrets FOR SELECT USING (public.has_tenant_access(auth.uid(), tenant_id));


--
-- Name: subscriptions Chapter admins can view their subscriptions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Chapter admins can view their subscriptions" ON public.subscriptions FOR SELECT USING (public.has_tenant_access(auth.uid(), tenant_id));


--
-- Name: tenants Chapter admins can view their tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Chapter admins can view their tenant" ON public.tenants FOR SELECT USING (public.has_tenant_access(auth.uid(), tenant_id));


--
-- Name: refund_requests Chapter users can create refund requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Chapter users can create refund requests" ON public.refund_requests FOR INSERT WITH CHECK (public.has_tenant_access(auth.uid(), tenant_id));


--
-- Name: status_audit Chapter users can insert audit logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Chapter users can insert audit logs" ON public.status_audit FOR INSERT WITH CHECK (public.has_tenant_access(auth.uid(), tenant_id));


--
-- Name: checkins Chapter users can manage their checkins; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Chapter users can manage their checkins" ON public.checkins USING (public.has_tenant_access(auth.uid(), tenant_id)) WITH CHECK (public.has_tenant_access(auth.uid(), tenant_id));


--
-- Name: meetings Chapter users can manage their meetings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Chapter users can manage their meetings" ON public.meetings USING (public.has_tenant_access(auth.uid(), tenant_id)) WITH CHECK (public.has_tenant_access(auth.uid(), tenant_id));


--
-- Name: participants Chapter users can manage their participants; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Chapter users can manage their participants" ON public.participants USING (public.has_tenant_access(auth.uid(), tenant_id)) WITH CHECK (public.has_tenant_access(auth.uid(), tenant_id));


--
-- Name: payments Chapter users can manage their payments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Chapter users can manage their payments" ON public.payments USING (public.has_tenant_access(auth.uid(), tenant_id)) WITH CHECK (public.has_tenant_access(auth.uid(), tenant_id));


--
-- Name: meeting_registrations Chapter users can manage their registrations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Chapter users can manage their registrations" ON public.meeting_registrations USING (public.has_tenant_access(auth.uid(), tenant_id)) WITH CHECK (public.has_tenant_access(auth.uid(), tenant_id));


--
-- Name: status_audit Chapter users can view their audit logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Chapter users can view their audit logs" ON public.status_audit FOR SELECT USING (public.has_tenant_access(auth.uid(), tenant_id));


--
-- Name: participants Chapter users can view their participants; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Chapter users can view their participants" ON public.participants FOR SELECT USING (public.has_tenant_access(auth.uid(), tenant_id));


--
-- Name: refund_requests Chapter users can view their refund requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Chapter users can view their refund requests" ON public.refund_requests FOR SELECT USING (public.has_tenant_access(auth.uid(), tenant_id));


--
-- Name: meeting_registrations Chapter users can view their registrations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Chapter users can view their registrations" ON public.meeting_registrations FOR SELECT USING (public.has_tenant_access(auth.uid(), tenant_id));


--
-- Name: refund_requests Super admins can manage all refund requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super admins can manage all refund requests" ON public.refund_requests USING (public.has_role(auth.uid(), 'super_admin'::public.app_role));


--
-- Name: user_roles Super admins can manage all roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super admins can manage all roles" ON public.user_roles USING (public.has_role(auth.uid(), 'super_admin'::public.app_role));


--
-- Name: invoices Super admins can manage invoices; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super admins can manage invoices" ON public.invoices USING (public.has_role(auth.uid(), 'super_admin'::public.app_role));


--
-- Name: plans Super admins can manage plans; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super admins can manage plans" ON public.plans USING (public.has_role(auth.uid(), 'super_admin'::public.app_role));


--
-- Name: subscriptions Super admins can manage subscriptions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super admins can manage subscriptions" ON public.subscriptions USING (public.has_role(auth.uid(), 'super_admin'::public.app_role));


--
-- Name: tenants Super admins can manage tenants; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super admins can manage tenants" ON public.tenants USING (public.has_role(auth.uid(), 'super_admin'::public.app_role));


--
-- Name: usage_metrics Super admins can manage usage metrics; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super admins can manage usage metrics" ON public.usage_metrics USING (public.has_role(auth.uid(), 'super_admin'::public.app_role));


--
-- Name: integration_logs System can insert integration logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "System can insert integration logs" ON public.integration_logs FOR INSERT WITH CHECK (true);


--
-- Name: profiles Users can insert their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK ((auth.uid() = id));


--
-- Name: profiles Users can update their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING ((auth.uid() = id));


--
-- Name: profiles Users can view their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING ((auth.uid() = id));


--
-- Name: user_roles Users can view their own roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own roles" ON public.user_roles FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: checkins; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.checkins ENABLE ROW LEVEL SECURITY;

--
-- Name: integration_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.integration_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: invoices; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

--
-- Name: meeting_registrations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.meeting_registrations ENABLE ROW LEVEL SECURITY;

--
-- Name: meetings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;

--
-- Name: participants; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.participants ENABLE ROW LEVEL SECURITY;

--
-- Name: payments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

--
-- Name: plans; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: refund_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.refund_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: status_audit; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.status_audit ENABLE ROW LEVEL SECURITY;

--
-- Name: subscriptions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

--
-- Name: tenant_secrets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tenant_secrets ENABLE ROW LEVEL SECURITY;

--
-- Name: tenant_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tenant_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: tenants; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

--
-- Name: usage_metrics; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.usage_metrics ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--


