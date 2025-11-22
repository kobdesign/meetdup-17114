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
- **Role-Based Access Control (RBAC)**: Supports Super Admin, Chapter Admin, and Member roles.
- **UI/UX**: Employs Radix UI, Shadcn/ui, and Tailwind CSS for a modern, responsive interface.
- **LINE Integration**: Comprehensive multi-tenant LINE webhook system with destination-based tenant resolution, HMAC signature validation, secure credential management, rich menu management (with database persistence), and message-based interaction flows (e.g., phone linking, business card search with tags support, automated LIFF activation). Uses an Express-only webhook at `/api/line/webhook`. Rich menus use api-data.line.me for image uploads.
- **Check-In System**: QR code-based check-ins integrated with LINE webhooks, primarily using phone number for identification.
- **Member/Visitor Pipeline Separation**: UI is restructured to separate active member management from visitor pipeline analytics, standardizing the visitor progression (Prospect → Visitor → Member → Alumni/Declined).
- **Multi-Path Onboarding System**: Supports Pioneer (create chapter), Invite (accept invite link), and Discovery (search chapters) onboarding flows.
- **Unified Member-Participant Architecture**: Every member has records in both `user_roles` (for access control) and `participants` (for chapter activities), linked via `user_id`.
- **Bulk Member Import System**: Excel-based import with validation, phone normalization, duplicate detection, and error reporting, supporting later activation of imported members without user accounts.
- **Auto-Link System**: Automatically connects user accounts to participant records via phone number matching during registration.
- **Activation Flow**: Secure token-based self-registration for imported members with single-use, 7-day expiring tokens (`activation_tokens` table with `used_at` timestamp), facilitating account creation and linking.
- **Business Card Search**: Enhanced multi-field search across full_name, nickname, phone, company, notes, and tags array. Conversational flow prompts for keywords if none provided. Supports "ค้นหานามบัตร" command from Rich Menu.
- **Database Management & Health Monitoring**: Includes a health check system for database status, schema sync verification, and manual migration instructions for production Supabase. Migrations are manual for safety and transparency.

## External Dependencies

- **Supabase** (`sbknunooplaezvwtyooi`):
    - **Database**: PostgreSQL
    - **Authentication**: Supabase Auth
    - **Storage**: Supabase Storage
- **LINE Messaging API**: Integrated for communication, rich menus, quick replies, and webhooks.
- **Google Maps API**: Utilized for location features.