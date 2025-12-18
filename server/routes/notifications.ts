import { Router, Response } from "express";
import crypto from "crypto";
import { supabaseAdmin } from "../utils/supabaseClient";
import { verifySupabaseAuth, AuthenticatedRequest } from "../utils/auth";

const router = Router();

async function checkAdminAccess(userId: string, tenantId: string): Promise<boolean> {
  const { data: superAdminRoles } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "super_admin")
    .is("tenant_id", null);
  
  if (superAdminRoles && superAdminRoles.length > 0) {
    return true;
  }

  const { data: userRoles } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("tenant_id", tenantId);
  
  if (!userRoles || userRoles.length === 0) return false;
  return userRoles.some(r => r.role === "super_admin" || r.role === "chapter_admin");
}

/**
 * GET /api/notifications/settings/:tenantId
 * Get event notification settings for a tenant
 */
router.get("/settings/:tenantId", verifySupabaseAuth, async (req: AuthenticatedRequest, res: Response) => {
  const requestId = crypto.randomUUID().slice(0, 8);
  const logPrefix = `[notification-settings-get:${requestId}]`;

  try {
    const { tenantId } = req.params;
    const userId = req.user!.id;

    if (!await checkAdminAccess(userId, tenantId)) {
      return res.status(403).json({ success: false, error: "Access denied" });
    }

    const { data: settings, error } = await supabaseAdmin
      .from("event_notification_settings")
      .select("*")
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (error) {
      console.error(`${logPrefix} Query error:`, error);
      return res.status(500).json({ success: false, error: "Database error" });
    }

    // Return default settings if none exist
    const defaultSettings = {
      tenant_id: tenantId,
      notify_7_days_before: true,
      notify_1_day_before: true,
      notify_2_hours_before: false,
      notification_time: "09:00:00",
      send_to_group: false,
      group_line_id: null,
      custom_message_template: null
    };

    return res.json({ 
      success: true, 
      settings: settings || defaultSettings
    });

  } catch (error: any) {
    console.error(`${logPrefix} Error:`, error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/notifications/settings/:tenantId
 * Update event notification settings for a tenant
 */
router.put("/settings/:tenantId", verifySupabaseAuth, async (req: AuthenticatedRequest, res: Response) => {
  const requestId = crypto.randomUUID().slice(0, 8);
  const logPrefix = `[notification-settings-update:${requestId}]`;

  try {
    const { tenantId } = req.params;
    const userId = req.user!.id;

    if (!await checkAdminAccess(userId, tenantId)) {
      return res.status(403).json({ success: false, error: "Access denied" });
    }

    const {
      notify_7_days_before,
      notify_1_day_before,
      notify_2_hours_before,
      notification_time,
      send_to_group,
      group_line_id,
      custom_message_template
    } = req.body;

    const { data: result, error } = await supabaseAdmin
      .from("event_notification_settings")
      .upsert({
        tenant_id: tenantId,
        notify_7_days_before,
        notify_1_day_before,
        notify_2_hours_before,
        notification_time,
        send_to_group,
        group_line_id,
        custom_message_template,
        updated_at: new Date().toISOString()
      }, { onConflict: "tenant_id" })
      .select()
      .single();

    if (error) {
      console.error(`${logPrefix} Upsert error:`, error);
      return res.status(500).json({ success: false, error: "Database error" });
    }

    console.log(`${logPrefix} Settings updated for tenant: ${tenantId}`);
    return res.json({ success: true, settings: result });

  } catch (error: any) {
    console.error(`${logPrefix} Error:`, error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/notifications/rsvp/:meetingId
 * Get RSVP summary for a meeting
 */
router.get("/rsvp/:meetingId", verifySupabaseAuth, async (req: AuthenticatedRequest, res: Response) => {
  const requestId = crypto.randomUUID().slice(0, 8);
  const logPrefix = `[rsvp-get:${requestId}]`;

  try {
    const { meetingId } = req.params;
    const userId = req.user!.id;

    // Get meeting to find tenant
    const { data: meeting } = await supabaseAdmin
      .from("meetings")
      .select("tenant_id")
      .eq("meeting_id", meetingId)
      .single();

    if (!meeting) {
      return res.status(404).json({ success: false, error: "Meeting not found" });
    }

    if (!await checkAdminAccess(userId, meeting.tenant_id)) {
      return res.status(403).json({ success: false, error: "Access denied" });
    }

    const { data: rsvps, error } = await supabaseAdmin
      .from("meeting_rsvp")
      .select(`
        *,
        participant:participants(participant_id, full_name_th, full_name_en, phone, profile_image_url)
      `)
      .eq("meeting_id", meetingId);

    if (error) {
      console.error(`${logPrefix} Query error:`, error);
      return res.status(500).json({ success: false, error: "Database error" });
    }

    // Calculate summary
    const summary = {
      total: rsvps?.length || 0,
      confirmed: rsvps?.filter(r => r.rsvp_status === "confirmed").length || 0,
      declined: rsvps?.filter(r => r.rsvp_status === "declined").length || 0,
      leave: rsvps?.filter(r => r.rsvp_status === "leave").length || 0,
      pending: rsvps?.filter(r => r.rsvp_status === "pending").length || 0
    };

    return res.json({ success: true, rsvps, summary });

  } catch (error: any) {
    console.error(`${logPrefix} Error:`, error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/notifications/send/:meetingId
 * Manually send event notification for a meeting
 */
router.post("/send/:meetingId", verifySupabaseAuth, async (req: AuthenticatedRequest, res: Response) => {
  const requestId = crypto.randomUUID().slice(0, 8);
  const logPrefix = `[notification-send:${requestId}]`;

  try {
    const { meetingId } = req.params;
    const userId = req.user!.id;
    const { notification_type = "manual" } = req.body;

    // Get meeting details
    const { data: meeting, error: meetingError } = await supabaseAdmin
      .from("meetings")
      .select("*, tenant:tenants(name, line_channel_access_token)")
      .eq("meeting_id", meetingId)
      .single();

    if (meetingError || !meeting) {
      return res.status(404).json({ success: false, error: "Meeting not found" });
    }

    if (!await checkAdminAccess(userId, meeting.tenant_id)) {
      return res.status(403).json({ success: false, error: "Access denied" });
    }

    // Import notification service
    const { sendEventNotifications } = await import("../services/notifications/eventNotificationService");
    
    const result = await sendEventNotifications(
      meetingId, 
      meeting.tenant_id, 
      notification_type,
      logPrefix
    );

    return res.json({ 
      success: true, 
      sent: result.sent,
      failed: result.failed,
      message: `Sent ${result.sent} notifications, ${result.failed} failed`
    });

  } catch (error: any) {
    console.error(`${logPrefix} Error:`, error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
