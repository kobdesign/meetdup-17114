# Manual Migration Instructions for Replit Environment

Since Supabase CLI is not available in Replit, migrations must be applied manually via Supabase Dashboard.

## How to Apply Migrations

### Step 1: Access Supabase Dashboard
1. Go to [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Select your project
3. Navigate to **SQL Editor** in the left sidebar

### Step 2: Run Migration SQL
1. Open the migration file from `supabase/migrations/` directory
2. Copy the entire SQL content
3. Paste into SQL Editor
4. Click **Run** button

### Step 3: Verify Migration
1. Navigate to **Database** → **Tables** in the left sidebar
2. Verify new tables/columns exist
3. Check indexes under **Database** → **Indexes**

---

## Migration: 20251113105300_add_rich_menu_system.sql

**Purpose:** Add LINE Rich Menu and Quick Reply template support

**Tables Created:**
- `rich_menus` - Stores LINE Rich Menu configurations
- `quick_reply_templates` - Stores reusable Quick Reply button templates

**Dependencies:**
- Requires existing `tenants` table
- Requires existing `auth.users` table

**To Apply:**
1. Open `supabase/migrations/20251113105300_add_rich_menu_system.sql`
2. Copy all SQL (99 lines)
3. Paste into Supabase SQL Editor
4. Run migration

**Expected Result:**
- 2 new tables created
- 6 new indexes created
- 2 new triggers created
- 2 new trigger functions created

**Rollback (if needed):**
```sql
-- Drop triggers
DROP TRIGGER IF EXISTS trigger_update_rich_menus_updated_at ON rich_menus;
DROP TRIGGER IF EXISTS trigger_update_quick_reply_templates_updated_at ON quick_reply_templates;

-- Drop functions
DROP FUNCTION IF EXISTS update_rich_menus_updated_at();
DROP FUNCTION IF EXISTS update_quick_reply_templates_updated_at();

-- Drop tables
DROP TABLE IF EXISTS quick_reply_templates;
DROP TABLE IF EXISTS rich_menus;
```

---

## Migration Status Tracking

After applying each migration, record it here:

| Migration File | Applied Date | Applied By | Status | Notes |
|----------------|--------------|------------|--------|-------|
| 20251113105300_add_rich_menu_system.sql | YYYY-MM-DD | Your Name | ✅ / ❌ | Any issues or notes |

---

## Troubleshooting

### Error: "relation already exists"
- Migration was already applied
- Check if tables exist: `SELECT * FROM rich_menus LIMIT 1;`
- If tables exist, skip this migration

### Error: "column does not exist"
- Dependency migration not applied yet
- Check if `tenants` table exists first
- Apply earlier migrations in order

### Error: "permission denied"
- Insufficient database permissions
- Use Supabase Dashboard SQL Editor (has admin permissions)
- Do not use service role key in client

---

## Best Practices

1. **Always backup** before running migrations in production
2. **Test in development** environment first
3. **Run migrations in order** by filename timestamp
4. **Never modify** already-applied migration files
5. **Document** any manual changes in this file
