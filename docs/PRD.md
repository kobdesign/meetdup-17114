# Product Requirements Document (PRD)

## 1. Overview
### 1.1 Product Vision
Deliver a multi-tenant platform that helps BNI chapter leaders operate weekly meetings, manage member lifecycles, process payments, and support visitor onboarding through an end-to-end digital experience spanning internal dashboards and public-facing flows.

### 1.2 Key Value Proposition
- Centralize chapter data for admins while preserving tenant-level isolation.
- Automate operational tasks such as meeting scheduling, attendance, and payment review.
- Offer a frictionless visitor journey from discovery to check-in and payment submission.

### 1.3 Target Users & Roles
- **Super Admin** – oversees multiple tenants, configures permissions, and supports chapter operations at scale.
- **Chapter Admin** – manages meetings, members, visitors, and payments for a single tenant.
- **Chapter Member** – authenticates for self-service actions (e.g., profile updates) and visibility into meeting logistics.
- **Visitor** – interacts with public check-in and payment flows without authentication.

## 2. Goals & Success Metrics
- **Operational efficiency:** reduce manual effort for scheduling, attendance tracking, and payment verification.
- **Member growth & retention:** provide visibility into participant pipelines and visitor conversion.
- **Payment compliance:** shorten the lag between visitor registration and confirmed payment.
- **Tenant scalability:** allow a super admin to spin up or manage new chapters without developer intervention.

Success can be measured by meeting engagement (attendance, visitors), turnaround time on payment reviews, and reduction in manual configuration across tenants.

## 3. User Roles & Access Control
- Role-gated routing ensures authenticated users only see authorized pages, with super admins inheriting all permissions. Tenant-aware providers load role metadata, the effective tenant, and allow super admins to switch tenants when operating in shared dashboards.
- Navigation adapts to role: chapter admins receive operational menus (dashboard, participants, meetings, visitors, check-in, payment reviews, settings) while super admins see tenant administration and authorization tools in addition to chapter views.

## 4. User Journeys & Use Cases
- **Super Admin onboarding:** authenticate, select a tenant, configure branding/payment options, invite chapter staff, and monitor cross-tenant analytics.
- **Chapter Admin daily workflow:** review dashboard analytics, confirm upcoming meetings, manage recurring schedules and venues, invite visitors, print or share check-in QR codes, process attendance, review payments/refunds, and update chapter settings.
- **Member self-service:** log in to update their profile or view meeting resources (scoped beyond the provided UI screens but supported by routing and layouts).
- **Visitor funnel:** discover the chapter profile, register or RSVP, scan the QR code to check in on-site, and upload payment slips through mobile-friendly public pages.

## 5. Functional Requirements
### 5.1 Authentication & Authorization
- Email-based login flows with password reset support are provided, with session persistence handled through Supabase authentication.
- Protected routes enforce login and optional role requirements, redirecting unauthenticated users to the auth page and downgrading unauthorized access.

### 5.2 Tenant Management & Context
- Maintain tenant metadata (name, slug, branding) and keep a synchronized list of active tenants for super admins.
- Remember super admin tenant selections across sessions and expose a tenant selector control inside admin navigation for quick switching.
- Load tenant-specific settings such as logos, colors, currency, visitor fee policies, QR payment payloads, and expose editing tools guarded by permission checks.

### 5.3 Dashboard & Analytics
- Present summary metrics (participants by status, meetings, attendance, revenue, payment states) with configurable date ranges.
- Provide charts (pie, bar, line) illustrating participant mix, payment status, monthly check-ins, and revenue trends.
- Allow filtering by participant status and date presets, including custom ranges.

### 5.4 Participant Management
- List participants with search, status badges, and action controls (create, update, delete) scoped to the active tenant.
- Capture detailed profiles (contact info, company, goals, notes) and enforce required fields during creation or update.
- Prevent destructive actions when dependent records (check-ins, payments) exist, surfacing descriptive errors.

