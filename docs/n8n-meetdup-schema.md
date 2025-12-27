# Meetdup Database Schema for n8n Text-to-SQL

Use this schema information in the n8n AI Agent system prompt.

## Core Tables

### tenants
Multi-tenant organization table.
```sql
tenant_id       UUID PRIMARY KEY
tenant_name     TEXT          -- Chapter name (e.g., "BNI The World")
subdomain       TEXT          -- URL subdomain
line_official_url TEXT        -- LINE Official Account URL
created_at      TIMESTAMPTZ
updated_at      TIMESTAMPTZ
```

### meetings
Chapter meetings/events.
```sql
meeting_id      UUID PRIMARY KEY
tenant_id       UUID REFERENCES tenants(tenant_id)
meeting_name    TEXT          -- Meeting title
meeting_date    DATE          -- Meeting date
meeting_time    TIME          -- Meeting start time (e.g., "06:30:00")
venue           TEXT          -- Venue name
location_lat    DECIMAL       -- GPS latitude
location_lng    DECIMAL       -- GPS longitude
location_details TEXT         -- Full address
description     TEXT          -- HTML description
visitor_fee     DECIMAL       -- Fee for visitors (e.g., 800.00)
theme           TEXT          -- Meeting theme
ontime_closed_at TIMESTAMPTZ  -- When on-time check-in closed
meeting_closed_at TIMESTAMPTZ -- When meeting fully closed
recurrence_pattern TEXT       -- "none", "weekly", "monthly"
created_at      TIMESTAMPTZ
updated_at      TIMESTAMPTZ
```

### participants
Members and visitors of a chapter.
```sql
participant_id  UUID PRIMARY KEY
tenant_id       UUID REFERENCES tenants(tenant_id)
full_name_th    TEXT          -- Full name in Thai
full_name_en    TEXT          -- Full name in English
nickname_th     TEXT          -- Nickname in Thai (e.g., "กบ", "โอ๋")
nickname_en     TEXT          -- Nickname in English
email           TEXT
phone           TEXT          -- Phone number
company         TEXT          -- Company name
position        TEXT          -- Job title
business_type   TEXT          -- Business category name
business_type_code TEXT       -- Business category code (2-digit)
status          TEXT          -- "member", "visitor", "inactive"
member_type     TEXT          -- "regular", "substitute"
line_user_id    TEXT          -- LINE User ID (for LINE integration)
line_id         TEXT          -- LINE ID (display name)
user_id         UUID          -- Linked user account
photo_url       TEXT          -- Profile photo URL
website_url     TEXT
facebook_url    TEXT
instagram_url   TEXT
linkedin_url    TEXT
tagline         TEXT          -- Business tagline
tags            TEXT[]        -- Array of business tags
joined_date     DATE
referred_by_participant_id UUID -- Who referred this person
created_at      TIMESTAMPTZ
updated_at      TIMESTAMPTZ
```

### checkins
Meeting attendance records.
```sql
checkin_id      UUID PRIMARY KEY
tenant_id       UUID REFERENCES tenants(tenant_id)
meeting_id      UUID REFERENCES meetings(meeting_id)
participant_id  UUID REFERENCES participants(participant_id)
checkin_time    TIMESTAMPTZ   -- When they checked in
status          TEXT          -- "approved", "pending", "rejected"
is_late         BOOLEAN       -- Whether they arrived late
checkin_method  TEXT          -- "qr", "manual", "pos"
notes           TEXT
```

### visitor_meeting_fees
Visitor fee tracking per meeting.
```sql
fee_id          UUID PRIMARY KEY
tenant_id       UUID REFERENCES tenants(tenant_id)
meeting_id      UUID REFERENCES meetings(meeting_id)
participant_id  UUID REFERENCES participants(participant_id)
amount_due      DECIMAL       -- Fee amount (e.g., 800)
amount_paid     DECIMAL       -- Amount paid
status          TEXT          -- "pending", "paid", "waived"
paid_at         TIMESTAMPTZ   -- When payment was made
notes           TEXT
created_at      TIMESTAMPTZ
updated_at      TIMESTAMPTZ
```

