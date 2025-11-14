import { Router } from "express";
import { supabaseAdmin } from "../utils/supabaseClient";
import { verifySupabaseAuth, AuthenticatedRequest } from "../utils/auth";

const router = Router();

// Get visitor pipeline analytics
router.get("/visitor-analytics", verifySupabaseAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { tenant_id } = req.query;
    const userId = req.user?.id;

    if (!tenant_id || typeof tenant_id !== 'string') {
      return res.status(400).json({ 
        error: "Missing required parameter",
        message: "tenant_id is required"
      });
    }

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Verify user has access to this tenant
    const { data: userRoles, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("role, tenant_id")
      .eq("user_id", userId);

    if (roleError || !userRoles || userRoles.length === 0) {
      return res.status(403).json({ 
        error: "Forbidden",
        message: "You don't have access to any chapter"
      });
    }

    // Check if user is super admin (role='super_admin' with null tenant_id)
    const isSuperAdmin = userRoles.some(r => r.role === "super_admin" && !r.tenant_id);
    
    // Check if user has access to requested tenant
    const hasAccessToTenant = userRoles.some(r => r.tenant_id === tenant_id);
    
    if (!isSuperAdmin && !hasAccessToTenant) {
      return res.status(403).json({ 
        error: "Forbidden",
        message: "You don't have access to this chapter"
      });
    }

    // Get status counts
    const { data: statusData, error: statusError } = await supabaseAdmin
      .from("participants")
      .select("status")
      .eq("tenant_id", tenant_id);

    if (statusError) {
      console.error("Error fetching status data:", statusError);
      return res.status(500).json({ 
        error: "Failed to fetch analytics",
        message: statusError.message
      });
    }

    // Count by status
    const statusCounts = statusData.reduce((acc: Record<string, number>, row) => {
      acc[row.status] = (acc[row.status] || 0) + 1;
      return acc;
    }, {});

    const prospects = statusCounts['prospect'] || 0;
    const visitors = statusCounts['visitor'] || 0;
    const members = statusCounts['member'] || 0;
    const declined = statusCounts['declined'] || 0;

    // Get visitors with check-ins
    const { data: visitorsWithCheckins, error: checkinsError } = await supabaseAdmin
      .from("participants")
      .select(`
        participant_id,
        checkins (
          checkin_id
        )
      `)
      .eq("tenant_id", tenant_id)
      .eq("status", "visitor");

    if (checkinsError) {
      console.error("Error fetching checkins:", checkinsError);
      return res.status(500).json({ 
        error: "Failed to fetch check-in data",
        message: checkinsError.message
      });
    }

    const visitorsWithCheckinCount = visitorsWithCheckins?.filter(
      (v: any) => v.checkins && v.checkins.length > 0
    ).length || 0;

    // Get engagement metrics for VISITORS ONLY (not prospects)
    const { data: visitorEngagementData, error: visitorEngagementError } = await supabaseAdmin
      .from("checkins")
      .select(`
        checkin_id,
        participant:participants!inner (
          participant_id,
          status,
          tenant_id
        )
      `)
      .eq("participant.tenant_id", tenant_id)
      .eq("participant.status", "visitor");

    if (visitorEngagementError) {
      console.error("Error fetching visitor engagement data:", visitorEngagementError);
      return res.status(500).json({ 
        error: "Failed to fetch engagement data",
        message: visitorEngagementError.message
      });
    }

    const visitorCheckins = visitorEngagementData?.length || 0;
    const avgCheckinsPerVisitor = visitors > 0 
      ? parseFloat((visitorCheckins / visitors).toFixed(1))
      : 0;

    // Count visitors with 2+ check-ins (engaged visitors likely to convert)
    const visitorCheckinCounts = new Map<string, number>();
    visitorEngagementData?.forEach((checkin: any) => {
      const participantId = checkin.participant.participant_id;
      visitorCheckinCounts.set(participantId, (visitorCheckinCounts.get(participantId) || 0) + 1);
    });
    const engagedVisitors = Array.from(visitorCheckinCounts.values()).filter(count => count >= 2).length;

    const totalInPipeline = prospects + visitors;

    return res.json({
      success: true,
      analytics: {
        prospects,
        visitors,
        visitorsWithCheckins: visitorsWithCheckinCount,
        engagedVisitors, // Visitors with 2+ check-ins
        members,
        declined,
        avgCheckinsPerVisitor,
        totalInPipeline,
      },
      note: "engagedVisitors = visitors with 2+ check-ins. True conversion tracking requires status_history table."
    });

  } catch (error: any) {
    console.error("Visitor analytics error:", error);
    return res.status(500).json({ 
      error: "Internal server error",
      message: error.message
    });
  }
});

export default router;
