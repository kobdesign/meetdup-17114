# Migration Guide: Run Security Hardening Migration

## Overview
This guide explains how to run the final security migration (`20251114_fix_permissions_final.sql`) to your Supabase database.

---

## ⚠️ Important Notes

1. **This migration is CRITICAL for security**:
   - Restricts invite token access to admins only
   - Prevents regular members from seeing others' join requests
   - Protects against token enumeration attacks

2. **Safe to run multiple times**:
   - Uses `DROP POLICY IF EXISTS`
   - Uses `REVOKE ALL` (idempotent)
   - Won't break existing data

3. **Backup recommended** (optional):
   - This migration only affects permissions/policies
   - Does not modify table structure or data
   - But you can backup just to be safe

---

## Method 1: Supabase Dashboard (Recommended)

### Step 1: Open SQL Editor
1. Go to your Supabase dashboard: https://supabase.com/dashboard
2. Select project: **sbknunooplaezvwtyooi**
3. Click **SQL Editor** in left sidebar

### Step 2: Copy Migration SQL
1. Open file: `supabase/migrations/20251114_fix_permissions_final.sql`
2. Copy **entire contents** (Ctrl+A, Ctrl+C)

### Step 3: Run Migration
1. Paste SQL into SQL Editor
2. Click **Run** button (or press Ctrl+Enter)
3. Wait for completion (should take 2-5 seconds)

### Step 4: Verify Success
You should see output like:
```
Success. No rows returned
```

If you see errors about "policy does not exist" - **this is normal**! The migration drops policies that may not exist yet.

---

## Method 2: Supabase CLI (Advanced)

### Prerequisites
```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref sbknunooplaezvwtyooi
```

### Run Migration
```bash
# Apply migration
supabase db push

# Or run specific migration
supabase db execute \
  --file supabase/migrations/20251114_fix_permissions_final.sql
```

---

## Method 3: Copy-Paste Instructions

If you prefer step-by-step instructions, here's the SQL to copy:

<details>
<summary>📋 Click to expand full SQL</summary>

```sql
-- See: supabase/migrations/20251114_fix_permissions_final.sql
-- (Copy entire file contents from that file)
```

</details>

---

## Verification Steps

After running the migration, verify it worked:

### Step 1: Run Verification Script
```bash
npm run verify-migration
```

Expected output:
```
✅ chapter_invites table exists
✅ chapter_join_requests table exists
```

### Step 2: Check Data
```bash
npm run check-data
```

Should display:
- Chapters (tenants)
- User roles
- Profiles
- Chapter invites
- Join requests

### Step 3: Verify Policies in Dashboard

1. Go to **Database** → **Policies** in Supabase Dashboard
2. Check `chapter_invites` table:
   - ✅ "Only admins view invites"
   - ✅ "Only admins create invites"
   - ✅ "Only admins delete invites"
3. Check `chapter_join_requests` table:
   - ✅ "View join requests" (admins + self)
   - ✅ "Create join request"
   - ✅ "Admins update requests"
   - ✅ "Delete own pending request"

---

## Troubleshooting

### "Permission denied" errors
**Cause**: Not using service role key

**Solution**: Make sure you're logged into Supabase dashboard with project owner account

### "Relation does not exist" errors
**Cause**: Tables not created yet

**Solution**: 
1. First run `20251114_add_chapter_invites_and_join_requests.sql`
2. Then run `20251114_fix_permissions_final.sql`

### Policies still not working
**Cause**: RLS might be disabled

**Solution**:
```sql
-- Enable RLS if needed
ALTER TABLE chapter_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE chapter_join_requests ENABLE ROW LEVEL SECURITY;
```

---

## Testing After Migration

### Test 1: Admin Can See Invites
```typescript
// As admin user
const { data, error } = await supabase
  .from('chapter_invites')
  .select('*');

// Should return invite tokens
console.log(data); // ✅ Shows invites
```

### Test 2: Member Cannot See Invites
```typescript
// As regular member
const { data, error } = await supabase
  .from('chapter_invites')
  .select('*');

// Should return empty array
console.log(data); // ✅ Returns []
console.log(error); // null (no error, just no results)
```

### Test 3: Admin Sees All Join Requests
```typescript
// As admin user
const { data } = await supabase
  .from('chapter_join_requests')
  .select('*');

// Should see all requests for their chapter
```

### Test 4: Member Sees Own Requests Only
```typescript
// As regular member
const { data } = await supabase
  .from('chapter_join_requests')
  .select('*');

// Should only see own requests
```

---

## Rollback (Emergency Only)

If you need to rollback this migration:

```sql
-- Drop all policies
DROP POLICY IF EXISTS "Only admins view invites" ON public.chapter_invites;
DROP POLICY IF EXISTS "Only admins create invites" ON public.chapter_invites;
DROP POLICY IF EXISTS "Only admins delete invites" ON public.chapter_invites;
DROP POLICY IF EXISTS "View join requests" ON public.chapter_join_requests;
DROP POLICY IF EXISTS "Create join request" ON public.chapter_join_requests;
DROP POLICY IF EXISTS "Admins update requests" ON public.chapter_join_requests;
DROP POLICY IF EXISTS "Delete own pending request" ON public.chapter_join_requests;

-- Disable RLS temporarily (NOT RECOMMENDED - security risk)
ALTER TABLE chapter_invites DISABLE ROW LEVEL SECURITY;
ALTER TABLE chapter_join_requests DISABLE ROW LEVEL SECURITY;
```

⚠️ **Warning**: Disabling RLS exposes all data to all users. Only use for debugging.

---

## Next Steps

After successful migration:

1. ✅ Test onboarding flows (see USER_JOURNEY_ONBOARDING.md)
2. ✅ Update frontend to respect new permissions
3. ✅ Notify team about security changes
4. ✅ Monitor for any permission errors in production

---

## Support

If you encounter issues:

1. Check logs: `npm run check-data`
2. Verify tables exist: `npm run verify-migration`
3. Review policies in Supabase Dashboard
4. Check this guide's troubleshooting section
5. Review error messages carefully (many "errors" are expected)

---

**Migration File**: `supabase/migrations/20251114_fix_permissions_final.sql`

**Created**: November 14, 2025

**Purpose**: Security hardening for multi-path onboarding system
