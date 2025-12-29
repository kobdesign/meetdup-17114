import OpenAI from "openai";
import { supabaseAdmin } from "../utils/supabaseClient";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export interface ChurnRiskMember {
  participant_id: string;
  full_name_th: string;
  nickname: string;
  risk_score: number;
  risk_level: "high" | "medium" | "low";
  reasons: string[];
  last_attendance: string | null;
  attendance_rate: number;
}

export interface GrowthInsight {
  type: "positive" | "warning" | "action";
  title: string;
  description: string;
  metric?: string;
  trend?: "up" | "down" | "stable";
}

export interface MeetingPlaybook {
  focus_areas: string[];
  member_highlights: string[];
  visitor_strategy: string;
  action_items: string[];
}

export interface EngagementScore {
  overall_score: number;
  attendance_score: number;
  visitor_score: number;
  referral_score: number;
  trend: "improving" | "declining" | "stable";
}

export interface GrowthCopilotData {
  churn_risks: ChurnRiskMember[];
  growth_insights: GrowthInsight[];
  meeting_playbook: MeetingPlaybook;
  engagement_score: EngagementScore;
  ai_summary: string;
}

async function getChapterStats(tenantId: string) {
  const now = new Date();
  const threeMonthsAgo = subMonths(now, 3);
  
  const { data: members, error: membersError } = await supabaseAdmin
    .from("participants")
    .select("participant_id, full_name_th, nickname_th, nickname, status, created_at")
    .eq("tenant_id", tenantId)
    .eq("status", "active");

  const { data: meetings, error: meetingsError } = await supabaseAdmin
    .from("meetings")
    .select("meeting_id, meeting_date, status")
    .eq("tenant_id", tenantId)
    .gte("meeting_date", format(threeMonthsAgo, "yyyy-MM-dd"))
    .order("meeting_date", { ascending: false })
    .limit(12);

  const meetingIds = meetings?.map(m => m.meeting_id) || [];
  
  const { data: attendance, error: attendanceError } = await supabaseAdmin
    .from("meeting_attendance")
    .select("meeting_id, participant_id, status, check_in_time")
    .in("meeting_id", meetingIds);

  const { data: visitors, error: visitorsError } = await supabaseAdmin
    .from("meeting_registrations")
    .select("meeting_id, visitor_name, status, created_at")
    .in("meeting_id", meetingIds);

  const { data: goals } = await supabaseAdmin
    .from("chapter_goals")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .single();

  return {
    members: members || [],
    meetings: meetings || [],
    attendance: attendance || [],
    visitors: visitors || [],
    goals: goals || null
  };
}

function calculateChurnRisks(
  members: any[],
  meetings: any[],
  attendance: any[]
): ChurnRiskMember[] {
  const recentMeetingIds = meetings.slice(0, 6).map(m => m.meeting_id);
  
  return members.map(member => {
    const memberAttendance = attendance.filter(
      a => a.participant_id === member.participant_id && recentMeetingIds.includes(a.meeting_id)
    );
    
    const totalMeetings = recentMeetingIds.length;
    const attended = memberAttendance.filter(a => a.status === "present" || a.status === "late").length;
    const attendanceRate = totalMeetings > 0 ? (attended / totalMeetings) * 100 : 0;
    
    const reasons: string[] = [];
    let riskScore = 0;
    
    if (attendanceRate < 50) {
      riskScore += 40;
      reasons.push(`Low attendance rate: ${attendanceRate.toFixed(0)}%`);
    } else if (attendanceRate < 75) {
      riskScore += 20;
      reasons.push(`Moderate attendance: ${attendanceRate.toFixed(0)}%`);
    }
    
    const lastAttendance = memberAttendance
      .filter(a => a.status === "present" || a.status === "late")
      .sort((a, b) => new Date(b.check_in_time || 0).getTime() - new Date(a.check_in_time || 0).getTime())[0];
    
    if (!lastAttendance) {
      riskScore += 30;
      reasons.push("No recent attendance record");
    }
    
    const consecutiveAbsent = recentMeetingIds.slice(0, 3).every(meetingId => {
      const att = memberAttendance.find(a => a.meeting_id === meetingId);
      return !att || att.status === "absent";
    });
    
    if (consecutiveAbsent && recentMeetingIds.length >= 3) {
      riskScore += 30;
      reasons.push("Absent for 3+ consecutive meetings");
    }
    
    let riskLevel: "high" | "medium" | "low" = "low";
    if (riskScore >= 60) riskLevel = "high";
    else if (riskScore >= 30) riskLevel = "medium";
    
    return {
      participant_id: member.participant_id,
      full_name_th: member.full_name_th || member.nickname_th || member.nickname || "Unknown",
      nickname: member.nickname_th || member.nickname || "",
      risk_score: Math.min(riskScore, 100),
      risk_level: riskLevel,
      reasons,
      last_attendance: lastAttendance?.check_in_time || null,
      attendance_rate: attendanceRate
    };
  }).filter(m => m.risk_level !== "low").sort((a, b) => b.risk_score - a.risk_score);
}

