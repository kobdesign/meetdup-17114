# User Journey: Multi-Path Onboarding System

## Overview
Meetdup provides **3 onboarding paths** for new users to join chapters:

1. **Pioneer Flow** 🏗️ - Create a new chapter and become admin
2. **Invite Flow** 📬 - Accept an invite link from a chapter admin
3. **Discovery Flow** 🔍 - Search for chapters and request membership

---

## Flow 1: Pioneer (Create New Chapter)

### User Journey
```
User without chapter
  ↓
Navigate to /welcome
  ↓
Click "Create New Chapter"
  ↓
Fill form:
  - Chapter Name (e.g., "BNI Bangkok Central")
  - Subdomain (e.g., "bangkok-central")
  ↓
Submit form
  ↓
Backend:
  1. Validate subdomain is unique
  2. Create tenant record in Supabase
  3. Create user profile (if not exists)
  4. Assign user as chapter_admin
  ↓
Auto-redirect to /admin
  ↓
✅ User is now Chapter Admin
```

### Technical Details
- **API Endpoint**: `POST /api/chapters/create`
- **Authentication**: Required (Supabase Auth)
- **Database Operations**:
  ```sql
  INSERT INTO tenants (tenant_name, subdomain) VALUES (...)
  INSERT INTO profiles (id) VALUES (...) -- if not exists
  INSERT INTO user_roles (user_id, tenant_id, role) VALUES (..., 'chapter_admin')
  ```
- **Validation**:
  - Subdomain must be unique
  - Must contain only lowercase letters, numbers, and hyphens
  - Minimum 3 characters

---

## Flow 2: Invite (Accept Invite Link)

### User Journey
```
Chapter Admin creates invite
  ↓
Admin gets invite link: /invite/{token}
  ↓
Admin shares link (email, LINE, etc.)
  ↓
New user clicks link
  ↓
If not logged in:
  → Redirect to /auth?redirect=/invite/{token}
  → User signs up/logs in
  → Auto-redirect back to /invite/{token}
  ↓
Show invite details:
  - Chapter name
  - "Accept Invite" button
  ↓
User clicks "Accept Invite"
  ↓
Backend:
  1. Validate token (exists, not expired, not maxed out)
  2. Check user isn't already a member
  3. Create user profile (if not exists)
  4. Assign user as member
  5. Increment invite uses_count
  ↓
Auto-redirect to /admin
  ↓
✅ User is now Chapter Member
```

### Technical Details
- **API Endpoint**: `POST /api/chapters/invite/accept/:token`
- **Authentication**: Required (Supabase Auth)
- **Database Operations**:
  ```sql
  SELECT * FROM chapter_invites WHERE token = :token
  -- Validate: expires_at > NOW() AND uses_count < max_uses
  
  INSERT INTO profiles (id) VALUES (...) -- if not exists
  INSERT INTO user_roles (user_id, tenant_id, role) VALUES (..., 'member')
  UPDATE chapter_invites SET uses_count = uses_count + 1 WHERE invite_id = ...
  ```
- **Validation**:
  - Token must exist
  - Token must not be expired
  - Uses must be < max_uses
  - User must not already be a member of this chapter

### Creating Invites (Admin Only)
```
Chapter Admin → Members Management → Generate Invite Link
  ↓
Admin configures:
  - Max uses (1-100)
  - Expiration date (optional)
  ↓
Backend generates:
  - Random token (12+ characters)
  - Stores in chapter_invites table
  ↓
Admin receives link: /invite/{token}
  ↓
Admin shares link with new members
```

**API Endpoint**: `POST /api/chapters/invite/generate`

---

## Flow 3: Discovery (Search & Request)

### User Journey
```
User without chapter
  ↓
Navigate to /welcome
  ↓
Click "Find Existing Chapter"
  ↓
/discover-chapters page
  ↓
Search chapters by name or subdomain
  (Optional: filter/sort)
  ↓
Browse available chapters
  ↓
Click "Request to Join" on desired chapter
  ↓
(Optional) Add message to admin
  ↓
Backend:
  1. Create join request record
  2. Set status = 'pending'
  ↓
User sees: "Request sent! Waiting for admin approval"
  ↓
Admin reviews request in Members Management
  ↓
Admin clicks "Approve"
  ↓
Backend:
  1. Update request status = 'approved'
  2. Create user_roles record (role = 'member')
  3. Set approved_by and approved_at
  ↓
✅ User becomes Chapter Member
```

### Technical Details
- **Search API**: `GET /api/chapters/discover?search={query}`
- **Request API**: `POST /api/chapters/join-request`
- **Approve API**: `PATCH /api/chapters/join-requests/:id`

**Database Operations**:
```sql
-- Discover
SELECT * FROM tenants
WHERE tenant_name ILIKE '%{search}%' OR subdomain ILIKE '%{search}%'
  AND tenant_id NOT IN (SELECT tenant_id FROM user_roles WHERE user_id = current_user)

-- Request
INSERT INTO chapter_join_requests (tenant_id, user_id, message, status)
VALUES (..., 'pending')

-- Approve
BEGIN;
  UPDATE chapter_join_requests 
  SET status = 'approved', approved_by = :admin_id, approved_at = NOW()
  WHERE request_id = :id;
  
  INSERT INTO user_roles (user_id, tenant_id, role)
  VALUES (:user_id, :tenant_id, 'member');
COMMIT;
```