### 5.5 Meeting Management
- Display meetings in table and calendar views, showing check-in counts per session.
- Support rich text agendas with image uploads, theme previews, visitor fees, and Google-powered location search capturing coordinates and formatted addresses.
- Provide recurrence tools (pattern, interval, day selection, end rules) to generate multiple meetings automatically.
- Enable editing existing meetings and deleting when permitted, with confirmation dialogs.

### 5.6 Visitor & Attendance Flows
- Manage visitor records and link them to meetings (details inferred from supporting code patterns and shared components).
- Generate check-in QR codes per meeting, allow downloads, copyable public links, and open public check-in pages.
- Display real-time check-ins with participant context (name, company, status) and restrict access when no tenant is selected.
- Provide a public check-in page where visitors submit their name, email, and phone. The system calls an edge function to register the check-in, handles duplicate prevention, and surfaces localized success/error feedback.

### 5.7 Payments & Refunds
- Offer a public payment portal for visitors to review chapter details, see payment amounts/currency, view QR payment payloads, and upload transfer slips to an edge function for processing.
- Supply internal views for payment history per participant, pending payment reviews, and refund approval workflows (implementation mirrors other admin pages and is exposed through routing and navigation).

### 5.8 Chapter Settings & Branding
- Update tenant name, upload logos with storage management, choose brand colors, set currency/language preferences, configure default visitor fees, and toggle payment requirements.
- Generate and download branded chapter QR codes, as well as copy public chapter profile links for sharing.

### 5.9 Public Chapter Profile
- Expose a shareable chapter page (implementation implied via routing), accessible without login to present chapter information to prospects and visitors.

### 5.10 Integrations & Infrastructure
- Supabase provides authentication, database access, storage, real-time tenant updates, and serverless edge functions for meeting operations, check-ins, and payment processing.
- Google Maps Places API powers venue autocomplete and place details for meeting locations, storing structured venue data with coordinates.
- React Query manages client-side data fetching/caching, while Sonner/Toaster deliver user notifications.

## 6. Data Entities & Sources
- **Tenants & Tenant Settings:** contain branding, payment configurations, and slug metadata per chapter.
- **User Roles:** map users to roles and tenants, enabling permission-aware dashboards.
- **Participants:** store member/visitor contact info, statuses, and notes.
- **Meetings:** include schedule details, location metadata, visitor fees, recurrence attributes, and relationships to check-ins.
- **Check-ins:** link participants and meetings with timestamps for attendance tracking.
- **Payments:** capture amounts, statuses, slips, and review states for compliance flows.

## 7. Non-Functional Requirements
- Ensure responsive layouts across devices (admin dashboards and public pages employ mobile-aware UI components).
- Provide Thai-language UI copy with localized formatting for dates and messages, targeting the local user base.
- Maintain secure handling of personal and payment data using Supabase RLS policies (enforced on the backend) and client-side validation for required fields.

## 8. Out of Scope / Future Considerations
- Automated LINE notifications, full CRM integrations, and advanced reporting beyond the provided analytics dashboards.
- Deep customization of public chapter microsites beyond branding, QR code sharing, and payment/check-in flows.
- Gamification or referral tracking features not represented in the current codebase.

## 9. Success Metrics & Analytics Instrumentation
- Track daily active admins, meetings scheduled, visitor conversions, and payment review turnaround times via analytics dashboards.
- Monitor edge function outcomes (check-in success/failure, payment processing errors) to surface operational issues quickly.

## 10. Risks & Dependencies
- Dependence on Supabase availability for authentication, database, storage, and edge functions; downtime directly impacts all workflows.
- Reliance on Google Maps Places API for location accuracy; API quota exhaustion could disrupt meeting venue management.
- Mobile network conditions affect visitor payment slip uploads and QR code check-ins; consider offline mitigation or caching for critical paths.

## 11. Launch Checklist
- Configure Supabase environment variables (URL, publishable key) and Google Maps API key for deployment environments.
- Seed baseline tenant, role, and settings data to enable first-login experiences.
- Validate access control rules through role-based QA and ensure public flows function without authentication.
- Prepare documentation/training for chapter admins on recurring meetings, check-ins, and payment review processes.
