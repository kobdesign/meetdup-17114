# AI Growth Co-Pilot

## Overview

AI Growth Co-Pilot is a predictive analytics dashboard that serves as an intelligent advisor for chapter administrators. It analyzes historical meeting attendance, visitor patterns, and member engagement data to provide actionable insights and early warnings about chapter health.

**Goal:** Transform raw chapter data into strategic guidance that helps admins proactively manage member retention, boost engagement, and grow their chapter.

---

## Core Principles

### 1. Proactive vs Reactive Management
Traditional chapter management is reactive - admins notice problems only after members have already disengaged. AI Growth Co-Pilot shifts this to proactive management by identifying at-risk members **before** they leave.

### 2. Data-Driven Decision Making
Instead of relying on intuition or anecdotal observations, the system uses quantitative metrics derived from actual meeting data to guide decisions.

### 3. Actionable Intelligence
Every insight generated includes specific recommendations. The system doesn't just report problems - it suggests solutions.

### 4. Trend Analysis Over Snapshots
The system compares recent periods against historical periods to identify trends (improving/declining/stable) rather than just showing current state.

---

## Feature Components

### 1. Churn Risk Scoring

**Purpose:** Identify members at risk of disengaging or leaving the chapter.

**Data Sources:**
- `participants` - Active member list
- `meetings` - Recent 6 meetings
- `meeting_attendance` - Check-in records per member

**Calculation Logic:**

```
Risk Score = Sum of Risk Factors (max 100)

Risk Factors:
├── Low Attendance Rate (<50%): +40 points
├── Moderate Attendance (50-75%): +20 points  
├── No Recent Attendance Record: +30 points
└── 3+ Consecutive Absences: +30 points

Risk Level Classification:
├── HIGH: score >= 60
├── MEDIUM: score >= 30
└── LOW: score < 30 (filtered out, not shown)
```

**Example:**
- Member A: 40% attendance + absent 3 meetings = 40 + 30 = 70 (HIGH)
- Member B: 60% attendance, attended last meeting = 20 (MEDIUM)
- Member C: 85% attendance, regular = 0 (LOW, not displayed)

**Output:**
```typescript
interface ChurnRiskMember {
  participant_id: string;
  full_name_th: string;
  risk_score: number;          // 0-100
  risk_level: "high" | "medium" | "low";
  reasons: string[];           // Human-readable explanations
  last_attendance: string;     // Last check-in timestamp
  attendance_rate: number;     // Percentage
}
```

---

### 2. Growth Insights

**Purpose:** Surface patterns and trends from chapter data as categorized insights.

**Data Sources:**
- `meetings` - Split into "recent" (last 4) and "older" (previous 4)
- `meeting_attendance` - Attendance records
- `meeting_registrations` - Visitor registrations
- `chapter_goals` - Chapter-specific targets

**Insight Types:**

| Type | Icon Color | Purpose |
|------|------------|---------|
| `positive` | Green | Celebrate wins, reinforce good patterns |
| `warning` | Yellow | Flag concerning trends early |
| `action` | Blue | Suggest specific actions to take |

**Calculation Logic:**

**Visitor Growth/Decline:**
```
recent_visitors = count visitors in last 4 meetings
older_visitors = count visitors in previous 4 meetings

// Guard: Only compare if older period has data
if recent > older AND older > 0: 
  growth_rate = (recent - older) / older * 100
  → Generate "positive" insight with trend "up"
  
if recent < older AND older > 0:
  → Generate "warning" insight with trend "down"
```

**Attendance Analysis:**
```
avg_attendance = total_present / meeting_count
attendance_rate = avg_attendance / total_members * 100

if rate >= 80%: → "positive" (Strong Attendance)
if rate < 60%: → "action" (Boost Attendance)
// Note: 60-80% range generates no insight
```

