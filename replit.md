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
- **Backend**: Express.js (development server)
- **Database**: PostgreSQL via Supabase
- **Authentication & Storage**: Supabase Auth, Supabase Storage
- **Deployment**: Replit Autoscale

### Core Architectural Decisions
- **Multi-Tenancy**: Implemented with tenant-based data isolation, chapter-specific branding, and settings. Utilizes `tenants` table for chapter records and `tenant_secrets` for encrypted API keys.
- **Role-Based Access Control (RBAC)**: Supports Super Admin, Chapter Admin, and Member roles, with `user_roles` table managing permissions.
- **Data Fetching & State Management**: Leverages TanStack React Query for data fetching, caching (stale-while-revalidate), retries, and invalidation, combined with React Context API for global state management. A singleton `QueryClient` is used to prevent re-instantiation issues.
- **UI/UX**: Employs Radix UI, Shadcn/ui, and Tailwind CSS for a modern, responsive, and consistent user interface.
- **LINE Integration**: Features a comprehensive multi-tenant LINE webhook system with destination-based tenant resolution, HMAC signature validation, and secure credential management. This includes rich menu management (create, list, delete, set default) and a quick reply system for interactive communication.
- **Robust Error Handling**: Implemented across the system, including specific fixes for React Query context errors and infinite loops related to authentication state changes, ensuring stability and a smooth user experience.
- **Modular Design**: Project structured into `client/`, `server/`, `supabase/`, and `shared/` directories to promote maintainability and scalability, following the Replit fullstack pattern.
- **Payment Processing**: Supports multiple payment methods (PromptPay, Transfer, Cash) with features for payment slip upload, review, and a refund request workflow.
- **Check-In System**: Utilizes QR code-based check-ins and integrates with LINE webhooks for automatic status progression and communication.

### Feature Specifications
- **Member Management**: Tracks participant status (Prospect, Visitor, Member, Alumni), manages contact information, and logs status changes.
- **Meeting Management**: Facilitates scheduling with recurrence, venue management (integrated with Google Maps), and attendance tracking.
- **Administrative Features**: Provides a dashboard with analytics, user role management, tenant configuration, and approval workflows for payments and refunds.

## Recent Changes

### Member/Visitor Pipeline Separation (November 14, 2025)
- **Complete UI Restructure**: Separated active member management from visitor pipeline analytics
- **Active Members Page** (`/admin/participants`):
  - Shows only participants with status='member'
  - Focused on active member management with role assignment and contact details
  - Simplified status filter (defaults to 'member' view)
- **Visitor Pipeline Dashboard** (`/admin/visitors`):
  - **Analytics KPIs**: 4 key metric cards showing prospects, visitors, engaged visitors (2+ check-ins), and declined
  - **Engagement Metrics**: Average check-ins per visitor calculation
  - **Status Breakdown**: Visual cards for each pipeline stage
  - **Data Table**: Complete visitor list with status, check-in counts, and quick actions
- **Backend API** (`/api/participants/visitor-analytics`):
  - Returns aggregated visitor pipeline metrics
  - **Security Features**:
    * Multi-tenant authorization check (queries all user_roles to support multi-tenant users)
    * Super admin support (role='super_admin' with tenant_id=NULL can access all chapters)
    * 403 Forbidden for unauthorized tenant access
  - Server-side aggregation with Supabase queries
- **Navigation Update**: Visitor Pipeline moved under Members section in AdminLayout for better discoverability
- **Architecture Decision**: Split analytics surface from member CRUD operations for better UX and performance

### Multi-Path Onboarding System Implementation (November 14, 2025)
- **Feature Complete**: Implemented comprehensive 3-path user onboarding system for new users without chapter assignment
- **Three Onboarding Flows:**
  1. **Pioneer Flow** (`/create-chapter`): Create new chapter and become admin
  2. **Invite Flow** (`/invite/:token`): Accept invite link and auto-join chapter
  3. **Discovery Flow** (`/discover-chapters`): Search chapters and request membership
