import { Router, Response } from "express";
import { supabaseAdmin } from "../utils/supabaseClient";
import { AuthenticatedRequest, verifySupabaseAuth, checkTenantAccess } from "../utils/auth";
import { sendGoalAchievementNotification, checkAndNotifyAchievedGoals } from "../services/goals/achievementNotification";
import { sendGoalsProgressSummary } from "../services/goals/progressSummary";

const router = Router();

interface GoalTemplate {
  template_id: string;
  metric_type: string;
  name_th: string;
  name_en: string | null;
  description_th: string | null;
  description_en: string | null;
  icon: string;
  default_target: number;
  is_active: boolean;
  sort_order: number;
}

interface MeetingInfo {
  meeting_id: string;
  meeting_date: string;
  meeting_time: string | null;
  theme: string | null;
  venue: string | null;
}

interface ChapterGoal {
  goal_id: string;
  tenant_id: string;
  template_id: string | null;
  metric_type: string;
  name: string;
  description: string | null;
  icon: string;
  target_value: number;
  current_value: number;
  start_date: string;
  end_date: string;
  meeting_id: string | null;
  meeting?: MeetingInfo | null;
  status: 'active' | 'achieved' | 'expired' | 'cancelled';
  achieved_at: string | null;
  line_notified_at: string | null;
  created_at: string;
  updated_at: string;
}

// Get all goal templates
router.get("/templates", verifySupabaseAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("goal_templates")
      .select("*")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    if (error) throw error;

    res.json(data || []);
  } catch (error: any) {
    console.error("Error fetching goal templates:", error);
    res.status(500).json({ error: error.message || "Failed to fetch templates" });
  }
});

// Get chapter goals
router.get("/", verifySupabaseAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { tenant_id, status } = req.query;
    const userId = req.user?.id;

    if (!tenant_id) {
      return res.status(400).json({ error: "tenant_id is required" });
    }

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const hasAccess = await checkTenantAccess(userId, tenant_id as string);
    if (!hasAccess) {
      return res.status(403).json({ error: "Access denied to this chapter" });
    }

    let query = supabaseAdmin
      .from("chapter_goals")
      .select(`
        *,
        meeting:meetings(
          meeting_id,
          meeting_date,
          meeting_time,
          theme,
          venue
        )
      `)
      .eq("tenant_id", tenant_id as string)
      .order("created_at", { ascending: false });

    if (status && status !== "all") {
      query = query.eq("status", status as string);
    }

    const { data, error } = await query;

    if (error) throw error;

    const goalsWithProgress = await Promise.all(
      (data || []).map(async (goal: ChapterGoal) => {
        const currentValue = await calculateGoalProgress(goal.tenant_id, goal.metric_type, goal.start_date, goal.end_date, goal.meeting_id);
        const isAchieved = currentValue >= goal.target_value;
        const wasNotAchieved = goal.status === "active";
        const shouldUpdateStatus = isAchieved && wasNotAchieved;
        
        if (shouldUpdateStatus) {
          const updates: any = {
            current_value: currentValue,
            status: "achieved",
            achieved_at: new Date().toISOString()
          };
          
          await supabaseAdmin
            .from("chapter_goals")
            .update(updates)
            .eq("goal_id", goal.goal_id);
          
          if (!goal.line_notified_at) {
            sendGoalAchievementNotification({
              ...goal,
              current_value: currentValue
            }).then(result => {
              console.log(`[Goals] Auto-achievement notification for ${goal.name}:`, result);
            }).catch(err => {
              console.error(`[Goals] Failed to send achievement notification:`, err);
            });
          }
          
          return {
            ...goal,
            current_value: currentValue,
            status: "achieved",
            achieved_at: new Date().toISOString(),
            progress_percent: 100
          };
        }
        
        return {
          ...goal,
          current_value: currentValue,
          progress_percent: Math.min(100, Math.round((currentValue / goal.target_value) * 100))
        };
      })
    );

    res.json(goalsWithProgress);
  } catch (error: any) {
    console.error("Error fetching chapter goals:", error);
    res.status(500).json({ error: error.message || "Failed to fetch goals" });
  }
});

