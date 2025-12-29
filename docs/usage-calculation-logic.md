# Meetdup Usage Calculation Business Logic

## สารบัญ
1. [ภาพรวมระบบ](#1-ภาพรวมระบบ)
2. [ประเภท Usage ทั้งหมด](#2-ประเภท-usage-ทั้งหมด)
3. [วิธีการนับ Usage แต่ละประเภท](#3-วิธีการนับ-usage-แต่ละประเภท)
4. [ข้อจำกัดตามแพลน](#4-ข้อจำกัดตามแพลน)
5. [Trial Period Logic](#5-trial-period-logic)
6. [สถานะปัจจุบัน vs. งานที่ต้องทำ](#6-สถานะปัจจุบัน-vs-งานที่ต้องทำ)
7. [Technical Reference](#7-technical-reference)

---

## 1. ภาพรวมระบบ

### หลักการทำงาน
ระบบ Usage Tracking ของ Meetdup ออกแบบมาเพื่อ:
- **ติดตามการใช้งาน** ทรัพยากรของแต่ละ tenant แบบ real-time
- **บังคับใช้ limit** ตามแพลนที่สมัคร (Free/Starter/Pro)
- **แจ้งเตือน** เมื่อใกล้ถึง limit (warning 80%, critical 90%)
- **รองรับ billing** โดยเฉพาะ AI usage ที่คิดค่าใช้จ่ายตาม query count

### Architecture Overview
```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │ useUsage     │  │ useCheck     │  │ UsageWarning │       │
│  │ Warnings()   │  │ Limit()      │  │ Banner       │       │
│  └──────┬───────┘  └──────┬───────┘  └──────────────┘       │
└─────────┼─────────────────┼─────────────────────────────────┘
          │                 │
          ▼                 ▼
┌─────────────────────────────────────────────────────────────┐
│                      API Layer                               │
│  GET /api/subscriptions/warnings/:tenantId                   │
│  GET /api/subscriptions/check-limit/:tenantId/:limitType     │
└─────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────┐
│               subscriptionService.ts                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │ getUsage     │  │ checkLimit   │  │ getWarning   │       │
│  │ Limits()     │  │ Exceeded()   │  │ Level()      │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
└─────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────┐
│                    Database                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │ participants │  │ meetings     │  │ ai_          │       │
│  │              │  │              │  │ conversations│       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. ประเภท Usage ทั้งหมด

| ประเภท | คำอธิบาย | หน่วยนับ | ช่วงเวลา |
|--------|---------|---------|----------|
| **Members** | จำนวนสมาชิกที่ active | คน | Lifetime (นับสะสม) |
| **Meetings** | จำนวนการประชุม | ครั้ง | ต่อเดือน |
| **AI Queries** | จำนวนคำถาม AI | queries | ต่อเดือน |
| **Storage** | พื้นที่เก็บข้อมูล | MB | Lifetime (นับสะสม) |

### หมายเหตุสำคัญ
- **Members** และ **Storage** เป็น lifetime limit (ไม่ reset ทุกเดือน)
- **Meetings** และ **AI Queries** reset ทุกเดือน (นับเฉพาะเดือนปัจจุบัน)

---

## 3. วิธีการนับ Usage แต่ละประเภท

### 3.1 Members Count

**หลักการ:** นับ participants ที่มี status = 'active' ของ tenant

```sql
SELECT COUNT(*)
FROM participants
WHERE tenant_id = :tenantId
  AND status = 'active'
```

**Code Reference:** `server/stripe/subscriptionService.ts` - `getUsageLimits()`

```typescript
// Members: count active participants
const { count: memberCount } = await supabaseAdmin
  .from('participants')
  .select('*', { count: 'exact', head: true })
  .eq('tenant_id', tenantId)
  .eq('status', 'active');
```

**ข้อควรระวัง:**
- นับเฉพาะ `status = 'active'` (ไม่รวม visitor, inactive)
- ถ้ามี member ที่ถูก soft delete ต้องไม่นับรวม

---

### 3.2 Meetings Count

**หลักการ:** นับ meetings ของ tenant ที่มีวันจัดประชุมตั้งแต่วันที่ 1 ของเดือนปัจจุบันเป็นต้นไป

```sql
SELECT COUNT(*)
FROM meetings
WHERE tenant_id = :tenantId
  AND date >= :startOfMonth
```

**Code Reference:**

```typescript
// Meetings: count meetings from start of current month onwards
const startOfMonth = new Date();
startOfMonth.setDate(1);
startOfMonth.setHours(0, 0, 0, 0);

const { count: meetingCount } = await supabaseAdmin
  .from('meetings')
  .select('*', { count: 'exact', head: true })
  .eq('tenant_id', tenantId)
  .gte('date', startOfMonth.toISOString());
```

**ข้อควรระวัง:**
- ใช้ `date` field ของ meeting (วันที่จัดประชุม)
- Query ใช้เฉพาะ lower bound (>= startOfMonth) ไม่มี upper bound
- Reset count อัตโนมัติเมื่อเริ่มเดือนใหม่ (startOfMonth เปลี่ยน)

---

### 3.3 AI Queries Count

**หลักการ:** นับ user messages ใน `ai_conversations` table ของเดือนปัจจุบัน

```sql
SELECT COUNT(*)
FROM ai_conversations
WHERE tenant_id = :tenantId
  AND role = 'user'
  AND created_at >= :startOfMonth
```

**แหล่งที่มาของ AI Queries:**
1. **LINE AI Bot** - ผู้ใช้ถามคำถามผ่าน LINE → log ก่อนส่ง n8n webhook
2. **Growth Co-Pilot** - Admin ใช้ AI assistant ใน web app → log ก่อนเรียก OpenAI

**Code Reference:**

```typescript
// AI Queries: count user messages this month
const { count: aiQueryCount } = await supabaseAdmin
  .from('ai_conversations')
  .select('*', { count: 'exact', head: true })
  .eq('tenant_id', tenantId)
  .eq('role', 'user')
  .gte('created_at', startOfMonth.toISOString());
```

**การ Log AI Usage:**

```typescript
// ใน n8nAIQuery.ts (LINE AI Bot)
await supabaseAdmin
  .from('ai_conversations')
  .insert({
    tenant_id: tenantId,
    line_user_id: lineUserId,
    role: 'user',
    content: message
  });

// ใน growthCopilot.ts (Growth Co-Pilot)
await supabaseAdmin
  .from('ai_conversations')
  .insert({
    tenant_id: tenantId,
    line_user_id: `system:growth_copilot:${Date.now()}`,
    role: 'user',
    content: userMessage
  });
```

**ข้อควรระวัง:**
- นับเฉพาะ `role = 'user'` (ไม่รวม assistant response)
- Growth Co-Pilot ใช้ prefix `system:` เพื่อแยกจาก LINE user IDs
- Log ก่อนเรียก API เพื่อให้ tracking แม้ API fail

---

### 3.4 Storage Usage

**หลักการ:** วัดจาก Supabase Storage API โดยรวมขนาดไฟล์ทั้งหมดของ tenant

**สถานะ:** ยังไม่ได้ implement

**แผนการ implement:**
```typescript
// ดึงข้อมูลจาก Supabase Storage
const folders = ['avatars', 'rich-menu-images', 'business-cards'];
let totalBytes = 0;

for (const folder of folders) {
  const { data } = await supabaseAdmin.storage
    .from(folder)
    .list(tenantId);
  
  for (const file of data || []) {
    totalBytes += file.metadata?.size || 0;
  }
}

const storageMB = Math.round(totalBytes / (1024 * 1024));
```

---

## 4. ข้อจำกัดตามแพลน

### Plan Limits Matrix

| Resource | Free | Starter ($19.90/mo) | Pro ($49.90/mo) |
|----------|------|---------------------|-----------------|
| **Members** | 10 | 30 | Unlimited |
| **Meetings/month** | 4 | 8 | Unlimited |
| **AI Queries/month** | 0 | 50 | 500 |
| **Storage** | 1 GB | 5 GB | 50 GB |

**หมายเหตุ:** 
- Free plan ไม่มี AI queries (ต้อง upgrade เพื่อใช้งาน)
- Pro plan มี unlimited members และ meetings (ใช้ค่า -1 ใน database)

### Warning Levels

| Level | Threshold | Action |
|-------|-----------|--------|
| `ok` | < 80% | ไม่แจ้งเตือน |
| `warning` | 80-89% | แสดง warning banner สีเหลือง |
| `critical` | 90-99% | แสดง warning banner สีแดง |
| `exceeded` | >= 100% | Block การสร้าง resource ใหม่ |

**Code Reference:**

```typescript
getWarningLevel(usage: number, limit: number): 'ok' | 'warning' | 'critical' | 'exceeded' {
  if (limit === -1) return 'ok'; // Unlimited
  const percentage = (usage / limit) * 100;
  
  if (percentage >= 100) return 'exceeded';
  if (percentage >= 90) return 'critical';
  if (percentage >= 80) return 'warning';
  return 'ok';
}
```

### Limit Enforcement

เมื่อ tenant เกิน limit ระบบจะ:
1. **Block การสร้าง resource ใหม่** (return 403 LIMIT_EXCEEDED)
2. **แสดง error message** ให้ผู้ใช้ทราบ
3. **แนะนำให้ upgrade plan**

```typescript
// Middleware example
if (await subscriptionService.checkLimitExceeded(tenantId, 'members')) {
  return res.status(403).json({
    error: 'LIMIT_EXCEEDED',
    message: 'Member limit reached. Please upgrade your plan.',
    limitType: 'members'
  });
}
```

---

## 5. Trial Period Logic

### 5.1 Trial Duration
- **ระยะเวลา:** 30 วัน
- **Plan ระหว่าง trial:** ได้รับ features และ limits ของ plan ที่เลือก (Starter หรือ Pro)

### 5.2 Trial Notifications

ระบบส่ง LINE notification แจ้งเตือน admins:

| Days Before Expiry | Notification Type |
|--------------------|-------------------|
| 7 วัน | `trial_expiring_7d` |
| 3 วัน | `trial_expiring_3d` |
| 1 วัน | `trial_expiring_1d` |

**Notification Content:**
- ชื่อ Chapter
- จำนวนวันที่เหลือ
- Link ไปหน้า Billing Settings

### 5.3 Trial Expiration

เมื่อ trial หมดอายุ:
1. **Status เปลี่ยน:** `trialing` → `canceled`
2. **Plan เปลี่ยน:** → `free`
3. **Limits ลด:** ตาม Free plan
4. **แจ้ง Admin:** ส่ง LINE notification

**Code Reference:**

```typescript
// Auto-downgrade expired trials
const { error: updateError } = await supabaseAdmin
  .from('tenant_subscriptions')
  .update({
    status: 'canceled',
    plan_id: 'free',
    stripe_price_id: null,
    updated_at: now.toISOString()
  })
  .eq('tenant_id', trial.tenant_id);
```

### 5.4 Notification Deduplication

ใช้ `notification_logs` table ป้องกันส่งซ้ำ:

```sql
-- Check if already sent today
SELECT id FROM notification_logs
WHERE tenant_id = :tenantId
  AND notification_type = 'trial_expiring_7d'
  AND created_at >= :todayStart
LIMIT 1;
```

---

## 6. สถานะปัจจุบัน vs. งานที่ต้องทำ

### สิ่งที่ทำเสร็จแล้ว

| Feature | Status | Files |
|---------|--------|-------|
| Members count | Done | `subscriptionService.ts` |
| Meetings count | Done | `subscriptionService.ts` |
| AI Queries count | Done | `subscriptionService.ts` |
| AI logging (LINE Bot) | Done | `n8nAIQuery.ts` |
| AI logging (Growth Co-Pilot) | Done | `growthCopilot.ts` |
| Warning levels calculation | Done | `subscriptionService.ts` |
| Limit enforcement middleware | Done | `usageLimitMiddleware.ts` |
| Trial notifications | Done | `trialNotificationService.ts` |
| Trial auto-downgrade | Done | `trialNotificationService.ts` |
| Cron job endpoints | Done | `scheduledJobs.ts` |
| Frontend hooks | Done | `usePlanConfig.ts` |

### งานที่ยังไม่ได้ทำ

| Feature | Priority | Notes |
|---------|----------|-------|
| Storage usage tracking | Medium | ต้องใช้ Supabase Storage API |
| Warning UI banners | High | แสดง alert เมื่อ usage >= 80% |
| Usage dashboard | High | หน้า Billing Settings redesign |
| Apply middleware to routes | Medium | ใส่ middleware ใน member/meeting routes |

---

## 7. Technical Reference

### 7.1 Core Files

| File | Purpose |
|------|---------|
| `server/stripe/subscriptionService.ts` | Usage calculation, limit checking |
| `server/middleware/usageLimitMiddleware.ts` | Route-level limit enforcement |
| `server/routes/subscriptions.ts` | API endpoints for warnings/limits |
| `server/services/notifications/trialNotificationService.ts` | Trial notifications |
| `server/routes/scheduledJobs.ts` | Cron job endpoints |
| `client/src/hooks/usePlanConfig.ts` | Frontend hooks |

### 7.2 Database Tables

| Table | Purpose |
|-------|---------|
| `participants` | Member count source |
| `meetings` | Meeting count source |
| `ai_conversations` | AI query count source |
| `tenant_subscriptions` | Plan/trial status |
| `plan_limits` | Limit values per plan |
| `notification_logs` | Notification deduplication |

### 7.3 API Endpoints

```
GET /api/subscriptions/warnings/:tenantId
Response: { warnings: [{ limitType, usage, limit, percentage, level }] }

GET /api/subscriptions/check-limit/:tenantId/:limitType
Response: { exceeded, usage, limit, percentage }

POST /api/cron/trial-notifications
Header: Authorization: Bearer <CRON_SECRET>
Response: { results: [...] }

POST /api/cron/trial-downgrade
Header: Authorization: Bearer <CRON_SECRET>
Response: { results: [...] }
```

### 7.4 Environment Variables

| Variable | Purpose |
|----------|---------|
| `CRON_SECRET` | Authentication for cron endpoints |
| `SUPABASE_URL` | Supabase API URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase admin access |

---

## Appendix: Usage Calculation Pseudocode

```
function getUsageLimits(tenantId):
    # Get tenant's current plan
    subscription = getSubscription(tenantId)
    planId = subscription.plan_id
    
    # Get plan limits from database
    limits = getPlanLimits(planId)
    
    # Calculate current usage
    startOfMonth = getStartOfMonth()
    
    memberCount = COUNT(participants WHERE tenant_id = tenantId AND status = 'active')
    meetingCount = COUNT(meetings WHERE tenant_id = tenantId AND date >= startOfMonth)
    aiQueryCount = COUNT(ai_conversations WHERE tenant_id = tenantId AND role = 'user' AND created_at >= startOfMonth)
    storageUsage = calculateStorageUsage(tenantId)  # Not implemented yet
    
    return {
        plan: planId,
        members: { usage: memberCount, limit: limits.members },
        meetings: { usage: meetingCount, limit: limits.meetings },
        ai_queries: { usage: aiQueryCount, limit: limits.ai_queries },
        storage: { usage: storageUsage, limit: limits.storage }
    }

function checkLimitExceeded(tenantId, limitType):
    usage = getUsageLimits(tenantId)
    return usage[limitType].usage >= usage[limitType].limit

function getWarningLevel(usage, limit):
    if limit == -1: return 'ok'  # Unlimited
    percentage = (usage / limit) * 100
    if percentage >= 100: return 'exceeded'
    if percentage >= 90: return 'critical'
    if percentage >= 80: return 'warning'
    return 'ok'
```

---

*Last Updated: December 2024*
*Version: 1.0*
