# Meetdup - Chapter Management System

## Overview
Meetdup is a comprehensive multi-tenant SaaS application designed to streamline and manage business networking chapter operations. Its core purpose is to provide a robust platform for member management, meeting scheduling and attendance tracking, visitor check-ins, and various administrative tasks. The system aims to enhance efficiency and organization for business chapters, offering a tailored experience through multi-tenancy and role-based access control.

### Recent Features
- **LIFF Activation Flow (Nov 2024)**: Streamlined member activation via LINE LIFF app
  - **Admin UI**: "Send via LINE" button in Members Management for members with linked LINE accounts
  - **LINE Flex Message**: Beautiful activation invitation with one-tap button to open LIFF
  - **LIFF Page**: Single-page form pre-filled with member data, collects email/password, auto-links LINE User ID
  - **Backend API**: `/api/participants/send-liff-activation` generates tokens and sends LINE messages; `/api/participants/activate-via-line` creates accounts and confirms via LINE
  - **Setup**: Requires LIFF app configuration in LINE Developers Console (see `.env.example`)
  - **Flow**: Admin clicks "Send via LINE" → Member receives Flex Message → Taps button → Opens LIFF form → Creates account → Auto-linked to LINE → Receives confirmation
- **Bulk Member Import**: Excel-based member import with phone validation and duplicate detection
- **Auto-Link System**: Automatically connects user accounts to participant records via phone number matching
- **Activation Flow**: Secure token-based self-registration for imported members with 7-day expiration
- **Duplicate Role Fix (Nov 2024)**: Resolved PGRST116 error for admins with multiple chapter roles
  - Migration adds unique constraint on (user_id, tenant_id, role) to prevent exact duplicate roles
  - API detects and returns 409 errors for data corruption while preserving legitimate multi-role assignments
  - Users can still have multiple different roles per tenant (e.g., chapter_admin + member)

## User Preferences
None specified yet.

## Database Management & Health Monitoring

### Quick Reference
**Always check database status when debugging!**
```bash
npm run db:status        # Check what database you're using
npm run db:check-sync    # Verify schemas match
```

### The Problem We Solve
- **Multiple Databases**: Local PostgreSQL (Replit) + Production Supabase
- **Schema Drift**: Migrations run on local but not production
- **Hard to Debug**: Not knowing which database is being used

### Health Check System
Every server startup now shows:
```
================================================================================
🏥 DATABASE HEALTH CHECK
================================================================================
📋 ENVIRONMENT:
   SUPABASE_URL: https://sbknunooplaezvwtyooi.supabase.co
   DATABASE_URL: ✅ SET (ep-silent-bush-ah6um9gf.c-3.us-east-1.aws.neon.tech)

🔌 CONNECTIONS:
   Supabase (sbknunooplaezvwtyooi): ✅ Connected
   PostgreSQL (neondb): ✅ Connected

📊 SCHEMA STATUS:
   Business Card Columns: ✅ All Present OR ❌ Missing Columns
================================================================================
```

### Available Commands

#### 1. Check Database Status
```bash
npm run db:status
```
Shows environment, connections, and schema sync status.

#### 2. Verify Schema Sync
```bash
npm run db:check-sync
```
Checks if local and production schemas match. **Run this before deploying!**

#### 3. Get Manual Migration Instructions
```bash
npm run db:migrate-manual
```
Shows step-by-step instructions for manually running migrations on Production Supabase.
For safety, automated migrations are not supported - you must review and run SQL manually.

#### 4. List All Migrations
```bash
npm run db:list-migrations
```
Shows all migration files (🎯 marks business card related).

### Troubleshooting Guide

#### ❌ "column does not exist" Error

**Symptom**: Queries fail with `column participants.position does not exist`

**Cause**: Migration not run on Production Supabase

**Solution**:
```bash
# Check which database is missing columns
npm run db:check-sync

# If Supabase is out of sync, get migration instructions
npm run db:migrate-manual

# Follow the manual steps, then verify
npm run db:check-sync
```

#### ❌ Wrong Database Being Used

**Symptom**: Code works locally but not in production (or vice versa)

**Solution**:
```bash
# Check environment variables
npm run db:status

# Look for:
# ✅ SUPABASE_URL should be: https://sbknunooplaezvwtyooi.supabase.co
# ✅ Both connections should show "Connected"
```

#### ❌ Schema Drift After Migration

**Prevention**:
1. Write migration file in `supabase/migrations/`
2. Run on local: Automatic with Replit PostgreSQL
3. Run on production: Follow `npm run db:migrate-manual` instructions
4. Verify: `npm run db:check-sync`

### Best Practices

1. **Before Starting Work**
   ```bash
   npm run db:status  # Know your environment
   ```

2. **After Creating Migration**
   ```bash
   npm run db:migrate-manual  # Get instructions for production
   # Follow manual steps in Supabase SQL Editor
   npm run db:check-sync      # Verify
   ```

3. **When Debugging**
   - Check server startup logs for health check results
   - Run `npm run db:status` to verify environment
   - Check which database query is failing against

4. **Before Deployment**
   ```bash
   npm run db:check-sync  # Ensure schemas match
   ```

### Production Migration Process

**All production migrations must be run manually** for safety and transparency.

1. Run the migration helper:
   ```bash
   npm run db:migrate-manual
   ```

2. This will show you:
   - Direct link to Supabase SQL Editor
   - Migration file path
   - SQL preview
   - Step-by-step instructions

3. Follow the displayed steps to:
   - Open Supabase SQL Editor
   - Copy SQL from the migration file
   - Review the SQL changes
   - Paste and click "Run"

4. Verify the migration worked:
   ```bash
   npm run db:check-sync
   ```

**Why manual migrations?**
- **Safety**: Review SQL before execution
- **Transparency**: See exactly what changes
- **Rollback-friendly**: Can undo via Supabase dashboard

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
- **Bulk Member Import System**: Excel-based import with validation, phone normalization, duplicate detection, and error reporting. Supports importing existing members without user accounts for later activation.
- **Auto-Link System**: Automatically connects user accounts to participant records via phone number matching during registration. Prevents account duplication and ensures unified member-participant architecture.
- **Activation Flow**: Secure token-based self-registration for imported members:
  - **Token Generation**: Admins generate activation links for members without accounts via Members Management page
  - **Token Security**: Backend-only access via service role (no public RLS), single-use tokens with 7-day expiration
  - **Activation Process**: Member receives link → validates token → creates account → auto-links to participant record → marks token as used
  - **User Experience**: Pre-filled form with participant data (name, phone), password setup, email confirmation

## External Dependencies

- **Supabase** (`sbknunooplaezvwtyooi`):
    - **Database**: PostgreSQL
    - **Authentication**: Supabase Auth
    - **Storage**: Supabase Storage
- **LINE Messaging API**: Integrated for communication, rich menus, quick replies, and webhooks.
- **Google Maps API**: Utilized for location features, particularly in meeting venue management.