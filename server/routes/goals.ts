import { Router, Response } from "express";
import { supabaseAdmin } from "../utils/supabaseClient";
import { AuthenticatedRequest, verifySupabaseAuth } from "../utils/auth";

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

    if (!tenant_id) {
      return res.status(400).json({ error: "tenant_id is required" });
    }

    let query = supabaseAdmin
      .from("chapter_goals")
      .select("*")
      .eq("tenant_id", tenant_id as string)
      .order("created_at", { ascending: false });

    if (status && status !== "all") {
      query = query.eq("status", status as string);
    }

    const { data, error } = await query;

    if (error) throw error;

    const goalsWithProgress = await Promise.all(
      (data || []).map(async (goal: ChapterGoal) => {
        const currentValue = await calculateGoalProgress(goal.tenant_id, goal.metric_type, goal.start_date, goal.end_date);
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
    const { tenant_id, template_id, metric_type, name, description, icon, target_value, start_date, end_date } = req.body;
    const userId = req.user?.id;

    if (!tenant_id || !metric_type || !name || !target_value || !start_date || !end_date) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const currentValue = await calculateGoalProgress(tenant_id, metric_type, start_date, end_date);

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
        status: currentValue >= target_value ? "achieved" : "active",
        achieved_at: currentValue >= target_value ? new Date().toISOString() : null,
        created_by: userId
      })
      .select()
      .single();

    if (error) throw error;

    res.json(data);
  } catch (error: any) {
    console.error("Error creating goal:", error);
    res.status(500).json({ error: error.message || "Failed to create goal" });
  }
});

// Update a chapter goal
router.patch("/:goalId", verifySupabaseAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { goalId } = req.params;
    const updates = req.body;

    delete updates.goal_id;
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

    const { data: goal, error: fetchError } = await supabaseAdmin
      .from("chapter_goals")
      .select("*")
      .eq("goal_id", goalId)
      .single();

    if (fetchError || !goal) {
      return res.status(404).json({ error: "Goal not found" });
    }

    const currentValue = await calculateGoalProgress(goal.tenant_id, goal.metric_type, goal.start_date, goal.end_date);
    const isAchieved = currentValue >= goal.target_value;
    const wasNotAchieved = goal.status !== "achieved";

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

    res.json({
      ...data,
      progress_percent: Math.min(100, Math.round((currentValue / goal.target_value) * 100)),
      newly_achieved: isAchieved && wasNotAchieved
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

    if (!tenant_id) {
      return res.status(400).json({ error: "tenant_id is required" });
    }

    const { data: goals, error: fetchError } = await supabaseAdmin
      .from("chapter_goals")
      .select("*")
      .eq("tenant_id", tenant_id)
      .eq("status", "active");

    if (fetchError) throw fetchError;

    const results = [];
    const newlyAchieved = [];

    for (const goal of goals || []) {
      const currentValue = await calculateGoalProgress(goal.tenant_id, goal.metric_type, goal.start_date, goal.end_date);
      const isAchieved = currentValue >= goal.target_value;
      const wasNotAchieved = goal.status !== "achieved";

      const updates: any = {
        current_value: currentValue,
      };

      if (isAchieved && wasNotAchieved) {
        updates.status = "achieved";
        updates.achieved_at = new Date().toISOString();
        newlyAchieved.push(goal);
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
      }
    }

    res.json({
      updated: results.length,
      newly_achieved: newlyAchieved.length,
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
  endDate: string
): Promise<number> {
  try {
    switch (metricType) {
      case "weekly_visitors":
      case "monthly_visitors": {
        const { count, error } = await supabaseAdmin
          .from("participants")
          .select("*", { count: "exact", head: true })
          .eq("tenant_id", tenantId)
          .in("status", ["visitor", "prospect"])
          .gte("created_at", startDate)
          .lte("created_at", endDate + "T23:59:59.999Z");

        if (error) throw error;
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

export default router;
