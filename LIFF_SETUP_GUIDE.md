# LINE LIFF Registration Setup Guide

## 📋 คู่มือการตั้งค่า LIFF สำหรับระบบลงทะเบียนผ่าน LINE

ระบบนี้ใช้ **LINE Front-end Framework (LIFF)** เพื่อให้ผู้ใช้สามารถลงทะเบียนและเชื่อมโยง LINE account ผ่าน web browser ภายใน LINE app

---

## ⚠️ **สิ่งสำคัญ: LINE Policy Update**

**LIFF apps ไม่สามารถเพิ่มลงใน Messaging API channel ได้อีกต่อไป!**

ตั้งแต่ปี 2020 LINE มีนโยบายดังนี้:
- ❌ **LIFF apps ห้ามเพิ่มใน Messaging API channel**
- ✅ **LIFF apps ต้องสร้างใน LINE Login channel เท่านั้น**

**Solution:** สร้าง **LINE Login channel** แยกต่างหาก + **Link เข้ากับ Messaging API channel** ที่มีอยู่

---

## 🎯 สิ่งที่จะได้รับหลังจากตั้งค่า

✅ User สามารถพิมพ์ "ลงทะเบียน" ใน LINE Bot → เปิดแบบฟอร์มใน LINE browser  
✅ ระบบดึง LINE User ID อัตโนมัติ  
✅ รองรับทั้ง **ลงทะเบียนใหม่** และ **เชื่อมโยงกับข้อมูลเดิม**  
✅ ใช้เบอร์โทรศัพท์เป็น unique identifier  
✅ User ID เหมือนกันระหว่าง Messaging API และ LINE Login (ถ้าอยู่ใน Provider เดียวกัน)

---

## 🏗️ **สถาปัตยกรรมระบบ**

```
Provider: "Your Company"
├── Messaging API Channel (LINE Official Account)
│   ├── Webhook → Supabase Edge Function
│   ├── Rich Menu, Quick Reply
│   └── Push/Reply Messages
│
└── LINE Login Channel (LIFF Apps)
    ├── LIFF App: Meetdup Registration
    ├── User Authentication
    └── Linked to Messaging API Channel ✅
```

**User ID เหมือนกัน** → สามารถเชื่อมโยงข้อมูลระหว่าง Bot และ LIFF ได้

---

## 🔧 ขั้นตอนการตั้งค่า

### **Step 0: ตรวจสอบ Provider ที่มีอยู่**

