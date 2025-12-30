# Lean Pipeline - Chapter Growth Pipeline System

## Overview

Lean Pipeline คือระบบติดตามการเปลี่ยน Visitor ให้เป็น Member ของ Chapter โดยใช้ 7 stages หลัก + 1 stage สำหรับ archive ออกแบบมาให้ใช้งานง่าย ลด complexity และมี automation ที่ชาญฉลาด

---

## Business Logic

### ทำไมต้อง 7 Stages?

เดิมระบบมี 12 stages ซึ่งทำให้:
- Admin สับสนว่าควรย้าย visitor ไปอยู่ stage ไหน
- มี stages ที่ซ้ำซ้อนกัน (เช่น prospect_qualified, invite_scheduled, rsvp_confirmed)
- ยากต่อการติดตามและวิเคราะห์ข้อมูล

**Lean Pipeline** ลดเหลือ 7 stages ที่สอดคล้องกับ workflow จริงของ Chapter:

| Stage | ความหมาย | Trigger |
|-------|----------|---------|
| **Lead** | รายชื่อใหม่ที่ได้รับมา | ลงทะเบียนผ่าน LIFF / Admin เพิ่ม |
| **Attended** | เข้าประชุมครั้งแรก | Check-in ครั้งแรก |
| **Revisit** | กลับมาประชุมซ้ำ | Check-in ≥2 ครั้ง หรือลงทะเบียนซ้ำ |
| **Follow-up** | กำลังติดตาม | Admin ย้ายมือ (Protected Stage) |
| **Application Submitted** | ยื่นใบสมัครแล้ว | Admin ย้ายมือ |
| **Active Member** | เป็นสมาชิกแล้ว | Convert เป็น member / Admin ย้าย |
| **สมาชิก Onboarding** | กำลังอบรม | Admin ย้ายมือ |
| **Archived** | ไม่ active แล้ว | Admin archive |

### Protected Stages (No-Backward Rule)

เมื่อ Visitor ถึง **Follow-up** ขึ้นไป จะถือว่าอยู่ใน "protected zone" - ระบบจะไม่ย้ายกลับไป stages ก่อนหน้าอัตโนมัติ

**ตัวอย่าง:**
- คน A อยู่ Follow-up → ลงทะเบียนประชุมใหม่ → **ยังอยู่ Follow-up** (ไม่กลับไป Lead)
- คน B อยู่ Attended → ลงทะเบียนประชุมใหม่ → **ย้ายไป Revisit** (ยังไม่ protected)

**Protected Stages:**
- Follow-up
- Application Submitted  
- Active Member
- Onboarding
- Archived

---

## Application Logic

### Auto-Sync Rules

ระบบจะ sync ข้อมูลไปยัง Pipeline อัตโนมัติเมื่อเกิด events ต่างๆ:

#### 1. Registration → Lead / Revisit
```
When: Visitor ลงทะเบียนเข้าประชุม
Logic:
  - ถ้าไม่มี record ใน pipeline → สร้างใหม่ที่ Lead
  - ถ้ามี record อยู่แล้ว:
    - อยู่ Lead/Attended → ย้ายไป Revisit
    - อยู่ Follow-up+ → ไม่ย้าย (protected)
```

#### 2. Check-in → Attended / Revisit
```
When: Visitor check-in เข้าประชุม
Logic:
  - ถ้าอยู่ Lead + check-in ครั้งแรก → ย้ายไป Attended
  - ถ้าอยู่ Attended + meetings_attended ≥ 2 → ย้ายไป Revisit
  - ถ้าอยู่ Follow-up+ → ไม่ย้าย (protected)
```

#### 3. Member Conversion → Active Member
```
When: Visitor ถูก convert เป็น member (status = 'member')
Logic:
  - ย้ายไป Active Member ทันที
  - ไม่ว่าจะอยู่ stage ไหนก็ตาม
```

### Sync Flow Diagram

```
Registration Event
      │
      ▼
┌─────────────────┐
│ Check existing  │
│ pipeline record │
└────────┬────────┘
         │
    ┌────┴────┐
    │ Exists? │
    └────┬────┘
         │
    No ──┤── Yes
         │      │
         ▼      ▼
   ┌─────────┐  ┌──────────────┐
   │ Create  │  │ Is Protected?│
   │ @ Lead  │  └──────┬───────┘
   └─────────┘         │
                  No ──┤── Yes
                       │      │
                       ▼      ▼
                 ┌─────────┐  ┌──────────┐
                 │ Move to │  │ No change│
                 │ Revisit │  └──────────┘
                 └─────────┘
```

