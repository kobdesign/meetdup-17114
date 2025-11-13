# 🔧 Supabase Authentication URL Configuration

## ปัญหาที่เจอ:
```
error=access_denied&error_code=otp_expired
error_description=Email+link+is+invalid+or+has+expired
```

**สาเหตุ:** Email confirmation link redirect ไปที่ `localhost:3000` แต่:
1. App รันที่ port 5000 (ไม่ใช่ 3000)
2. **Localhost ไม่สามารถเข้าถึงได้จากเครื่อง client ภายนอก** ❌

---

## ✅ วิธีแก้ไข (สำหรับ Production):

### ขั้นตอนที่ 1: แก้ไข Supabase Site URL

**เปิด Supabase Auth Settings:**
```
https://supabase.com/dashboard/project/sbknunooplaezvwtyooi/auth/url-configuration
```

**ตั้งค่า "Site URL" เป็น Replit Production URL:**
```
https://8625661b-810c-454f-a000-87408dbc3705-00-11ta8rgc9d0py.riker.replit.dev
```

⚠️ **สำคัญ:** ต้องใช้ Replit public URL ไม่ใช่ localhost เพราะ:
- Email link จะถูกกดจากเครื่อง client ที่อยู่ภายนอก
- Client ไม่สามารถเข้าถึง `localhost` ของเครื่อง developer ได้

---

### ขั้นตอนที่ 2: เพิ่ม Redirect URLs

Add ทั้งหมดนี้ใน **"Redirect URLs"** section (one per line):

```
https://8625661b-810c-454f-a000-87408dbc3705-00-11ta8rgc9d0py.riker.replit.dev/**
https://*.replit.dev/**
http://localhost:5000/**
http://localhost:5000/auth/callback
```

**คำอธิบาย:**
- ✅ **Production URL (exact)**: สำหรับ client ภายนอกที่กด email link
- ✅ **Wildcard `*.replit.dev`**: รองรับกรณี Replit domain เปลี่ยน
- ✅ **Localhost URLs**: สำหรับ development บนเครื่อง developer เท่านั้น

---

### ขั้นตอนที่ 3: ตรวจสอบ Email Templates

**เปิด Email Templates:**
```
https://supabase.com/dashboard/project/sbknunooplaezvwtyooi/auth/templates
```

**ตรวจสอบ "Confirm signup" template ว่าใช้:**
```
{{ .SiteURL }}
```
**ไม่ใช่ hardcoded** `http://localhost:3000` หรือ `http://localhost:5000`

---

### ขั้นตอนที่ 4: ทดสอบใหม่

1. **ลบ email เก่าทิ้ง** (OTP expired แล้ว)
2. **Sign up ใหม่** ด้วย email อื่น
3. **รอรับ email confirmation**
4. **กดลิงก์จาก email** → ควร redirect ไปที่:
   ```
   https://8625661b-810c-454f-a000-87408dbc3705-00-11ta8rgc9d0py.riker.replit.dev/#access_token=...
   ```
5. **Verify authentication flow สำเร็จ**

---

## 📝 การใช้งานที่ถูกต้อง:

### ✅ สำหรับ Production (Client ภายนอก):
```
Site URL: https://8625661b-810c-454f-a000-87408dbc3705-00-11ta8rgc9d0py.riker.replit.dev
```
- Email links จะ redirect มาที่ Replit URL
- Client สามารถเข้าถึงได้จากทุกเครื่อง

### ✅ สำหรับ Development (Local testing):
```
Redirect URLs: http://localhost:5000/**
```
- เพิ่มใน redirect list เพื่อให้ dev บนเครื่องตัวเองได้
- แต่ **ไม่ใช่ Site URL** (เพราะ client ภายนอกเข้าไม่ถึง)

### ⚠️ กรณี Replit Domain เปลี่ยน:
- Wildcard `https://*.replit.dev/**` จะช่วยรองรับ
- แต่ควร **update Site URL** เป็น domain ใหม่ทุกครั้ง
- Check domain ปัจจุบันได้จาก env var: `REPLIT_DEV_DOMAIN`

---

## 🔍 สรุป:

| Environment | Site URL | Purpose |
|------------|----------|---------|
| **Production** | `https://8625661b-...riker.replit.dev` | Email links สำหรับ client ภายนอก ✅ |
| **Development** | Add to Redirect URLs only | Local testing เท่านั้น |

---

**Next Steps:**
1. ✅ แก้ Supabase Site URL → Replit production URL
2. ✅ เพิ่ม Redirect URLs (production + wildcard + localhost)
3. ✅ Sign up ใหม่เพื่อทดสอบ
4. ✅ Verify email link redirect ไปที่ Replit URL

**หลังแก้เสร็จ → ทดสอบ sign up ใหม่ทันที!** 🚀
