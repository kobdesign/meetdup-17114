# LINE LIFF Registration Setup Guide

## 📋 คู่มือการตั้งค่า LIFF สำหรับระบบลงทะเบียนผ่าน LINE

ระบบนี้ใช้ **LINE Front-end Framework (LIFF)** เพื่อให้ผู้ใช้สามารถลงทะเบียนและเชื่อมโยง LINE account ผ่าน web browser ภายใน LINE app

---

## 🎯 สิ่งที่จะได้รับหลังจากตั้งค่า

✅ User สามารถพิมพ์ "ลงทะเบียน" ใน LINE → เปิดแบบฟอร์มใน LINE browser  
✅ ระบบดึง LINE User ID อัตโนมัติ  
✅ รองรับทั้ง **ลงทะเบียนใหม่** และ **เชื่อมโยงกับข้อมูลเดิม**  
✅ ใช้เบอร์โทรศัพท์เป็น unique identifier

---

## 🔧 ขั้นตอนการตั้งค่า

### **Step 1: สร้าง LIFF App ใน LINE Developers Console**

1. ไปที่ [LINE Developers Console](https://developers.line.biz/console/)
2. เลือก Provider และ Channel ที่ต้องการ
3. ไปที่แท็บ **LIFF** → คลิก **Add**
4. กรอกข้อมูลดังนี้:

| Field | Value |
|-------|-------|
| **LIFF app name** | `Meetdup Registration` (หรือชื่อที่ต้องการ) |
| **Size** | `Full` (แนะนำ) |
| **Endpoint URL** | `https://meetdup.replit.app/line-register` |
| **Scope** | ✅ `profile`<br>✅ `openid` |
| **Bot link feature** | `On (Aggressive)` (แนะนำ) |
| **Scan QR** | `Off` |
| **Module Mode** | `Off` |

5. คลิก **Add** → จะได้ **LIFF ID** (ตัวอย่าง: `1234567890-AbCdEfGh`)

---

### **Step 2: เพิ่ม LIFF ID เข้า Environment Variables**

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

### **Step 3: Restart Workflows**

หลังจากเพิ่ม Environment Variables แล้ว:

1. **Redeploy Edge Function:**
   ```bash
   cd supabase
   npx supabase functions deploy line-webhook --no-verify-jwt
   ```

2. **Restart Frontend Workflow:**
   - หรือกด Restart ใน Replit console

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

### ❌ "LIFF init failed: invalid liffId"
**สาเหตุ:** LIFF ID ผิดหรือไม่ได้ตั้งค่า  
**แก้ไข:**
- ตรวจสอบว่า LIFF ID ถูกต้อง
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
- ตรวจสอบ Endpoint URL ใน LINE Developers Console
- ควรเป็น: `https://meetdup.replit.app/line-register`

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

**เอกสารนี้อัปเดตล่าสุด:** November 17, 2025  
**เวอร์ชัน:** 1.0.0