---

## Sub-Statuses

บาง stages มี sub-status เพื่อแบ่งย่อยสถานะภายใน:

### Follow-up Sub-Statuses
| Sub-Status | ความหมาย |
|------------|----------|
| `contacted` | ติดต่อแล้ว |
| `interested` | สนใจ |
| `ready_to_apply` | พร้อมสมัคร |

### Application Submitted Sub-Statuses
| Sub-Status | ความหมาย |
|------------|----------|
| `pending_review` | รอตรวจสอบ |
| `qualification_check` | ตรวจคุณสมบัติ |
| `payment_pending` | รอชำระเงิน |
| `approved` | อนุมัติแล้ว |

### Onboarding Sub-Statuses
| Sub-Status | ความหมาย |
|------------|----------|
| `orientation` | ปฐมนิเทศ |
| `training` | อบรม |
| `completed` | เสร็จสิ้น |

---

## Admin Guide

### วิธีใช้งาน Pipeline

1. **ดู Pipeline Board**
   - ไปที่ Admin → Growth Pipeline
   - จะเห็น Kanban board แสดง 7 stages

2. **ย้าย Stage Manual**
   - คลิกที่ card ของ visitor
   - เลือก "Move to Stage"
   - เลือก stage ปลายทาง

3. **Set Sub-Status**
   - คลิกที่ card
   - เลือก sub-status ที่ต้องการ (ถ้ามี)

4. **Add Notes**
   - คลิกที่ card
   - เพิ่ม notes สำหรับ follow-up

### Best Practices

1. **ปล่อยให้ระบบ auto-sync**
   - Lead → Attended → Revisit จะถูกจัดการอัตโนมัติ
   - Admin focus ที่ Follow-up เป็นต้นไป

2. **ใช้ Sub-Status**
   - ช่วยให้ทีมรู้ว่าแต่ละคนอยู่ขั้นตอนไหน
   - ง่ายต่อการ handover งาน

3. **Archive ไม่ใช่ลบ**
   - visitor ที่ไม่สนใจ/ติดต่อไม่ได้ → Archive
   - ข้อมูลยังอยู่ใน history

---

## Technical Reference

### Database Tables

```sql
-- Stages definition
pipeline_stages (
  stage_key VARCHAR PRIMARY KEY,  -- e.g., 'lead', 'attended'
  stage_name VARCHAR,
  stage_name_th VARCHAR,
  stage_order INTEGER,
  stage_group VARCHAR,
  color VARCHAR,
  icon VARCHAR,
  is_active BOOLEAN,
  is_terminal BOOLEAN,
  auto_move_days INTEGER
)

-- Sub-statuses for each stage
pipeline_sub_statuses (
  stage_key VARCHAR,
  sub_status_key VARCHAR,
  sub_status_name VARCHAR,
  sub_status_name_th VARCHAR,
  display_order INTEGER,
  color VARCHAR
)

-- Pipeline records (one per visitor per tenant)
pipeline_records (
  id UUID PRIMARY KEY,
  tenant_id UUID,
  visitor_id UUID,           -- participant_id of visitor
  participant_id UUID,       -- linked after conversion
  full_name VARCHAR,
  phone VARCHAR,
  email VARCHAR,
  line_id VARCHAR,
  current_stage VARCHAR,
  current_sub_status VARCHAR,
  stage_entered_at TIMESTAMP,
  source VARCHAR,
  source_details TEXT,
  referrer_participant_id UUID,
  first_meeting_id UUID,
  last_meeting_id UUID,
  last_meeting_date DATE,
  meetings_attended INTEGER,
  notes TEXT,
  archived_at TIMESTAMP,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)

-- Transition history
pipeline_transitions (
  id UUID PRIMARY KEY,
  pipeline_record_id UUID,
  from_stage VARCHAR,
  to_stage VARCHAR,
  from_sub_status VARCHAR,
  to_sub_status VARCHAR,
  changed_by_user_id UUID,
  is_automatic BOOLEAN,
  change_reason TEXT,
  created_at TIMESTAMP
)
```

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/pipeline/stages` | Get all active stages |
| GET | `/api/pipeline/records?tenant_id=X` | Get pipeline records |
| PATCH | `/api/pipeline/records/:id/stage` | Move to new stage |
| PATCH | `/api/pipeline/records/:id/sub-status` | Update sub-status |
| POST | `/api/pipeline/records/:id/archive` | Archive record |

### Sync Functions

Location: `server/services/pipelineSync.ts`

```typescript
// Called when visitor registers for meeting
syncVisitorToPipeline({
  tenant_id: string,
  participant_id: string,
  meeting_id: string,
  source?: string,
  source_details?: string,
  referrer_participant_id?: string
})

