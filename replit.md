# Meetdup - Chapter Management System

## Overview
Meetdup is a multi-tenant SaaS application designed to streamline business networking chapter operations. Its core purpose is to provide a robust platform for member management, meeting scheduling and attendance tracking, visitor check-ins, and various administrative tasks. The system aims to enhance efficiency and organization for business chapters, offering a tailored experience through multi-tenancy and role-based access control. Key capabilities include self-service activation link requests, automated LINE LIFF activation, and bulk member import.

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
- **Multi-Tenancy**: Implemented with tenant-based data isolation, chapter-specific branding, and settings.
- **Role-Based Access Control (RBAC)**: Supports Super Admin, Chapter Admin, and Member roles with progressive disclosure navigation and route-level guards.
- **UI/UX**: Employs Radix UI, Shadcn/ui, and Tailwind CSS for a modern, responsive interface, including an image cropper for profile photos.
- **LINE Integration**: Comprehensive multi-tenant LINE webhook system with destination-based tenant resolution, HMAC signature validation, secure credential management, rich menu management (with database persistence, tenant isolation, and edit functionality with rollback), and message-based interaction flows (e.g., phone linking, business card search with tags support, automated LIFF activation). Includes a LIFF-based member search system with tenant branding.
- **Check-In System**: QR code-based check-ins integrated with LINE webhooks, primarily using phone number for identification.
- **Member/Visitor Pipeline Separation**: UI separates active member management from visitor pipeline analytics, standardizing visitor progression.
- **Multi-Path Onboarding System**: Supports Pioneer, Invite, and Discovery onboarding flows.
- **Unified Member-Participant Architecture**: Every member has records in both `user_roles` (for access control) and `participants` (for chapter activities), linked via `user_id`.
- **Bulk Member Import System**: Excel-based import with validation, phone normalization, duplicate detection, and error reporting.
- **Auto-Link System**: Automatically connects user accounts to participant records via phone number matching during registration.
- **Activation Flow**: Secure token-based self-registration for imported members with single-use, expiring tokens. Upon successful activation, participant status is automatically upgraded to "member" with joined_date set (preserving existing values if already a member).
- **User Journey Status Transitions**:
  - `prospect` → Initial registration as a visitor
  - `visitor` → After first check-in (auto-upgrade from prospect)  
  - `member` → After using activation link (sets joined_date and role)
- **Business Card Search**: Enhanced multi-field search across various participant data fields with input sanitization and SQL injection prevention.
- **Participant Deletion**: Comprehensive participant deletion with cleanup of related records and proper handling of multi-tenant scenarios, ensuring data integrity.
- **Database Management & Health Monitoring**: Includes a health check system for database status and schema sync verification. Supabase Production is the source of truth, with manual migration for safety.
- **Schema Update (Nov 2024)**:
  - **Simplified Name Fields**: Unified full name approach with `full_name_th` (Thai, required) and `full_name_en` (English, optional), plus `nickname_th`/`nickname_en`. Migrated from legacy `full_name` column.
  - **Dual-Field Referral Model**: `referral_origin` enum (`member`, `central`, `external`) + conditional `referred_by_participant_id` FK to track member referrals vs. central/external sources
  - **LinkedIn Field**: Added `linkedin_url` for professional networking
  - **Required Phone**: Phone number is now required for participant creation/update
  - **LINE ID Distinction**: `line_id` (user-entered public @username for contact) is separate from `line_user_id` (system-managed internal ID from LINE Platform for messaging)
  - **Migration Status**: SQL migration script ready at `supabase/migrations/20241129_rename_name_columns.sql` - execute manually in Supabase dashboard to complete the migration
- **Business Category System (Nov 2024)**:
  - **25 Simple Categories**: Uses standardized 2-digit codes (01-25) matching Supabase `business_categories` table. Examples: 01=อสังหาริมทรัพย์, 02=ไอที และ เทคโนโลยี, 14=กฎหมาย
  - **Unified Selector**: BusinessTypeSelector component now uses single dropdown instead of hierarchical 3-level selection
  - **Category Search via Quick Reply (Nov 2024)**: Bot-driven category selection using Quick Reply + Postback instead of LIFF. Avoids LINE OAuth 400 errors with ephemeral dev URLs.
    - User sends "ค้นหาประเภทธุรกิจ" → Bot replies with Quick Reply showing categories with member counts
    - User taps category → Bot sends business card Flex Message(s) directly
    - Handlers: `handleCategorySearch()` and `handleCategorySelection()` in `businessCardHandler.ts`
  - **Migration Required**: Run `server/migrations/20241130_clear_old_business_type_codes.sql` on Supabase production to clear legacy hierarchical codes before deployment
