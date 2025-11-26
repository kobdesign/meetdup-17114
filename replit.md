# Meetdup - Chapter Management System

## Overview
Meetdup is a multi-tenant SaaS application designed to streamline business networking chapter operations. Its core purpose is to provide a robust platform for member management, meeting scheduling and attendance tracking, visitor check-ins, and various administrative tasks. The system aims to enhance efficiency and organization for business chapters, offering a tailored experience through multi-tenancy and role-based access control. Key capabilities include self-service activation link requests, automated LINE LIFF activation, and bulk member import.

## User Preferences
None specified yet.

## Recent Changes

### November 26, 2024 - Profile Photo Image Cropper Feature
- **New Component**: Created `ImageCropper.tsx` using react-easy-crop library for circular image cropping
- **UX Improvement**: Users can now preview and adjust their profile photo before uploading
- **Features**: 
  - Circular crop preview (1:1 aspect ratio) to match avatar display
  - Zoom slider control
  - Rotate control
  - Cancel/Confirm actions
- **Integration**: Updated `ParticipantProfile.tsx` to use cropper flow before compression and upload
- **Fix**: Cropper dialog properly closes after upload success/error (setCropperOpen in finally block)
- **Result**: Prevents distorted profile photos when users upload non-square images

### November 26, 2024 - Activation Success Flex Message Fix
- **Bug Fix**: Activation success Flex Message was not sending after user activation
- **Root Cause**: Code was querying non-existent `tenants.line_channel_access_token` column
- **Solution**: Changed to use `getLineCredentials(tenantId)` function that retrieves encrypted credentials from `tenant_secrets` table
- **Result**: Users now receive congratulatory Flex Message with chapter name, status, and profile link button after successful account activation

### November 26, 2024 - Complete Participant Deletion with Auth User Cleanup
- **DELETE /api/participants/:id Endpoint**: Comprehensive participant deletion that properly cleans up all related records:
  - Deletes `activation_tokens` (allows retry for activation)
  - Checks if user has roles in other tenants (business rule: 1 user = 1 chapter)
  - If other tenant roles exist: Deletes only current tenant's `user_roles` and `participants` record
  - If no other roles: Deletes all `user_roles`, then `auth.users`, then `participants`
- **Error Handling Strategy**: All deletion steps are now fatal - if any step fails, returns 500 error and aborts before participant deletion to prevent orphaned records
- **Execution Order**: Participant is deleted LAST to ensure any prior failure doesn't leave partial cleanup state
- **Frontend Integration**: `Participants.tsx` updated to call DELETE API endpoint with auth header instead of direct Supabase client delete
- **Cleanup Script**: `server/scripts/cleanup-orphan-user.ts` with pagination support to handle >1000 users - removes orphaned auth users that have no participant/role links
- **Business Rule Enforcement**: Deletion logic validates multi-tenant scenarios; user can only belong to 1 chapter at a time

### November 25, 2024 - Complete Role-Based Authorization Fix
- **Role Naming Consistency**: Eliminated all `chapter_member` mapping confusion - system now uses actual database roles (`super_admin`, `chapter_admin`, `member`) throughout
- **Frontend Authorization**: Implemented progressive disclosure navigation in `AdminLayout.tsx` with `getNavItemsByRole()`:
  - **Member**: Dashboard + Meetings only (2 menu items)
  - **Chapter Admin**: Full operational menu (10 items: participants, visitors, check-in, meetings, LINE config, rich menu, settings, etc.)
  - **Super Admin**: Complete access (12 items including tenant management)
- **Route-Level Protection**: Added `requiredRole` guards to admin-only routes:
  - Protected routes: `/admin/participants`, `/admin/visitors`, `/admin/checkin`, `/admin/settings`, LINE config pages, rich menu pages
  - Open routes (all authenticated users): `/admin` (Dashboard), `/admin/meetings`
  - Super admin routes: Already protected with existing guards
- **ProtectedRoute Simplification**: Removed confusing `roleMapping` constant, now compares roles directly (`userInfo.role !== requiredRole`)
- **Security Architecture**: Three-layer defense:
  1. Frontend menu filtering (UX - hide inaccessible items)
  2. Route-level guards with ProtectedRoute (Security)
  3. Backend RLS policies + middleware (Defense in depth)
- **No Regressions**: Architect-verified implementation maintains all existing functionality while fixing member access issues

### November 22, 2024 - Rich Menu Edit Feature & Production Safety
- **Rich Menu Edit**: Implemented full Edit Rich Menu functionality with production-safe rollback handling:
  - Edit form allows updating name, chat_bar_text, and areas JSON without requiring image re-upload
  - Backend creates new menu before deleting old to prevent data loss
  - Comprehensive rollback logic: if any step fails (image upload, DB update, default setting), system reverts to original state and cleans up new menu
  - Added bounds configuration tip in UI to help users align clickable areas with icon positions (y:400, height:443 for bottom-half icons)
  - Image reuse: automatically copies existing image when no new upload provided
