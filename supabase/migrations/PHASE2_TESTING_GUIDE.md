# Phase 2: Rich Menu & Quick Reply Testing Guide

## Overview
This guide covers end-to-end testing for Phase 2 LINE Integration:
- ✅ Rich Menu System (Admin UI, Edge Function, Database)
- ✅ Postback Event Handling (webhook extension)
- ✅ Quick Reply System (factory functions, templates)

## Prerequisites

### 1. Database Migration
Apply migration via Supabase Dashboard:
```sql
-- File: supabase/migrations/20251113105300_add_rich_menu_system.sql
-- Follow instructions in: MIGRATION_INSTRUCTIONS.md
```

### 2. LINE Bot Configuration
1. Navigate to Admin → LINE Configuration
2. Enter LINE Bot credentials:
   - Channel ID
   - Channel Access Token
   - Channel Secret
3. Click "Test Bot Connection" to verify
4. Bot user ID should auto-populate

### 3. Webhook Setup
- Webhook URL: `https://your-project.supabase.co/functions/v1/line-webhook`
- Webhook events: Messages, Follow, Unfollow, Join, Leave, **Postback**
- Enable "Use webhook" in LINE Developers Console

---

## Test Suite

### Test 1: Rich Menu Creation (Admin UI)

**Steps:**
1. Log in as Super Admin or Chapter Admin
2. Navigate to **Admin → Rich Menu**
3. Click **"Create New Rich Menu"**
4. Fill in form:
   - **Name:** Main Menu (en), เมนูหลัก (th)
   - **Chat Bar Text:** Menu, เมนู
   - **Image Height:** Select `843px (Half)` or `1686px (Full)`
   - **Areas JSON:** Use default template or customize
   - **Image File:** Upload 2500x843 or 2500x1686 PNG
5. Click **"Create Rich Menu"**

**Expected Results:**
- ✅ Success toast: "Rich menu created successfully"
- ✅ New card appears in list with:
  - Name, Chat Bar Text
  - Image preview
  - Created date
  - Status: Active
- ✅ Actions: View Details, Set as Default, Delete

**Common Issues:**
- ❌ "Invalid areas JSON" → Check JSON structure (bounds + actions)
- ❌ "Image upload failed" → Verify image dimensions (2500x843 or 2500x1686)
- ❌ "LINE API error" → Check LINE credentials in LINE Configuration

---

### Test 2: Set Default Rich Menu

**Steps:**
1. From Rich Menu list, find desired menu
2. Click **"Set as Default"** button
3. Confirm action

**Expected Results:**
- ✅ Success toast: "Default rich menu set successfully"
- ✅ Badge "Default" appears on menu card
- ✅ All **new** LINE bot followers receive this menu automatically
- ✅ Database: `rich_menus.is_default = true` for selected menu

**Note:** 
- Only ONE menu can be default per tenant
- Setting new default removes "default" status from previous menu
- Existing followers keep their current menu (use LINE Official Account Manager to bulk update)

---

### Test 3: Rich Menu Display (User Side)

**Test with LINE App:**
1. Add your LINE Bot as friend (or re-add if already friends)
2. Open chat with bot
3. Look at bottom of chat screen

**Expected Results:**
- ✅ Rich Menu appears with custom image
- ✅ Chat bar shows configured text (e.g., "Menu")
- ✅ Tapping menu areas triggers postback events

**Troubleshooting:**
- ❌ Menu not showing:
  - Check if menu is set as default
  - Try unfollowing → re-following bot
  - Verify webhook receives "follow" event
- ❌ Wrong menu showing:
  - Check default menu in database
  - User might have manually linked menu (check LINE OA Manager)

---

### Test 4: Postback Event Handling

**Rich Menu Actions:**
Configure Rich Menu areas with these postback data formats:
```json
{
  "bounds": { "x": 0, "y": 0, "width": 833, "height": 843 },
  "action": {
    "type": "postback",
    "label": "Check-in",
    "data": "action=checkin"
  }
}
```

**Available Actions:**
1. **Check-in:** `action=checkin` or `action=checkin&meeting_id=123`
2. **Meeting Info:** `action=meeting_info`
3. **Payment:** `action=payment`
4. **Profile:** `action=profile`
5. **Help:** `action=help`

**Testing Each Action:**

#### 4a. Check-in Action
1. Tap Rich Menu area with `action=checkin`
2. **Expected:**
   - Bot replies: "⏳ ระบบเช็คอินผ่าน Rich Menu กำลังอยู่ระหว่างการพัฒนา..."
   - (Future: Actual check-in processing)

#### 4b. Meeting Info Action
1. Tap Rich Menu area with `action=meeting_info`
2. **Expected:**
   - Bot replies: "📅 การประชุมที่กำลังจะมาถึง\n\n⏳ กำลังโหลดข้อมูล..."
   - (Future: Real meeting list)

#### 4c. Payment Action
1. Tap Rich Menu area with `action=payment`
2. **Expected:**
   - Bot replies: "💰 ข้อมูลการชำระเงิน\n\n⏳ กำลังโหลดข้อมูล..."
   - (Future: Payment links and status)