// Create a new chapter goal
router.post("/", verifySupabaseAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { tenant_id, template_id, metric_type, name, description, icon, target_value, start_date, end_date, meeting_id } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const isMeetingBased = metric_type === 'meeting_visitors' || metric_type === 'meeting_checkins';
    
    if (isMeetingBased && !meeting_id) {
      return res.status(400).json({ error: "meeting_id is required for meeting-based goals" });
    }

    if (!tenant_id || !metric_type || !name || !target_value || !start_date || !end_date) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const hasAccess = await checkTenantAccess(userId, tenant_id);
    if (!hasAccess) {
      return res.status(403).json({ error: "Access denied to this chapter" });
    }

    const currentValue = await calculateGoalProgress(tenant_id, metric_type, start_date, end_date, meeting_id || null);
    const isAlreadyAchieved = currentValue >= target_value;

    const { data, error } = await supabaseAdmin
      .from("chapter_goals")
      .insert({
        tenant_id,
        template_id,
        metric_type,
        name,
        description,
        icon: icon || "target",
        target_value,
        current_value: currentValue,
        start_date,
        end_date,
        meeting_id: meeting_id || null,
        status: isAlreadyAchieved ? "achieved" : "active",
        achieved_at: isAlreadyAchieved ? new Date().toISOString() : null,
        created_by: userId
      })
      .select()
      .single();

    if (error) throw error;

    let notificationResult = null;
    if (isAlreadyAchieved && data) {
      let meetingData = null;
      if (meeting_id) {
        const { data: meetingInfo } = await supabaseAdmin
          .from("meetings")
          .select("meeting_id, meeting_date, meeting_time, theme, venue")
          .eq("meeting_id", meeting_id)
          .single();
        meetingData = meetingInfo;
        console.log(`[Goals] Fetched meeting info for notification:`, meetingData);
      }
      
      notificationResult = await sendGoalAchievementNotification({
        ...data,
        current_value: currentValue,
        meeting: meetingData
      });
      console.log(`[Goals] New goal already achieved, notification result:`, notificationResult);
    }

    res.json({
      ...data,
      progress_percent: Math.min(100, Math.round((currentValue / target_value) * 100)),
      notification_sent: notificationResult?.success || false
    });
  } catch (error: any) {
    console.error("Error creating goal:", error);
    res.status(500).json({ error: error.message || "Failed to create goal" });
  }
});

// Update a chapter goal
router.patch("/:goalId", verifySupabaseAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { goalId } = req.params;
    const userId = req.user?.id;
    const updates = req.body;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { data: existingGoal, error: fetchError } = await supabaseAdmin
      .from("chapter_goals")
      .select("tenant_id")
      .eq("goal_id", goalId)
      .single();

    if (fetchError || !existingGoal) {
      return res.status(404).json({ error: "Goal not found" });
    }

    const hasAccess = await checkTenantAccess(userId, existingGoal.tenant_id);
    if (!hasAccess) {
      return res.status(403).json({ error: "Access denied to this goal" });
    }

    delete updates.goal_id;
    delete updates.tenant_id;
    delete updates.created_at;
    delete updates.current_value;

    const { data, error } = await supabaseAdmin
      .from("chapter_goals")
      .update(updates)
      .eq("goal_id", goalId)
      .select()
      .single();

    if (error) throw error;

    res.json(data);
  } catch (error: any) {
    console.error("Error updating goal:", error);
    res.status(500).json({ error: error.message || "Failed to update goal" });
  }
});

// Delete a chapter goal
router.delete("/:goalId", verifySupabaseAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { goalId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { data: existingGoal, error: fetchError } = await supabaseAdmin
      .from("chapter_goals")
      .select("tenant_id")
      .eq("goal_id", goalId)
      .single();

    if (fetchError || !existingGoal) {
      return res.status(404).json({ error: "Goal not found" });
    }

    const hasAccess = await checkTenantAccess(userId, existingGoal.tenant_id);
    if (!hasAccess) {
      return res.status(403).json({ error: "Access denied to this goal" });
    }

    const { error } = await supabaseAdmin
      .from("chapter_goals")
      .delete()
      .eq("goal_id", goalId);

    if (error) throw error;

    res.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting goal:", error);
    res.status(500).json({ error: error.message || "Failed to delete goal" });
  }
});