1. ไปที่ [LINE Developers Console](https://developers.line.biz/console/)
2. เช็คว่า **Messaging API channel** (LINE Official Account Bot) อยู่ใน Provider ไหน
3. จด **Provider name** ไว้ (เช่น "Meetdup", "MyCompany")

> **สำคัญ:** LINE Login channel ต้องสร้างภายใต้ **Provider เดียวกัน** เพื่อให้ User ID ตรงกัน

---

### **Step 1: สร้าง LINE Login Channel**

1. ไปที่ Provider เดิม (ที่มี Messaging API channel อยู่แล้ว)
2. คลิก **Create a new channel**
3. เลือก **LINE Login**
4. กรอกข้อมูล:

| Field | Value |
|-------|-------|
| **Channel name** | `Meetdup Registration` (หรือชื่อที่ต้องการ) |
| **Channel description** | `LINE registration for Meetdup members` |
| **App types** | ✅ Web app |
| **Email address** | `your-email@example.com` |
| **Privacy Policy URL** | `https://meetdup.replit.app/privacy` (optional) |
| **Terms of Use URL** | `https://meetdup.replit.app/terms` (optional) |

5. คลิก **Create**
6. เซฟ **Channel ID** และ **Channel Secret** ไว้

---

### **Step 2: เพิ่ม LIFF App ใน LINE Login Channel**

1. เข้า LINE Login channel ที่สร้างใหม่
2. ไปที่แท็บ **LIFF** → คลิก **Add**
3. กรอกข้อมูลดังนี้:

| Field | Value |
|-------|-------|
| **LIFF app name** | `Meetdup Registration` (หรือชื่อที่ต้องการ) |
| **Size** | `Full` (แนะนำ) |
| **Endpoint URL** | `https://meetdup.replit.app/line-register?tenant_id={tenant_id}` |
| **Scope** | ✅ `profile`<br>✅ `openid` |
| **Bot link feature** | `On (Aggressive)` (แนะนำ) |
| **Scan QR** | `Off` |
| **Module Mode** | `Off` |

> **หมายเหตุ:** LINE webhook จะส่ง tenant_id อัตโนมัติตาม bot ที่ผู้ใช้พิมพ์ "ลงทะเบียน"

4. คลิก **Add** → จะได้ **LIFF ID** (ตัวอย่าง: `1234567890-AbCdEfGh`)

---

### **Step 3: Link LINE Login Channel กับ Messaging API Channel**

**สำคัญมาก!** ขั้นตอนนี้ทำให้ User ID เหมือนกันระหว่าง Bot และ LIFF

1. อยู่ใน **LINE Login channel** → ไปที่แท็บ **Basic settings**
2. หาส่วน **Linked bots**
3. คลิก **Edit**
4. เลือก **Messaging API channel** (LINE Official Account Bot) ของคุณ
5. คลิก **Update**

✅ **ตรวจสอบ:** ควรเห็น Messaging API channel ปรากฏในส่วน Linked bots

---

### **Step 4: เพิ่ม LIFF ID เข้า Environment Variables**

#### สำหรับ Supabase Edge Function:

1. ไปที่ [Supabase Dashboard](https://supabase.com/dashboard/project/sbknunooplaezvwtyooi/settings/functions)
2. เลือกโปรเจค → ไปที่ **Edge Functions** → **Settings**
3. เพิ่ม environment variable:

```
LIFF_ID=1234567890-AbCdEfGh
```

#### สำหรับ Frontend (Replit Secrets):

1. ไปที่ Replit → เปิด **Secrets** (กุญแจในแถบซ้าย)
2. เพิ่ม secret:

```
Key: VITE_LIFF_ID
Value: 1234567890-AbCdEfGh
```

---

### **Step 5: Restart Workflows**

หลังจากเพิ่ม Environment Variables แล้ว:

1. **Redeploy Edge Function:**
   ```bash
   cd supabase
   npx supabase functions deploy line-webhook --no-verify-jwt
   ```

2. **Restart Frontend Workflow:**
   - หรือกด Restart ใน Replit console

---

---

## 🔑 **Multi-Tenant Setup (สำหรับหลาย Chapter)**

ถ้าคุณมีหลาย Chapter (tenant) แต่ละ tenant ต้องมี:

1. **Messaging API channel** แยกกัน (1 bot ต่อ 1 chapter)
2. **LINE Login channel** แยกกัน (1 LIFF per chapter)
3. **Provider แยกกัน** หรือ **Provider เดียวกัน** (แนะนำแยก)

### **ตัวอย่าง Multi-Tenant Setup:**

```
Provider: "Meetdup Chapter BKK"
├── Messaging API: BKK Bot
└── LINE Login: BKK LIFF (linked)

Provider: "Meetdup Chapter CNX"
├── Messaging API: CNX Bot
└── LINE Login: CNX LIFF (linked)
```

**ข้อมูลในฐานข้อมูล (`tenant_secrets`):**

| tenant_id | secret_key | secret_value |
|-----------|------------|--------------|
| tenant-bkk | LIFF_ID | 1111111111-aaaBBBccc |
| tenant-cnx | LIFF_ID | 2222222222-xxxYYYzzz |

---

## ✅ ทดสอบการทำงาน

### **1. ทดสอบใน LINE:**

1. เพิ่ม LINE Official Account
2. พิมพ์: `ลงทะเบียน`
3. กดปุ่ม "เปิดแบบฟอร์มลงทะเบียน"
4. ระบบจะเปิด LIFF App (loading screen → phone lookup → form)

### **2. ทดสอบ Registration Flow:**

#### **สำหรับสมาชิกใหม่:**
1. กรอกเบอร์โทรศัพท์ (10 หลัก)
2. ระบบแจ้ง "ยินดีต้อนรับ! กรุณากรอกข้อมูลเพื่อลงทะเบียน"
3. กรอกข้อมูล (ชื่อ, อีเมล, บริษัท, ฯลฯ)
4. กด "ลงทะเบียน" → สำเร็จ! 🎉

#### **สำหรับสมาชิกเก่า (มีข้อมูลแล้ว):**
1. กรอกเบอร์โทรศัพท์ที่เคยใช้
2. ระบบแจ้ง "พบข้อมูลของคุณแล้ว!"
3. แสดงข้อมูลเดิม (pre-filled)
4. กด "ยืนยันและเชื่อมโยง" → เชื่อมโยง LINE สำเร็จ! 🎉

---

## 🛠️ Troubleshooting

### ❌ "Cannot add LIFF app to Messaging API channel"
**สาเหตุ:** นโยบาย LINE ไม่อนุญาต  
**แก้ไข:**
- สร้าง **LINE Login channel** แยกต่างหาก
- เพิ่ม LIFF app ใน LINE Login channel
- Link กับ Messaging API channel

### ❌ "LIFF init failed: invalid liffId"
**สาเหตุ:** LIFF ID ผิดหรือไม่ได้ตั้งค่า  
**แก้ไข:**
- ตรวจสอบว่า LIFF ID ถูกต้อง (จาก LINE Login channel, ไม่ใช่ Messaging API)
- เช็คว่าได้เพิ่ม `VITE_LIFF_ID` และ `LIFF_ID` ใน Secrets แล้ว

### ❌ "ไม่สามารถเชื่อมต่อกับ LINE ได้"
**สาเหตุ:** LIFF SDK ไม่ถูก load  
**แก้ไข:**
- ตรวจสอบว่า `client/index.html` มี LIFF SDK script:
  ```html
  <script charset="utf-8" src="https://static.line-scdn.net/liff/edge/2/sdk.js"></script>
  ```

### ❌ "LINE account already registered"
**สาเหตุ:** LINE User ID นี้ถูกใช้แล้ว  
**แก้ไข:**
- ลบ `line_user_id` ใน `participants` table ถ้าต้องการ unlink

### ❌ หน้าจอขาว / blank page
**สาเหตุ:** LIFF Endpoint URL ผิด  
**แก้ไข:**
- ตรวจสอบ Endpoint URL ใน LINE Login channel → LIFF tab
- ควรเป็น: `https://meetdup.replit.app/line-register?tenant_id={tenant_id}`

### ❌ "User ID ไม่ตรงกันระหว่าง Bot และ LIFF"
**สาเหตุ:** ไม่ได้ Link channels หรืออยู่คนละ Provider  
**แก้ไข:**
- ตรวจสอบว่า LINE Login และ Messaging API อยู่ใน **Provider เดียวกัน**
- ตรวจสอบว่าได้ **Link channels** แล้ว (Basic settings → Linked bots)

---

## 📊 Database Schema

หลังจาก user ลงทะเบียนสำเร็จ ระบบจะบันทึก:

```sql
-- ข้อมูลใน participants table
UPDATE participants SET
  line_user_id = 'U1234567890abcdef',  -- LINE User ID
  phone = '0812345678',
  full_name = 'ชื่อจาก LINE',
  email = 'user@example.com',
  company = 'บริษัท ABC',
  photo_url = 'https://profile.line-scdn.net/...',  -- รูปโปรไฟล์จาก LINE
  status = 'prospect',  -- หรือ 'visitor', 'member' (ขึ้นกับ flow)
  ...
WHERE participant_id = 'xxx';
```

---

## 🔒 Security Notes

✅ **ปลอดภัย:**
- LIFF ใช้ OAuth 2.0 authentication ของ LINE
- LINE User ID ถูก verify โดย LINE Platform
- ไม่ต้องจัดการ password

⚠️ **ข้อควรระวัง:**
- Phone number เป็น unique identifier ต่อ tenant
- ต้อง validate phone format (10 digits)
- ตรวจสอบ duplicate LINE User ID

---

## 📱 User Flow Diagram

```
User พิมพ์ "ลงทะเบียน"
    ↓
Bot ส่ง Flex Message พร้อม LIFF link
    ↓
User กด "เปิดแบบฟอร์ม"
    ↓
LIFF init → ดึง LINE User ID
    ↓
กรอกเบอร์โทรศัพท์
    ↓
Phone Lookup API
    ↓
┌─────────────────────┬─────────────────────┐
│ ไม่เจอข้อมูล       │ เจอข้อมูล          │
│ (New Registration)  │ (Link Existing)     │
└─────────────────────┴─────────────────────┘
    ↓                       ↓
แสดงฟอร์มว่าง           แสดงฟอร์ม pre-filled
    ↓                       ↓
กรอกข้อมูล              ตรวจสอบ/แก้ไขข้อมูล
    ↓                       ↓
Submit → INSERT         Submit → UPDATE
    ↓                       ↓
บันทึก + link LINE ID   update + link LINE ID
    ↓                       ↓
✅ สำเร็จ! 🎉          ✅ เชื่อมโยงสำเร็จ! 🎉
```

---

## 🎨 Customization

### เปลี่ยนสี Theme:
แก้ไข `client/src/pages/public/LineRegister.tsx`:
```typescript
backgroundColor: "#06C755",  // LINE Green
color: "#06C755"             // Primary buttons
```

### เพิ่ม Fields:
แก้ไข form ใน `LineRegister.tsx` และ API ใน `server/routes/participants.ts`

---

## 📞 Support

หากมีปัญหาหรือคำถาม:
- ดู logs ใน Supabase Edge Functions
- ตรวจสอบ browser console ใน LIFF app
- ดู backend logs ใน Replit console

---

## 📚 **เอกสารอ้างอิง**

- [LINE LIFF Documentation](https://developers.line.biz/en/docs/liff/)
- [LINE Login Channel Creation](https://developers.line.biz/en/docs/liff/getting-started/)
- [Linking Channels Official Guide](https://developers.line.biz/en/docs/liff/registering-liff-apps/#linking-line-login-channel-with-line-official-account)
- [LINE Policy: Cannot add LIFF to Messaging API](https://developers.line.biz/en/news/2019/11/11/liff-cannot-be-used-with-messaging-api-channels/)

---

## 🎓 **สรุป: Setup Checklist**

เมื่อทำครบทุกขั้นตอน คุณควรมี:

- [x] **LINE Login channel** (ภายใต้ Provider เดียวกับ Messaging API)
- [x] **LIFF app** สร้างใน LINE Login channel
- [x] **Linked channels** (LINE Login ↔ Messaging API)
- [x] **LIFF_ID** บันทึกใน Replit Secrets (`VITE_LIFF_ID`)
- [x] **LIFF_ID** บันทึกใน Supabase Edge Functions (`LIFF_ID`)
- [x] **Endpoint URL** ตั้งค่าเป็น `https://meetdup.replit.app/line-register?tenant_id={tenant_id}`
- [x] **Workflows redeployed** (Edge Function + Frontend)

✅ **พร้อมทดสอบ!**

---

**เอกสารนี้อัปเดตล่าสุด:** November 17, 2025  
**เวอร์ชัน:** 2.0.0 (Updated for LINE Login channel requirement)
