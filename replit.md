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

## External Dependencies

- **Supabase** (`sbknunooplaezvwtyooi`):
    - **Database**: PostgreSQL
    - **Authentication**: Supabase Auth
    - **Storage**: Supabase Storage
- **LINE Messaging API**: Integrated for communication, rich menus, quick replies, and webhooks.
- **Google Maps API**: Utilized for location features.