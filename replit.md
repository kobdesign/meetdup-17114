# Meetdup - Chapter Management System

## Overview
Meetdup is a multi-tenant SaaS application designed to streamline business networking chapter operations. Its core purpose is to provide a robust platform for member management, meeting scheduling and attendance tracking, visitor check-ins, and various administrative tasks. The system aims to enhance efficiency and organization for business chapters, offering a tailored experience through multi-tenancy and role-based access control. Key capabilities include self-service activation link requests, automated LINE LIFF activation, and bulk member import, along with comprehensive LINE integration and an AI Chapter Data Assistant.

## User Preferences
- **Supabase Production Query**: Agent สามารถ query Supabase Production ได้โดยใช้ environment variables:
  ```bash
  curl -s "$SUPABASE_URL/rest/v1/<table_name>?<query_params>" \
    -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
  ```
  ใช้สำหรับตรวจสอบข้อมูลจริงใน Production เมื่อ dev database ไม่มีข้อมูลที่ต้องการ

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
- **Role-Based Access Control (RBAC)**: Supports Super Admin, Chapter Admin, and Member roles with progressive disclosure navigation and route-level guards.
- **UI/UX**: Employs Radix UI, Shadcn/ui, and Tailwind CSS for a modern, responsive interface. The landing page uses a Professional Trust theme with Navy Blue + Soft Gold color scheme and an 8-section layout.
- **LINE Integration**: Comprehensive multi-tenant LINE webhook system with destination-based tenant resolution, HMAC signature validation, secure credential management, rich menu management, and message-based interaction flows. Includes a LIFF-based member search system and a LIFF Business Card Share System.
- **Check-In System**: QR code-based check-ins integrated with LINE webhooks, primarily using phone number for identification, and a secure POS Check-In System with JWT tokens.
- **Meeting Command Center**: A unified dashboard for meeting day operations with meeting selection, stats cards, and two operation modes (Manual and QR Scanner) for efficient participant management.
- **Member/Visitor Management**: Separated pipelines for active member management and visitor analytics, with a multi-path onboarding system (Pioneer, Invite, Discovery) and a unified member-participant architecture.
- **Data Management**: Bulk member import from Excel, auto-linking of user accounts to participant records, secure token-based activation flow for self-registration, and comprehensive participant deletion with related record cleanup.
- **Schema Enhancements**: Simplified name fields (`full_name_th`, `full_name_en`, `nickname_th`, `nickname_en`), dual-field referral model, added `linkedin_url`, required phone numbers, and distinct `line_id` and `line_user_id`.
- **Business Category System**: Dynamic 2-digit codes, searchable selector, member-created categories, and bot-driven category search.
- **Goals & Achievements System**: Chapters can set and track goals (visitors, members, check-ins, referrals) with auto-calculated progress and LINE notifications. Daily progress summaries are available.
- **LINE Command Authorization System**: Flexible access control for LINE bot commands (public, member, admin levels) with an admin UI for management.
- **LIFF Profile Components**: Reusable `MemberProfileCard` and `MemberListCard` for displaying member profiles across LIFF pages.
- **Event RSVP System**: Meeting notifications with RSVP buttons (Confirm, Substitute, Leave) and an admin view displaying RSVP responses with participant details and leave reasons.
- **Payment Tracking System**: Comprehensive tracking for member monthly dues and visitor meeting fees, including a Finance Dashboard for KPIs, dues configuration, member dues list, and bulk actions.
- **Chapter Apps Marketplace**: An extension system for mini-applications accessible via a Profile > Apps Tab for members and manageable via an Admin App Center. Includes implemented apps like BOQ Estimator.
- **AI Chapter Data Assistant (LINE Bot)**: An AI Chatbot integrated with OpenAI for Admin/Member queries via LINE, supporting intents like visitor summaries, unpaid visitor fees, and meeting statistics with RBAC logic.

### AI Chapter Data Assistant Details
**Core Files:** `server/services/chapterAI.ts`, `server/routes/line/webhook.ts`

**Supported Intents & Tools:**
1. `visitor_summary` - via `get_visitor_summary`
2. `unpaid_visitor_fee_today` - via `get_unpaid_visitor_fee` (RBAC protected)
3. `visitor_fee_total_month` - via `get_visitor_fee_total`
4. `meeting_stats` - via `get_meeting_stats`

**Additional Tools:** `get_meeting_context`, `get_user_role`

**RBAC:** Admin sees full details, Member sees counts only

## External Dependencies

- **Supabase**: Used for PostgreSQL database, authentication (Supabase Auth), and storage (Supabase Storage).
- **LINE Messaging API**: Integrated for communication, rich menus, quick replies, webhooks, and LIFF.
- **Google Maps API**: Utilized for location-based features.