// Recalculate progress for a specific goal
router.post("/:goalId/recalculate", verifySupabaseAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { goalId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { data: goal, error: fetchError } = await supabaseAdmin
      .from("chapter_goals")
      .select("*")
      .eq("goal_id", goalId)
      .single();

    if (fetchError || !goal) {
      return res.status(404).json({ error: "Goal not found" });
    }

    const hasAccess = await checkTenantAccess(userId, goal.tenant_id);
    if (!hasAccess) {
      return res.status(403).json({ error: "Access denied to this goal" });
    }

    const currentValue = await calculateGoalProgress(goal.tenant_id, goal.metric_type, goal.start_date, goal.end_date, goal.meeting_id);
    const isAchieved = currentValue >= goal.target_value;
    const wasNotAchieved = goal.status !== "achieved";
    const shouldNotify = isAchieved && wasNotAchieved && !goal.line_notified_at;

    const updates: any = {
      current_value: currentValue,
    };

    if (isAchieved && wasNotAchieved) {
      updates.status = "achieved";
      updates.achieved_at = new Date().toISOString();
    }

    const { data, error } = await supabaseAdmin
      .from("chapter_goals")
      .update(updates)
      .eq("goal_id", goalId)
      .select()
      .single();

    if (error) throw error;

    let notificationResult = null;
    if (shouldNotify && data) {
      notificationResult = await sendGoalAchievementNotification({
        ...data,
        current_value: currentValue
      });
      console.log(`[Goals] Achievement notification result:`, notificationResult);
    }

    res.json({
      ...data,
      progress_percent: Math.min(100, Math.round((currentValue / goal.target_value) * 100)),
      newly_achieved: isAchieved && wasNotAchieved,
      notification_sent: notificationResult?.success || false,
      notification_count: notificationResult?.notifiedCount || 0
    });
  } catch (error: any) {
    console.error("Error recalculating goal:", error);
    res.status(500).json({ error: error.message || "Failed to recalculate goal" });
  }
});

// Recalculate all active goals for a tenant
router.post("/recalculate-all", verifySupabaseAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { tenant_id } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!tenant_id) {
      return res.status(400).json({ error: "tenant_id is required" });
    }

    const hasAccess = await checkTenantAccess(userId, tenant_id);
    if (!hasAccess) {
      return res.status(403).json({ error: "Access denied to this chapter" });
    }

    const { data: goals, error: fetchError } = await supabaseAdmin
      .from("chapter_goals")
      .select("*")
      .eq("tenant_id", tenant_id)
      .eq("status", "active");

    if (fetchError) throw fetchError;

    const results = [];
    const newlyAchievedGoals = [];
    let notificationsSent = 0;

    for (const goal of goals || []) {
      const currentValue = await calculateGoalProgress(goal.tenant_id, goal.metric_type, goal.start_date, goal.end_date, goal.meeting_id);
      const isAchieved = currentValue >= goal.target_value;
      const wasNotAchieved = goal.status !== "achieved";
      const shouldNotify = isAchieved && wasNotAchieved && !goal.line_notified_at;

      const updates: any = {
        current_value: currentValue,
      };

      if (isAchieved && wasNotAchieved) {
        updates.status = "achieved";
        updates.achieved_at = new Date().toISOString();
      }

      const { data } = await supabaseAdmin
        .from("chapter_goals")
        .update(updates)
        .eq("goal_id", goal.goal_id)
        .select()
        .single();

      if (data) {
        results.push({
          ...data,
          progress_percent: Math.min(100, Math.round((currentValue / goal.target_value) * 100))
        });

        if (shouldNotify) {
          newlyAchievedGoals.push({ ...data, current_value: currentValue });
        }
      }
    }

    for (const achievedGoal of newlyAchievedGoals) {
      const result = await sendGoalAchievementNotification(achievedGoal);
      if (result.success) {
        notificationsSent += result.notifiedCount;
      }
    }

    res.json({
      updated: results.length,
      newly_achieved: newlyAchievedGoals.length,
      notifications_sent: notificationsSent,
      goals: results
    });
  } catch (error: any) {
    console.error("Error recalculating goals:", error);
    res.status(500).json({ error: error.message || "Failed to recalculate goals" });
  }
});