function calculateGrowthInsights(
  members: any[],
  meetings: any[],
  attendance: any[],
  visitors: any[],
  goals: any
): GrowthInsight[] {
  const insights: GrowthInsight[] = [];
  
  const totalMembers = members.length;
  const recentMeetings = meetings.slice(0, 4);
  const olderMeetings = meetings.slice(4, 8);
  
  const recentVisitors = visitors.filter(v => 
    recentMeetings.some(m => m.meeting_id === v.meeting_id)
  ).length;
  const olderVisitors = visitors.filter(v => 
    olderMeetings.some(m => m.meeting_id === v.meeting_id)
  ).length;
  
  if (recentVisitors > olderVisitors && olderVisitors > 0) {
    const growth = ((recentVisitors - olderVisitors) / olderVisitors * 100).toFixed(0);
    insights.push({
      type: "positive",
      title: "Visitor Growth",
      description: `Visitor count increased by ${growth}% compared to previous period`,
      metric: `${recentVisitors} visitors`,
      trend: "up"
    });
  } else if (recentVisitors < olderVisitors && olderVisitors > 0) {
    insights.push({
      type: "warning",
      title: "Visitor Decline",
      description: "Fewer visitors compared to previous period. Consider boosting outreach.",
      metric: `${recentVisitors} vs ${olderVisitors} visitors`,
      trend: "down"
    });
  }
  
  if (recentMeetings.length > 0) {
    const recentAttendance = attendance.filter(a => 
      recentMeetings.some(m => m.meeting_id === a.meeting_id) &&
      (a.status === "present" || a.status === "late")
    ).length;
    const avgAttendance = recentAttendance / recentMeetings.length;
    const attendanceRate = totalMembers > 0 ? (avgAttendance / totalMembers * 100).toFixed(0) : 0;
    
    if (Number(attendanceRate) >= 80) {
      insights.push({
        type: "positive",
        title: "Strong Attendance",
        description: `Average attendance rate of ${attendanceRate}% shows great engagement`,
        metric: `${attendanceRate}%`,
        trend: "stable"
      });
    } else if (Number(attendanceRate) < 60) {
      insights.push({
        type: "action",
        title: "Boost Attendance",
        description: "Attendance rate below 60%. Consider personal outreach to absent members.",
        metric: `${attendanceRate}%`,
        trend: "down"
      });
    }
  }
  
  if (goals) {
    if (goals.visitor_goal && recentVisitors >= goals.visitor_goal * 0.8) {
      insights.push({
        type: "positive",
        title: "On Track for Visitor Goal",
        description: `${recentVisitors}/${goals.visitor_goal} visitors - ${((recentVisitors/goals.visitor_goal)*100).toFixed(0)}% of goal`,
        metric: `${recentVisitors}/${goals.visitor_goal}`,
        trend: "up"
      });
    }
  }
  
  insights.push({
    type: "action",
    title: "Member Engagement",
    description: "Review members with low engagement scores and plan personal touchpoints",
    trend: "stable"
  });
  
  return insights;
}

function generateMeetingPlaybook(
  members: any[],
  meetings: any[],
  attendance: any[],
  visitors: any[],
  churnRisks: ChurnRiskMember[]
): MeetingPlaybook {
  const focus_areas: string[] = [];
  const member_highlights: string[] = [];
  const action_items: string[] = [];
  
  if (churnRisks.length > 0) {
    focus_areas.push(`Re-engage ${churnRisks.filter(r => r.risk_level === "high").length} high-risk members`);
    const topRisks = churnRisks.slice(0, 3).map(r => r.full_name_th || r.nickname);
    action_items.push(`Personal outreach to: ${topRisks.join(", ")}`);
  }
  
  const recentMeetingIds = meetings.slice(0, 4).map(m => m.meeting_id);
  const consistentMembers = members.filter(member => {
    const memberAtt = attendance.filter(
      a => a.participant_id === member.participant_id && 
           recentMeetingIds.includes(a.meeting_id) &&
           (a.status === "present" || a.status === "late")
    );
    return memberAtt.length >= 4;
  });
  
  if (consistentMembers.length > 0) {
    member_highlights.push(`${consistentMembers.length} members with perfect attendance`);
  }
  
  const recentVisitorCount = visitors.filter(v => 
    recentMeetingIds.includes(v.meeting_id)
  ).length;
  const avgVisitors = recentVisitorCount / Math.max(recentMeetingIds.length, 1);
  
  let visitor_strategy = "";
  if (avgVisitors < 2) {
    visitor_strategy = "Focus on member referrals - each member should invite 1 visitor this month";
    action_items.push("Set visitor invitation goal for each member");
  } else if (avgVisitors >= 2 && avgVisitors < 5) {
    visitor_strategy = "Good visitor flow - focus on conversion to membership";
    action_items.push("Follow up with recent visitors about membership");
  } else {
    visitor_strategy = "Strong visitor pipeline - maintain quality of experience";
    action_items.push("Ensure warm welcome protocol for all visitors");
  }
  
  focus_areas.push("Recognition moment for top performers");
  focus_areas.push("Networking time optimization");
  action_items.push("Prepare member spotlight presentation");
  
  return {
    focus_areas,
    member_highlights,
    visitor_strategy,
    action_items
  };
}