## Important Relationships

- All tables have `tenant_id` for multi-tenant isolation
- `checkins` links `participants` to `meetings`
- `visitor_meeting_fees` tracks visitor **registration** AND payments per meeting

### Critical: Counting Visitors
- **Visitor Registration** = records in `visitor_meeting_fees` table for a specific meeting
- **Visitor Check-in** = visitor_meeting_fees records where participant also has a checkin record
- **DO NOT use** `participants.status = 'visitor'` to count meeting visitors
- `participants.status` only indicates the person's general status, NOT their registration for a specific meeting

## Common Query Patterns

### Get today's meeting
```sql
SELECT * FROM meetings 
WHERE tenant_id = $tenant_id 
AND meeting_date = CURRENT_DATE
ORDER BY meeting_time ASC 
LIMIT 1;
```

### Count attendees for a meeting
```sql
SELECT 
  COUNT(*) FILTER (WHERE c.status = 'approved') as checked_in,
  COUNT(*) FILTER (WHERE c.is_late = false) as on_time,
  COUNT(*) FILTER (WHERE c.is_late = true) as late
FROM checkins c
WHERE c.meeting_id = $meeting_id 
AND c.tenant_id = $tenant_id;
```

### List members who attended
```sql
SELECT p.full_name_th, p.nickname_th, c.checkin_time, c.is_late
FROM checkins c
JOIN participants p ON c.participant_id = p.participant_id
WHERE c.meeting_id = $meeting_id 
AND c.tenant_id = $tenant_id
AND c.status = 'approved'
ORDER BY c.checkin_time;
```

### Find member by name/nickname
```sql
SELECT participant_id, full_name_th, nickname_th, status
FROM participants
WHERE tenant_id = $tenant_id
AND (
  nickname_th ILIKE '%search_term%'
  OR nickname_en ILIKE '%search_term%'
  OR full_name_th ILIKE '%search_term%'
  OR full_name_en ILIKE '%search_term%'
)
AND status = 'member';
```

### Unpaid visitor fees for a meeting
```sql
SELECT p.full_name_th, p.nickname_th, p.phone, v.amount_due
FROM visitor_meeting_fees v
JOIN participants p ON v.participant_id = p.participant_id
WHERE v.meeting_id = $meeting_id
AND v.tenant_id = $tenant_id
AND v.status = 'pending';
```

### Visitor statistics for a meeting (CORRECT WAY)
```sql
WITH visitor_stats AS (
  SELECT 
    COUNT(*) as registered,
    COUNT(*) FILTER (WHERE v.participant_id IN (
      SELECT participant_id FROM checkins WHERE meeting_id = $meeting_id
    )) as checked_in
  FROM visitor_meeting_fees v
  WHERE v.tenant_id = $tenant_id AND v.meeting_id = $meeting_id
)
SELECT registered, checked_in, (registered - checked_in) as no_show 
FROM visitor_stats;
```

### Visitor list with check-in status
```sql
SELECT 
  p.full_name_th, 
  p.nickname_th, 
  v.amount_due,
  v.status as payment_status,
  CASE WHEN c.checkin_id IS NOT NULL THEN 'checked_in' ELSE 'not_checked_in' END as checkin_status
FROM visitor_meeting_fees v
JOIN participants p ON v.participant_id = p.participant_id
LEFT JOIN checkins c ON v.participant_id = c.participant_id AND v.meeting_id = c.meeting_id
WHERE v.tenant_id = $tenant_id AND v.meeting_id = $meeting_id;
```

## Security Notes

1. **ALWAYS filter by tenant_id** - Never query across tenants
2. **Use read-only queries** - No INSERT/UPDATE/DELETE
3. **Limit results** - Add LIMIT to prevent huge result sets
4. **Protect PII** - Don't expose phone/email unless user is admin
