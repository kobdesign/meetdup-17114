# Meetdup - Chapter Management System

## Overview
Meetdup is a comprehensive multi-tenant SaaS application designed to streamline and manage business networking chapter operations. Its core purpose is to provide a robust platform for member management, meeting scheduling and attendance tracking, visitor check-ins, and various administrative tasks. The system aims to enhance efficiency and organization for business chapters, offering a tailored experience through multi-tenancy and role-based access control.

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
- **Role-Based Access Control (RBAC)**: Supports Super Admin, Chapter Admin, and Member roles.
- **Data Fetching & State Management**: Leverages TanStack React Query and React Context API.
- **UI/UX**: Employs Radix UI, Shadcn/ui, and Tailwind CSS for a modern, responsive interface. Meeting location fields are enhanced with collapsible sections and visual feedback.
- **LINE Integration**: Features a comprehensive multi-tenant LINE webhook system with destination-based tenant resolution, HMAC signature validation, secure credential management, rich menu management, quick reply system, and message-based interaction flows:
  - **Phone Linking Flow**: Users type "ลงทะเบียน" → Bot asks for phone number → System links LINE User ID to existing participant record (tenant-scoped)
  - **Business Card Search**: Users type "card {term}" → Search first_name/nickname fields → Display Business Card Flex Message or Carousel
  - **Status Badges**: Every Business Card shows status with emoji (🔵 Prospect, 🟡 Visitor, 🟢 Member, ⚫ Alumni, 🔴 Declined)
  - **Conversation State Management**: 5-minute TTL for multi-step flows with auto-cleanup
  - **Tenant Isolation**: All participant queries include defensive `.eq('tenant_id')` checks to prevent cross-tenant data access
  - **Architecture**: Single Messaging API channel per tenant (no LINE Login channel required), reducing setup time from 1-2 hours to ~5 minutes per chapter
- **LIFF Integration (DEPRECATED)**: LIFF-based LINE registration code preserved but commented out in favor of message-based flows. LIFF routes disabled in frontend (`/line-register`). Code retained for potential future use if browser-based registration becomes necessary.
- **Robust Error Handling**: Implemented across the system for stability and a smooth user experience.
- **Modular Design**: Project structured into `client/`, `server/`, `supabase/`, and `shared/` directories.
- **Check-In System**: Utilizes QR code-based check-ins and integrates with LINE webhooks for status progression and communication. Redesigned with phone number as the primary unique identifier, including normalization, lookup, and auto-registration flows.
- **Member/Visitor Pipeline Separation**: UI restructured to separate active member management from visitor pipeline analytics.
- **Multi-Path Onboarding System**: Implemented three onboarding flows: Pioneer (create chapter), Invite (accept invite link), and Discovery (search chapters).
- **Schema Management**: Database schema recreation using "wide tables" to match TypeScript definitions, including comprehensive columns and RLS policies. Fixed schema alignment issues for the `meetings` table and added missing columns for recurring meetings functionality.
- **Backend Migration**: User management and check-in APIs migrated from Supabase Edge Functions to Express API routes for enhanced control and reliability.
- **Unified Member-Participant Architecture**: Every member must have records in both `user_roles` (for access control) and `participants` (for chapter activities), linked via `user_id`. Includes a shared `syncUserToParticipants()` helper function.
- **Supabase Relationship Ambiguity Fix**: Resolved issues with multiple foreign keys pointing to the same table by using explicit relationship hints with actual FK constraint names.
- **Visitor Registration Status Flow**: Standardized visitor pipeline progression: Prospect (registered) → Visitor (first check-in) → Member (paid/approved) → Alumni (former member) or Declined (rejected).
- **2-Step Registration Flow**: Implemented phone-based lookup system for visitor registration. Step 1: Phone number entry and lookup. Step 2: Pre-filled form (if existing) or empty form (if new). Supports both INSERT (new) and UPDATE (existing) modes with tenant ownership validation for security.

## External Dependencies

- **Supabase** (`sbknunooplaezvwtyooi`):
    - **Database**: PostgreSQL
    - **Authentication**: Supabase Auth
    - **Storage**: Supabase Storage
- **LINE Messaging API**: Integrated for communication, rich menus, quick replies, and webhooks.
- **Google Maps API**: Utilized for location features, particularly in meeting venue management.