- **LIFF Configuration (Nov 2024)**:
  - **Production LIFF**: Uses `liff_id` from `system_settings` table for stable domain (meetdup.com)
  - **Development Note**: LIFF OAuth requires stable domains; Replit dev URLs cause 400 errors. Use Quick Reply flow for development testing.
  - **Helper**: `server/utils/liffConfig.ts` - centralized LIFF ID resolution
- **Goals & Achievements System (Dec 2024)**:
  - **Purpose**: Chapters can set and track goals (visitors, members, check-ins, referrals) with auto-calculated progress from real data
  - **Database Tables**: `goal_templates` (predefined templates), `chapter_goals` (chapter-specific goals)
  - **Metric Types**: `weekly_visitors`, `monthly_visitors`, `total_members`, `weekly_checkins`, `monthly_checkins`, `weekly_referrals`, `monthly_referrals`
  - **Progress Calculation**: Auto-calculated from `participants` and `checkins` tables based on date range
  - **LINE Notification**: Sends Flex Message congratulations to Chapter Admins when goal is achieved
  - **Duplicate Prevention**: Uses `line_notified_at` timestamp to prevent duplicate notifications
  - **Security**: All endpoints enforce tenant access verification via `checkTenantAccess()`
  - **UI**: Badge-style achievement cards at `/admin/goals` with progress bars, icons, and status indicators
  - **Migration**: Run `server/migrations/20251205_create_chapter_goals.sql` on Supabase (already executed on dev)
- **Daily Progress Summary (Dec 2024)**:
  - **Purpose**: Sends summary of active goals progress to Chapter Admins via LINE
  - **Trigger Methods**:
    - Manual: "ส่งสรุป LINE" button in Admin Goals page (POST `/api/goals/send-summary`)
    - LINE Bot: Send "สรุปเป้าหมาย" command (supports Thai particles: ค่ะ, ครับ, นะ, คะ)
  - **Flex Message Format**: Badge-style progress summary with Thai date formatting, progress bars, and meeting details
  - **Admin Verification**: Dual-check via cached admins list and Supabase fallback for robustness
  - **Settings**: Stored in `system_settings` table (`goals.daily_summary_enabled`, `goals.daily_summary_time`)
  - **Edge Case Handling**: Null-safe date formatting, division-by-zero guards for progress calculation
  - **Handler**: `server/services/line/handlers/goalsSummaryHandler.ts`
- **LINE Command Authorization System (Dec 2024)**:
  - **Purpose**: Flexible access control for LINE bot commands per chapter
  - **Access Levels**: `public` (anyone), `member` (linked members only), `admin` (chapter admins)
  - **Group Chat Support**: Commands can be enabled/disabled for group chats
  - **Database**: `line_command_permissions` table with tenant isolation and RLS
  - **Caching**: 5-minute TTL for permission lookups to reduce database calls
  - **Admin UI**: `/admin/line-command-access` page for managing command permissions
  - **Commands Supported**: `goals_summary`, `business_card_search`, `category_search`, `checkin`, `link_phone`
  - **Security**: Zod validation for API requests, member status verified as 'member' only (not visitor)
  - **Migration**: Run `server/migrations/20251205_create_line_command_permissions.sql` on Supabase
- **LIFF Business Card Share System (Dec 2024)**:
  - **Purpose**: Allow members to share their business card as Flex Message via LINE Share Target Picker
  - **Requirements**: LIFF SDK v2.x, LINE App >= 10.3.0, max 5 bubbles per share
  - **Flow**: User opens share link → LIFF init → Login check → Fetch Flex Message → Share Target Picker → Success/Cancel
  - **Files**:
    - `client/src/hooks/useLiff.ts` - LIFF hook with init, login, shareTargetPicker, closeWindow
    - `client/src/pages/liff/LiffShareCard.tsx` - Share card UI with status handling
    - `server/routes/public.ts` - GET `/api/public/share-flex/:participantId` endpoint
    - `server/services/line/templates/businessCard.ts` - Flex Message template generator
  - **URL Format**: `/liff/share/{tenantId}/{participantId}`
  - **LIFF State Format**: `share:{tenantId}:{participantId}` (for Rich Menu integration)
  - **Error Handling**: login needed, not-in-liff, cancelled, network error states
  - **Security**: UUID validation, tenant isolation, URL sanitization
  - **Documentation**: Full technical docs at `docs/LIFF_BUSINESS_CARD_SHARE.md`

## External Dependencies

- **Supabase** (`sbknunooplaezvwtyooi`):
    - **Database**: PostgreSQL
    - **Authentication**: Supabase Auth
    - **Storage**: Supabase Storage
- **LINE Messaging API**: Integrated for communication, rich menus, quick replies, and webhooks.
- **Google Maps API**: Utilized for location features.