- **Backend APIs Created:**
  - `POST /api/chapters/create` - Chapter creation with auto admin assignment
  - `POST /api/chapters/invite/generate` - Generate invite tokens with expiration
  - `POST /api/chapters/invite/accept/:token` - Accept invite and auto-join
  - `GET /api/chapters/discover` - Search available chapters
  - `POST /api/chapters/join-request` - Request chapter membership
  - `GET/PATCH /api/chapters/join-requests` - Admin approval workflow
- **Database Schema:**
  - `chapter_invites` table: invite token management with expiration and usage tracking
  - `chapter_join_requests` table: pending membership request workflow
  - **user_roles schema migration**: Restructured to support global Super Admin roles
    - Removed composite primary key `(user_id, tenant_id)`
    - Added `id serial PRIMARY KEY`
    - Made `tenant_id` nullable (NULL = global Super Admin)
    - Created unique indexes to prevent duplicate role assignments
- **Components:**
  - `OnboardingGuard` component: Session-gated wrapper using `useUserTenantInfo` hook
  - LoginPrompt UI for anonymous users with redirect handling
  - MembersManagement admin page for invite generation and role management
- **Auth Flow Improvements:**
  - ProtectedRoute refactored to use React Query (`useUserTenantInfo`)
  - Fixed race conditions in AcceptInvite and CreateChapter pages
  - Auth.tsx properly respects redirect query parameters
  - Cache management with `await refetchQueries({ type: 'all' })`
- **Super Admin Setup:** 
  - Schema migration for nullable tenant_id (`20251114_make_tenant_id_nullable.sql`)
  - Script to assign super_admin role: `npm run set-super-admin`
  - kobdesign@gmail.com can be assigned as first Super Admin
  - Guide: `docs/SET_SUPER_ADMIN_GUIDE.md`
- **Security Hardening** (November 14, 2025):
  - **Final Migration**: `supabase/migrations/20251114_fix_permissions_final.sql`
  - **Admin-Only Invite Access**: Only chapter admins can view/create/delete invite tokens
  - **Role-Based Join Request Visibility**: Admins see all requests; users see own only
  - **RLS Policies**: Tightened to prevent token enumeration and data exposure
  - **Backend Service Role**: Invite acceptance handled server-side (no client token queries)
  - **Privacy Protection**: Regular members cannot see invite metadata or others' join requests
  - **Verification Scripts**: 
    - `npm run verify-migration` - Checks table existence
    - `npm run check-data` - Displays all Supabase data with error handling
  - **Documentation**: Complete user journey guide in `docs/USER_JOURNEY_ONBOARDING.md`

### Comprehensive Schema Migration (November 14, 2025)
- **Migration Complete**: Added all missing columns to ensure production database matches TypeScript types
- **Migration Files:**
  1. `supabase/migrations/20251114_reconcile_schema_with_code.sql` - Initial reconciliation
  2. `supabase/migrations/20251114_add_all_missing_columns.sql` - **Comprehensive fix (USE THIS)**
  
- **Final Migration** (`20251114_add_all_missing_columns.sql`):
  - **Idempotent**: Uses `IF NOT EXISTS` - safe to run multiple times
  - **Transactional**: Wrapped in BEGIN/COMMIT for safety
  - **Complete**: Adds all potentially missing columns in one migration
  
- **Changes to `tenants` table:**
  - Renamed `name` → `tenant_name` (aligns with code)
  - Renamed `slug` → `subdomain` (matches AddTenantDialog and routing)
  - Added `line_bot_basic_id` (TEXT, nullable) - stores LINE Bot ID for webhook routing
  - Added `logo_url` (TEXT, nullable) - chapter logo storage reference
  - Created unique index `tenants_subdomain_unique` to enforce subdomain uniqueness
  - Dropped unused columns: `country`, `timezone`, `status` (not referenced in code)
  
