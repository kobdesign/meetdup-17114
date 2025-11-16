# 🔧 Supabase Migration Instructions

## ปัญหาที่เกิดขึ้น
หน้า **Visitor Pipeline** แสดง error:
```
column participants.referred_by_participant_id does not exist
```

## สาเหตุ
Migration files มีอยู่แล้วใน codebase แต่ยังไม่ถูก run ใน **Supabase Production Database**

---

## 📝 วิธีแก้ไข (ใช้เวลาประมาณ 2 นาที)

### ขั้นตอนที่ 1: เข้าสู่ Supabase Dashboard
1. ไปที่ https://supabase.com/dashboard
2. เลือก Project: **sbknunooplaezvwtyooi** (Meetdup)
3. ไปที่เมนู **SQL Editor** (ด้านซ้าย)

### ขั้นตอนที่ 2: Run Migration Script
1. คลิก **New Query** (ปุ่มสีน้ำเงิน)
2. Copy SQL script ทั้งหมดจากไฟล์ `supabase/migrations/20251116_fix_visitor_pipeline.sql`
3. Paste ลงใน SQL Editor
4. คลิก **Run** (หรือกด Ctrl+Enter)

### ขั้นตอนที่ 3: ตรวจสอบผลลัพธ์
คุณควรเห็นข้อความ:
```
✅ VERIFICATION PASSED - All changes applied successfully
  ✓ Enum value 'declined' exists
  ✓ Column referred_by_participant_id exists
```

---

## ✅ ตรวจสอบว่า Migration สำเร็จ

### วิธีที่ 1: ตรวจสอบใน SQL Editor
Run query นี้เพื่อดูว่า column ถูกสร้างแล้ว:

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'participants'
AND column_name = 'referred_by_participant_id';
```

**ผลลัพธ์ที่ต้องการ:**
```
column_name                   | data_type | is_nullable
------------------------------|-----------|------------
referred_by_participant_id    | uuid      | YES
```

### วิธีที่ 2: ตรวจสอบ Enum Values
Run query นี้เพื่อดู enum values:

```sql
SELECT enumlabel 
FROM pg_enum e
JOIN pg_type t ON e.enumtypid = t.oid
WHERE t.typname = 'participant_status'
ORDER BY enumsortorder;
```

**ผลลัพธ์ที่ต้องการ:**
```
enumlabel
----------
prospect
visitor
member
alumni
declined   ← ต้องมี!
```

---

## 🧪 ทดสอบ Application

หลังจาก run migration แล้ว:

1. **Refresh หน้าเว็บ** (Ctrl+R หรือ Cmd+R)
2. ไปที่หน้า **Admin → Visitors** (Visitor Pipeline)
3. ตรวจสอบว่า:
   - ✅ ไม่มี error แสดง
   - ✅ ตาราง Visitors แสดงข้อมูลได้ปกติ
   - ✅ สถิติ (Analytics Cards) แสดงผลถูกต้อง

---

## 🆘 หากยังมีปัญหา

### ถ้ายังเห็น Error เดิม:
1. **Hard Refresh Browser:**
   - Chrome/Edge: `Ctrl+Shift+R` (Windows) หรือ `Cmd+Shift+R` (Mac)
   - Firefox: `Ctrl+F5`
   
2. **ตรวจสอบ Console Logs:**
   - เปิด Developer Tools (F12)
   - ดู Console tab
   - บอก error message ที่เห็น

3. **Restart Workflow:**
   - Replit จะ auto-restart workflow
   - หรือ manually restart ได้ที่ Tools panel

---

## 📊 สิ่งที่ Migration นี้ทำ

### 1. เพิ่ม `'declined'` enum value
- เพิ่มสถานะ "ปฏิเสธ/ไม่เข้าร่วม" สำหรับ visitors
- ใช้ใน Visitor Pipeline analytics

### 2. เพิ่ม `referred_by_participant_id` column
- ติดตามว่าใครเป็นผู้แนะนำ visitor แต่ละคน
- เป็น Foreign Key ไปที่ `participants(participant_id)`
- รองรับระบบ Referral Tracking

---

## 🔒 ความปลอดภัย

Migration script นี้:
- ✅ **Idempotent** - Run ได้หลายครั้งโดยไม่เกิดปัญหา
- ✅ **Safe** - ไม่ลบหรือแก้ไขข้อมูลเดิม
- ✅ **Reversible** - สามารถ rollback ได้ถ้าจำเป็น
- ✅ **Verified** - มีการตรวจสอบผลลัพธ์หลัง run

---

## 💡 Tips

- **ไม่ต้องกังวล** - Migration script ถูกออกแบบมาให้ปลอดภัย
- **ใช้เวลาไม่นาน** - Migration จะเสร็จภายใน 1-2 วินาที
- **ไม่กระทบ Production** - การเพิ่ม column และ enum value ไม่ทำให้ระบบหยุดทำงาน

---

**หากมีคำถามหรือติดปัญหา แจ้งได้เลยครับ!** 🚀