**Goal Progress:**
```
if chapter_goals.visitor_goal exists:
  if recentVisitors >= visitor_goal * 0.8:
    → Generate "positive" insight (On Track for Visitor Goal)
// Note: Only positive case is implemented
```

**Default Insight:**
```
// Always added at end of insights list
→ "action" insight: "Member Engagement" 
   "Review members with low engagement scores..."
```

**Output:**
```typescript
interface GrowthInsight {
  type: "positive" | "warning" | "action";
  title: string;
  description: string;
  metric?: string;      // e.g., "85%", "12 visitors"
  trend?: "up" | "down" | "stable";
}
```

---

### 3. Meeting Playbook

**Purpose:** Provide a structured action plan for the next meeting.

**Data Sources:**
- Churn risk analysis results
- Attendance patterns
- Visitor flow data

**Generated Sections:**

| Section | Logic |
|---------|-------|
| **Focus Areas** | Dynamic: "Re-engage X high-risk members" (if any) + Fixed: "Recognition moment for top performers", "Networking time optimization" |
| **Member Highlights** | Count of members who attended ALL of last 4 meetings: "X members with perfect attendance" |
| **Visitor Strategy** | Based on avg visitors per meeting (see logic below) |
| **Action Items** | Dynamic based on churn risks + visitor strategy + Fixed: "Prepare member spotlight presentation" |

**Visitor Strategy Logic:**
```
avg_visitors = total_recent_visitors / meeting_count

if avg < 2:
  strategy = "Focus on member referrals - each member should invite 1 visitor"
  action = "Set visitor invitation goal for each member"

if 2 <= avg < 5:
  strategy = "Good visitor flow - focus on conversion to membership"
  action = "Follow up with recent visitors about membership"

if avg >= 5:
  strategy = "Strong pipeline - maintain quality of experience"
  action = "Ensure warm welcome protocol for all visitors"
```

**Output:**
```typescript
interface MeetingPlaybook {
  focus_areas: string[];      // Priority topics for meeting
  member_highlights: string[]; // Recognition opportunities
  visitor_strategy: string;   // Recruitment approach
  action_items: string[];     // Admin to-dos
}
```

---

### 4. Engagement Score

**Purpose:** Provide a single "health score" for the chapter with breakdowns.

**Score Components:**

| Component | Weight | Calculation | Cap |
|-----------|--------|-------------|-----|
| Attendance Score | 40% | (attended_count / (meeting_count × total_members)) × 100 | 100 |
| Visitor Score | 30% | (recent_visitors / (meeting_count × 3)) × 100 | 100 |
| Referral Score | 30% | (recent_visitors / total_members) × 50 | 100 |

**Formula:**
```
// Each component is calculated and capped at 100 first
attendance_score = min((attended / (meetings × members)) × 100, 100)
visitor_score = min((visitors / (meetings × 3)) × 100, 100)
referral_score = min((visitors / members) × 50, 100)

// Then weighted sum is calculated
overall_score = (attendance_score × 0.4) 
              + (visitor_score × 0.3) 
              + (min(referral_score, 100) × 0.3)

// Final overall also capped at 100
overall_score = min(overall_score, 100)
```

**Edge Case Handling:**
```
if no meetings: attendance_score = 0, visitor_score = 0
if no members: use 1 as divisor to prevent division by zero
```

**Trend Calculation:**
```
recent_attendance = sum of present in last 4 meetings
older_attendance = sum of present in previous 4 meetings

if recent > older × 1.1: trend = "improving"
if recent < older × 0.9: trend = "declining"
else: trend = "stable"
```

**Output:**
```typescript
interface EngagementScore {
  overall_score: number;      // 0-100, composite health metric
  attendance_score: number;   // Member participation rate
  visitor_score: number;      // Visitor pipeline health
  referral_score: number;     // Member contribution to growth
  trend: "improving" | "declining" | "stable";
}
```

---

### 5. AI Summary

**Purpose:** Generate a natural-language executive summary using GPT-4.

