import { supabaseAdmin } from "../../utils/supabaseClient";
import { getLineCredentials } from "../line/credentials";
import { LineClient } from "../line/lineClient";
import { getChapterAdminsWithLine } from "./achievementNotification";
import { calculateGoalProgressValue } from "./progressCalculator";

interface MeetingInfo {
  meeting_id: string;
  meeting_date: string;
  meeting_time: string | null;
  theme: string | null;
  venue: string | null;
}

interface GoalSummary {
  goal_id: string;
  name: string;
  icon: string;
  metric_type: string;
  target_value: number;
  current_value: number;
  progress_percent: number;
  end_date: string;
  meeting?: MeetingInfo | null;
}

function getIconEmoji(icon: string): string {
  const iconMap: Record<string, string> = {
    "users": "👥",
    "user-check": "✅",
    "calendar-check": "📅",
    "calendar": "📆",
    "gift": "🎁",
    "target": "🎯",
    "trophy": "🏆",
    "star": "⭐"
  };
  return iconMap[icon] || "🎯";
}

function formatThaiDate(dateString: string | null | undefined): string {
  if (!dateString) return "-";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "-";
  const thaiMonths = [
    "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
    "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."
  ];
  const day = date.getDate();
  const month = thaiMonths[date.getMonth()];
  const year = date.getFullYear() + 543;
  return `${day} ${month} ${year}`;
}

function formatThaiDateFull(dateString: string | null | undefined): string {
  if (!dateString) return "-";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "-";
  const thaiMonths = [
    "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
    "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."
  ];
  const thaiDays = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];
  const day = date.getDate();
  const month = thaiMonths[date.getMonth()];
  const year = date.getFullYear() + 543;
  const dayOfWeek = thaiDays[date.getDay()];
  return `${dayOfWeek} ${day} ${month} ${year}`;
}

function createProgressBar(percent: number): string {
  const filled = Math.round(percent / 10);
  const empty = 10 - filled;
  return "█".repeat(filled) + "░".repeat(empty);
}

function buildGoalRow(goal: GoalSummary): any[] {
  const iconEmoji = getIconEmoji(goal.icon);
  const progressBar = createProgressBar(goal.progress_percent);
  const isMeetingGoal = goal.metric_type === "meeting_visitors" || goal.metric_type === "meeting_checkins";
  
  const contents: any[] = [
    {
      type: "text",
      text: `${iconEmoji} ${goal.name}`,
      weight: "bold",
      size: "sm",
      color: "#333333",
      wrap: true
    },
    {
      type: "text",
      text: `${progressBar} ${goal.current_value}/${goal.target_value} (${goal.progress_percent}%)`,
      size: "xs",
      color: goal.progress_percent >= 80 ? "#27AE60" : goal.progress_percent >= 50 ? "#F39C12" : "#E74C3C",
      margin: "xs"
    }
  ];

  if (isMeetingGoal && goal.meeting) {
    const meetingDate = formatThaiDate(goal.meeting.meeting_date);
    const venue = goal.meeting.venue ? ` | ${goal.meeting.venue}` : "";
    contents.push({
      type: "text",
      text: `📅 ${meetingDate}${venue}`,
      size: "xxs",
      color: "#888888",
      margin: "xs"
    });
  } else if (goal.end_date) {
    contents.push({
      type: "text",
      text: `สิ้นสุด: ${formatThaiDate(goal.end_date)}`,
      size: "xxs",
      color: "#888888",
      margin: "xs"
    });
  }

  return [{
    type: "box",
    layout: "vertical",
    contents: contents,
    paddingAll: "sm",
    backgroundColor: "#F8F9FA",
    cornerRadius: "md",
    margin: "sm"
  }];
}

export function buildProgressSummaryFlexMessage(goals: GoalSummary[], chapterName: string, reportDate: string) {
  const formattedDate = formatThaiDateFull(reportDate);
  
  const goalRows: any[] = [];
  for (const goal of goals) {
    goalRows.push(...buildGoalRow(goal));
  }

  if (goalRows.length === 0) {
    goalRows.push({
      type: "text",
      text: "ไม่มีเป้าหมายที่กำลังดำเนินการ",
      size: "sm",
      color: "#888888",
      align: "center",
      margin: "lg"
    });
  }

  return {
    type: "flex",
    altText: `📊 สรุปเป้าหมาย ${chapterName} - ${formattedDate}`,
    contents: {
      type: "bubble",
      size: "mega",
      header: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "text",
            text: "📊 สรุปเป้าหมายประจำวัน",
            weight: "bold",
            size: "lg",
            color: "#ffffff",
            align: "center"
          },
          {
            type: "text",
            text: chapterName,
            size: "sm",
            color: "#E8F8F5",
            align: "center",
            margin: "xs"
          },
          {
            type: "text",
            text: formattedDate,
            size: "xs",
            color: "#B2DFDB",
            align: "center",
            margin: "xs"
          }
        ],
        backgroundColor: "#00897B",
        paddingAll: "15px"
      },
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "text",
            text: `เป้าหมายที่กำลังดำเนินการ (${goals.length})`,
            weight: "bold",
            size: "sm",
            color: "#555555",
            margin: "none"
          },
          ...goalRows
        ],
        paddingAll: "15px",
        spacing: "sm"
      },
      footer: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "text",
            text: "พิมพ์ 'สรุปเป้าหมาย' เพื่อดูอีกครั้ง",
            size: "xs",
            color: "#888888",
            align: "center"
          }
        ],
        paddingAll: "10px"
      }
    }
  };
}

