# Meetdup - BNI Chapter Management System

## Overview
Meetdup is a comprehensive multi-tenant SaaS application designed to streamline and manage BNI (Business Network International) chapter operations. Its core purpose is to provide a robust platform for member management, meeting scheduling and attendance tracking, visitor check-ins, and various administrative tasks. The system aims to enhance efficiency and organization for BNI chapters, offering a tailored experience through multi-tenancy and role-based access control.

## User Preferences
None specified yet.

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
- **Multi-Tenancy**: Implemented with tenant-based data isolation, chapter-specific branding, and settings using `tenants` and `tenant_secrets` tables.
- **Role-Based Access Control (RBAC)**: Supports Super Admin, Chapter Admin, and Member roles via a `user_roles` table.
- **Data Fetching & State Management**: Leverages TanStack React Query for data operations and React Context API for global state.
- **UI/UX**: Employs Radix UI, Shadcn/ui, and Tailwind CSS for a modern, responsive interface.
- **LINE Integration**: Features a comprehensive multi-tenant LINE webhook system with destination-based tenant resolution, HMAC signature validation, secure credential management, rich menu management, and a quick reply system. Includes Business Card feature via LINE Flex Messages with vCard download support, member search functionality, and corporate-style contact sharing.
- **Robust Error Handling**: Implemented across the system for stability and a smooth user experience, including fixes for React Query context errors.
- **Modular Design**: Project structured into `client/`, `server/`, `supabase/`, and `shared/` directories.
- **Check-In System**: Utilizes QR code-based check-ins and integrates with LINE webhooks for status progression and communication.
- **Member/Visitor Pipeline Separation**: UI restructured to separate active member management from visitor pipeline analytics, with dedicated pages for active members and a visitor pipeline dashboard featuring analytics KPIs.
- **Multi-Path Onboarding System**: Implemented three onboarding flows: Pioneer (create chapter), Invite (accept invite link), and Discovery (search chapters). This includes new backend APIs for chapter creation, invite management, and join requests, alongside schema migrations for `chapter_invites` and `chapter_join_requests`, and a refactored `user_roles` table to support global Super Admin roles.
- **Schema Management**: Database schema recreation using "wide tables" to match TypeScript definitions, including `tenant_settings` and `participants` tables with comprehensive columns and RLS policies.
- **Backend Migration**: User management APIs migrated from Supabase Edge Functions to Express API routes for enhanced control and to resolve previous authorization issues.
- **Super Admin Authorization Fix** (Nov 15, 2025): Fixed critical authorization bug where Super Admin (tenant_id = NULL) couldn't create invite links or approve join requests. Implemented two-step authorization check: first check for super admin role, then fallback to chapter admin role for tenant-specific access.
- **Unified Member-Participant Architecture** (Nov 15, 2025): Implemented unified approach where every member must have records in BOTH `user_roles` (for access control) and `participants` (for chapter activities). Added `user_id` column (nullable) to `participants` table to link members to auth accounts while keeping visitors (without accounts) unlinked. Created shared `syncUserToParticipants()` helper function that:
  - Sources data from profiles → auth.users → placeholder fallback
  - Maps roles to participant status (chapter_admin/member → member, others → prospect)
  - Uses UPSERT to prevent duplicates (unique constraint on user_id + tenant_id)
  - Sets joined_date when user becomes member
  - Integrated into all 3 onboarding flows (Pioneer, Invite, Discovery) with atomic rollback on failure
  - Backfill migration created for existing users
