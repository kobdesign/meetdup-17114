# Meetdup - BNI Chapter Management System

## Overview
Meetdup is a multi-tenant SaaS application designed to manage BNI chapter operations. It provides robust features for member management, meeting scheduling, attendance tracking, visitor check-ins, payment processing, and administrative tasks. The system aims to improve efficiency and organization for BNI chapters through multi-tenancy and role-based access control, offering a tailored experience for each chapter.

## User Preferences
None specified yet.

## System Architecture

### Technology Stack
- **Frontend**: React 18, TypeScript, Vite, Radix UI, Shadcn/ui, Tailwind CSS
- **Routing**: React Router v6
- **State Management**: TanStack React Query, React Context API
- **Backend**: Express.js
- **Database**: PostgreSQL via Supabase
- **Authentication & Storage**: Supabase Auth, Supabase Storage
- **Deployment**: Replit Autoscale

### Core Architectural Decisions
- **Multi-Tenancy**: Implemented with tenant-based data isolation, chapter-specific branding, and settings, utilizing `tenants` and `tenant_secrets` tables.
- **Role-Based Access Control (RBAC)**: Supports Super Admin, Chapter Admin, and Member roles, managed via the `user_roles` table.
- **Direct PostgreSQL Connections**: The backend uses the `pg` library with connection pooling for direct PostgreSQL interactions, bypassing Supabase PostgREST client schema cache issues. This includes transaction support, Auth middleware with caching, and a service layer with manual RLS enforcement and multi-tenant authorization.
- **Data Fetching & State Management**: TanStack React Query is used for data fetching, caching, and invalidation, complemented by React Context API for global state.
- **UI/UX**: Leverages Radix UI, Shadcn/ui, and Tailwind CSS for a modern, responsive user interface.
- **LINE Integration**: Features a multi-tenant LINE webhook system with destination-based tenant resolution, HMAC signature validation, secure credential management, rich menu management, and a quick reply system.
- **Robust Error Handling**: Comprehensive error handling is implemented for stability and a smooth user experience.
- **Modular Design**: Project is structured into `client/`, `server/`, `supabase/`, and `shared/` directories for maintainability and scalability.
- **Payment Processing**: Supports multiple payment methods (PromptPay, Transfer, Cash) with features for slip upload, review, and a refund request workflow.
- **Check-In System**: Utilizes QR code-based check-ins and integrates with LINE webhooks for automatic status progression.
- **Onboarding System**: Implements a three-path onboarding system for new users (Pioneer, Invite, Discovery) with associated backend APIs and database schema for invite tokens and join requests.
- **Visitor Pipeline & Member Management**: Separated UI for active member management and visitor pipeline analytics, with dedicated backend APIs for aggregated metrics.

## External Dependencies

- **Supabase** (`sbknunooplaezvwtyooi`):
    - **Database**: PostgreSQL for all primary data storage, utilizing direct connections from the backend.
    - **Authentication**: Supabase Auth for user authentication.
    - **Storage**: Supabase Storage for file management (e.g., payment slips).
- **LINE Messaging API**: Integrated for interactive communication, rich menus, and webhook-based interactions.
- **Google Maps API**: Used for location-based features, particularly for meeting venue management.