export async function getActiveGoalsForTenant(tenantId: string): Promise<GoalSummary[]> {
  const { data: goals, error } = await supabaseAdmin
    .from("chapter_goals")
    .select(`
      goal_id,
      name,
      icon,
      metric_type,
      target_value,
      current_value,
      start_date,
      end_date,
      meeting_id,
      meeting:meetings(
        meeting_id,
        meeting_date,
        meeting_time,
        theme,
        venue
      )
    `)
    .eq("tenant_id", tenantId)
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (error || !goals) {
    console.error("[ProgressSummary] Error fetching goals:", error);
    return [];
  }

  const progressPromises = goals.map(goal => 
    calculateGoalProgressValue(
      tenantId,
      goal.metric_type,
      goal.start_date,
      goal.end_date,
      goal.meeting_id
    )
  );
  
  const currentValues = await Promise.all(progressPromises);
  
  const results: GoalSummary[] = goals.map((goal, index) => {
    const targetValue = goal.target_value || 0;
    const currentValue = currentValues[index];
    const progressPercent = targetValue > 0 
      ? Math.min(100, Math.round((currentValue / targetValue) * 100))
      : 0;
    
    console.log(`[ProgressSummary] Goal "${goal.name}": ${currentValue}/${targetValue} (${progressPercent}%)`);
    
    let meetingInfo: MeetingInfo | null = null;
    if (goal.meeting) {
      if (Array.isArray(goal.meeting) && goal.meeting.length > 0) {
        meetingInfo = goal.meeting[0];
      } else if (!Array.isArray(goal.meeting)) {
        meetingInfo = goal.meeting as unknown as MeetingInfo;
      }
    }
    
    return {
      goal_id: goal.goal_id,
      name: goal.name,
      icon: goal.icon,
      metric_type: goal.metric_type,
      target_value: targetValue,
      current_value: currentValue,
      progress_percent: progressPercent,
      end_date: goal.end_date,
      meeting: meetingInfo
    };
  });
  
  return results;
}

export async function sendGoalsProgressSummary(
  tenantId: string,
  options?: { isTest?: boolean }
): Promise<{ success: boolean; notifiedCount: number; goalsCount: number; error?: string; message?: string }> {
  try {
    console.log(`[ProgressSummary] Sending summary for tenant: ${tenantId}`);

    const credentials = await getLineCredentials(tenantId);
    if (!credentials) {
      return { success: false, notifiedCount: 0, goalsCount: 0, error: "LINE not configured for this chapter" };
    }

    const { data: tenant } = await supabaseAdmin
      .from("tenants")
      .select("tenant_name")
      .eq("tenant_id", tenantId)
      .single();

    const chapterName = tenant?.tenant_name || "Chapter";

    const goals = await getActiveGoalsForTenant(tenantId);
    console.log(`[ProgressSummary] Found ${goals.length} active goals`);

    if (goals.length === 0) {
      console.log("[ProgressSummary] No active goals found - skipping summary");
      return { success: true, notifiedCount: 0, goalsCount: 0, message: "No active goals to report" };
    }

    const adminsWithLine = await getChapterAdminsWithLine(tenantId);
    
    if (adminsWithLine.length === 0) {
      return { success: false, notifiedCount: 0, goalsCount: goals.length, error: "No admins with LINE linked found" };
    }

    const lineClient = new LineClient(credentials.channelAccessToken);
    const reportDate = new Date().toISOString().split('T')[0];
    const flexMessage = buildProgressSummaryFlexMessage(goals, chapterName, reportDate);

    let notifiedCount = 0;
    const errors: string[] = [];

    for (const admin of adminsWithLine) {
      try {
        await lineClient.pushMessage(admin.line_user_id, flexMessage);
        notifiedCount++;
        console.log(`[ProgressSummary] Sent summary to admin ${admin.full_name_th || admin.user_id}`);
      } catch (error: any) {
        console.error(`[ProgressSummary] Failed to send to ${admin.user_id}:`, error.message);
        errors.push(`${admin.full_name_th || admin.user_id}: ${error.message}`);
      }
    }

    if (!options?.isTest) {
      await supabaseAdmin
        .from("system_settings")
        .upsert({
          tenant_id: tenantId,
          setting_key: "goals.last_summary_sent_at",
          setting_value: new Date().toISOString()
        }, {
          onConflict: "tenant_id,setting_key"
        });
    }

    return {
      success: notifiedCount > 0,
      notifiedCount,
      goalsCount: goals.length,
      error: errors.length > 0 ? errors.join("; ") : undefined
    };
  } catch (error: any) {
    console.error("[ProgressSummary] Error sending summary:", error);
    return { success: false, notifiedCount: 0, goalsCount: 0, error: error.message };
  }
}
