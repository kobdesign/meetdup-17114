# Testing Guide: Multi-Path Onboarding Flows

## Prerequisites

Before testing, ensure:
- ✅ Migration `20251114_fix_permissions_final.sql` has been run
- ✅ App is running (`npm run dev`)
- ✅ Verification scripts pass:
  ```bash
  npm run verify-migration  # Should show ✅ All tables exist
  npm run check-data       # Should display current data
  ```

---

## Test Environment Setup

### Test Accounts Needed

You'll need **3 test accounts** to properly test all flows:

1. **Admin Account** (existing):
   - Email: `kobdesign@gmail.com` or your admin email
   - Role: `chapter_admin` or `super_admin`
   - Used for: Creating invites, approving requests

2. **New User 1** (create during testing):
   - Email: `testuser1@example.com`
   - Used for: Pioneer flow (create chapter) OR Invite flow

3. **New User 2** (create during testing):
   - Email: `testuser2@example.com`
   - Used for: Discovery flow (find and request to join)

### Browser Setup

- **Primary browser**: Your main browser (logged in as admin)
- **Incognito/Private window**: For testing new user flows
- **Second browser** (optional): For parallel testing

---

## Flow 1: Pioneer (Create Chapter)

### Objective
Test that a new user can create their own chapter and become admin.

### Steps

1. **Open incognito window**
2. Navigate to: `http://localhost:5000/`
3. Click **Sign Up** (top right)
4. Create account:
   ```
   Email: testuser1@example.com
   Password: Test123456!
   ```
5. After signup, should auto-redirect to `/welcome` page

6. **EXPECTED**: See 3 onboarding options:
   - 🏗️ Create New Chapter
   - 📬 Join with Invite Link
   - 🔍 Find Existing Chapter

7. Click **"Create New Chapter"**

8. Fill form:
   ```
   Chapter Name: BNI Bangkok Test
   Subdomain: bangkok-test
   ```

9. Click **"Create Chapter"**

10. **VERIFY**:
    - ✅ Redirects to `/admin` page
    - ✅ See dashboard with "Welcome to BNI Bangkok Test"
    - ✅ Sidebar shows admin features

11. **Check database**:
    ```bash
    npm run check-data
    ```
    Should show:
    - New chapter: "BNI Bangkok Test"
    - New user role: `chapter_admin` for testuser1

### Expected Results

- ✅ New chapter created successfully
- ✅ User automatically assigned as `chapter_admin`
- ✅ User can access admin features (Members, Meetings, etc.)
- ✅ Other users cannot see this chapter until they're invited

### Edge Cases to Test

**Duplicate Subdomain**:
1. Try creating another chapter with subdomain `bangkok-test`
2. **EXPECTED**: Error message "Subdomain already exists"

**Invalid Subdomain**:
1. Try subdomain with spaces: `my chapter`
2. **EXPECTED**: Validation error
3. Try subdomain with special chars: `my@chapter`
4. **EXPECTED**: Validation error

---

## Flow 2: Invite (Accept Invite Link)

### Objective
Test that a user can join a chapter via invite link.

### Steps

#### Part A: Generate Invite (As Admin)

1. **In your main browser** (logged in as admin)
2. Navigate to `/admin/members`
3. Click **"Generate Invite Link"** button
4. Configure invite:
   ```
   Max Uses: 10
   Expires: 30 days from now
   ```
5. Click **"Generate"**
6. **VERIFY**:
   - ✅ Invite link appears
   - ✅ Can copy link
   - Format: `http://localhost:5000/invite/{token}`

7. **Copy the invite link**

#### Part B: Verify Admin-Only Access

1. **Still as admin**, refresh Members page
2. **VERIFY**:
   - ✅ Can see "Active Invites" section
   - ✅ Shows the invite you just created
   - ✅ Shows: token, uses (0/10), expiry date

3. **Open incognito** with a **regular member** account (if you have one)
4. Navigate to `/admin/members`
5. **VERIFY**:
   - ❌ **Cannot** see "Active Invites" section
   - ❌ **Cannot** see "Generate Invite" button
   - ℹ️ This proves admin-only access is working!

#### Part C: Accept Invite (As New User)

1. **Open NEW incognito window**
2. Paste the invite link you copied
3. **EXPECTED**: Redirect to `/auth?redirect=/invite/{token}`
4. Click **"Sign Up"**
5. Create account:
   ```
   Email: testuser2@example.com
   Password: Test123456!
   ```
6. **EXPECTED**: After signup, auto-redirect back to `/invite/{token}`
7. **VERIFY**: See invite details page showing:
   - Chapter name: "BNI The World" (or your chapter)
   - "Accept Invite" button

8. Click **"Accept Invite"**

9. **VERIFY**:
   - ✅ Redirects to `/admin`
   - ✅ See chapter dashboard
   - ✅ Can access features (but not admin-only features)

