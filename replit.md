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
- **LINE Integration**: Features a comprehensive multi-tenant LINE webhook system with destination-based tenant resolution, HMAC signature validation, secure credential management, rich menu management, and a quick reply system.
- **Robust Error Handling**: Implemented across the system for stability and a smooth user experience, including fixes for React Query context errors.
- **Modular Design**: Project structured into `client/`, `server/`, `supabase/`, and `shared/` directories.
- **Payment Processing**: Supports multiple payment methods (PromptPay, Transfer, Cash) with features for slip upload, review, and refund workflows.
- **Check-In System**: Utilizes QR code-based check-ins and integrates with LINE webhooks for status progression and communication.
- **Member/Visitor Pipeline Separation**: UI restructured to separate active member management from visitor pipeline analytics, with dedicated pages for active members and a visitor pipeline dashboard featuring analytics KPIs.
- **Multi-Path Onboarding System**: Implemented three onboarding flows: Pioneer (create chapter), Invite (accept invite link), and Discovery (search chapters). This includes new backend APIs for chapter creation, invite management, and join requests, alongside schema migrations for `chapter_invites` and `chapter_join_requests`, and a refactored `user_roles` table to support global Super Admin roles.
- **Schema Management**: Database schema recreation using "wide tables" to match TypeScript definitions, including `tenant_settings` and `participants` tables with comprehensive columns and RLS policies.
- **Backend Migration**: User management APIs migrated from Supabase Edge Functions to Express API routes for enhanced control and to resolve previous authorization issues.
- **Super Admin Authorization Fix** (Nov 15, 2025): Fixed critical authorization bug where Super Admin (tenant_id = NULL) couldn't create invite links or approve join requests. Implemented two-step authorization check: first check for super admin role, then fallback to chapter admin role for tenant-specific access.

## External Dependencies

- **Supabase** (`sbknunooplaezvwtyooi`):
    - **Database**: PostgreSQL (main data store with 18 tables and multi-tenant architecture)
    - **Authentication**: Supabase Auth (integrated with profiles table)
    - **Storage**: Supabase Storage (for payment slips and other files)
- **LINE Messaging API**: Integrated for communication, rich menus, quick replies, and webhooks.
- **Google Maps API**: Utilized for location features, particularly in meeting venue management.