function calculateEngagementScore(
  members: any[],
  meetings: any[],
  attendance: any[],
  visitors: any[]
): EngagementScore {
  const totalMembers = members.length || 1;
  const recentMeetingIds = meetings.slice(0, 4).map(m => m.meeting_id);
  const meetingCount = recentMeetingIds.length || 1;
  
  const attendedCount = attendance.filter(a => 
    recentMeetingIds.includes(a.meeting_id) &&
    (a.status === "present" || a.status === "late")
  ).length;
  const attendance_score = recentMeetingIds.length > 0 
    ? Math.min(Math.round((attendedCount / (meetingCount * totalMembers)) * 100), 100)
    : 0;
  
  const recentVisitors = visitors.filter(v => 
    recentMeetingIds.includes(v.meeting_id)
  ).length;
  const visitor_score = recentMeetingIds.length > 0 
    ? Math.min(Math.round((recentVisitors / (meetingCount * 3)) * 100), 100)
    : 0;
  
  const referral_score = Math.round((recentVisitors / Math.max(totalMembers, 1)) * 50);
  
  const overall_score = Math.round(
    (attendance_score * 0.4) + (visitor_score * 0.3) + (Math.min(referral_score, 100) * 0.3)
  );
  
  const olderMeetingIds = meetings.slice(4, 8).map(m => m.meeting_id);
  const olderAttendance = attendance.filter(a => 
    olderMeetingIds.includes(a.meeting_id) &&
    (a.status === "present" || a.status === "late")
  ).length;
  
  let trend: "improving" | "declining" | "stable" = "stable";
  if (attendedCount > olderAttendance * 1.1) trend = "improving";
  else if (attendedCount < olderAttendance * 0.9) trend = "declining";
  
  return {
    overall_score: Math.min(overall_score, 100),
    attendance_score,
    visitor_score: Math.min(visitor_score, 100),
    referral_score: Math.min(referral_score, 100),
    trend
  };
}

async function logAIUsage(tenantId: string, source: string, prompt: string): Promise<void> {
  try {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    await supabaseAdmin
      .from("ai_conversations")
      .insert({
        tenant_id: tenantId,
        line_user_id: `system:${source}`,
        role: "user",
        content: prompt.substring(0, 500),
        expires_at: expiresAt.toISOString()
      });
  } catch (error) {
    console.error("[GrowthCopilot] Error logging AI usage:", error);
  }
}

async function generateAISummary(
  tenantId: string,
  churnRisks: ChurnRiskMember[],
  insights: GrowthInsight[],
  playbook: MeetingPlaybook,
  engagementScore: EngagementScore
): Promise<string> {
  const prompt = `You are an AI Growth Co-Pilot for a business networking chapter. 
Analyze the following data and provide a brief, actionable summary (2-3 sentences) for the chapter admin:

Chapter Engagement Score: ${engagementScore.overall_score}/100 (${engagementScore.trend})
- Attendance Score: ${engagementScore.attendance_score}%
- Visitor Score: ${engagementScore.visitor_score}%

High-Risk Members: ${churnRisks.filter(r => r.risk_level === "high").length}
Medium-Risk Members: ${churnRisks.filter(r => r.risk_level === "medium").length}

Key Insights:
${insights.map(i => `- ${i.title}: ${i.description}`).join("\n")}

Focus Areas:
${playbook.focus_areas.join(", ")}

Provide a concise, encouraging summary with the most important action item. Use simple language.`;

  try {
    await logAIUsage(tenantId, "growth_copilot", prompt);
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 200,
      temperature: 0.7
    });
    
    return response.choices[0]?.message?.content || "Unable to generate summary.";
  } catch (error) {
    console.error("AI Summary error:", error);
    return "Your chapter is performing well. Focus on member engagement and visitor conversion for continued growth.";
  }
}

export async function getGrowthCopilotData(tenantId: string): Promise<GrowthCopilotData> {
  const stats = await getChapterStats(tenantId);
  
  const churn_risks = calculateChurnRisks(stats.members, stats.meetings, stats.attendance);
  const growth_insights = calculateGrowthInsights(
    stats.members, 
    stats.meetings, 
    stats.attendance, 
    stats.visitors,
    stats.goals
  );
  const meeting_playbook = generateMeetingPlaybook(
    stats.members,
    stats.meetings,
    stats.attendance,
    stats.visitors,
    churn_risks
  );
  const engagement_score = calculateEngagementScore(
    stats.members,
    stats.meetings,
    stats.attendance,
    stats.visitors
  );
  
  const ai_summary = await generateAISummary(
    tenantId,
    churn_risks,
    growth_insights,
    meeting_playbook,
    engagement_score
  );
  
  return {
    churn_risks,
    growth_insights,
    meeting_playbook,
    engagement_score,
    ai_summary
  };
}
