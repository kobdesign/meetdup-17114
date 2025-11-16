# Meetdup - BNI Chapter Management System

## Overview
Meetdup is a comprehensive multi-tenant SaaS application designed to streamline and manage BNI (Business Network International) chapter operations. Its core purpose is to provide a robust platform for member management, meeting scheduling and attendance tracking, visitor check-ins, payment processing, and various administrative tasks. The system aims to enhance efficiency and organization for BNI chapters, offering a tailored experience through multi-tenancy and role-based access control.

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
- **Payment Processing**: Supports multiple payment methods (PromptPay, Transfer, Cash) with features for slip upload, review, and refund workflows.
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
  - **Payment Flow Removal**: Removed post-registration payment redirect, replaced with success message for cleaner UX
  - Migration: `supabase/migrations/20251116_add_business_card_fields.sql`
- **Supabase Relationship Ambiguity Fix** (Nov 16, 2025): Resolved PGRST204/PGRST201 errors caused by multiple foreign keys pointing to the same table. When embedding `participants` from tables with multiple FK relationships (checkins, meeting_registrations, payments), Supabase couldn't determine which FK to use. Solution: Use explicit relationship hints with FK names in ALL directions:
  - **FROM child tables TO participants**: `participants!checkins_participant_id_fkey(...)`, `participants!meeting_registrations_participant_id_fkey(...)`, `participants!payments_participant_id_fkey(...)`
  - **FROM participants TO child tables**: `checkins!checkins_participant_id_fkey(...)`, `meeting_registrations!meeting_registrations_participant_id_fkey(...)`, `payments!payments_participant_id_fkey(...)`
  - Updated all affected queries in MeetingDetails.tsx, CheckIn.tsx, Visitors.tsx (backend visitor-analytics endpoint), and send-payment-reminder edge function
  - Changed embedded relationship alias from `participants` (plural) to `participant` (singular) to match PostgREST's singular embedding convention

## External Dependencies

- **Supabase** (`sbknunooplaezvwtyooi`):
    - **Database**: PostgreSQL (main data store with 18 tables and multi-tenant architecture)
    - **Authentication**: Supabase Auth (integrated with profiles table)
    - **Storage**: Supabase Storage (for payment slips and other files)
- **LINE Messaging API**: Integrated for communication, rich menus, quick replies, and webhooks.
- **Google Maps API**: Utilized for location features, particularly in meeting venue management.