// Called when visitor checks in
syncCheckInToPipeline({
  tenant_id: string,
  participant_id: string,
  meeting_id: string
})

// Called when visitor is converted to member
syncMemberStatusToPipeline({
  tenant_id: string,
  participant_id: string,
  source?: string
})
```

### Stage Order Constants

```typescript
const STAGE_ORDER = {
  lead: 1,
  attended: 2,
  revisit: 3,
  follow_up: 4,
  application_submitted: 5,
  active_member: 6,
  onboarding: 7,
  archived: 8
};

const PROTECTED_STAGES = [
  'follow_up',
  'application_submitted', 
  'active_member',
  'onboarding',
  'archived'
];
```

---

## Migration from Legacy Stages

หากมี data จาก stages เดิม จะถูก map อัตโนมัติ:

| Legacy Stage | → New Stage |
|-------------|-------------|
| lead_capture | lead |
| prospect_qualified | lead |
| invite_scheduled | lead |
| rsvp_confirmed | lead |
| attended_meeting | attended |
| application_approved | active_member |
| retention_watch | archived |
| follow_up | follow_up (unchanged) |
| application_submitted | application_submitted (unchanged) |
| onboarding | onboarding (unchanged) |

---

## Metrics & KPIs

### Conversion Funnel
```
Lead → Attended     : % First-time attendance
Attended → Revisit  : % Repeat visitors
Revisit → Follow-up : % Qualified leads
Follow-up → Applied : % Application rate
Applied → Member    : % Conversion rate
```

### Sample Queries

**Visitors by Stage:**
```sql
SELECT current_stage, COUNT(*) 
FROM pipeline_records 
WHERE tenant_id = '<tenant_id>' 
AND archived_at IS NULL
GROUP BY current_stage;
```

**Conversion Rate (Last 30 days):**
```sql
-- Conversion นับทั้ง active_member และ onboarding (เพราะทั้งสองเป็นสมาชิกแล้ว)
SELECT 
  COUNT(*) FILTER (WHERE current_stage IN ('active_member', 'onboarding')) as converted,
  COUNT(*) as total,
  ROUND(
    COUNT(*) FILTER (WHERE current_stage IN ('active_member', 'onboarding'))::numeric 
    / NULLIF(COUNT(*), 0) * 100, 1
  ) as conversion_rate
FROM pipeline_records
WHERE tenant_id = '<tenant_id>'
AND created_at >= NOW() - INTERVAL '30 days';
```

**Stale Leads (No activity > 14 days):**
```sql
SELECT full_name, current_stage, stage_entered_at
FROM pipeline_records
WHERE tenant_id = '<tenant_id>'
AND current_stage IN ('lead', 'attended', 'revisit')
AND stage_entered_at < NOW() - INTERVAL '14 days'
AND archived_at IS NULL
ORDER BY stage_entered_at;
```

---

## FAQ

**Q: ถ้า visitor ลงทะเบียนแล้วไม่มา check-in จะอยู่ stage ไหน?**
A: จะอยู่ที่ Lead จนกว่าจะ check-in หรือ admin ย้ายเอง

**Q: ถ้า member เก่าลงทะเบียนมาเป็น visitor จะเกิดอะไร?**
A: ระบบจะไม่สร้าง pipeline record ใหม่ เพราะเขาเป็น member แล้ว

**Q: ทำไมบาง visitor ไม่เห็นใน pipeline?**
A: อาจเป็นเพราะถูก archive ไปแล้ว หรือลงทะเบียนก่อนที่จะมีระบบ pipeline

**Q: สามารถย้าย stage ย้อนกลับได้ไหม?**
A: Admin สามารถย้าย manual ได้ทุก stage แต่ auto-sync จะไม่ย้อนกลับถ้าอยู่ protected zone
