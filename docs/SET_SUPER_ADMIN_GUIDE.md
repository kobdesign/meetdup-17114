# Quick Guide: Set Super Admin

## Overview
This guide shows how to set a user as Super Admin with global access to all chapters.

---

## Prerequisites

- User account already exists in Supabase Auth
- Have access to Supabase Dashboard
- Know the user's email address

---

## Step-by-Step Instructions

### Step 1: Run Schema Migration

**Purpose**: Make `tenant_id` nullable to support Super Admin

1. Open **Supabase Dashboard**: https://supabase.com/dashboard
2. Select project: **sbknunooplaezvwtyooi**
3. Click **SQL Editor** (left sidebar)
4. Open file: `supabase/migrations/20251114_make_tenant_id_nullable.sql`
5. **Copy entire content** (Ctrl+A, Ctrl+C)
6. **Paste** into SQL Editor
7. Click **Run** (or Ctrl+Enter)
8. Wait for success message

**What this migration does**:
```sql
-- Makes tenant_id nullable
ALTER TABLE user_roles ALTER COLUMN tenant_id DROP NOT NULL;

-- Adds unique constraints
-- - super_admin: one per user (tenant_id = NULL)
-- - chapter roles: one per user per tenant

-- Adds check constraint
-- - super_admin MUST have tenant_id = NULL
-- - chapter_admin/member MUST have tenant_id
```

### Step 2: Set User as Super Admin

**Run the script**:
```bash
npm run set-super-admin
```

**For different email** (optional):
```bash
npm run set-super-admin your@email.com
```

**Expected Output**:
```
🔧 Setting kobdesign@gmail.com as Super Admin

1️⃣  Looking up user in auth.users...
   ✅ Found user: kobdesign@gmail.com
   User ID: 64ef290f-b761-4a4b-820f-be2a12462f15

2️⃣  Checking existing roles...
   Current roles: 1
     - Role: chapter_admin, Tenant: 285248fd...

3️⃣  Ensuring profile exists...
   ✅ Profile exists: Abhisak Chonchanakul

4️⃣  Adding super_admin role...
   ✅ Super admin role added!

5️⃣  Verifying final state...
   Total roles: 2
     - SUPER ADMIN 🌟
     - chapter_admin (Tenant: 285248fd...)

================================================================================
✅ SUCCESS! User is now a Super Admin
================================================================================

User: kobdesign@gmail.com
ID: 64ef290f-b761-4a4b-820f-be2a12462f15
Role: super_admin (tenant_id = NULL)

Super Admin can:
  ✅ Access all chapters
  ✅ Manage all users
  ✅ Create/delete chapters
  ✅ Override all permissions
```

### Step 3: Verify in Database

**Check via script**:
```bash
npm run check-data
```

Look for:
```
USER ROLES (user_roles table)
   Total: 2
   1. User: 64ef290f...
      Role: super_admin
      Tenant: NULL (SUPER ADMIN)
   2. User: 64ef290f...
      Role: chapter_admin
      Tenant: 285248fd... (BNI The World)
```

**Check in Supabase Dashboard**:
1. Go to **Database** → **Table Editor**
2. Select `user_roles` table
3. Look for row where:
   - `user_id` = your user ID
   - `role` = `super_admin`
   - `tenant_id` = `NULL`

---

## What is Super Admin?

### Super Admin vs Chapter Admin

| Feature | Super Admin | Chapter Admin |
|---------|-------------|---------------|
| **Scope** | All chapters | Single chapter |
| **tenant_id** | NULL | Specific chapter ID |
| **Access** | Global | Chapter-specific |
| **Create chapters** | ✅ Yes | ❌ No |
| **Delete chapters** | ✅ Yes | ❌ No |
| **Manage own chapter** | ✅ Yes | ✅ Yes |
| **Manage other chapters** | ✅ Yes | ❌ No |
| **View all users** | ✅ Yes | ❌ Chapter only |
| **Generate invites** | ✅ Any chapter | ✅ Own chapter |
| **Approve join requests** | ✅ Any chapter | ✅ Own chapter |

### Database Schema

**user_roles table**:
```sql
CREATE TABLE user_roles (
  id serial PRIMARY KEY,
  user_id uuid NOT NULL,
  tenant_id uuid,  -- NULL for super_admin
  role app_role NOT NULL,  -- 'super_admin', 'chapter_admin', 'member'
  created_at timestamptz DEFAULT now()
);

-- Constraints
CHECK (
  (role = 'super_admin' AND tenant_id IS NULL) OR
  (role != 'super_admin' AND tenant_id IS NOT NULL)
)
```

**Example data**:
```
id | user_id      | tenant_id    | role           
---+--------------+--------------+---------------
1  | 64ef290f...  | NULL         | super_admin   -- Global access
2  | 64ef290f...  | 285248fd...  | chapter_admin -- Chapter access
3  | 65c7cf9b...  | 285248fd...  | member        -- Chapter member
```

---

## Troubleshooting

### Error: "null value in column tenant_id violates not-null constraint"

**Cause**: Migration not run yet (tenant_id still NOT NULL)

**Solution**: Run Step 1 migration first

### Error: "User with email X not found"

**Cause**: User doesn't exist in Supabase Auth

**Solution**: 
1. User must sign up first via app
2. Or create user in Supabase Dashboard → Authentication → Users

### Error: "Role insert error: duplicate key"

**Cause**: User already has super_admin role

**Solution**: This is expected! User is already super admin, no action needed

### User already has super_admin role

**Output**:
```
2️⃣  Checking existing roles...
   Current roles: 1
     - Role: super_admin, Tenant: NULL (super_admin)

   ℹ️  User is already a Super Admin!
   No changes needed.
```

**Solution**: No action needed, user is already super admin

---

## Removing Super Admin Role

**To remove super_admin role**:

**Option 1: Via SQL**:
```sql
DELETE FROM user_roles 
WHERE user_id = 'your-user-id' 
  AND role = 'super_admin' 
  AND tenant_id IS NULL;
```

**Option 2: Keep chapter_admin, remove super_admin**:
```sql
-- User will still be chapter admin but lose global access
DELETE FROM user_roles 
WHERE user_id = 'your-user-id' 
  AND role = 'super_admin';
```

---

## Security Considerations

1. **Limited super admins**: Only assign to trusted users
2. **Audit regularly**: Review super_admin roles periodically
3. **Use chapter admins**: For most administrative tasks, chapter admin is sufficient
4. **Monitor actions**: Log super admin activities (future enhancement)

---

## Multiple Super Admins

**Can you have multiple super admins?**
✅ Yes! You can set multiple users as super admins.

**To add another super admin**:
```bash
npm run set-super-admin second@email.com
```

**To list all super admins**:
```sql
SELECT u.email, r.user_id, r.created_at
FROM user_roles r
JOIN auth.users u ON u.id = r.user_id
WHERE r.role = 'super_admin' 
  AND r.tenant_id IS NULL
ORDER BY r.created_at;
```

---

## Future Enhancements

- [ ] Web UI to manage super admins
- [ ] Audit log for super admin actions
- [ ] Role-based access control (RBAC) for super admin features
- [ ] Super admin dashboard
- [ ] Bulk operations for super admins

---

## Related Documentation

- [User Journey Onboarding](./USER_JOURNEY_ONBOARDING.md) - Onboarding flows
- [Migration Guide](./MIGRATION_GUIDE.md) - How to run migrations
- [Security Best Practices](./SECURITY_BEST_PRACTICES.md) - Security guidelines

---

**Last Updated**: November 14, 2025