10. **Check database**:
    ```bash
    npm run check-data
    ```
    Should show:
    - New user role: `member` for testuser2
    - Invite uses: 1/10 (incremented)

#### Part D: Verify Member Restrictions

1. **Still as new member** (testuser2)
2. Navigate to `/admin/members`
3. **VERIFY**:
   - ❌ **Cannot** see "Active Invites" section
   - ❌ **Cannot** see "Generate Invite" button
   - ✅ Can see member list
   - ❌ **Cannot** see others' join requests (if any)

### Expected Results

- ✅ Admin can generate invite links
- ✅ Invite link works for new users
- ✅ User automatically becomes `member` after accepting
- ✅ Invite uses count incremented
- ✅ Regular members **cannot** see invite tokens
- ✅ Members **cannot** generate invites

### Edge Cases to Test

**Expired Token**:
1. As admin, create invite with expiry = "today"
2. Wait 1 minute, then try to accept
3. **EXPECTED**: Error "Invite has expired"

**Max Uses Reached**:
1. Create invite with max_uses = 1
2. Accept it once
3. Try to accept again with different account
4. **EXPECTED**: Error "Invite has reached maximum uses"

**Already a Member**:
1. Try to accept invite with account that's already a member
2. **EXPECTED**: Error "You are already a member"

---

## Flow 3: Discovery (Search & Join)

### Objective
Test that a user can discover chapters and request membership.

### Steps

#### Part A: Search for Chapters

1. **Open incognito window**
2. Navigate to `http://localhost:5000/`
3. Sign up with new account:
   ```
   Email: testuser3@example.com
   Password: Test123456!
   ```
4. **EXPECTED**: Redirect to `/welcome` page

5. Click **"Find Existing Chapter"**

6. **VERIFY**: Redirects to `/discover-chapters`

