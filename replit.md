# Meetdup - Chapter Management System

## Overview
Meetdup is a multi-tenant SaaS application designed to streamline business networking chapter operations. It provides a robust platform for member management, meeting scheduling, attendance tracking, visitor check-ins, and administrative tasks. The system aims to enhance efficiency and organization for business chapters through multi-tenancy, role-based access control, and comprehensive LINE integration. Key features include self-service activation, automated LINE LIFF activation, bulk member import, an AI Chapter Data Assistant, and a Chapter Growth Pipeline for tracking visitor-to-member conversion.

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
- **Multi-Tenancy**: Data isolation, chapter-specific branding, and settings. The `tenants` table uses `tenant_id` (UUID) as its primary key.
- **Role-Based Access Control (RBAC)**: Super Admin, Chapter Admin, Member roles with progressive disclosure and route guards.
- **UI/UX**: Modern, responsive design using Radix UI, Shadcn/ui, and Tailwind CSS, featuring a Professional Trust theme with Navy Blue + Soft Gold.
- **LINE Integration**: Multi-tenant webhook system, HMAC signature validation, secure credential management, rich menus, LIFF-based member search, and a LIFF Business Card Share System.
- **Check-In System**: QR code-based check-ins via LINE webhooks and a secure POS Check-In System with JWT tokens.
- **Meeting Command Center**: Unified dashboard for meeting operations with manual and QR scanner modes.
- **Member/Visitor Management**: Separate pipelines for active members and visitor analytics, with a multi-path onboarding system and a unified member-participant architecture.
- **Data Management**: Bulk member import, auto-linking of user accounts, token-based self-registration, and comprehensive participant deletion.
- **Goals & Achievements System**: Chapters can set and track goals (visitors, members, check-ins, referrals) with auto-calculated progress and LINE notifications.
- **LINE Command Authorization System**: Flexible access control for LINE bot commands (public, member, admin levels) with an admin UI.
- **Event RSVP System**: Meeting notifications with RSVP options (Confirm, Substitute, Leave) and admin views.
- **Payment Tracking System**: Comprehensive tracking for member dues and visitor fees, including a Finance Dashboard.
- **Chapter Apps Marketplace**: Extensible system for mini-applications accessible via member profiles and an Admin App Center.
- **AI Chapter Data Assistant (LINE Bot)**: AI Chatbot integrated with OpenAI for Admin/Member queries via LINE, supporting intents like visitor summaries and meeting statistics with RBAC.
    - **Architecture**: Single n8n agent for Text-to-SQL and response formatting.
    - **Supported Intents**: `meeting_statistics`, `visitor_summary`, `unpaid_visitor_fee`, `visitor_fee_total`, `member_search`.
    - **RBAC**: Admin sees full details, Member sees counts only.
- **Super Admin Platform Settings**: Centralized management for platform branding (logo, name) stored in Supabase Storage and `system_settings` table.
- **Dynamic Plan Configuration System**: Manages subscription plans, features, and limits without hardcoding, using `feature_catalog`, `limit_catalog`, `plan_definitions`, `plan_features`, `plan_limits`, and `tenant_subscriptions` tables. Includes Super Admin CRUD API and frontend hooks for feature gating.
- **Usage Tracking and Limit Enforcement System**: Tracks usage (members, meetings, AI queries) and enforces plan limits. Logs AI interactions in `ai_conversations`. Implements warning levels (ok, warning, critical, exceeded) for usage.
- **Trial Notification and Auto-Downgrade System**: Notifies admins before trial expiration (7, 3, 1 day) and automatically downgrades expired trials to the free plan using scheduled cron jobs and a `notification_logs` table for deduplication.
- **Chapter Growth Pipeline System**: Tracks visitor-to-member conversion through 11 stages (e.g., `lead_capture`, `rsvp_confirmed`, `attended_meeting`, `active_member`). Utilizes `pipeline_stages`, `pipeline_sub_statuses`, `pipeline_records`, and `pipeline_transitions` tables. Features auto-syncing from visitor registrations and check-ins, stale lead management, and batch import functionality.

## External Dependencies

-   **Supabase**: PostgreSQL database, authentication, and storage.
-   **LINE Messaging API**: Communication, rich menus, quick replies, webhooks, and LIFF.
-   **Google Maps API**: Location-based features.
-   **OpenAI**: AI Chapter Data Assistant integration.