- **Rich Menu Security**: Replaced inline service-role key usage with supabaseAdmin singleton, preventing credential exposure
- **Tenant Isolation**: Removed unsafe .or() queries with user input; implemented sequential lookups with double tenant checks
- **Input Sanitization**: Business Card search now sanitizes all user input (escape %, _, remove quotes/semicolons) before SQL queries
- **Tags Search Fix**: Replaced unsafe .cs.{${searchTerm}} with .contains([sanitizedTerm]) for proper array search
- **Migration Safety**: Updated 20251122 migration to use ALTER TABLE instead of CREATE TABLE for production compatibility
- **Rich Menu Switching**: Added support for creating multiple Rich Menus with richmenuswitch action type, allowing users to navigate between menus (e.g., Main Menu ↔ More Menu). LINE Rich Menu ID display with copy button enables easy setup without requiring Rich Menu Aliases.

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
- **Role-Based Access Control (RBAC)**: Supports Super Admin, Chapter Admin, and Member roles.
- **UI/UX**: Employs Radix UI, Shadcn/ui, and Tailwind CSS for a modern, responsive interface.
- **LINE Integration**: Comprehensive multi-tenant LINE webhook system with destination-based tenant resolution, HMAC signature validation, secure credential management (using supabaseAdmin singleton), rich menu management (with database persistence and tenant isolation), and message-based interaction flows (e.g., phone linking, business card search with tags support, automated LIFF activation). Uses an Express-only webhook at `/api/line/webhook`. Rich menus use api-data.line.me for image uploads.
- **Check-In System**: QR code-based check-ins integrated with LINE webhooks, primarily using phone number for identification.
- **Member/Visitor Pipeline Separation**: UI is restructured to separate active member management from visitor pipeline analytics, standardizing the visitor progression (Prospect → Visitor → Member → Alumni/Declined).
- **Multi-Path Onboarding System**: Supports Pioneer (create chapter), Invite (accept invite link), and Discovery (search chapters) onboarding flows.
- **Unified Member-Participant Architecture**: Every member has records in both `user_roles` (for access control) and `participants` (for chapter activities), linked via `user_id`.
- **Bulk Member Import System**: Excel-based import with validation, phone normalization, duplicate detection, and error reporting, supporting later activation of imported members without user accounts.
- **Auto-Link System**: Automatically connects user accounts to participant records via phone number matching during registration.
- **Activation Flow**: Secure token-based self-registration for imported members with single-use, 7-day expiring tokens (`activation_tokens` table with `used_at` timestamp), facilitating account creation and linking.
- **Business Card Search**: Enhanced multi-field search across full_name, nickname, phone, company, notes, and tags array with input sanitization and SQL injection prevention. Two-phase search: (1) text fields with sanitized ILIKE, (2) tags array with .contains(). Conversational flow prompts for keywords if none provided. Supports "ค้นหานามบัตร" command from Rich Menu.
- **Database Management & Health Monitoring**: Includes a health check system for database status, schema sync verification, and manual migration instructions for production Supabase. Migrations are manual for safety and transparency.

### Database Architecture & Verification Rules

**CRITICAL: Source of Truth**
- ✅ **Supabase Production** (`sbknunooplaezvwtyooi`) = Source of Truth
  - All application code uses `supabaseAdmin` from `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`
  - This is the ONLY database the application actually uses
- ❌ **Local PostgreSQL** (Neon via `DATABASE_URL`) = Testing/Infrastructure ONLY
  - Used for health checks and local testing only
  - NOT connected to the application runtime
  - Schema may differ from Supabase production

**Verification Protocol (Mandatory)**

Before making ANY claims about database state:
1. ✅ Run verification script: `npx tsx server/scripts/check-supabase-production.ts [table_name]`
2. ✅ Check actual Supabase production data, not local database
3. ✅ Show evidence (query results, screenshots) to user
4. ❌ NEVER use `execute_sql_tool` to verify production state (it connects to local PostgreSQL)
5. ❌ NEVER assume migration status without verification

**Tools for Production Verification:**
- `server/scripts/check-supabase-production.ts` - Verify schema and columns exist
- Supabase Dashboard SQL Editor - Manual queries and migrations
- `supabaseAdmin` client in code - Runtime queries

**Common Mistakes to Avoid:**
- ❌ Using `execute_sql_tool` and thinking it's Supabase production
- ❌ Assuming local schema matches production
- ❌ Claiming "column doesn't exist" without checking Supabase
- ❌ Claiming "migration not run" without verification

## External Dependencies

- **Supabase** (`sbknunooplaezvwtyooi`):
    - **Database**: PostgreSQL
    - **Authentication**: Supabase Auth
    - **Storage**: Supabase Storage
- **LINE Messaging API**: Integrated for communication, rich menus, quick replies, and webhooks.
- **Google Maps API**: Utilized for location features.