7. **Test search**:
   - Leave search empty, click search
   - **EXPECTED**: Shows all available chapters (exclude chapters you're already member of)
   
   - Search "BNI"
   - **EXPECTED**: Shows chapters matching "BNI"
   
   - Search "test"
   - **EXPECTED**: Shows chapters matching "test"

#### Part B: Request to Join

1. Find a chapter (e.g., "BNI The World")
2. Click **"Request to Join"** button
3. **EXPECTED**: Modal/form appears
4. (Optional) Add message:
   ```
   Hi, I'd like to join your chapter!
   ```
5. Click **"Send Request"**

6. **VERIFY**:
   - ✅ Success message appears
   - ✅ Button changes to "Request Pending"
   - ✅ Button is now disabled

7. **Check "My Requests"** section (if visible)
8. **VERIFY**:
   - ✅ Can see own request
   - ✅ Shows status: "Pending"

#### Part C: Verify User Cannot See Others' Requests

1. **Still as testuser3** (regular user)
2. Try to navigate to `/admin/members`
3. **VERIFY**:
   - ❌ **Cannot** see "Join Requests" section
   - ❌ **Cannot** see approve/reject buttons
   - ✅ Can only see own requests (if shown separately)

#### Part D: Admin Approves Request

1. **Switch to admin account** (in main browser)
2. Navigate to `/admin/members`
3. **VERIFY**: "Join Requests" section shows:
   - ✅ Request from testuser3
   - ✅ Message: "Hi, I'd like to join your chapter!"
   - ✅ Request date/time
   - ✅ "Approve" and "Reject" buttons

4. Click **"Approve"**

5. **VERIFY**:
   - ✅ Request disappears from pending list
   - ✅ User appears in members list
   - ✅ User role shows as `member`

6. **Check database**:
   ```bash
   npm run check-data
   ```
   Should show:
   - New user role: `member` for testuser3
   - Join request status: `approved`

#### Part E: Verify New Member Access

1. **Switch back to testuser3 account**
2. Refresh page or navigate to `/admin`
3. **VERIFY**:
   - ✅ Can now access chapter dashboard
   - ✅ See chapter content
   - ✅ Cannot access admin features
   - ❌ **Cannot** see invite tokens
   - ❌ **Cannot** see others' join requests

### Expected Results

- ✅ Users can search for chapters
- ✅ Users can request to join
- ✅ Users can see their own requests
- ✅ Users **cannot** see others' requests
- ✅ Only admins can approve/reject requests
- ✅ After approval, user becomes `member`

### Edge Cases to Test

**Duplicate Request**:
1. Try to request to join the same chapter twice
2. **EXPECTED**: Error "You already have a pending request"

**Already a Member**:
1. Try to request to join a chapter you're already a member of
2. **EXPECTED**: Chapter doesn't appear in search results

**Withdraw Request**:
1. Create a join request
2. Click "Cancel Request" (if available)
3. **EXPECTED**: Request is deleted
4. **EXPECTED**: Can create a new request

---

## Security Testing

### Test 1: Member Cannot See Invite Tokens

**Setup**: Log in as regular member

**Test**:
```typescript
// Try to query invite tokens directly via Supabase client
const { data, error } = await supabase
  .from('chapter_invites')
  .select('*');
```

**EXPECTED**:
- `data` = `[]` (empty array)
- `error` = `null` (no error, just no results due to RLS)

### Test 2: Member Cannot See Others' Join Requests

**Setup**: Log in as regular member

**Test**:
```typescript
const { data } = await supabase
  .from('chapter_join_requests')
  .select('*');
```

**EXPECTED**:
- Only returns requests where `user_id` = current user ID
- Does NOT return requests from other users

### Test 3: Non-Admin Cannot Create Invites

**Setup**: Log in as regular member

**Test**:
```typescript
const { data, error } = await supabase
  .from('chapter_invites')
  .insert({
    tenant_id: 'some-tenant-id',
    token: 'fake-token',
    created_by: currentUserId,
  });
```

**EXPECTED**:
- `error` !== `null`
- Error message about RLS policy violation

### Test 4: Non-Admin Cannot Approve Requests

**Setup**: Log in as regular member

**Test**:
```typescript
const { error } = await supabase
  .from('chapter_join_requests')
  .update({ status: 'approved' })
  .eq('request_id', 'some-request-id');
```

**EXPECTED**:
- `error` !== `null`
- Error about RLS policy

---

## Troubleshooting

### Problem: Cannot access /admin after signup

**Cause**: User not assigned to any chapter

**Solution**: Complete one of the onboarding flows (create chapter, accept invite, or request to join)

### Problem: "Permission denied" errors

**Cause**: RLS policies blocking access

**Debug**:
1. Check user role: `npm run check-data`
2. Verify migration ran: `npm run verify-migration`
3. Check Supabase dashboard → Database → Policies

### Problem: Invite link doesn't work

**Cause**: Token not found or expired

**Debug**:
```bash
npm run check-data
# Look at CHAPTER INVITES section
# Check: expires_at, uses_count, max_uses
```

### Problem: Join requests not showing for admin

**Cause**: May not have any pending requests

**Solution**: Create a test request with another account

---

## Performance Testing

### Test 1: Chapter Discovery Performance

1. Create 50+ chapters (use script or manually)
2. Search for chapters
3. **VERIFY**: Results load within 2 seconds

### Test 2: Large Invite List

1. Generate 20+ invite tokens
2. View Members page as admin
3. **VERIFY**: Page loads within 3 seconds

---

## Automated Testing (Future)

### Example Test Cases

```typescript
describe('Onboarding Flows', () => {
  describe('Pioneer Flow', () => {
    it('should create chapter and assign admin role', async () => {
      // Test implementation
    });
    
    it('should prevent duplicate subdomain', async () => {
      // Test implementation
    });
  });

  describe('Invite Flow', () => {
    it('should accept valid invite', async () => {
      // Test implementation
    });
    
    it('should reject expired invite', async () => {
      // Test implementation
    });
    
    it('should hide invites from non-admins', async () => {
      // Test implementation
    });
  });

  describe('Discovery Flow', () => {
    it('should find chapters by search', async () => {
      // Test implementation
    });
    
    it('should create join request', async () => {
      // Test implementation
    });
    
    it('should hide others\' requests from non-admins', async () => {
      // Test implementation
    });
  });
});
```

---

## Checklist

Before considering testing complete:

### Functional Testing
- [ ] Pioneer flow: Create chapter works
- [ ] Pioneer flow: Subdomain validation works
- [ ] Invite flow: Admin can generate invite
- [ ] Invite flow: New user can accept invite
- [ ] Invite flow: Invite uses incremented
- [ ] Discovery flow: Search works
- [ ] Discovery flow: Join request created
- [ ] Discovery flow: Admin can approve request

### Security Testing
- [ ] Members **cannot** see invite tokens
- [ ] Members **cannot** generate invites
- [ ] Members **cannot** see others' join requests
- [ ] Members **cannot** approve requests
- [ ] Non-members **cannot** access invite metadata
- [ ] RLS policies enforced correctly

### Edge Cases
- [ ] Expired invite rejected
- [ ] Max uses enforced
- [ ] Duplicate subdomain prevented
- [ ] Duplicate request prevented
- [ ] Already-member prevented from requesting again

### User Experience
- [ ] Error messages clear and helpful
- [ ] Success messages displayed
- [ ] Loading states shown
- [ ] Redirect flows work correctly
- [ ] Mobile responsive (if applicable)

---

**Happy Testing!** 🎉

If you find any bugs or issues, please document them with:
- Steps to reproduce
- Expected vs actual behavior
- Screenshots (if UI issue)
- Browser console errors (if any)
