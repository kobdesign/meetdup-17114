# Meetdup - Chapter Management System

## Overview
Meetdup is a multi-tenant SaaS application designed to streamline business networking chapter operations. Its core purpose is to provide a robust platform for member management, meeting scheduling and attendance tracking, visitor check-ins, and various administrative tasks. The system aims to enhance efficiency and organization for business chapters, offering a tailored experience through multi-tenancy and role-based access control. Key capabilities include self-service activation link requests, automated LINE LIFF activation, and bulk member import, along with comprehensive LINE integration and an AI Chapter Data Assistant.

## User Preferences
- **Supabase Production Query**: Agent สามารถ query Supabase Production ได้โดยใช้ environment variables:
  ```bash
  curl -s "$SUPABASE_URL/rest/v1/<table_name>?<query_params>" \
    -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
  ```
  ใช้สำหรับตรวจสอบข้อมูลจริงใน Production เมื่อ dev database ไม่มีข้อมูลที่ต้องการ

## System Architecture

### Technology Stack
- **Frontend**: React 18, TypeScript, Vite, Radix UI, Shadcn/ui, Tailwind CSS
- **Routing**: React Router v6
- **State Management**: TanStack React Query, React Context API
- **Forms**: React Hook Form with Zod validation
- **Backend**: Express.js
- **Database**: PostgreSQL via Supabase
- **Authentication & Storage**: Supabase Auth, Supabase Storage
- **Deployment**: Replit Autoscale

### Core Architectural Decisions
- **Multi-Tenancy**: Implemented with tenant-based data isolation, chapter-specific branding, and settings.
- **Role-Based Access Control (RBAC)**: Supports Super Admin, Chapter Admin, and Member roles with progressive disclosure navigation and route-level guards.
- **UI/UX**: Employs Radix UI, Shadcn/ui, and Tailwind CSS for a modern, responsive interface. The landing page uses a Professional Trust theme with Navy Blue + Soft Gold color scheme and an 8-section layout.
- **LINE Integration**: Comprehensive multi-tenant LINE webhook system with destination-based tenant resolution, HMAC signature validation, secure credential management, rich menu management, and message-based interaction flows. Includes a LIFF-based member search system and a LIFF Business Card Share System.
- **Check-In System**: QR code-based check-ins integrated with LINE webhooks, primarily using phone number for identification, and a secure POS Check-In System with JWT tokens.
- **Meeting Command Center**: A unified dashboard for meeting day operations with meeting selection, stats cards, and two operation modes (Manual and QR Scanner) for efficient participant management.
- **Member/Visitor Management**: Separated pipelines for active member management and visitor analytics, with a multi-path onboarding system (Pioneer, Invite, Discovery) and a unified member-participant architecture.
- **Data Management**: Bulk member import from Excel, auto-linking of user accounts to participant records, secure token-based activation flow for self-registration, and comprehensive participant deletion with related record cleanup.
- **Schema Enhancements**: Simplified name fields (`full_name_th`, `full_name_en`, `nickname_th`, `nickname_en`), dual-field referral model, added `linkedin_url`, required phone numbers, and distinct `line_id` and `line_user_id`.
- **Business Category System**: Dynamic 2-digit codes, searchable selector, member-created categories, and bot-driven category search.
- **Goals & Achievements System**: Chapters can set and track goals (visitors, members, check-ins, referrals) with auto-calculated progress and LINE notifications. Daily progress summaries are available.
- **LINE Command Authorization System**: Flexible access control for LINE bot commands (public, member, admin levels) with an admin UI for management.
- **LIFF Profile Components**: Reusable `MemberProfileCard` and `MemberListCard` for displaying member profiles across LIFF pages.
- **Event RSVP System**: Meeting notifications with RSVP buttons (Confirm, Substitute, Leave) and an admin view displaying RSVP responses with participant details and leave reasons.
- **Payment Tracking System**: Comprehensive tracking for member monthly dues and visitor meeting fees, including a Finance Dashboard for KPIs, dues configuration, member dues list, and bulk actions.
- **Chapter Apps Marketplace**: An extension system for mini-applications accessible via a Profile > Apps Tab for members and manageable via an Admin App Center. Includes implemented apps like BOQ Estimator.
- **AI Chapter Data Assistant (LINE Bot)**: An AI Chatbot integrated with OpenAI for Admin/Member queries via LINE, supporting intents like visitor summaries, unpaid visitor fees, and meeting statistics with RBAC logic.
- **Super Admin Platform Settings**: Centralized platform branding management at `/super-admin/platform-settings` with logo upload for light/dark modes and platform name configuration. Logos stored in Supabase Storage `avatars/branding/` folder with settings in `system_settings` table (keys: `platform_logo_url`, `platform_logo_dark_url`, `platform_name`).

### AI Chapter Data Assistant Details

**Architecture:** Single Agent (n8n) - ทำทั้ง Text-to-SQL และ Format Response ในตัวเดียว

**Core Files:** 
- `docs/n8n-system-prompt.md` - System prompt สำหรับ n8n AI Agent
- `docs/n8n-meetdup-schema.md` - Database schema reference
- `server/services/n8nAIQuery.ts` - n8n webhook integration
- `server/routes/line/webhook.ts` - LINE webhook handler

