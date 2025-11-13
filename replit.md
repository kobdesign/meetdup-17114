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