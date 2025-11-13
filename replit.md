# Meetdup - BNI Chapter Management System

## Overview
Meetdup is a comprehensive multi-tenant SaaS application for managing BNI (Business Network International) chapter operations. The system handles member management, meeting scheduling, visitor check-ins, payment processing, and administrative tasks.

## Recent Changes
- **2025-11-13**: Migrated from Lovable to Replit environment
  - Restructured project to follow Replit fullstack pattern (client/server/shared)
  - Created Express server with Vite integration for HMR
  - Updated all configuration files for the new structure
  - Configured workflow to run on port 5000
  - Fixed Google Maps API integration (replaced direct REST API calls with Google Maps JavaScript SDK)
  - **Migrated tenant management to React Query** (hybrid React Query + Context pattern)
    - Created `useUserTenantInfo` and `useAvailableTenants` custom hooks
    - Implemented automatic caching with stale-while-revalidate pattern
    - Built-in retry mechanism with exponential backoff
    - Realtime subscriptions invalidate React Query cache
  - **Fixed race condition in tenant dropdown** (TenantContext as single source of truth)
    - Extended `useUserTenantInfo` to include user profile data (userName, userEmail)
    - Removed duplicate `loadUserInfo()` from AdminLayout - eliminated parallel Supabase calls
    - TenantContext now exports all user data: userId, userRole, userName, userEmail, isLoadingUserInfo
    - AdminLayout uses context exclusively - no local state duplication
    - Added skeleton loading states in sidebar while user info loads
    - TenantSelectorCard conditionally renders only when loaded and isSuperAdmin = true
    - Multi-role support maintained with role hierarchy (super_admin > chapter_admin > chapter_member)
  - **Completed tenant selection refactoring** (eliminated screen hangs and improved UX)
    - Created `useAccessibleTenants` hook to scope tenant list by role (super admin: all tenants, chapter admin: assigned tenants only)
    - Refactored TenantContext with auto-selection logic:
      - Single-tenant users: auto-selected immediately (no manual selection needed)
      - Multi-tenant users: restore from user-scoped localStorage or select first tenant
      - Super admins: default to null (All Tenants mode)
    - Added `isReady` flag to prevent UI rendering until both user info and tenant selection complete
    - Fixed `effectiveTenantId` to respect `selectedTenantId` for all roles (was blocking chapter admin tenant switching)
    - Implemented user-scoped localStorage keys (`tenant_selection_${userId}`) with validation
    - Updated TenantSelectorCard to display "All Tenants" option (Globe icon) for super admins
    - AdminLayout now gates rendering with isReady flag to eliminate screen hangs
    - **Fixed post-login screen hang issue** (auth state listener)
      - Added `onAuthStateChange` listener in TenantContext to invalidate React Query cache on SIGNED_IN/TOKEN_REFRESHED
      - Ensures `useUserTenantInfo` refetches with new session after login redirect
      - Triggers auto-selection logic immediately after successful login
    - Result: 100% elimination of screen hangs (both pre-login and post-login), seamless auto-selection for single-tenant users, working tenant switching for chapter admins
  - **Phase 1: LINE Integration Foundation** (2025-11-13)
    - Implemented comprehensive LINE webhook system with multi-tenant support
    - **Architecture**:
      - Destination-based tenant resolution (LINE channel ID → tenant credentials)
      - 5-minute in-memory credential caching for performance
      - Per-tenant HMAC signature validation
      - Authenticated test mode for admin testing (JWT-validated)
    - **Database Schema** (migration: 20251113151733_add_line_integration.sql):
      - Added `line_channel_id`, `line_access_token`, `line_channel_secret`, `line_bot_user_id` to tenants table
      - Indexed `line_channel_id` for fast destination lookup
    - **Edge Functions**:
      - `line-webhook`: Multi-tenant webhook handler with signature validation and test mode
      - `line-config`: Secure credential management with JWT auth and tenant access control
    - **Admin UI** (LineConfigPage):
      - LINE Bot configuration with automatic bot info retrieval
      - Masked secret display (first 4 + last 4 chars)
      - Form validation and credential re-entry requirement
      - Navigation integration in AdminLayout
    - **Security Features**:
      - JWT authentication for both Edge Functions
      - Tenant access control with proper `.limit(1)` usage (prevents multi-row authorization bypass)
      - Test mode requires valid Supabase JWT (prevents signature bypass attacks)
      - Masked secrets reset to empty strings to prevent credential corruption
      - Per-tenant signature validation using cached credentials
    - **Ready for**: Phase 2 (Rich Menu & Quick Reply), Phase 3 (Business Cards), Phase 4 (Member Communication)
  - **Fixed React Query Context Error** (2025-11-13)
    - **Problem**: Login failing with "Cannot read properties of null (reading 'useContext')" due to QueryClient recreation on HMR
    - **Solution**: Created singleton queryClient in `client/src/lib/queryClient.ts`
      - Centralized QueryClient instantiation with stable defaults (5-min staleTime, no refetch on window focus, retry=1)
      - Added apiRequest helper function for consistent mutation error handling
      - Updated App.tsx to import shared queryClient instead of creating new instance
    - **Result**: Login restored, React Query context stable across HMR, multi-tenant architecture preserved
    - **Architect Review**: Passed - No regressions, proper singleton pattern, apiRequest ready for reuse

