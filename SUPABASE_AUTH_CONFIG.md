# 🔧 Supabase Authentication Configuration Fix

## ปัญหา: Email Confirmation Error
```
error=access_denied&error_code=otp_expired
error_description=Email+link+is+invalid+or+has+expired
```

**สาเหตุ:** Email redirect ไปที่ `localhost:3000` แต่ app รันที่ `localhost:5000`

---

## ✅ วิธีแก้ไข:

### ขั้นตอนที่ 1: แก้ไข Supabase Auth Settings

1. **เปิด Supabase Dashboard:**
   ```
   https://supabase.com/dashboard/project/sbknunooplaezvwtyooi/auth/url-configuration
   ```

2. **แก้ไข "Site URL":**
   - Current: `http://localhost:3000` (ผิด)
   - Change to: `http://localhost:5000` (ถูก)

3. **เพิ่ม "Redirect URLs":**
   Add the following URLs (one per line):
   ```
   http://localhost:5000/**
   http://localhost:5000/auth/callback
   https://*.replit.dev/**
   ```

4. **กด "Save"**

---

### ขั้นตอนที่ 2: Email Templates (Optional)

หาก Site URL แก้แล้วยังไม่หาย - ตรวจสอบ Email Templates:

1. **เปิด Email Templates:**
   ```
   https://supabase.com/dashboard/project/sbknunooplaezvwtyooi/auth/templates
   ```

2. **ตรวจสอบ "Confirm signup" template:**
   - ค้นหา: `{{ .SiteURL }}`
   - ตรวจสอบว่าใช้ `{{ .SiteURL }}` ไม่ใช่ hardcoded `localhost:3000`

---

### ขั้นตอนที่ 3: ทดสอบใหม่

1. **ลบ email เก่าทิ้ง** (OTP expired แล้ว)
2. **Sign up ใหม่** ด้วย email อื่น
3. **เปิด email confirmation link**
4. **ควรจะ redirect ไปที่ `localhost:5000` และ confirm สำเร็จ**

---

## 📝 หมายเหตุ:

- **Development:** ใช้ `http://localhost:5000`
- **Production (Replit):** ใช้ `https://*.replit.dev/**`
- **OTP Expiration:** Email links หมดอายุใน 1 ชั่วโมง - ต้อง sign up ใหม่

---

**หลังแก้ไขแล้ว → ทดสอบ sign up ใหม่อีกครั้ง!** ✅
