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
