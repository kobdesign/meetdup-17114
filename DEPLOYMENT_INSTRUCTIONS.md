# Deployment Instructions - Nov 22, 2024

## Critical Database Migration Required

⚠️ **IMPORTANT**: Production Supabase database needs these schema updates before the system will work properly.

### Issue 1: Activation Tokens Table
**Error**: `Could not find the 'used' column of 'activation_tokens' in the schema cache`
**Status**: Table should already exist from migration `20251120_create_activation_tokens.sql`
**Action**: Verify table exists with `used_at` column. If missing, apply the 2025-11-20 migration first.

### Issue 2: Missing Tags Column  
**Need**: Add `tags` text array column to `participants` table for enhanced business card search
**Migration**: `20251122_fix_activation_and_add_tags.sql` (safe ALTER TABLE operation)

## Migration Steps (Production Supabase)

### Option A: Via Supabase Dashboard (Recommended)

1. Log into Supabase Dashboard: https://supabase.com/dashboard
2. Select project: `sbknunooplaezvwtyooi`
3. Go to **SQL Editor**
4. Copy and paste the migration SQL from: `supabase/migrations/20251122_fix_activation_and_add_tags.sql`
5. Click **Run** to execute
6. Verify success in logs

### Option B: Via Supabase CLI

```bash
# Make sure you're using the correct project
supabase link --project-ref sbknunooplaezvwtyooi

# Push the migration to production
supabase db push

# OR manually apply the specific migration
supabase migration up --db-url postgresql://postgres.[YOUR-PROJECT-REF]@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres
```

## Migration File Location

`supabase/migrations/20251122_fix_activation_and_add_tags.sql`

## What This Migration Does

1. **Creates `activation_tokens` table** (idempotent - safe to run multiple times)
   - Columns: token_id, token, participant_id, tenant_id, expires_at, used_at, created_at, created_by
   - Indexes: token, participant_id, tenant_id
   - RLS policies for admin access

2. **Adds `tags` column to `participants` table**
   - Type: TEXT[] (array of text)
   - Default: empty array `'{}'`
   - GIN index for fast search
   - Used for searchable keywords (company keywords, specialties, etc.)

## Verification Steps

After running the migration, verify:

```sql
-- Check activation_tokens table exists
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'activation_tokens';

-- Check tags column exists on participants
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'participants' AND column_name = 'tags';

-- Verify indexes
SELECT indexname FROM pg_indexes 
WHERE tablename IN ('activation_tokens', 'participants');
```

## Testing After Migration

1. **Test Activation Flow**: 
   - In LINE, send: "ขอลิงก์ใหม่"
   - Should receive LIFF activation link without errors

2. **Test Business Card Search**:
   - In LINE, send: "ค้นหานามบัตร"
   - Should receive prompt for keyword
   - Type a keyword and verify search works

3. **Test Rich Menu**:
   - Rich Menu Management page should display created menus
   - Can create, view, delete, and set default menus

## Rollback Plan

If issues occur, the migration is non-destructive:
- `activation_tokens` table creation uses `IF NOT EXISTS`
- `tags` column addition checks existence first
- No data is deleted or modified

To rollback tags column only:
```sql
ALTER TABLE participants DROP COLUMN IF EXISTS tags;
```

## Rich Menu Configuration

After migration, configure Rich Menu with these areas:

```json
[
  {
    "bounds": { "x": 0, "y": 0, "width": 833, "height": 843 },
    "action": { "type": "message", "text": "ค้นหานามบัตร" }
  },
  {
    "bounds": { "x": 833, "y": 0, "width": 834, "height": 843 },
    "action": { "type": "message", "text": "ขอลิงก์ใหม่" }
  },
  {
    "bounds": { "x": 1667, "y": 0, "width": 833, "height": 843 },
    "action": { "type": "message", "text": "ข้อมูลเพิ่มเติม" }
  }
]
```

See `RICH_MENU_CONFIG.md` for full details.