**Supported Intents:**
1. `meeting_statistics` - สถิติการประชุมแบบ Dashboard (member stats, visitor stats, conversion)
2. `visitor_summary` - สรุปผู้เยี่ยมชม
3. `unpaid_visitor_fee` - ผู้เยี่ยมชมที่ยังไม่จ่ายเงิน (RBAC protected)
4. `visitor_fee_total` - ยอดรวมค่า visitor fee
5. `member_search` - ค้นหาสมาชิกจากชื่อ

**Key Metrics from Dashboard:**
- Member: total, on_time, late, substitute, absent, attendance_rate%
- Visitor: registered, checked_in, no_show, no_show_rate%, repeat_visitors
- Conversion: converted_to_member (per meeting), total_converted (lifetime)

**Critical Table Mapping:**
- `meeting_registrations` = ใช้นับ visitor ลงทะเบียน (source of truth)
- ห้ามใช้ `participants.status = 'visitor'` นับ visitor ของ meeting

**RBAC:** Admin sees full details, Member sees counts only

### Dynamic Plan Configuration System

**Purpose:** Manage subscription plans, features, and limits without hardcoding.

**Database Tables:**
- `feature_catalog` - Registry of available features with display names/categories
- `limit_catalog` - Registry of usage limits (members, meetings, AI queries, storage)
- `plan_definitions` - Plan metadata (free, starter, pro) with Stripe price IDs
- `plan_features` - Junction table mapping features to plans (enabled/disabled)
- `plan_limits` - Junction table mapping limit values to plans
- `tenant_subscriptions` - Per-tenant subscription data (plan, status, Stripe IDs, trial dates)
- `notification_logs` - Tracks sent notifications to prevent duplicates (trial expiration, etc.)

**Important Schema Note:** The `tenants` table uses `tenant_id` (not `id`) as its primary key. Foreign key references must use `REFERENCES tenants(tenant_id)`.

**Core Files:**
- `server/migrations/20251229_create_plan_config_tables.sql` - Database schema
- `server/routes/planConfig.ts` - CRUD API with super admin auth
- `client/src/pages/super-admin/PlanConfiguration.tsx` - Admin UI
- `client/src/hooks/usePlanConfig.ts` - Frontend hooks for feature gating
- `server/stripe/subscriptionService.ts` - Backend feature/limit checking

**API Endpoints:**
- `GET /api/plan-config` - Public, returns config without Stripe price IDs
- `GET /api/plan-config/admin` - Super admin only, full config with Stripe IDs
- `PUT /api/plan-config/plans/:planId` - Update plan definition
- `PUT /api/plan-config/plan-features` - Bulk update feature toggles
- `PUT /api/plan-config/plan-limits` - Bulk update limit values

**Frontend Hooks:**
- `usePlanConfig()` - Fetch all plan configuration
- `usePlanFeature(planId, featureKey)` - Check if feature enabled for plan
- `useTenantPlanFeature(featureKey)` - Check feature for current tenant's plan

**Backend Methods:**
- `checkFeatureAccess(tenantId, feature)` - Async, checks DB then fallback
- `checkPlanFeature(planId, feature)` - Async, database-backed check
- `checkPlanLimit(planId, limitKey)` - Async, get limit value from DB

### Usage Tracking and Limit Enforcement System

**Purpose:** Track usage (members, meetings, AI queries) and enforce plan limits.

**AI Usage Tracking:**
- `ai_conversations` table logs all AI interactions (LINE AI bot + Growth Co-Pilot)
- Counts `role='user'` messages per tenant/month for billing
- Growth Co-Pilot uses `system:growth_copilot` as line_user_id prefix
- LINE AI queries logged before n8n webhook calls

**Core Files:**
- `server/stripe/subscriptionService.ts` - `getUsageLimits()`, `checkLimitExceeded()`, `getWarningLevel()`
- `server/middleware/usageLimitMiddleware.ts` - Express middleware for limit checks
- `server/routes/subscriptions.ts` - Warning and limit check endpoints
- `client/src/hooks/usePlanConfig.ts` - `useUsageWarnings()`, `useCheckLimit()`

**Warning Levels:**
- `ok` - Usage below 80%
- `warning` - Usage 80-89%
- `critical` - Usage 90-99%
- `exceeded` - Usage at or above limit

**API Endpoints:**
- `GET /api/subscriptions/warnings/:tenantId` - Get all usage warnings
- `GET /api/subscriptions/check-limit/:tenantId/:limitType` - Check specific limit

### Trial Notification and Auto-Downgrade System

**Purpose:** Notify admins before trial expiration and auto-downgrade expired trials.

**Core Files:**
- `server/services/notifications/trialNotificationService.ts` - Notification and downgrade logic
- `server/routes/scheduledJobs.ts` - Cron job API endpoints
- `server/migrations/20251230_create_notification_logs.sql` - Deduplication table

**Notification Schedule:**
- 7 days before trial ends
- 3 days before trial ends
- 1 day before trial ends

**Cron API Endpoints (secured with CRON_SECRET):**
- `POST /api/cron/trial-notifications` - Send expiration warnings
- `POST /api/cron/trial-downgrade` - Downgrade expired trials to free
- `POST /api/cron/all` - Run both jobs

**Deduplication:**
- `notification_logs` table tracks sent notifications
- Prevents duplicate notifications on same day using `notification_type` + `created_at`

## External Dependencies

- **Supabase**: Used for PostgreSQL database, authentication (Supabase Auth), and storage (Supabase Storage).
- **LINE Messaging API**: Integrated for communication, rich menus, quick replies, webhooks, and LIFF.
- **Google Maps API**: Utilized for location-based features.