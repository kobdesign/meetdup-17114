import { supabaseAdmin } from "../../utils/supabaseClient";
import { getLineCredentials } from "../line/credentials";
import { LineClient } from "../line/lineClient";

interface ChapterGoal {
  goal_id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  icon: string;
  target_value: number;
  current_value: number;
  metric_type: string;
}

interface AdminWithLine {
  user_id: string;
  line_user_id: string;
  full_name_th: string | null;
}

export async function getChapterAdminsWithLine(tenantId: string): Promise<AdminWithLine[]> {
  console.log(`[GoalNotification] Looking for admins in tenant: ${tenantId}`);
  
  const { data: adminRoles, error: rolesError } = await supabaseAdmin
    .from("user_roles")
    .select("user_id, role")
    .eq("tenant_id", tenantId)
    .in("role", ["chapter_admin", "super_admin"]);

  if (rolesError) {
    console.error(`[GoalNotification] Error fetching admin roles:`, rolesError);
    return [];
  }

  if (!adminRoles || adminRoles.length === 0) {
    console.log(`[GoalNotification] No admins found for tenant ${tenantId}`);
    return [];
  }

  console.log(`[GoalNotification] Found ${adminRoles.length} admins:`, adminRoles.map(r => ({ user_id: r.user_id, role: r.role })));

  const userIds = adminRoles.map(r => r.user_id);

  const { data: participants, error: participantsError } = await supabaseAdmin
    .from("participants")
    .select("user_id, line_user_id, full_name_th")
    .eq("tenant_id", tenantId)
    .in("user_id", userIds);

  if (participantsError) {
    console.error(`[GoalNotification] Error fetching participants:`, participantsError);
    return [];
  }

  console.log(`[GoalNotification] Found ${participants?.length || 0} participant records for admins`);
  
  if (participants) {
    for (const p of participants) {
      console.log(`[GoalNotification] Admin participant: ${p.full_name_th || 'N/A'}, user_id: ${p.user_id}, line_user_id: ${p.line_user_id ? 'SET' : 'NOT SET'}`);
    }
  }

  const adminsWithLine = (participants || [])
    .filter(p => p.line_user_id)
    .map(p => ({
      user_id: p.user_id,
      line_user_id: p.line_user_id!,
      full_name_th: p.full_name_th
    }));

  console.log(`[GoalNotification] ${adminsWithLine.length} admins have LINE linked`);
  
  return adminsWithLine;
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

function getMetricLabel(metricType: string): string {
  const labels: Record<string, string> = {
    "weekly_visitors": "Visitor สัปดาห์นี้",
    "monthly_visitors": "Visitor เดือนนี้",
    "total_members": "สมาชิกทั้งหมด",
    "weekly_checkins": "Check-in สัปดาห์นี้",
    "monthly_checkins": "Check-in เดือนนี้",
    "weekly_referrals": "Referral สัปดาห์นี้",
    "monthly_referrals": "Referral เดือนนี้"
  };
  return labels[metricType] || metricType;
}

export function buildAchievementFlexMessage(goal: ChapterGoal, chapterName: string) {
  const iconEmoji = getIconEmoji(goal.icon);
  const metricLabel = getMetricLabel(goal.metric_type);

  return {
    type: "flex",
    altText: `ยินดีด้วย! ${chapterName} บรรลุเป้าหมาย ${goal.name}`,
    contents: {
      type: "bubble",
      size: "mega",
      header: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "box",
            layout: "horizontal",
            contents: [
              {
                type: "text",
                text: "🏆",
                size: "xxl",
                align: "center"
              }
            ],
            justifyContent: "center"
          },
          {
            type: "text",
            text: "ยินดีด้วย!",
            weight: "bold",
            size: "xl",
            color: "#ffffff",
            align: "center"
          },
          {
            type: "text",
            text: chapterName,
            size: "md",
            color: "#ffffff",
            align: "center"
          }
        ],
        backgroundColor: "#27AE60",
        paddingAll: "20px"
      },
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "box",
            layout: "vertical",
            contents: [
              {
                type: "text",
                text: `${iconEmoji} ${goal.name}`,
                weight: "bold",
                size: "lg",
                align: "center",
                wrap: true
              },
              {
                type: "text",
                text: metricLabel,
                size: "sm",
                color: "#888888",
                align: "center",
                margin: "sm"
              },
              {
                type: "separator",
                margin: "lg"
              },
              {
                type: "box",
                layout: "horizontal",
                contents: [
                  {
                    type: "text",
                    text: "เป้าหมาย:",
                    size: "md",
                    color: "#555555",
                    flex: 1
                  },
                  {
                    type: "text",
                    text: `${goal.target_value}`,
                    size: "md",
                    weight: "bold",
                    color: "#27AE60",
                    align: "end",
                    flex: 1
                  }
                ],
                margin: "lg"
              },
              {
                type: "box",
                layout: "horizontal",
                contents: [
                  {
                    type: "text",
                    text: "ผลลัพธ์:",
                    size: "md",
                    color: "#555555",
                    flex: 1
                  },
                  {
                    type: "text",
                    text: `${goal.current_value}`,
                    size: "md",
                    weight: "bold",
                    color: "#27AE60",
                    align: "end",
                    flex: 1
                  }
                ],
                margin: "md"
              },
              {
                type: "box",
                layout: "vertical",
                contents: [
                  {
                    type: "text",
                    text: "✅ สำเร็จ!",
                    weight: "bold",
                    size: "xl",
                    color: "#27AE60",
                    align: "center"
                  }
                ],
                margin: "xl",
                paddingAll: "md",
                backgroundColor: "#E8F8F5",
                cornerRadius: "md"
              }
            ],
            paddingAll: "20px"
          }
        ]
      },
      footer: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "text",
            text: "ขอบคุณทุกคนที่ช่วยกัน!",
            size: "sm",
            color: "#888888",
            align: "center"
          }
        ],
        paddingAll: "15px"
      }
    }
  };
}