- **Changes to `tenant_settings` table (6 columns added):**
  - `branding_color` (TEXT, nullable) - chapter branding color
  - `currency` (TEXT, DEFAULT 'THB') - for multi-currency support
  - `default_visitor_fee` (NUMERIC, nullable) - default fee for visitors
  - `language` (TEXT, DEFAULT 'en') - preferred language
  - `logo_url` (TEXT, nullable) - settings logo URL
  - `require_visitor_payment` (BOOLEAN, DEFAULT true) - visitor payment requirement flag
  
- **Changes to `participants` table (1 column added):**
  - `business_type` (TEXT, nullable) - type of business/profession
- **Migration Tools Created:**
  - `server/scripts/run-migration.ts` - PostgreSQL migration runner using `psql` command
    * Handles multi-statement files with BEGIN/COMMIT and DO blocks
    * Secure: Passes PGPASSWORD via environment variables (not command line)
  - `npm run migrate:run <migration-file>` - Generic migration executor
  - `npm run migrate:reconcile` - Initial reconciliation migration (deprecated - use add-columns)
  - `npm run migrate:add-columns` - **Comprehensive migration (RECOMMENDED)** - adds all missing columns
- **Settings UI Enhancement:**
  - Added Switch component for `require_visitor_payment` toggle
  - Fixed Settings.tsx to load, display, and persist all tenant_settings columns
  - Prevents NULL overwrites on upsert by including all fields
- **PostgREST Schema Cache:**
  - Fixed "column not found" errors by sending `NOTIFY pgrst, 'reload schema'`
  - Required after direct PostgreSQL migrations to refresh Supabase API cache
- **Verification:**
  - All columns verified in database via `information_schema.columns` queries
  - Existing tenant data preserved (BNI Integrity chapter intact)
  - TypeScript types (types.ts) already matched expected schema before migration

### Database Migration to User-Owned Supabase (November 13, 2025)
- **Successfully migrated** from Lovable-owned Supabase (`nzenqhtautbitmbmgyjk`) to user-owned Supabase (`sbknunooplaezvwtyooi`)
- **Migration Process:**
  1. Created new Supabase project with user account
  2. Exported complete schema (18 tables, 8 custom types, 24 indexes, RLS policies)
  3. Fixed table dependency ordering (tenants → participants → meetings → checkins)
  4. Resolved RLS permission issues by granting service_role full access
  5. Disabled RLS for testing phase; proper policies to be implemented later
- **Backend Architecture:**
  - **Express API Routes**: `/api/line/*` endpoints for LINE integration (Rich Menu, Webhook, Config)
  - **Supabase Edge Functions**: Legacy functions remain in `supabase/functions/` directory (to be migrated)
  - **Health Endpoint**: `/api/health` validates database connectivity via service role
- **Environment Variables Updated:**
  - `VITE_SUPABASE_URL`: `https://sbknunooplaezvwtyooi.supabase.co`
  - `VITE_SUPABASE_PUBLISHABLE_KEY`: User-owned anon key
  - `SUPABASE_SERVICE_ROLE_KEY`: User-owned service role key
  - `LINE_ENCRYPTION_KEY`: Generated for tenant secrets encryption
- **Migration Files:** Archived in `./migration_archive/` directory for reference
- **Database Status:** ✅ Connected and verified (all 18 tables accessible)

## External Dependencies

- **Supabase** (User-owned: `sbknunooplaezvwtyooi`):
    - **Database**: PostgreSQL (main data store) - 18 tables with multi-tenant architecture
    - **Authentication**: Supabase Auth (integrated with profiles table)
    - **Storage**: Supabase Storage (for payment slips and other files)
    - **Backend**: All logic runs in Express.js (no Edge Functions due to Lovable ownership constraint)
- **LINE Messaging API**: Integrated for communication, rich menus, and quick replies, including webhooks for real-time interactions.
- **Google Maps API**: Utilized for location features, particularly in meeting venue management.