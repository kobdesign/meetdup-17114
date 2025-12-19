# Meetdup - Chapter Management System

## Overview
Meetdup is a multi-tenant SaaS application designed to streamline business networking chapter operations. Its core purpose is to provide a robust platform for member management, meeting scheduling and attendance tracking, visitor check-ins, and various administrative tasks. The system aims to enhance efficiency and organization for business chapters, offering a tailored experience through multi-tenancy and role-based access control. Key capabilities include self-service activation link requests, automated LINE LIFF activation, and bulk member import.

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
- **UI/UX**: Employs Radix UI, Shadcn/ui, and Tailwind CSS for a modern, responsive interface, including an image cropper for profile photos.
- **Landing Page**: Professional Trust theme with Navy Blue (#1e3a5f) + Soft Gold (#d4a574) color scheme. World-class SaaS landing page with 8 sections: LandingNavbar (sticky navigation), HeroSection (value proposition + CTA), TrustBar (stats + partners), ProblemSolutionSection, FeatureShowcase (9 key features), SocialProofSection (testimonials), TechnologySection (security + trust), LandingFooter (CTA + links). Uses custom `variant="gold"` button for CTAs.
- **LINE Integration**: Comprehensive multi-tenant LINE webhook system with destination-based tenant resolution, HMAC signature validation, secure credential management, rich menu management, and message-based interaction flows (e.g., phone linking, business card search, automated LIFF activation). Includes a LIFF-based member search system with tenant branding.
- **Check-In System**: QR code-based check-ins integrated with LINE webhooks, primarily using phone number for identification.
- **POS Check-In System**: Secure QR-based check-in for physical meetings with:
    - JWT tokens (15-min expiry, single-use enforcement via `used_checkin_tokens` database table)
    - LINE Bot "QR" command for generating secure check-in QR codes
    - Admin POS page with QR scanner (@yudiel/react-qr-scanner) and manual search fallback
    - Atomic `/pos-checkin` endpoint for QR validation
    - Auth-protected `/pos-manual-checkin` endpoint for manual check-in (requires admin role)
- **Member/Visitor Pipeline Separation**: UI separates active member management from visitor pipeline analytics, standardizing visitor progression.
- **Multi-Path Onboarding System**: Supports Pioneer, Invite, and Discovery onboarding flows.
- **Unified Member-Participant Architecture**: Every member has records in both `user_roles` (for access control) and `participants` (for chapter activities).
- **Bulk Member Import System**: Excel-based import with validation, phone normalization, duplicate detection, and error reporting.
- **Auto-Link System**: Automatically connects user accounts to participant records via phone number matching during registration.
- **Activation Flow**: Secure token-based self-registration for imported members with single-use, expiring tokens.
- **User Journey Status Transitions**: `prospect` → `visitor` → `member`.
- **Referrer Name Display Format**: Consistently shows "nickname (full_name)" format across all pages to prevent confusion when multiple members share the same nickname.
- **Business Card Search**: Enhanced multi-field search across various participant data fields with input sanitization and SQL injection prevention.
- **Participant Deletion**: Comprehensive participant deletion with cleanup of related records and proper handling of multi-tenant scenarios.
- **Database Management & Health Monitoring**: Includes a health check system for database status and schema sync verification.
- **Schema Updates**:
    - **Simplified Name Fields**: Unified `full_name_th` (Thai, required) and `full_name_en` (English, optional), plus `nickname_th`/`nickname_en`.
    - **Dual-Field Referral Model**: `referral_origin` enum + conditional `referred_by_participant_id` FK.
    - **LinkedIn Field**: Added `linkedin_url`.
    - **Required Phone**: Phone number is now required for participant creation/update.
    - **LINE ID Distinction**: `line_id` (user-entered) is separate from `line_user_id` (system-managed).
- **Business Category System**: Dynamic 2-digit codes, searchable selector, member-created categories (global across chapters), and bot-driven category search via Quick Reply + Postback.
- **LIFF Configuration**: Uses `liff_id` from `system_settings` for production; development uses Quick Reply flow due to LIFF OAuth domain restrictions.
- **Goals & Achievements System**: Chapters can set and track goals (visitors, members, check-ins, referrals) with auto-calculated progress and LINE notifications for achievement.
- **Daily Progress Summary**: Sends summary of active goals progress to Chapter Admins via LINE (manual trigger or bot command).
- **LINE Command Authorization System**: Flexible access control for LINE bot commands per chapter with `public`, `member`, and `admin` levels, supporting group chats and an admin UI for management.
- **LIFF Business Card Share System**: Allows members to share their business card as a Flex Message via LINE Share Target Picker, with robust LINE OAuth compliant architecture, URL normalization, and Super Admin toggle for share button visibility.
- **LIFF Profile Components**: Reusable `MemberProfileCard` (detailed view) and `MemberListCard` (compact list view) for displaying member profiles across LIFF pages, including LINE Chat links.
- **Event RSVP System**: Meeting notification with RSVP buttons (Confirm, Substitute, Leave). Data stored in `meeting_rsvp` table with statuses: pending, confirmed, declined, leave. Leave flow captures reason via Quick Reply options or free-text input.
- **RSVP Summary in Admin**: Meeting Details page displays RSVP responses grouped by status (Confirmed=green, Leave=orange, Substitute/Declined=blue, Pending=gray) with participant names, companies, and leave reasons. Data fetched via API endpoint `/api/notifications/rsvp/:meetingId` using supabaseAdmin to bypass RLS.

### Future Improvements (TODO)
- **Substitute Flow Enhancement**: Add `substitute_participant_id` column to `meeting_rsvp` table and update status constraint to include "substitute" value. LIFF form submission should sync back to `meeting_rsvp` with substitute details.

## External Dependencies

- **Supabase** (`sbknunooplaezvwtyooi`):
    - **Database**: PostgreSQL
    - **Authentication**: Supabase Auth
    - **Storage**: Supabase Storage
- **LINE Messaging API**: Integrated for communication, rich menus, quick replies, and webhooks.
- **Google Maps API**: Utilized for location features.