#### 4d. Profile Action
1. Ensure user exists in `participants` table with `line_user_id` set
2. Tap Rich Menu area with `action=profile`
3. **Expected:**
   - Bot replies with profile:
     ```
     👤 ข้อมูลส่วนตัว

     ชื่อ: John Doe
     สถานะ: สมาชิก
     อีเมล: john@example.com
     โทรศัพท์: 081-234-5678
     ```
   - Status translated: prospect → ผู้สนใจ, visitor → ผู้เยี่ยมชม, member → สมาชิก, alumni → ศิษย์เก่า

**Error Cases:**
- ❌ User not in database → "ไม่พบข้อมูลของคุณในระบบ"
- ❌ Invalid action → "ไม่พบคำสั่งที่คุณต้องการ"
- ❌ Missing action parameter → "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง"

---

### Test 5: Quick Reply Buttons

**When Quick Reply Appears:**
1. **Greeting Message:**
   - Send "สวัสดี" or "hello" → Quick reply with 4 buttons
2. **Help Message:**
   - Send "เมนู" or "help" → Quick reply with 4 buttons

**Quick Reply Buttons:**
1. เช็คอิน → `action=checkin`
2. ข้อมูลการประชุม → `action=meeting_info`
3. ชำระเงิน → `action=payment`
4. ข้อมูลส่วนตัว → `action=profile`

**Testing:**
1. Send "สวัสดี" to bot
2. **Expected:**
   - Bot replies: "สวัสดีครับ! ยินดีต้อนรับสู่ BNI Meetdup 🎉\n\nกดปุ่มด้านล่างเพื่อเริ่มต้นใช้งาน"
   - 4 quick reply buttons appear below message
3. Tap any button
4. **Expected:**
   - Display text appears in chat (e.g., "เช็คอิน")
   - Bot processes postback and replies accordingly
   - Quick reply buttons disappear after use

**Quick Reply Specifications:**
- ✅ Max 13 items per message (truncates if exceeded)
- ✅ Button label shows on button
- ✅ Display text shows in chat when tapped
- ✅ Postback data sent to webhook
- ✅ Buttons disappear after one use

---

### Test 6: Multi-Tenant Isolation

**Setup:**
1. Create 2 tenants (Chapter A, Chapter B)
2. Configure LINE Bot for each (different Channel IDs)
3. Create different Rich Menus for each

**Testing:**
1. Add both bots as friends
2. Tap Rich Menu in Chapter A bot
3. Tap Rich Menu in Chapter B bot

**Expected Results:**
- ✅ Each bot shows its own Rich Menu
- ✅ Postback events route to correct tenant
- ✅ Profile action returns correct tenant's participant data
- ✅ Database queries scoped to `tenant_id`

**Verification in Logs:**
```
[line-webhook:abc123] Using cached credentials for destination: U1234567890
[line-webhook:abc123] Signature validated for tenant: tenant-A-uuid
[line-webhook:abc123] Postback action: profile
```

---

## Database Verification

### Check Rich Menus
```sql
SELECT 
  id,
  name_en,
  chat_bar_text_en,
  is_default,
  line_rich_menu_id,
  created_at
FROM rich_menus
WHERE tenant_id = 'your-tenant-id'
ORDER BY created_at DESC;
```

### Check Postback Logs
```sql
-- No dedicated table yet, check Supabase Edge Function logs
-- In Edge Function dashboard, search for:
[line-webhook] Postback action: checkin
```

---

## Rollback Procedure

If issues occur, rollback Rich Menu system:

```sql
-- 1. Remove default rich menus from LINE
-- (Manual via LINE OA Manager)

-- 2. Drop tables
DROP TABLE IF EXISTS quick_reply_templates CASCADE;
DROP TABLE IF EXISTS rich_menus CASCADE;

-- 3. Remove Edge Function deployment
-- (Delete via Supabase Dashboard → Edge Functions)
```

---

## Success Criteria

### Phase 2 Complete ✅ When:
- [ ] Rich Menu Admin UI working (create, list, delete, set default)
- [ ] Rich Menu appears for new LINE followers automatically
- [ ] All postback actions handled (checkin, meeting_info, payment, profile, help)
- [ ] Quick Reply buttons appear in greeting/help messages
- [ ] Quick Reply buttons trigger correct postback handlers
- [ ] Multi-tenant isolation working (correct menu per tenant)
- [ ] Error handling graceful (user-friendly messages)
- [ ] Database migration applied successfully
- [ ] Edge Functions deployed and responding

---

## Next Steps (Phase 3+)

After Phase 2 verification:
1. **Phase 3:** Implement actual check-in logic (with meeting_id)
2. **Phase 4:** Add meeting info fetch (upcoming meetings from database)
3. **Phase 5:** Payment processing integration
4. **Phase 6:** Automated messaging (reminders, notifications)
5. **Phase 7:** Business card Flex Messages
6. **Phase 8:** Advanced Quick Reply templates (location, datetime picker)

---

## Support

**Issues?**
- Check Supabase Edge Function logs
- Verify LINE webhook events enabled
- Confirm database migration applied
- Review `MIGRATION_INSTRUCTIONS.md` for database setup

**Common Errors:**
- `Invalid signature` → Check LINE Channel Secret
- `Tenant not configured` → Check LINE Configuration page
- `No action in postback data` → Verify Rich Menu areas JSON format
- `Invalid areas JSON` → Use validation function in RichMenuPage

**Contact:**
- Technical: developer@meetdup.com
- Support: support@meetdup.com
