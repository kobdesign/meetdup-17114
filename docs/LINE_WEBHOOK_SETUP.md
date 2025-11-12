# LINE Webhook Integration Guide

## Overview
This document explains how to set up and use the LINE webhook integration for your BNI Chapter. The webhook enables automated responses to LINE messages, including business card search, check-in links, and payment information.

## Features

### Supported Commands
- `card <name>` - Search for business cards by name, company, or business type
- `checkin` - Get a check-in link to scan QR codes at meetings
- `pay` - Receive payment instructions for visitor fees
- Any other text - Display help message

### Security Features
- ✅ LINE signature verification using HMAC-SHA256
- ✅ Rate limiting (20 requests per minute per user)
- ✅ Tenant-scoped access control
- ✅ Comprehensive logging to `integration_logs` table

---

## Setup Instructions

### 1. Create LINE Messaging API Channel

1. Go to [LINE Developers Console](https://developers.line.biz/console/)
2. Create a new Provider (or use existing)
3. Create a new **Messaging API** channel
4. Fill in required information:
   - Channel name: `BNI {Chapter Name} Bot`
   - Channel description: `Official BNI Chapter management bot`
   - Category: Business
   - Subcategory: Business Management

### 2. Get LINE Credentials

After creating the channel, you'll need:

#### Channel ID
- Found in: **Basic settings** tab
- Example: `1234567890`

#### Channel Secret
- Found in: **Basic settings** tab
- Click **Issue** if not generated yet
- Example: `a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6`

#### Channel Access Token
- Found in: **Messaging API** tab
- Click **Issue** button under "Channel access token (long-lived)"
- Example: `eyJhbGciOiJIUzI1NiIsInR5cCI6...`

### 3. Configure Webhook in LINE

1. Go to **Messaging API** tab in LINE Developers Console
2. Find **Webhook settings** section
3. Set **Webhook URL** to:
   ```
   https://nzenqhtautbitmbmgyjk.supabase.co/functions/v1/line-webhook/{your-tenant-slug}
   ```
   Replace `{your-tenant-slug}` with your chapter's slug (e.g., `bni-bangkok-central`)

4. Enable **Use webhook** toggle
5. Click **Verify** to test the connection (should return 200 OK)

### 4. Configure LINE Bot Settings

In **Messaging API** tab:

- **Auto-reply messages**: Disable (we handle replies via webhook)
- **Greeting messages**: Optional (customize welcome message)
- **Allow bot to join group chats**: Optional (enable if needed)
- **Response mode**: ✅ **Webhook**

### 5. Add Credentials to Your Chapter Settings

1. Log in to your admin panel
2. Go to **Settings** > **LINE Integration** section
3. Enter the following credentials:
   - **LINE Channel ID**: Your channel ID
   - **LINE Channel Secret**: Your channel secret (stored securely)
   - **LINE Channel Access Token**: Your access token (encrypted)
   - **LIFF ID (Share)**: (Optional) LIFF app ID for sharing
   - **LIFF ID (Check-in)**: (Optional) LIFF app ID for check-in

4. Click **Save LINE Settings**

---

## Testing Your Integration

### Method 1: Add Bot as Friend

1. Go to **Messaging API** tab in LINE Developers Console
2. Find **QR code** under "Bot information"
3. Scan with LINE app on your phone
4. Send a test message: `help`
5. You should receive a welcome message with available commands

### Method 2: Test Commands

Try these commands:
```
help              → Show available commands
card john         → Search for "john" in business cards
checkin           → Get check-in link (requires LIFF setup)
pay               → Show payment information
```

### Method 3: Check Integration Logs

1. Go to **Admin Panel** > **Integration Logs**
2. Filter by source: `LINE`
3. View webhook events, message replies, and any errors

---

## LIFF App Setup (Optional)

LIFF (LINE Front-end Framework) enables in-app web experiences.

### Create LIFF Apps

1. In LINE Developers Console, go to **LIFF** tab
2. Click **Add**
3. Create two LIFF apps:

#### LIFF for Sharing
- **LIFF app name**: `BNI Meeting Share`
- **Size**: Full
- **Endpoint URL**: `https://your-domain.com/chapter/{tenant_slug}`
- **Scope**: `profile`, `openid`

#### LIFF for Check-in
- **LIFF app name**: `BNI Check-in Scanner`
- **Size**: Full
- **Endpoint URL**: `https://your-domain.com/checkin/{meeting-id}`
- **Scope**: `profile`, `openid`
- **Additional features**: Enable QR code scanner

4. Copy the LIFF IDs (format: `1234567890-abcdefgh`)
5. Add them to **Settings** > **LINE Integration**

---

## Webhook Response Examples

### Help Command
**User sends:** `anything`
```
👋 สวัสดีค่ะ! BNI Bangkok Central

คำสั่งที่ใช้ได้:

📇 card <ชื่อ> - ค้นหานามบัตร
✅ checkin - เปิด check-in
💰 pay - ชำระค่าผู้เยี่ยมชม

ตัวอย่าง: card john
```

### Card Search
**User sends:** `card john`
```
🔍 กำลังค้นหานามบัตร "john" ใน BNI Bangkok Central

ฟีเจอร์นี้จะเชื่อมต่อกับฐานข้อมูล participants เร็วๆ นี้

สามารถค้นหาได้ด้วย: ชื่อ, บริษัท, หรือ business_type
```

### Check-in Command
**User sends:** `checkin`
```
✅ Check-in สำหรับการประชุม

กดลิงก์ด้านล่างเพื่อ check-in:
https://liff.line.me/1234567890-abcdefgh?tenant=bni-bangkok-central

[Quick Reply Button: 📱 เปิด Check-in]
```

### Payment Command
**User sends:** `pay`
```
💰 ชำระค่าผู้เยี่ยมชม

ค่าเข้าร่วม: 650 THB

กดลิงก์ด้านล่างเพื่อชำระเงิน:

[Quick Reply Button: 💳 ชำระเงิน]
```

---

## Rate Limiting

The webhook implements rate limiting to prevent abuse:

- **Limit**: 20 requests per user per minute
- **Response when exceeded**:
  ```
  ⚠️ คุณส่งข้อความมากเกินไป กรุณารอสักครู่แล้วลองใหม่
  ```

Rate limit is reset every 60 seconds.

---

## Integration Logs

All webhook events are logged to the `integration_logs` table:

### Log Fields
- `tenant_id` - Chapter ID
- `source` - Always `'line'` for LINE webhooks
- `event_type` - Event type (`message`, `follow`, `unfollow`, `webhook_error`, etc.)
- `payload` - Full LINE webhook payload
- `metadata` - Additional context (user_id, error details, etc.)
- `created_at` - Timestamp

### Viewing Logs
1. Go to **Admin Panel** > **Integration Logs**
2. Filter by source: `LINE`
3. Click on any log entry to view full details

---

## Troubleshooting

### Webhook Returns 404
- ✅ Check that tenant_slug in webhook URL is correct
- ✅ Verify tenant is **active** in database
- ✅ Ensure edge function is deployed

### Webhook Returns 403 (Invalid Signature)
- ✅ Verify LINE Channel Secret is correct in Settings
- ✅ Check that webhook URL in LINE console matches exactly
- ✅ Ensure no proxy or CDN is modifying request headers

### Webhook Returns 503 (LINE Integration Not Configured)
- ✅ Add LINE credentials in **Settings** > **LINE Integration**
- ✅ Save both Channel Secret and Access Token
- ✅ Refresh webhook configuration in LINE console

### Bot Doesn't Reply to Messages
- ✅ Check **Integration Logs** for errors
- ✅ Verify Access Token is valid (tokens can expire)
- ✅ Ensure **Auto-reply** is disabled in LINE console
- ✅ Check webhook is enabled and verified

### Check-in Link Returns Error
- ✅ Configure LIFF app in LINE Developers Console
- ✅ Add LIFF ID (Check-in) to Settings
- ✅ Verify LIFF endpoint URL is accessible

---

## Security Best Practices

### ✅ DO
- Store credentials securely (never commit to git)
- Use HTTPS for all webhook endpoints
- Verify LINE signatures on every request
- Monitor integration logs regularly
- Rotate access tokens periodically
- Use RLS policies to protect data

### ❌ DON'T
- Share Channel Secret publicly
- Disable signature verification
- Store credentials in code
- Use the same credentials across environments
- Ignore rate limit warnings

---

## Advanced Features

### Custom Message Handlers

To add custom command handlers, edit:
```typescript
// supabase/functions/line-webhook/index.ts

// Example: Add "status" command
else if (messageText === 'status') {
  replyMessages = [{
    type: 'text',
    text: `📊 Chapter Status\n\nActive Members: 25\nNext Meeting: 2024-02-15`
  }];
}
```

### Rich Messages

LINE supports rich message formats:
- Flex Messages (custom layouts)
- Template Messages (buttons, carousels)
- Image Maps (clickable images)
- Quick Replies (button suggestions)

Example in webhook handler:
```typescript
replyMessages = [{
  type: 'template',
  altText: 'Meeting options',
  template: {
    type: 'buttons',
    title: 'Upcoming Meeting',
    text: 'Choose an action',
    actions: [
      { type: 'uri', label: 'Check-in', uri: liffUrl },
      { type: 'uri', label: 'View Details', uri: meetingUrl }
    ]
  }
}];
```

---

## Support

For issues or questions:
1. Check **Integration Logs** in admin panel
2. Review LINE Developers Console webhook logs
3. Contact technical support with log IDs

---

## References

- [LINE Messaging API Documentation](https://developers.line.biz/en/docs/messaging-api/)
- [LINE Webhook Reference](https://developers.line.biz/en/reference/messaging-api/#webhook-event-objects)
- [LIFF Documentation](https://developers.line.biz/en/docs/liff/)
- [Flex Message Simulator](https://developers.line.biz/flex-simulator/)