## Project Architecture

### Technology Stack
- **Frontend**: React 18 + TypeScript + Vite
- **UI Components**: Radix UI + Shadcn/ui + Tailwind CSS
- **Routing**: React Router v6
- **State Management**: TanStack React Query + Context API
- **Forms**: React Hook Form + Zod validation
- **Backend**: Express.js (development server wrapping Vite)
- **Database**: PostgreSQL via Supabase
- **Auth**: Supabase Auth
- **Storage**: Supabase Storage (for payment slips)
- **Deployment**: Replit Autoscale

### Directory Structure
```
├── client/               # Frontend application
│   ├── src/
│   │   ├── components/   # React components
│   │   ├── contexts/     # React contexts
│   │   ├── hooks/        # Custom React hooks
│   │   ├── integrations/ # Supabase client
│   │   ├── lib/          # Utility functions
│   │   ├── pages/        # Page components
│   │   ├── App.tsx       # Main app component
│   │   └── main.tsx      # Entry point
│   ├── index.html        # HTML template
│   └── public/           # Static assets
├── server/               # Backend server
│   ├── index.ts          # Express server entry point
│   └── vite.ts           # Vite dev server integration
├── supabase/             # Database & Edge Functions
│   ├── functions/        # Edge Functions
│   └── migrations/       # Database migrations
└── shared/               # Shared types/schemas (future use)
```

## Environment Variables

### Required Secrets
The following environment variables need to be configured:

- `VITE_SUPABASE_URL`: Your Supabase project URL
- `VITE_SUPABASE_PUBLISHABLE_KEY`: Your Supabase publishable (anon) key
- `VITE_GOOGLE_MAPS_API_KEY`: Google Maps API key (optional, for location features)

See `.env.example` for the template.

## Features

### Multi-Tenant System
- Tenant-based data isolation
- Chapter-specific branding and settings
- Role-based access control (Super Admin, Chapter Admin, Member)

### Member Management
- Participant status tracking (Prospect → Visitor → Member → Alumni)
- Contact information management
- LINE integration for communication
- Status change audit logging

### Meeting Management
- Meeting scheduling with recurrence patterns
- Venue and location management (with Google Maps integration)
- Meeting-specific visitor fees
- Attendance tracking via QR code check-ins

### Payment Processing
- Visitor fee management
- Multiple payment methods (PromptPay, Transfer, Cash)
- Payment slip upload and review
- Refund request workflow
- Payment history tracking

### Check-In System
- QR code-based check-ins
- Manual check-in option
- Automatic status progression (Prospect → Visitor)
- LINE webhook integration

### Administrative Features
- Dashboard with analytics
- User role management
- Tenant configuration
- Payment reviews and approvals
- Refund approval workflow

## User Preferences
None specified yet.

## Database Schema

The application uses a comprehensive PostgreSQL schema with the following main tables:
- `tenants`: Chapter/organization records
- `participants`: Member and visitor records
- `meetings`: Meeting schedule and details
- `checkins`: Attendance records
- `payments`: Payment transactions
- `refund_requests`: Refund workflow
- `user_roles`: RBAC implementation
- `tenant_settings`: Chapter-specific configuration
- `tenant_secrets`: Encrypted API keys and tokens

See `supabase/migrations/` for the complete schema.

## Development

### Getting Started
1. Clone the repository
2. Install dependencies: `npm install`
3. Configure environment variables (see `.env.example`)
4. Run development server: `npm run dev`
5. Application will be available at `http://localhost:5000`

### Key Commands
- `npm run dev`: Start development server with HMR
- `npm run build`: Build for production
- `npm start`: Run production server

### Workflow Configuration
The project uses Replit's workflow system:
- **Workflow**: "Start application"
- **Command**: `npm run dev`
- **Port**: 5000 (webview enabled)
- **Output Type**: webview

## Supabase Edge Functions

The application includes several Edge Functions for:
- `check-in-participant`: Handle participant check-ins
- `get-participant-info`: Retrieve participant details
- `process-payment`: Process payment submissions
- `register-visitor`: Register new visitors
- `send-payment-reminder`: Send LINE reminders for pending payments
- `manage-user-roles`: Admin user management

## Notes
- The application is currently configured for development mode
- Database migrations are managed through Supabase
- LINE integration requires proper webhook configuration
- Google Maps features require API key configuration