async function calculateGoalProgress(
  tenantId: string,
  metricType: string,
  startDate: string,
  endDate: string,
  meetingId: string | null = null
): Promise<number> {
  try {
    switch (metricType) {
      case "meeting_visitors": {
        if (!meetingId) {
          console.error("[GoalProgress] meeting_visitors requires meeting_id");
          return 0;
        }
        console.log(`[GoalProgress] Calculating meeting_visitors for meeting ${meetingId}`);
        
        // For meeting-based goals, we count all registrations for that meeting
        // regardless of date range, since the meeting itself defines the scope
        const { data, error } = await supabaseAdmin
          .from("meeting_registrations")
          .select(`
            registration_id,
            registered_at,
            participant:participants!inner(participant_id, status)
          `)
          .eq("meeting_id", meetingId)
          .in("registration_status", ["registered", "attended"]);

        if (error) {
          console.error(`[GoalProgress] Error:`, error);
          throw error;
        }
        
        console.log(`[GoalProgress] Raw registrations found:`, data?.length || 0);
        
        const visitorCount = data?.filter((r: any) => 
          r.participant?.status === 'visitor' || r.participant?.status === 'prospect'
        ).length || 0;
        
        console.log(`[GoalProgress] Found ${visitorCount} visitors/prospects for meeting`);
        return visitorCount;
      }

      case "meeting_checkins": {
        if (!meetingId) {
          console.error("[GoalProgress] meeting_checkins requires meeting_id");
          return 0;
        }
        console.log(`[GoalProgress] Calculating meeting_checkins for meeting ${meetingId}`);
        
        // For meeting-based goals, we count all checkins for that meeting
        // regardless of date range, since the meeting itself defines the scope
        const { count, error } = await supabaseAdmin
          .from("checkins")
          .select("*", { count: "exact", head: true })
          .eq("meeting_id", meetingId)
          .eq("status", "approved");

        if (error) {
          console.error(`[GoalProgress] Error:`, error);
          throw error;
        }
        
        console.log(`[GoalProgress] Found ${count} checkins for meeting`);
        return count || 0;
      }

      case "weekly_visitors":
      case "monthly_visitors": {
        const endDateWithTime = endDate + "T23:59:59.999Z";
        console.log(`[GoalProgress] Calculating ${metricType} for tenant ${tenantId}`);
        console.log(`[GoalProgress] Date range: ${startDate} to ${endDateWithTime}`);
        
        const { count, error, data } = await supabaseAdmin
          .from("participants")
          .select("participant_id, status, created_at", { count: "exact" })
          .eq("tenant_id", tenantId)
          .in("status", ["visitor", "prospect"])
          .gte("created_at", startDate)
          .lte("created_at", endDateWithTime);

        console.log(`[GoalProgress] Found ${count} participants:`, data?.map(p => ({
          id: p.participant_id.slice(0, 8),
          status: p.status,
          created_at: p.created_at
        })));
        
        if (error) {
          console.error(`[GoalProgress] Error:`, error);
          throw error;
        }
        return count || 0;
      }

      case "total_members": {
        const { count, error } = await supabaseAdmin
          .from("participants")
          .select("*", { count: "exact", head: true })
          .eq("tenant_id", tenantId)
          .eq("status", "member");

        if (error) throw error;
        return count || 0;
      }

      case "weekly_checkins":
      case "monthly_checkins": {
        const { data: meetings } = await supabaseAdmin
          .from("meetings")
          .select("meeting_id")
          .eq("tenant_id", tenantId);

        if (!meetings || meetings.length === 0) return 0;

        const meetingIds = meetings.map(m => m.meeting_id);

        const { count, error } = await supabaseAdmin
          .from("checkins")
          .select("*", { count: "exact", head: true })
          .in("meeting_id", meetingIds)
          .gte("checkin_time", startDate)
          .lte("checkin_time", endDate + "T23:59:59.999Z");

        if (error) throw error;
        return count || 0;
      }

      case "weekly_referrals":
      case "monthly_referrals": {
        const { count, error } = await supabaseAdmin
          .from("participants")
          .select("*", { count: "exact", head: true })
          .eq("tenant_id", tenantId)
          .not("referred_by_participant_id", "is", null)
          .gte("created_at", startDate)
          .lte("created_at", endDate + "T23:59:59.999Z");

        if (error) throw error;
        return count || 0;
      }

      default:
        return 0;
    }
  } catch (error) {
    console.error(`Error calculating progress for ${metricType}:`, error);
    return 0;
  }
}