- **Meeting Location UX Enhancement** (Nov 16, 2025): Improved meeting creation/edit forms by moving latitude/longitude fields into collapsible "Advanced Location Settings" sections. LocationSearch component auto-fills coordinates, but users can manually override when Google Places API fails or returns incorrect data. Helper text and Info icon (lucide-react) clarify auto-fill behavior. This preserves all functionality while keeping the UI cleaner and more user-friendly.
  - **Auto-Expand & Visual Feedback** (Nov 16, 2025): Enhanced Advanced Location Settings with auto-expansion when users select a location from LocationSearch, making coordinate updates immediately visible. Added green check icon (✓) with "มีพิกัด" text as visual indicator when coordinates exist. Implemented proper state management with dialog lifecycle hooks to prevent stale state bugs (section resets on dialog close, adapts to current meeting's coordinate data). This ensures users always see clear feedback when location coordinates are populated.
  - **Schema Alignment Fix** (Nov 16, 2025): Fixed PGRST204 errors by fully aligning `meetings` table schema with TypeScript types. Added missing columns: `description`, `location_details`, `meeting_time`, `theme`, `visitor_fee`, `recurrence_pattern`, `recurrence_interval`, `recurrence_end_date`, `recurrence_days_of_week`, and `parent_meeting_id`. Renamed `venue_lat`/`venue_lng` to `location_lat`/`location_lng`. Created performance indexes on `parent_meeting_id`, `meeting_date`, and composite `tenant_id + meeting_date`. Migration files: `supabase/migrations/20251116_fix_meetings_schema.sql` and `supabase/migrations/20251116_complete_meetings_schema.sql`. This ensures database schema stays in sync with TypeScript types for the wide tables architecture and supports recurring meetings functionality.
- **LINE Business Card Feature** (Nov 16, 2025): Implemented comprehensive Business Card system via LINE Messaging API featuring:
  - **Database Schema**: Extended `participants` table with business card fields (photo_url, position, tagline, website_url, facebook_url, instagram_url, business_address)
  - **Corporate Flex Message Template**: Professional LINE Flex Message design with responsive layouts, photo headers, contact info sections, and action buttons
  - **Interactive Actions**: Call (tel:), email (mailto:), website links, LINE chat, vCard download, and social media sharing
  - **vCard Generator**: RFC 6350-compliant vCard 3.0 generation with automatic filename sanitization for .vcf downloads
  - **Member Search**: Text-based search via LINE messages (e.g., "หาสมาชิก [ชื่อ]") with quick reply buttons for results
  - **Webhook Handlers**: Integrated postback handlers for view_card action and text message routing for member search
  - **Public API Endpoints**: `/api/participants/:id/business-card` (JSON) and `/api/participants/:id/vcard` (file download)
  - Migration: `supabase/migrations/20251116_add_business_card_fields.sql`
- **Supabase Relationship Ambiguity Fix** (Nov 16, 2025): Resolved PGRST204/PGRST201 errors caused by multiple foreign keys pointing to the same table. When embedding `participants` from tables with multiple FK relationships (checkins, meeting_registrations), Supabase couldn't determine which FK to use. Solution: Use explicit relationship hints with actual FK constraint names in ALL directions:
  - **Actual FK Names**: `fk_checkins_participant`, `fk_meeting_registrations_participant` (verified from database schema, not the initially assumed `*_participant_id_fkey` pattern)
  - **FROM child tables TO participants**: `participants!fk_checkins_participant(...)`, `participants!fk_meeting_registrations_participant(...)`
  - **FROM participants TO child tables**: `checkins!fk_checkins_participant(...)`, `meeting_registrations!fk_meeting_registrations_participant(...)`
  - Updated all affected queries in MeetingDetails.tsx, CheckIn.tsx, Visitors.tsx (backend visitor-analytics endpoint)
  - Changed embedded relationship alias from `participants` (plural) to `participant` (singular) to match PostgREST's singular embedding convention
  - After dropping tables (payments, invoices, refund_requests), reloaded Supabase schema cache via `NOTIFY pgrst, 'reload schema'` to clear cached metadata
- **Check-In Migration to Express API** (Nov 16, 2025): Migrated check-in functionality from Supabase Edge Function to Express API for better reliability and control. Created POST `/api/participants/check-in` endpoint (public, no auth) that:
  - Validates meeting existence and retrieves tenant_id
  - Finds or create participant record (new participants start as 'prospect')
  - Prevents duplicate check-ins by querying existing checkins
  - Auto-upgrades participant status from 'prospect' to 'visitor' upon first check-in
  - Records check-in in `checkins` table (removed non-existent 'source' column, kept tenant_id as required)
  - Returns structured JSON responses with success/error states
  - Updated CheckInScanner.tsx to call Express API via fetch() instead of supabase.functions.invoke()
  - Resolves FunctionsFetchError and connection timeout issues with Edge Functions
- **Visitor Registration Status Fix** (Nov 16, 2025): Fixed incorrect status flow in `/api/participants/register-visitor` endpoint. Changed from `status: meeting_id ? "visitor" : "prospect"` to `status: "prospect"` (always). This ensures proper visitor pipeline progression: **Prospect** (registered) → **Visitor** (first check-in) → **Member** (paid/approved) → **Alumni** (former member). Database enum only supports: prospect, visitor, member, alumni (no hot_lead or declined in actual database despite TypeScript types).
- **Mock Data Implementation** (Nov 16, 2025): Created comprehensive mock data covering all visitor pipeline scenarios for Dashboard analytics testing:
  - **5 Meetings**: 2 past, 1 today, 2 future with realistic Thai business themes
  - **13 Participants** across all statuses:
    - 4 Prospects (including 1 "declined" via notes field)
    - 5 Visitors (3 regular + 2 "hot leads" with 3+ check-ins)
    - 3 Members (active members)
    - 1 Alumni (former member)
  - **18 Meeting Registrations**: Prospects for future, Visitors/Hot Leads for past/today
  - **18 Check-ins**: Realistic timestamps, varied attendance patterns
  - Discovered database schema discrepancies: `meeting_registrations` and `checkins` tables lack `tenant_id` column despite TypeScript types, `checkin_status` enum is pending/approved/rejected (not present/late/absent)
- **Phone-Based Check-in Flow Redesign** (Nov 16, 2025): Complete UX redesign of check-in system with phone number as primary identifier:
  - **Unique Identifier**: Phone number is the unique key for participant identity across tenant (unique constraint on `tenant_id` + `phone_number`)
  - **Check-in Flow**: 
    1. Scan QR Code → Enter phone number (10 digits)
    2. Lookup participant by phone in database
    3. If found: Display info + confirm check-in
    4. If not found: Redirect to registration form with `auto_checkin=true` flag
  - **Two Registration Modes**:
    - **Regular Registration** (from Meeting Detail page): Create participant (status=prospect) + meeting_registration, NO auto check-in
    - **Registration from Check-in** (via QR flow): Create participant + meeting_registration + auto check-in immediately (status=visitor, skipping prospect)
  - **Status Transition Rules**:
    - Prospect → Visitor (first check-in, auto-upgrade)
    - Visitor → Visitor (subsequent check-ins)
    - Member → Member (check-in records attendance)
    - Alumni → Alumni (check-in with remark in `checkins.notes`, no status change)
  - **Alumni Revisit Policy**: When Alumni return and check-in, they remain Alumni status with a remark noted in the check-in record
  - **Duplicate Prevention**: System prevents duplicate registrations using phone number uniqueness constraint per tenant

## External Dependencies

- **Supabase** (`sbknunooplaezvwtyooi`):
    - **Database**: PostgreSQL (main data store with multi-tenant architecture)
    - **Authentication**: Supabase Auth (integrated with profiles table)
    - **Storage**: Supabase Storage (for file uploads)
- **LINE Messaging API**: Integrated for communication, rich menus, quick replies, and webhooks.
- **Google Maps API**: Utilized for location features, particularly in meeting venue management.