**Input to AI:**
- Engagement scores with trend
- High/Medium risk member counts
- Key insights list
- Focus areas

**Prompt Template:**
```
You are an AI Growth Co-Pilot for a business networking chapter.
Analyze the following data and provide a brief, actionable summary 
(2-3 sentences) for the chapter admin:

Chapter Engagement Score: {overall_score}/100 ({trend})
- Attendance Score: {attendance_score}%
- Visitor Score: {visitor_score}%

High-Risk Members: {high_risk_count}
Medium-Risk Members: {medium_risk_count}

Key Insights:
{insights_list}

Focus Areas:
{focus_areas}

Provide a concise, encouraging summary with the most important 
action item. Use simple language.
```

**Model:** GPT-4o-mini (fast, cost-effective)
**Max Tokens:** 200
**Temperature:** 0.7 (balanced creativity/consistency)

---

## Data Flow Architecture

```
┌─────────────────┐
│   API Request   │
│ GET /api/ai/    │
│ growth-copilot/ │
│ {tenantId}      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ getChapterStats │
│ (Supabase)      │
├─────────────────┤
│ - participants  │
│ - meetings (12) │
│ - attendance    │
│ - visitors      │
│ - chapter_goals │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────┐
│         Parallel Calculations        │
├──────────┬──────────┬───────────────┤
│ Churn    │ Growth   │ Engagement    │
│ Risks    │ Insights │ Score         │
└────┬─────┴────┬─────┴───────┬───────┘
     │          │             │
     └──────────┴──────────┬──┘
                           │
                           ▼
              ┌────────────────────┐
              │ generatePlaybook   │
              │ (uses churn data)  │
              └─────────┬──────────┘
                        │
                        ▼
              ┌────────────────────┐
              │ generateAISummary  │
              │ (OpenAI GPT-4o)    │
              └─────────┬──────────┘
                        │
                        ▼
              ┌────────────────────┐
              │   JSON Response    │
              │ GrowthCopilotData  │
              └────────────────────┘
```

---

## Business Logic Decisions

### Why 6 Meetings for Churn Risk?
- 6 meetings ≈ 1.5 months of weekly meetings
- Long enough to establish patterns, short enough for timely intervention
- 3 consecutive absences = 3 weeks, clear disengagement signal

### Why 4+4 Split for Trends?
- Comparing 4 recent vs 4 older meetings = ~2 months of context
- 4 meetings smooths out individual anomalies (holidays, sick days)
- Monthly pattern detection without too much lag

### Why Weight Attendance at 40%?
- Core value of networking groups is **showing up**
- Attendance directly correlates with member retention
- Visitors and referrals flow from active participation

### Why Cap Scores at 100?
- Prevents inflated metrics from outlier months
- Makes scores intuitive (percentage-like)
- Enables consistent progress bar visualization

---

## Edge Cases Handled

| Scenario | Handling |
|----------|----------|
| No meetings in 3 months | All scores = 0, trend = "stable" |
| No active members | Division guard prevents NaN |
| No visitors | Visitor/referral scores = 0 |
| No chapter goals | Goal-based insights skipped |
| OpenAI API fails | Fallback generic summary returned |

---

## Files Reference

| File | Purpose |
|------|---------|
| `server/services/growthCopilot.ts` | Core business logic and calculations |
| `server/routes/ai-copilot.ts` | API route handler |
| `client/src/pages/admin/AIGrowthCopilot.tsx` | Dashboard UI component |
| `client/src/components/layout/AdminLayout.tsx` | Navigation entry point |

---

## Future Enhancements

1. **Predictive Modeling** - ML model trained on historical data to predict churn probability
2. **Personalized Actions** - AI-generated specific outreach messages for at-risk members
3. **Benchmark Comparison** - Compare chapter performance against similar chapters
4. **Automated Alerts** - LINE notifications when risk scores spike
5. **Goal Recommendations** - AI-suggested realistic goals based on historical performance