// Send progress summary notification to admins
router.post("/send-summary", verifySupabaseAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { tenant_id } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!tenant_id) {
      return res.status(400).json({ error: "tenant_id is required" });
    }

    const hasAccess = await checkTenantAccess(userId, tenant_id);
    if (!hasAccess) {
      return res.status(403).json({ error: "Access denied to this chapter" });
    }

    console.log(`[Goals] Sending progress summary for tenant: ${tenant_id}`);
    
    const result = await sendGoalsProgressSummary(tenant_id, { isTest: true });
    
    console.log(`[Goals] Progress summary result:`, result);

    res.json({
      success: result.success,
      message: result.success 
        ? `ส่งสรุปเป้าหมายแล้ว (${result.goalsCount} เป้าหมาย, ${result.notifiedCount} คน)`
        : result.error || "Failed to send summary",
      ...result
    });
  } catch (error: any) {
    console.error("Error sending progress summary:", error);
    res.status(500).json({ error: error.message || "Failed to send progress summary" });
  }
});

// Get/Set daily summary settings
router.get("/summary-settings", verifySupabaseAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { tenant_id } = req.query;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!tenant_id) {
      return res.status(400).json({ error: "tenant_id is required" });
    }

    const hasAccess = await checkTenantAccess(userId, tenant_id as string);
    if (!hasAccess) {
      return res.status(403).json({ error: "Access denied" });
    }

    const { data: settings } = await supabaseAdmin
      .from("system_settings")
      .select("setting_key, setting_value")
      .eq("tenant_id", tenant_id)
      .in("setting_key", [
        "goals.daily_summary_enabled",
        "goals.daily_summary_time",
        "goals.last_summary_sent_at"
      ]);

    const settingsMap: Record<string, string> = {};
    for (const s of settings || []) {
      settingsMap[s.setting_key] = s.setting_value;
    }

    res.json({
      enabled: settingsMap["goals.daily_summary_enabled"] === "true",
      time: settingsMap["goals.daily_summary_time"] || "18:00",
      lastSentAt: settingsMap["goals.last_summary_sent_at"] || null
    });
  } catch (error: any) {
    console.error("Error fetching summary settings:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/summary-settings", verifySupabaseAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { tenant_id, enabled, time } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!tenant_id) {
      return res.status(400).json({ error: "tenant_id is required" });
    }

    const hasAccess = await checkTenantAccess(userId, tenant_id);
    if (!hasAccess) {
      return res.status(403).json({ error: "Access denied" });
    }

    const updates = [];
    
    if (typeof enabled === "boolean") {
      updates.push({
        tenant_id,
        setting_key: "goals.daily_summary_enabled",
        setting_value: String(enabled)
      });
    }

    if (time) {
      const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
      if (!timeRegex.test(time)) {
        return res.status(400).json({ error: "Invalid time format. Use HH:mm" });
      }
      updates.push({
        tenant_id,
        setting_key: "goals.daily_summary_time",
        setting_value: time
      });
    }

    if (updates.length > 0) {
      const { error } = await supabaseAdmin
        .from("system_settings")
        .upsert(updates, { onConflict: "tenant_id,setting_key" });

      if (error) throw error;
    }

    res.json({ success: true, message: "Settings updated" });
  } catch (error: any) {
    console.error("Error updating summary settings:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