export async function sendGoalAchievementNotification(
  goal: ChapterGoal
): Promise<{ success: boolean; notifiedCount: number; error?: string }> {
  try {
    const credentials = await getLineCredentials(goal.tenant_id);
    if (!credentials) {
      return { success: false, notifiedCount: 0, error: "LINE not configured for this chapter" };
    }

    const { data: tenant } = await supabaseAdmin
      .from("tenants")
      .select("tenant_name")
      .eq("tenant_id", goal.tenant_id)
      .single();

    const chapterName = tenant?.tenant_name || "Chapter";

    const adminsWithLine = await getChapterAdminsWithLine(goal.tenant_id);
    
    if (adminsWithLine.length === 0) {
      return { success: false, notifiedCount: 0, error: "No admins with LINE linked found" };
    }

    const lineClient = new LineClient(credentials.channelAccessToken);
    const flexMessage = buildAchievementFlexMessage(goal, chapterName);

    let notifiedCount = 0;
    const errors: string[] = [];

    for (const admin of adminsWithLine) {
      try {
        await lineClient.pushMessage(admin.line_user_id, flexMessage);
        notifiedCount++;
        console.log(`[GoalAchievement] Sent notification to admin ${admin.user_id}`);
      } catch (error: any) {
        console.error(`[GoalAchievement] Failed to send to ${admin.user_id}:`, error.message);
        errors.push(`${admin.full_name_th || admin.user_id}: ${error.message}`);
      }
    }

    await supabaseAdmin
      .from("chapter_goals")
      .update({ line_notified_at: new Date().toISOString() })
      .eq("goal_id", goal.goal_id);

    return {
      success: notifiedCount > 0,
      notifiedCount,
      error: errors.length > 0 ? errors.join("; ") : undefined
    };
  } catch (error: any) {
    console.error("[GoalAchievement] Error sending notification:", error);
    return { success: false, notifiedCount: 0, error: error.message };
  }
}

export async function checkAndNotifyAchievedGoals(tenantId: string): Promise<{
  checked: number;
  notified: number;
}> {
  const { data: achievedGoals } = await supabaseAdmin
    .from("chapter_goals")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("status", "achieved")
    .is("line_notified_at", null);

  if (!achievedGoals || achievedGoals.length === 0) {
    return { checked: 0, notified: 0 };
  }

  let notified = 0;
  for (const goal of achievedGoals) {
    const result = await sendGoalAchievementNotification(goal as ChapterGoal);
    if (result.success) {
      notified++;
    }
  }

  return { checked: achievedGoals.length, notified };
}