**Admin View**: `/admin/members` shows pending join requests with:
- User name
- Request message
- Request date
- Approve / Reject buttons

---

## Database Schema

### Tables Involved

**tenants** (Chapters)
```sql
tenant_id         uuid PRIMARY KEY
tenant_name       text NOT NULL
subdomain         text NOT NULL UNIQUE
line_bot_basic_id text
logo_url          text
created_at        timestamptz
updated_at        timestamptz
```

**user_roles** (Membership)
```sql
id         serial PRIMARY KEY
user_id    uuid NOT NULL
tenant_id  uuid (NULL for super_admin)
role       app_role NOT NULL -- 'super_admin', 'chapter_admin', 'member'
created_at timestamptz

UNIQUE INDEX (user_id, tenant_id) WHERE tenant_id IS NOT NULL
UNIQUE INDEX (user_id) WHERE tenant_id IS NULL
```

**chapter_invites** (Invite Tokens)
```sql
invite_id    uuid PRIMARY KEY
tenant_id    uuid NOT NULL REFERENCES tenants
token        text NOT NULL UNIQUE
created_by   uuid NOT NULL
max_uses     integer DEFAULT 1
uses_count   integer DEFAULT 0
expires_at   timestamptz
created_at   timestamptz
```

**chapter_join_requests** (Membership Requests)
```sql
request_id   uuid PRIMARY KEY
tenant_id    uuid NOT NULL REFERENCES tenants
user_id      uuid NOT NULL
status       text DEFAULT 'pending' -- 'pending', 'approved', 'rejected'
message      text
approved_by  uuid
approved_at  timestamptz
created_at   timestamptz
```

---

## Row Level Security (RLS) Policies

### chapter_invites
- **SELECT**: 
  - Tenant members can view their chapter's invites
  - Anyone can view invite by token (for accept page)
- **INSERT**: Only admins can create invites
- **UPDATE**: Service role can update uses_count

### chapter_join_requests
- **SELECT**: 
  - Tenant members can view requests for their chapter
  - Users can view their own requests
- **INSERT**: Authenticated users can create requests
- **UPDATE**: Only admins can approve/reject
- **DELETE**: Users can delete their own pending requests

---

## Security Considerations

1. **Token Security**:
   - Invite tokens are random 12+ character strings
   - Tokens expire after set date
   - Max uses prevent token abuse
   - One-time tokens recommended for sensitive chapters

2. **Permission Checks**:
   - All admin actions verify user has chapter_admin or super_admin role
   - RLS policies prevent unauthorized data access
   - Service role used only for trusted backend operations

3. **Input Validation**:
   - Subdomain sanitized to prevent XSS
   - User inputs validated before database operations
   - Duplicate request prevention

---

## Testing Guide

### Test Flow 1: Pioneer
1. Create new account (not assigned to any chapter)
2. Navigate to `/welcome`
3. Click "Create New Chapter"
4. Fill form and submit
5. Verify redirect to `/admin`
6. Check database: user has `chapter_admin` role

### Test Flow 2: Invite
1. As admin, go to Members Management
2. Click "Generate Invite Link"
3. Copy invite URL
4. Open in incognito/new browser
5. Sign up with new email
6. Accept invite
7. Verify redirect to `/admin`
8. Check database: user has `member` role

### Test Flow 3: Discovery
1. Create account (not assigned to chapter)
2. Navigate to `/discover-chapters`
3. Search for chapter
4. Click "Request to Join"
5. As admin, go to Members Management
6. See pending request
7. Click "Approve"
8. Verify user now has access

---

## Troubleshooting

### "No Chapter Found" Error
**Causes**:
- No chapters exist in Supabase
- RLS policies blocking query
- User already member of all chapters

**Solution**:
```bash
# Check if chapters exist
npm run check-data

# Verify migration ran
npm run verify-migration
```

### Invite Acceptance Fails
**Causes**:
- Token expired
- Max uses reached
- User already a member

**Debug**:
```sql
SELECT * FROM chapter_invites WHERE token = 'your-token';
-- Check: expires_at, uses_count, max_uses
```

### Join Request Not Showing
**Causes**:
- User already member
- RLS policy issue
- Request already approved/rejected

**Debug**:
```bash
npm run check-data
# Look at JOIN REQUESTS section
```

---

## NPM Scripts

```bash
# Verify migration status
npm run verify-migration

# Check all Supabase data
npm run check-data

# Start dev server
npm run dev
```

---

## Future Enhancements

- [ ] Email notifications for invite/approval
- [ ] LINE notification integration
- [ ] Bulk invite generation
- [ ] Custom invite messages
- [ ] Chapter discovery filters (location, industry)
- [ ] Auto-approval rules
- [ ] Invite analytics
