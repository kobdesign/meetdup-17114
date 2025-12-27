import { Router, Request, Response } from "express";
import crypto from "crypto";
import { supabaseAdmin } from "../utils/supabaseClient";
import { verifySupabaseAuth, AuthenticatedRequest } from "../utils/auth";
import { verifyProfileToken, ProfileTokenPayload } from "../utils/profileToken";
import { LineClient } from "../services/line/lineClient";

const router = Router();

// Extended request type for substitute token auth
interface SubstituteTokenRequest extends Request {
  tokenPayload?: ProfileTokenPayload;
}

// Helper: Check if user has admin access to tenant
async function checkAdminAccess(userId: string, tenantId: string): Promise<boolean> {
  // Check for super_admin with null tenant_id (global super admin)
  const { data: superAdminRoles } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "super_admin")
    .is("tenant_id", null);
  
  if (superAdminRoles && superAdminRoles.length > 0) {
    return true;
  }

  // Check for tenant-specific admin roles
  const { data: userRoles } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("tenant_id", tenantId);
  
  if (!userRoles || userRoles.length === 0) return false;
  return userRoles.some(r => r.role === "super_admin" || r.role === "chapter_admin");
}

// Helper: Check if user is member of tenant
async function checkMemberAccess(userId: string, tenantId: string): Promise<{ hasAccess: boolean; participantId?: string }> {
  const { data: userRoles } = await supabaseAdmin
    .from("user_roles")
    .select("role, participant_id")
    .eq("user_id", userId)
    .eq("tenant_id", tenantId);
  
  if (!userRoles || userRoles.length === 0) return { hasAccess: false };
  
  const memberRole = userRoles.find(r => r.role === "member" || r.role === "chapter_admin" || r.role === "super_admin");
  return { 
    hasAccess: !!memberRole, 
    participantId: memberRole?.participant_id 
  };
}

// ============================================
// SUBSTITUTE REQUESTS ENDPOINTS
// ============================================

/**
 * POST /api/palms/substitute-request
 * Member submits a substitute request for a meeting
 * Supports both Supabase auth and substitute token auth
 */
router.post("/substitute-request", async (req: SubstituteTokenRequest, res: Response) => {
  const requestId = crypto.randomUUID().slice(0, 8);
  const logPrefix = `[palms-sub-request:${requestId}]`;

  try {
    let participantId: string | undefined;
    let tenantId: string | undefined;
    let meetingIdFromToken: string | undefined;

    // Check for substitute token first (from LINE bot flow)
    const substituteToken = req.headers["x-substitute-token"] as string;
    if (substituteToken) {
      const payload = verifyProfileToken(substituteToken, "substitute_request");
      if (!payload) {
        return res.status(401).json({ success: false, error: "Token หมดอายุหรือไม่ถูกต้อง" });
      }
      participantId = payload.participant_id;
      tenantId = payload.tenant_id;
      meetingIdFromToken = payload.meeting_id;
      console.log(`${logPrefix} Using substitute token auth for participant:`, participantId);
    }

    const { meeting_id, substitute_name, substitute_phone, substitute_email } = req.body;
    const actualMeetingId = meeting_id || meetingIdFromToken;

    if (!actualMeetingId || !substitute_name || !substitute_phone) {
      return res.status(400).json({ 
        success: false, 
        error: "Missing required fields: meeting_id, substitute_name, substitute_phone" 
      });
    }

    // Get meeting to find tenant_id
    const { data: meeting, error: meetingError } = await supabaseAdmin
      .from("meetings")
      .select("meeting_id, tenant_id, meeting_date")
      .eq("meeting_id", actualMeetingId)
      .single();

    if (meetingError || !meeting) {
      return res.status(404).json({ success: false, error: "Meeting not found" });
    }

    // If using token auth, verify meeting matches token
    if (substituteToken) {
      if (tenantId !== meeting.tenant_id) {
        return res.status(403).json({ success: false, error: "Token ไม่ตรงกับ Meeting" });
      }
    } else {
      // Fall back to Supabase auth
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith("Bearer ")) {
        return res.status(401).json({ success: false, error: "Unauthorized" });
      }
      // For backward compatibility - this path requires Supabase login
      return res.status(401).json({ success: false, error: "กรุณาใช้ลิงก์จาก LINE bot" });
    }

    // Normalize phone
    const normalizedPhone = substitute_phone.replace(/\D/g, "");

    // Check if request already exists
    const { data: existing } = await supabaseAdmin
      .from("substitute_requests")
      .select("request_id, status")
      .eq("meeting_id", actualMeetingId)
      .eq("member_participant_id", participantId)
      .single();

    // Helper function to send LINE notification
    const sendLineNotification = async (requestData: any, isUpdate: boolean) => {
      try {
        // Get participant's line_user_id
        const { data: participant } = await supabaseAdmin
          .from("participants")
          .select("line_user_id, full_name_th")
          .eq("participant_id", participantId)
          .single();

        // Get tenant's LINE access token
        const { data: tenant } = await supabaseAdmin
          .from("tenants")
          .select("line_channel_access_token, name")
          .eq("tenant_id", tenantId)
          .single();

        if (!participant?.line_user_id || !tenant?.line_channel_access_token) {
          console.log(`${logPrefix} Cannot send LINE notification - missing line_user_id or access_token`);
          return;
        }

        // Format meeting date
        const meetingDate = new Date(meeting.meeting_date);
        const dateStr = meetingDate.toLocaleDateString("th-TH", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric"
        });

        // Create Flex Message for success notification
        const flexMessage = {
          type: "flex",
          altText: `${isUpdate ? "อัพเดต" : "บันทึก"}ตัวแทนสำเร็จ - ${substitute_name}`,
          contents: {
            type: "bubble",
            size: "kilo",
            header: {
              type: "box",
              layout: "vertical",
              contents: [
                {
                  type: "text",
                  text: isUpdate ? "อัพเดตตัวแทนสำเร็จ" : "บันทึกตัวแทนสำเร็จ",
                  color: "#ffffff",
                  size: "lg",
                  weight: "bold"
                }
              ],
              backgroundColor: "#22c55e",
              paddingAll: "lg"
            },
            body: {
              type: "box",
              layout: "vertical",
              contents: [
                {
                  type: "box",
                  layout: "horizontal",
                  contents: [
                    {
                      type: "text",
                      text: "Meeting",
                      color: "#8c8c8c",
                      size: "sm",
                      flex: 2
                    },
                    {
                      type: "text",
                      text: dateStr,
                      wrap: true,
                      size: "sm",
                      flex: 5
                    }
                  ],
                  spacing: "sm"
                },
                {
                  type: "separator",
                  margin: "md"
                },
                {
                  type: "box",
                  layout: "horizontal",
                  contents: [
                    {
                      type: "text",
                      text: "ตัวแทน",
                      color: "#8c8c8c",
                      size: "sm",
                      flex: 2
                    },
                    {
                      type: "text",
                      text: substitute_name,
                      wrap: true,
                      size: "sm",
                      weight: "bold",
                      flex: 5
                    }
                  ],
                  spacing: "sm",
                  margin: "md"
                },
                {
                  type: "box",
                  layout: "horizontal",
                  contents: [
                    {
                      type: "text",
                      text: "เบอร์โทร",
                      color: "#8c8c8c",
                      size: "sm",
                      flex: 2
                    },
                    {
                      type: "text",
                      text: normalizedPhone.replace(/(\d{3})(\d{3})(\d{4})/, "$1-$2-$3"),
                      size: "sm",
                      flex: 5
                    }
                  ],
                  spacing: "sm",
                  margin: "md"
                }
              ],
              paddingAll: "lg"
            },
            footer: {
              type: "box",
              layout: "vertical",
              contents: [
                {
                  type: "text",
                  text: "หากต้องการยกเลิก กรุณาพิมพ์ \"ส่งตัวแทน\" อีกครั้ง",
                  size: "xs",
                  color: "#8c8c8c",
                  wrap: true,
                  align: "center"
                }
              ],
              paddingAll: "md"
            }
          }
        };

        const lineClient = new LineClient(tenant.line_channel_access_token);
        await lineClient.pushMessage(participant.line_user_id, flexMessage);
        console.log(`${logPrefix} LINE notification sent to:`, participant.line_user_id);
      } catch (notifyError: any) {
        console.error(`${logPrefix} Failed to send LINE notification:`, notifyError.message);
        // Don't fail the request if notification fails
      }
    };

    if (existing) {
      // Update existing request
      const { data: updated, error: updateError } = await supabaseAdmin
        .from("substitute_requests")
        .update({
          substitute_name,
          substitute_phone: normalizedPhone,
          substitute_email: substitute_email || null,
          status: "pending",
          cancelled_at: null,
          cancel_reason: null
        })
        .eq("request_id", existing.request_id)
        .select()
        .single();

      if (updateError) {
        console.error(`${logPrefix} Update error:`, updateError);
        return res.status(500).json({ success: false, error: "Failed to update request" });
      }

      console.log(`${logPrefix} Updated substitute request:`, updated.request_id);
      
      // Send LINE notification (async, don't wait)
      sendLineNotification(updated, true);
      
      return res.json({ success: true, request: updated, updated: true });
    }

    // Create new request
    const { data: newRequest, error: insertError } = await supabaseAdmin
      .from("substitute_requests")
      .insert({
        tenant_id: meeting.tenant_id,
        meeting_id: actualMeetingId,
        member_participant_id: participantId,
        substitute_name,
        substitute_phone: normalizedPhone,
        substitute_email: substitute_email || null,
        status: "pending"
      })
      .select()
      .single();

    if (insertError) {
      console.error(`${logPrefix} Insert error:`, insertError);
      return res.status(500).json({ success: false, error: "Failed to create request" });
    }

    console.log(`${logPrefix} Created substitute request:`, newRequest.request_id);
    
    // Send LINE notification (async, don't wait)
    sendLineNotification(newRequest, false);
    
    return res.json({ success: true, request: newRequest, created: true });

  } catch (error: any) {
    console.error(`${logPrefix} Error:`, error);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
});

/**
 * GET /api/palms/my-substitute-requests
 * Get member's own substitute requests
 */
router.get("/my-substitute-requests", verifySupabaseAuth, async (req: AuthenticatedRequest, res: Response) => {
  const requestId = crypto.randomUUID().slice(0, 8);
  const logPrefix = `[palms-my-subs:${requestId}]`;

  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    const { tenant_id } = req.query;
    if (!tenant_id) {
      return res.status(400).json({ success: false, error: "Missing tenant_id" });
    }

    const access = await checkMemberAccess(user.id, tenant_id as string);
    if (!access.hasAccess || !access.participantId) {
      return res.status(403).json({ success: false, error: "Access denied" });
    }

    const { data: requests, error } = await supabaseAdmin
      .from("substitute_requests")
      .select(`
        *,
        meeting:meetings(meeting_id, meeting_date, theme)
      `)
      .eq("member_participant_id", access.participantId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(`${logPrefix} Query error:`, error);
      return res.status(500).json({ success: false, error: "Failed to fetch requests" });
    }

    return res.json({ success: true, requests: requests || [] });

  } catch (error: any) {
    console.error(`${logPrefix} Error:`, error);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
});

/**
 * DELETE /api/palms/substitute-request/:requestId
 * Cancel a substitute request
 * Supports both Supabase auth and substitute token auth
 */
router.delete("/substitute-request/:requestId", async (req: SubstituteTokenRequest, res: Response) => {
  const requestId = crypto.randomUUID().slice(0, 8);
  const logPrefix = `[palms-cancel-sub:${requestId}]`;

  try {
    const { requestId: subRequestId } = req.params;
    const { reason } = req.body;

    // Get request first
    const { data: request, error: fetchError } = await supabaseAdmin
      .from("substitute_requests")
      .select("*, member_participant_id, tenant_id")
      .eq("request_id", subRequestId)
      .single();

    if (fetchError || !request) {
      return res.status(404).json({ success: false, error: "Request not found" });
    }

    // Check for substitute token (from LINE bot flow)
    const substituteToken = req.headers["x-substitute-token"] as string;
    if (substituteToken) {
      const payload = verifyProfileToken(substituteToken, "substitute_request");
      if (!payload) {
        return res.status(401).json({ success: false, error: "Token หมดอายุหรือไม่ถูกต้อง" });
      }
      // Verify token matches request owner
      if (payload.participant_id !== request.member_participant_id) {
        return res.status(403).json({ success: false, error: "Access denied" });
      }
    } else {
      // No token - require Supabase auth (for backward compatibility)
      return res.status(401).json({ success: false, error: "กรุณาใช้ลิงก์จาก LINE bot" });
    }

    // Update status to cancelled
    const { error: updateError } = await supabaseAdmin
      .from("substitute_requests")
      .update({
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
        cancel_reason: reason || null
      })
      .eq("request_id", subRequestId);

    if (updateError) {
      console.error(`${logPrefix} Update error:`, updateError);
      return res.status(500).json({ success: false, error: "Failed to cancel request" });
    }

    console.log(`${logPrefix} Cancelled substitute request:`, subRequestId);
    return res.json({ success: true });

  } catch (error: any) {
    console.error(`${logPrefix} Error:`, error);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
});

// ============================================
// MEETING ATTENDANCE (PALMS) ENDPOINTS
// ============================================

/**
 * GET /api/palms/meeting/:meetingId/attendance
 * Get PALMS attendance for a meeting
 */
router.get("/meeting/:meetingId/attendance", async (req: Request, res: Response) => {
  const requestId = crypto.randomUUID().slice(0, 8);
  const logPrefix = `[palms-get-attendance:${requestId}]`;

  try {
    const { meetingId } = req.params;

    // Get meeting
    const { data: meeting, error: meetingError } = await supabaseAdmin
      .from("meetings")
      .select("meeting_id, tenant_id, meeting_date, theme")
      .eq("meeting_id", meetingId)
      .single();

    if (meetingError || !meeting) {
      return res.status(404).json({ success: false, error: "Meeting not found" });
    }

    // Get all members for this tenant
    const { data: members, error: membersError } = await supabaseAdmin
      .from("participants")
      .select("participant_id, full_name_th, nickname_th, status, phone, photo_url")
      .eq("tenant_id", meeting.tenant_id)
      .eq("status", "member")
      .order("full_name_th");

    if (membersError) {
      console.error(`${logPrefix} Members query error:`, membersError);
      return res.status(500).json({ success: false, error: "Failed to fetch members" });
    }

    // Get existing attendance records
    const { data: attendance, error: attendanceError } = await supabaseAdmin
      .from("meeting_attendance")
      .select(`
        *,
        substitute_request:substitute_requests(substitute_name, substitute_phone)
      `)
      .eq("meeting_id", meetingId);

    if (attendanceError) {
      console.error(`${logPrefix} Attendance query error:`, attendanceError);
      return res.status(500).json({ success: false, error: "Failed to fetch attendance" });
    }

    // Get pending substitute requests
    const { data: subRequests } = await supabaseAdmin
      .from("substitute_requests")
      .select(`
        *,
        member:participants!member_participant_id(full_name_th, nickname_th)
      `)
      .eq("meeting_id", meetingId)
      .eq("status", "pending");

    // Get check-ins for this meeting
    const { data: checkins } = await supabaseAdmin
      .from("checkins")
      .select("participant_id, checkin_time, source")
      .eq("meeting_id", meetingId);

    // Get visitors for this meeting
    const { data: visitors } = await supabaseAdmin
      .from("participants")
      .select("participant_id, full_name_th, nickname_th, phone")
      .eq("tenant_id", meeting.tenant_id)
      .in("status", ["visitor", "prospect"]);

    const visitorCheckins = checkins?.filter(c => 
      visitors?.some(v => v.participant_id === c.participant_id)
    ) || [];

    // Create attendance map
    const attendanceMap = new Map(
      (attendance || []).map(a => [a.participant_id, a])
    );
    const checkinMap = new Map(
      (checkins || []).map(c => [c.participant_id, c])
    );

    // Merge members with their attendance status
    const memberAttendance = (members || []).map(member => {
      const att = attendanceMap.get(member.participant_id);
      const checkin = checkinMap.get(member.participant_id);
      
      return {
        ...member,
        palms_status: att?.palms_status || (checkin ? "P" : "A"),
        attendance_id: att?.attendance_id || null,
        substitute_request: att?.substitute_request || null,
        managed_reason: att?.managed_reason || null,
        source: att?.source || (checkin ? "qr" : null),
        checkin_time: checkin?.checkin_time || null
      };
    });

    // Calculate summary
    const summary = {
      P: memberAttendance.filter(m => m.palms_status === "P").length,
      A: memberAttendance.filter(m => m.palms_status === "A").length,
      L: memberAttendance.filter(m => m.palms_status === "L").length,
      M: memberAttendance.filter(m => m.palms_status === "M").length,
      S: memberAttendance.filter(m => m.palms_status === "S").length,
      V: visitorCheckins.length,
      total_members: members?.length || 0
    };

    return res.json({
      success: true,
      meeting,
      members: memberAttendance,
      pending_substitutes: subRequests || [],
      visitor_count: visitorCheckins.length,
      summary
    });

  } catch (error: any) {
    console.error(`${logPrefix} Error:`, error);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
});

/**
 * POST /api/palms/meeting/:meetingId/attendance
 * Update PALMS attendance for a member (Admin only)
 */
router.post("/meeting/:meetingId/attendance", verifySupabaseAuth, async (req: AuthenticatedRequest, res: Response) => {
  const requestId = crypto.randomUUID().slice(0, 8);
  const logPrefix = `[palms-update-attendance:${requestId}]`;

  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    const { meetingId } = req.params;
    const { participant_id, palms_status, managed_reason, substitute_request_id } = req.body;

    if (!participant_id || !palms_status) {
      return res.status(400).json({ 
        success: false, 
        error: "Missing required fields: participant_id, palms_status" 
      });
    }

    // Validate palms_status
    const validStatuses = ["P", "A", "L", "M", "S"];
    if (!validStatuses.includes(palms_status)) {
      return res.status(400).json({ 
        success: false, 
        error: "Invalid palms_status. Must be P, A, L, M, or S" 
      });
    }

    // Get meeting
    const { data: meeting, error: meetingError } = await supabaseAdmin
      .from("meetings")
      .select("meeting_id, tenant_id")
      .eq("meeting_id", meetingId)
      .single();

    if (meetingError || !meeting) {
      return res.status(404).json({ success: false, error: "Meeting not found" });
    }

    // Check admin access
    const isAdmin = await checkAdminAccess(user.id, meeting.tenant_id);
    if (!isAdmin) {
      return res.status(403).json({ success: false, error: "Admin access required" });
    }

    // Upsert attendance record
    const { data: result, error: upsertError } = await supabaseAdmin
      .from("meeting_attendance")
      .upsert({
        tenant_id: meeting.tenant_id,
        meeting_id: meetingId,
        participant_id,
        palms_status,
        managed_reason: palms_status === "M" ? managed_reason : null,
        substitute_request_id: palms_status === "S" ? substitute_request_id : null,
        source: "manual",
        recorded_by: user.id
      }, {
        onConflict: "meeting_id,participant_id"
      })
      .select()
      .single();

    if (upsertError) {
      console.error(`${logPrefix} Upsert error:`, upsertError);
      return res.status(500).json({ success: false, error: "Failed to update attendance" });
    }

    // If status is S and there's a substitute request, mark it as confirmed
    if (palms_status === "S" && substitute_request_id) {
      await supabaseAdmin
        .from("substitute_requests")
        .update({ status: "confirmed", confirmed_at: new Date().toISOString() })
        .eq("request_id", substitute_request_id);
    }

    console.log(`${logPrefix} Updated attendance:`, result.attendance_id);
    return res.json({ success: true, attendance: result });

  } catch (error: any) {
    console.error(`${logPrefix} Error:`, error);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
});

/**
 * POST /api/palms/meeting/:meetingId/bulk-attendance
 * Bulk update attendance for multiple members
 */
router.post("/meeting/:meetingId/bulk-attendance", verifySupabaseAuth, async (req: AuthenticatedRequest, res: Response) => {
  const requestId = crypto.randomUUID().slice(0, 8);
  const logPrefix = `[palms-bulk-attendance:${requestId}]`;

  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    const { meetingId } = req.params;
    const { attendance_records } = req.body;

    if (!attendance_records || !Array.isArray(attendance_records)) {
      return res.status(400).json({ 
        success: false, 
        error: "Missing or invalid attendance_records array" 
      });
    }

    // Get meeting
    const { data: meeting, error: meetingError } = await supabaseAdmin
      .from("meetings")
      .select("meeting_id, tenant_id")
      .eq("meeting_id", meetingId)
      .single();

    if (meetingError || !meeting) {
      return res.status(404).json({ success: false, error: "Meeting not found" });
    }

    // Check admin access
    const isAdmin = await checkAdminAccess(user.id, meeting.tenant_id);
    if (!isAdmin) {
      return res.status(403).json({ success: false, error: "Admin access required" });
    }

    // Prepare records for upsert
    const records = attendance_records.map((r: any) => ({
      tenant_id: meeting.tenant_id,
      meeting_id: meetingId,
      participant_id: r.participant_id,
      palms_status: r.palms_status,
      managed_reason: r.palms_status === "M" ? r.managed_reason : null,
      substitute_request_id: r.palms_status === "S" ? r.substitute_request_id : null,
      source: "manual",
      recorded_by: user.id
    }));

    const { error: upsertError } = await supabaseAdmin
      .from("meeting_attendance")
      .upsert(records, { onConflict: "meeting_id,participant_id" });

    if (upsertError) {
      console.error(`${logPrefix} Bulk upsert error:`, upsertError);
      return res.status(500).json({ success: false, error: "Failed to update attendance" });
    }

    console.log(`${logPrefix} Bulk updated ${records.length} attendance records`);
    return res.json({ success: true, updated: records.length });

  } catch (error: any) {
    console.error(`${logPrefix} Error:`, error);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
});

/**
 * GET /api/palms/member/:participantId/rolling-status
 * Get rolling 6-month A and S counts for a member
 */
router.get("/member/:participantId/rolling-status", async (req: Request, res: Response) => {
  const requestId = crypto.randomUUID().slice(0, 8);
  const logPrefix = `[palms-rolling:${requestId}]`;

  try {
    const { participantId } = req.params;

    // Calculate date 6 months ago
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    // Get attendance records with meeting dates
    const { data: attendance, error } = await supabaseAdmin
      .from("meeting_attendance")
      .select(`
        palms_status,
        meeting:meetings!inner(meeting_date)
      `)
      .eq("participant_id", participantId)
      .gte("meeting.meeting_date", sixMonthsAgo.toISOString().split("T")[0]);

    if (error) {
      console.error(`${logPrefix} Query error:`, error);
      return res.status(500).json({ success: false, error: "Failed to fetch data" });
    }

    const counts = {
      A: (attendance || []).filter(a => a.palms_status === "A").length,
      S: (attendance || []).filter(a => a.palms_status === "S").length,
      total_meetings: attendance?.length || 0
    };

    return res.json({
      success: true,
      participant_id: participantId,
      rolling_6_months: counts,
      limit: 3,
      warnings: {
        A: counts.A >= 2,
        S: counts.S >= 2
      }
    });

  } catch (error: any) {
    console.error(`${logPrefix} Error:`, error);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
});

/**
 * GET /api/palms/meeting/:meetingId/export
 * Export PALMS report in text format
 */
router.get("/meeting/:meetingId/export", async (req: Request, res: Response) => {
  const requestId = crypto.randomUUID().slice(0, 8);
  const logPrefix = `[palms-export:${requestId}]`;

  try {
    const { meetingId } = req.params;
    const { format } = req.query; // text or json

    // Get meeting
    const { data: meeting, error: meetingError } = await supabaseAdmin
      .from("meetings")
      .select(`
        meeting_id, tenant_id, meeting_date, theme,
        tenant:tenants(name)
      `)
      .eq("meeting_id", meetingId)
      .single();

    if (meetingError || !meeting) {
      return res.status(404).json({ success: false, error: "Meeting not found" });
    }

    // Get all members
    const { data: members } = await supabaseAdmin
      .from("participants")
      .select("participant_id, full_name_th, nickname_th")
      .eq("tenant_id", meeting.tenant_id)
      .eq("status", "member");

    // Get attendance
    const { data: attendance } = await supabaseAdmin
      .from("meeting_attendance")
      .select(`
        *,
        substitute_request:substitute_requests(substitute_name)
      `)
      .eq("meeting_id", meetingId);

    // Get check-ins
    const { data: checkins } = await supabaseAdmin
      .from("checkins")
      .select("participant_id")
      .eq("meeting_id", meetingId);

    // Get visitor count
    const { data: visitors } = await supabaseAdmin
      .from("participants")
      .select("participant_id")
      .eq("tenant_id", meeting.tenant_id)
      .in("status", ["visitor", "prospect"]);

    const visitorCheckins = checkins?.filter(c => 
      visitors?.some(v => v.participant_id === c.participant_id)
    ) || [];

    // Build attendance map
    const attendanceMap = new Map(
      (attendance || []).map(a => [a.participant_id, a])
    );
    const checkinSet = new Set(
      (checkins || []).map(c => c.participant_id)
    );

    // Categorize members
    const categorized: Record<string, Array<{ name: string; sub?: string }>> = {
      P: [], A: [], L: [], M: [], S: []
    };

    (members || []).forEach(m => {
      const att = attendanceMap.get(m.participant_id);
      const hasCheckin = checkinSet.has(m.participant_id);
      const status = att?.palms_status || (hasCheckin ? "P" : "A");
      const displayName = m.nickname_th || m.full_name_th;
      
      if (status === "S" && att?.substitute_request?.substitute_name) {
        categorized[status].push({ 
          name: displayName, 
          sub: att.substitute_request.substitute_name 
        });
      } else {
        categorized[status].push({ name: displayName });
      }
    });

    // Format date
    const meetingDate = new Date(meeting.meeting_date);
    const dateStr = `${meetingDate.getDate()}/${meetingDate.getMonth() + 1}/${meetingDate.getFullYear() % 100}`;

    // Calculate meeting number (count meetings before this date)
    const { count: meetingNumber } = await supabaseAdmin
      .from("meetings")
      .select("meeting_id", { count: "exact", head: true })
      .eq("tenant_id", meeting.tenant_id)
      .lte("meeting_date", meeting.meeting_date);

    if (format === "json") {
      return res.json({
        success: true,
        chapter: (meeting as any).tenant?.name,
        date: dateStr,
        meeting_number: meetingNumber,
        total_members: members?.length || 0,
        summary: {
          P: categorized.P.length,
          A: categorized.A.length,
          L: categorized.L.length,
          M: categorized.M.length,
          S: categorized.S.length,
          V: visitorCheckins.length
        },
        details: categorized
      });
    }

    // Text format
    const formatNames = (items: Array<{ name: string; sub?: string }>) => {
      if (items.length === 0) return "";
      return items.map(i => i.sub ? `${i.name} → ${i.sub}` : i.name).join(" / ");
    };

    const textReport = `PALMS Report ${dateStr}
Member ${members?.length || 0} Meeting ${meetingNumber}

P - ${categorized.P.length}${categorized.P.length > 0 ? ` (${formatNames(categorized.P)})` : ""}
A - ${categorized.A.length}${categorized.A.length > 0 ? ` (${formatNames(categorized.A)})` : ""}
L - ${categorized.L.length}${categorized.L.length > 0 ? ` (${formatNames(categorized.L)})` : ""}
M - ${categorized.M.length}${categorized.M.length > 0 ? ` (${formatNames(categorized.M)})` : ""}
S - ${categorized.S.length}${categorized.S.length > 0 ? ` (${formatNames(categorized.S)})` : ""}
V - ${visitorCheckins.length}`;

    return res.json({ success: true, text: textReport });

  } catch (error: any) {
    console.error(`${logPrefix} Error:`, error);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
});

/**
 * GET /api/palms/substitute-requests/by-phone
 * Check if a phone number matches any pending substitute request
 * Used during check-in to detect substitutes
 */
router.get("/substitute-requests/by-phone", async (req: Request, res: Response) => {
  const requestId = crypto.randomUUID().slice(0, 8);
  const logPrefix = `[palms-sub-by-phone:${requestId}]`;

  try {
    const { phone, meeting_id } = req.query;

    if (!phone || !meeting_id) {
      return res.status(400).json({ 
        success: false, 
        error: "Missing required params: phone, meeting_id" 
      });
    }

    const normalizedPhone = String(phone).replace(/\D/g, "");

    const { data: subRequest, error } = await supabaseAdmin
      .from("substitute_requests")
      .select(`
        *,
        member:participants!member_participant_id(
          participant_id, full_name_th, nickname_th
        )
      `)
      .eq("meeting_id", meeting_id)
      .eq("substitute_phone", normalizedPhone)
      .eq("status", "pending")
      .single();

    if (error && error.code !== "PGRST116") { // PGRST116 = no rows
      console.error(`${logPrefix} Query error:`, error);
      return res.status(500).json({ success: false, error: "Database error" });
    }

    if (!subRequest) {
      return res.json({ success: true, found: false });
    }

    return res.json({
      success: true,
      found: true,
      substitute_request: subRequest
    });

  } catch (error: any) {
    console.error(`${logPrefix} Error:`, error);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
});

/**
 * GET /api/palms/meeting/:meetingId/substitute-requests
 * Get all pending substitute requests for a meeting (for POS admin)
 */
router.get("/meeting/:meetingId/substitute-requests", verifySupabaseAuth, async (req: AuthenticatedRequest, res: Response) => {
  const requestId = crypto.randomUUID().slice(0, 8);
  const logPrefix = `[palms-meeting-subs:${requestId}]`;

  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    const { meetingId } = req.params;

    // Get meeting
    const { data: meeting, error: meetingError } = await supabaseAdmin
      .from("meetings")
      .select("meeting_id, tenant_id, meeting_date, theme")
      .eq("meeting_id", meetingId)
      .single();

    if (meetingError || !meeting) {
      return res.status(404).json({ success: false, error: "Meeting not found" });
    }

    // Check admin access
    const isAdmin = await checkAdminAccess(user.id, meeting.tenant_id);
    if (!isAdmin) {
      return res.status(403).json({ success: false, error: "Admin access required" });
    }

    // Get all substitute requests for this meeting
    const { data: requests, error } = await supabaseAdmin
      .from("substitute_requests")
      .select(`
        *,
        member:participants!member_participant_id(
          participant_id, full_name_th, nickname_th, phone, photo_url
        )
      `)
      .eq("meeting_id", meetingId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(`${logPrefix} Query error:`, error);
      return res.status(500).json({ success: false, error: "Database error" });
    }

    // Separate by status
    const pending = (requests || []).filter(r => r.status === "pending");
    const confirmed = (requests || []).filter(r => r.status === "confirmed");
    const cancelled = (requests || []).filter(r => r.status === "cancelled");

    return res.json({
      success: true,
      meeting,
      pending,
      confirmed,
      cancelled,
      total: requests?.length || 0
    });

  } catch (error: any) {
    console.error(`${logPrefix} Error:`, error);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
});

/**
 * POST /api/palms/confirm-substitute
 * Confirm a substitute check-in and create attendance record
 */
router.post("/confirm-substitute", verifySupabaseAuth, async (req: AuthenticatedRequest, res: Response) => {
  const requestId = crypto.randomUUID().slice(0, 8);
  const logPrefix = `[palms-confirm-sub:${requestId}]`;

  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    const { request_id } = req.body;

    if (!request_id) {
      return res.status(400).json({ success: false, error: "Missing request_id" });
    }

    // Get the substitute request with meeting details
    const { data: subRequest, error: fetchError } = await supabaseAdmin
      .from("substitute_requests")
      .select(`
        *,
        member:participants!member_participant_id(
          participant_id, full_name_th, line_user_id
        ),
        meeting:meetings(meeting_id, tenant_id, meeting_date, theme)
      `)
      .eq("request_id", request_id)
      .single();

    if (fetchError || !subRequest) {
      return res.status(404).json({ success: false, error: "Substitute request not found" });
    }

    // Verify tenant consistency: substitute request tenant must match meeting tenant
    const meetingTenantId = subRequest.meeting?.tenant_id;
    if (!meetingTenantId || meetingTenantId !== subRequest.tenant_id) {
      console.error(`${logPrefix} Tenant mismatch: request=${subRequest.tenant_id}, meeting=${meetingTenantId}`);
      return res.status(403).json({ success: false, error: "Invalid request" });
    }

    // Check admin access against meeting's tenant (authoritative source)
    const isAdmin = await checkAdminAccess(user.id, meetingTenantId);
    if (!isAdmin) {
      return res.status(403).json({ success: false, error: "Admin access required" });
    }

    // Check if already confirmed
    if (subRequest.status === "confirmed") {
      return res.status(400).json({ success: false, error: "Request already confirmed" });
    }

    if (subRequest.status === "cancelled") {
      return res.status(400).json({ success: false, error: "Request was cancelled" });
    }

    // Update substitute request status
    const { error: updateError } = await supabaseAdmin
      .from("substitute_requests")
      .update({
        status: "confirmed",
        confirmed_at: new Date().toISOString()
      })
      .eq("request_id", request_id);

    if (updateError) {
      console.error(`${logPrefix} Update error:`, updateError);
      return res.status(500).json({ success: false, error: "Failed to confirm request" });
    }

    // Create/update attendance record with S status
    const { error: attendanceError } = await supabaseAdmin
      .from("meeting_attendance")
      .upsert({
        tenant_id: subRequest.tenant_id,
        meeting_id: subRequest.meeting_id,
        participant_id: subRequest.member_participant_id,
        palms_status: "S",
        substitute_request_id: request_id,
        source: "pos",
        recorded_by: user.id,
        recorded_at: new Date().toISOString()
      }, {
        onConflict: "meeting_id,participant_id"
      });

    if (attendanceError) {
      console.error(`${logPrefix} Attendance error:`, attendanceError);
      // Don't fail - the substitute is confirmed, just log error
    }

    // Send LINE notification to member if they have line_user_id
    if (subRequest.member?.line_user_id) {
      try {
        const { LineClient } = await import("../services/line/lineClient");
        
        // Get tenant's access token
        const { data: tenant } = await supabaseAdmin
          .from("tenants")
          .select("line_channel_access_token")
          .eq("tenant_id", subRequest.tenant_id)
          .single();

        if (tenant?.line_channel_access_token) {
          const lineClient = new LineClient(tenant.line_channel_access_token);
          const meetingDate = new Date(subRequest.meeting?.meeting_date);
          const dateStr = meetingDate.toLocaleDateString("th-TH", {
            year: "numeric",
            month: "long",
            day: "numeric"
          });

          const message = {
            type: "flex" as const,
            altText: "ตัวแทนเข้าร่วมแล้ว",
            contents: {
              type: "bubble",
              size: "kilo",
              header: {
                type: "box",
                layout: "vertical",
                backgroundColor: "#22C55E",
                paddingAll: "12px",
                contents: [
                  {
                    type: "text",
                    text: "ตัวแทนเข้าร่วมแล้ว",
                    weight: "bold",
                    color: "#FFFFFF",
                    size: "md"
                  }
                ]
              },
              body: {
                type: "box",
                layout: "vertical",
                spacing: "sm",
                paddingAll: "16px",
                contents: [
                  {
                    type: "text",
                    text: `Meeting: ${dateStr}`,
                    size: "sm",
                    color: "#6B7280"
                  },
                  {
                    type: "text",
                    text: `ตัวแทน: ${subRequest.substitute_name}`,
                    weight: "bold",
                    size: "md",
                    margin: "md"
                  },
                  {
                    type: "text",
                    text: `เบอร์โทร: ${subRequest.substitute_phone}`,
                    size: "sm",
                    color: "#6B7280"
                  }
                ]
              }
            }
          };

          await lineClient.pushMessage(subRequest.member.line_user_id, message);
          console.log(`${logPrefix} LINE notification sent to member:`, subRequest.member.full_name_th);
        }
      } catch (notifyError: any) {
        console.error(`${logPrefix} Failed to send LINE notification:`, notifyError.message);
        // Don't fail the request - notification is optional
      }
    }

    console.log(`${logPrefix} Substitute confirmed:`, request_id, "for member:", subRequest.member?.full_name_th);
    
    return res.json({
      success: true,
      message: `ยืนยันตัวแทน ${subRequest.substitute_name} สำเร็จ`,
      substitute_request: {
        ...subRequest,
        status: "confirmed",
        confirmed_at: new Date().toISOString()
      }
    });

  } catch (error: any) {
    console.error(`${logPrefix} Error:`, error);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
});

// ============================================
// WALK-IN SUBSTITUTE ENDPOINTS
// ============================================

/**
 * POST /api/palms/walkin-substitute
 * Admin registers a walk-in substitute (someone who showed up without prior registration)
 */
router.post("/walkin-substitute", verifySupabaseAuth, async (req: AuthenticatedRequest, res: Response) => {
  const requestId = crypto.randomUUID().slice(0, 8);
  const logPrefix = `[palms-walkin-sub:${requestId}]`;

  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    const { 
      meeting_id, 
      substitute_name, 
      substitute_phone, 
      substitute_email,
      member_participant_id // Optional - may be null if unknown
    } = req.body;

    if (!meeting_id || !substitute_name || !substitute_phone) {
      return res.status(400).json({ 
        success: false, 
        error: "Missing required fields: meeting_id, substitute_name, substitute_phone" 
      });
    }

    // Get meeting to verify tenant
    const { data: meeting, error: meetingError } = await supabaseAdmin
      .from("meetings")
      .select("meeting_id, tenant_id, meeting_date")
      .eq("meeting_id", meeting_id)
      .single();

    if (meetingError || !meeting) {
      return res.status(404).json({ success: false, error: "Meeting not found" });
    }

    // Verify admin access
    const hasAccess = await checkAdminAccess(user.id, meeting.tenant_id);
    if (!hasAccess) {
      return res.status(403).json({ success: false, error: "Access denied" });
    }

    // Normalize phone number
    let normalizedPhone = substitute_phone.replace(/[\s-]/g, "");
    if (normalizedPhone.startsWith("+66")) {
      normalizedPhone = "0" + normalizedPhone.slice(3);
    } else if (normalizedPhone.startsWith("66") && normalizedPhone.length === 11) {
      normalizedPhone = "0" + normalizedPhone.slice(2);
    }

    // Check if member already has a confirmed substitute for this meeting
    if (member_participant_id) {
      const { data: existingSub } = await supabaseAdmin
        .from("substitute_requests")
        .select("request_id")
        .eq("meeting_id", meeting_id)
        .eq("member_participant_id", member_participant_id)
        .eq("status", "confirmed")
        .single();

      if (existingSub) {
        return res.status(400).json({ 
          success: false, 
          error: "สมาชิกนี้มีตัวแทนในการประชุมนี้แล้ว" 
        });
      }
    }

    // Create walk-in substitute request and immediately confirm it
    const now = new Date().toISOString();
    const { data: newRequest, error: insertError } = await supabaseAdmin
      .from("substitute_requests")
      .insert({
        tenant_id: meeting.tenant_id,
        meeting_id: meeting_id,
        member_participant_id: member_participant_id || null,
        substitute_name,
        substitute_phone: normalizedPhone,
        substitute_email: substitute_email || null,
        status: "confirmed",
        confirmed_at: now,
        is_walkin: true
      })
      .select(`
        *,
        member:participants!substitute_requests_member_participant_id_fkey (
          participant_id,
          full_name_th,
          nickname_th,
          phone
        )
      `)
      .single();

    if (insertError) {
      console.error(`${logPrefix} Insert error:`, insertError);
      return res.status(500).json({ success: false, error: "Failed to create walk-in substitute" });
    }

    // If member is assigned, create attendance record with S status
    if (member_participant_id) {
      const { error: attendanceError } = await supabaseAdmin
        .from("meeting_attendance")
        .upsert({
          tenant_id: meeting.tenant_id,
          meeting_id: meeting_id,
          participant_id: member_participant_id,
          palms_status: "S",
          substitute_request_id: newRequest.request_id,
          source: "pos",
          recorded_by: user.id,
          recorded_at: now
        }, {
          onConflict: "meeting_id,participant_id"
        });

      if (attendanceError) {
        console.error(`${logPrefix} Attendance error:`, attendanceError);
        // Don't fail - the substitute is created
      }
    }

    console.log(`${logPrefix} Walk-in substitute created:`, newRequest.request_id, 
      member_participant_id ? `for member: ${newRequest.member?.full_name_th}` : "(unassigned)");

    return res.json({
      success: true,
      message: member_participant_id 
        ? `ลงทะเบียนตัวแทน ${substitute_name} แทน ${newRequest.member?.full_name_th} สำเร็จ`
        : `ลงทะเบียนตัวแทน ${substitute_name} สำเร็จ (ยังไม่ได้จับคู่กับสมาชิก)`,
      substitute_request: newRequest
    });

  } catch (error: any) {
    console.error(`${logPrefix} Error:`, error);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
});

/**
 * PATCH /api/palms/walkin-substitute/:requestId/assign
 * Assign an unassigned walk-in substitute to a member
 */
router.patch("/walkin-substitute/:requestId/assign", verifySupabaseAuth, async (req: AuthenticatedRequest, res: Response) => {
  const requestId = crypto.randomUUID().slice(0, 8);
  const logPrefix = `[palms-assign-sub:${requestId}]`;

  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    const { requestId: subRequestId } = req.params;
    const { member_participant_id } = req.body;

    if (!member_participant_id) {
      return res.status(400).json({ success: false, error: "Missing member_participant_id" });
    }

    // Get the substitute request
    const { data: subRequest, error: fetchError } = await supabaseAdmin
      .from("substitute_requests")
      .select(`
        *,
        meeting:meetings!substitute_requests_meeting_id_fkey (
          meeting_id,
          tenant_id,
          meeting_date
        )
      `)
      .eq("request_id", subRequestId)
      .single();

    if (fetchError || !subRequest) {
      return res.status(404).json({ success: false, error: "Substitute request not found" });
    }

    // Verify admin access
    const hasAccess = await checkAdminAccess(user.id, subRequest.meeting.tenant_id);
    if (!hasAccess) {
      return res.status(403).json({ success: false, error: "Access denied" });
    }

    // Check if already assigned
    if (subRequest.member_participant_id) {
      return res.status(400).json({ 
        success: false, 
        error: "This substitute is already assigned to a member" 
      });
    }

    // Get member info
    const { data: member, error: memberError } = await supabaseAdmin
      .from("participants")
      .select("participant_id, full_name_th, nickname_th")
      .eq("participant_id", member_participant_id)
      .eq("tenant_id", subRequest.meeting.tenant_id)
      .single();

    if (memberError || !member) {
      return res.status(404).json({ success: false, error: "Member not found" });
    }

    // Update the substitute request
    const { error: updateError } = await supabaseAdmin
      .from("substitute_requests")
      .update({ member_participant_id })
      .eq("request_id", subRequestId);

    if (updateError) {
      console.error(`${logPrefix} Update error:`, updateError);
      return res.status(500).json({ success: false, error: "Failed to assign substitute" });
    }

    // Create attendance record with S status
    const { error: attendanceError } = await supabaseAdmin
      .from("meeting_attendance")
      .upsert({
        tenant_id: subRequest.meeting.tenant_id,
        meeting_id: subRequest.meeting_id,
        participant_id: member_participant_id,
        palms_status: "S",
        substitute_request_id: subRequestId,
        source: "pos",
        recorded_by: user.id,
        recorded_at: new Date().toISOString()
      }, {
        onConflict: "meeting_id,participant_id"
      });

    if (attendanceError) {
      console.error(`${logPrefix} Attendance error:`, attendanceError);
      // Don't fail - assignment is done
    }

    console.log(`${logPrefix} Walk-in substitute assigned:`, subRequestId, "to member:", member.full_name_th);

    return res.json({
      success: true,
      message: `จับคู่ตัวแทน ${subRequest.substitute_name} กับ ${member.full_name_th} สำเร็จ`,
      member
    });

  } catch (error: any) {
    console.error(`${logPrefix} Error:`, error);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
});

/**
 * GET /api/palms/meeting/:meetingId/unassigned-substitutes
 * Get list of walk-in substitutes that haven't been assigned to a member
 */
router.get("/meeting/:meetingId/unassigned-substitutes", verifySupabaseAuth, async (req: AuthenticatedRequest, res: Response) => {
  const requestId = crypto.randomUUID().slice(0, 8);
  const logPrefix = `[palms-unassigned-subs:${requestId}]`;

  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    const { meetingId } = req.params;

    // Get meeting to verify tenant
    const { data: meeting, error: meetingError } = await supabaseAdmin
      .from("meetings")
      .select("meeting_id, tenant_id")
      .eq("meeting_id", meetingId)
      .single();

    if (meetingError || !meeting) {
      return res.status(404).json({ success: false, error: "Meeting not found" });
    }

    // Verify admin access
    const hasAccess = await checkAdminAccess(user.id, meeting.tenant_id);
    if (!hasAccess) {
      return res.status(403).json({ success: false, error: "Access denied" });
    }

    // Get unassigned walk-in substitutes
    const { data: unassigned, error: fetchError } = await supabaseAdmin
      .from("substitute_requests")
      .select("*")
      .eq("meeting_id", meetingId)
      .eq("is_walkin", true)
      .is("member_participant_id", null)
      .order("created_at", { ascending: false });

    if (fetchError) {
      console.error(`${logPrefix} Fetch error:`, fetchError);
      return res.status(500).json({ success: false, error: "Failed to fetch unassigned substitutes" });
    }

    console.log(`${logPrefix} Found ${unassigned?.length || 0} unassigned walk-in substitutes`);

    return res.json({
      success: true,
      unassigned: unassigned || []
    });

  } catch (error: any) {
    console.error(`${logPrefix} Error:`, error);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
});

// ============================================
// ON-TIME CHECK-IN MANAGEMENT
// ============================================

/**
 * POST /api/palms/meeting/:meetingId/close-ontime
 * Admin closes on-time check-in window - subsequent check-ins will be marked as late
 */
router.post("/meeting/:meetingId/close-ontime", verifySupabaseAuth, async (req: AuthenticatedRequest, res: Response) => {
  const requestId = crypto.randomUUID().slice(0, 8);
  const logPrefix = `[palms-close-ontime:${requestId}]`;

  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    const { meetingId } = req.params;

    // Get meeting to verify tenant
    const { data: meeting, error: meetingError } = await supabaseAdmin
      .from("meetings")
      .select("meeting_id, tenant_id, meeting_date, ontime_closed_at")
      .eq("meeting_id", meetingId)
      .single();

    if (meetingError || !meeting) {
      return res.status(404).json({ success: false, error: "Meeting not found" });
    }

    // Verify admin access
    const hasAccess = await checkAdminAccess(user.id, meeting.tenant_id);
    if (!hasAccess) {
      return res.status(403).json({ success: false, error: "Access denied" });
    }

    // Check if already closed
    if (meeting.ontime_closed_at) {
      return res.json({
        success: true,
        message: "On-time ถูกปิดแล้ว",
        ontime_closed_at: meeting.ontime_closed_at,
        already_closed: true
      });
    }

    // Close on-time window
    const closedAt = new Date().toISOString();
    const { error: updateError } = await supabaseAdmin
      .from("meetings")
      .update({ ontime_closed_at: closedAt })
      .eq("meeting_id", meetingId);

    if (updateError) {
      console.error(`${logPrefix} Update error:`, updateError);
      return res.status(500).json({ success: false, error: "Failed to close on-time" });
    }

    console.log(`${logPrefix} On-time closed for meeting:`, meetingId, "at:", closedAt);
    
    return res.json({
      success: true,
      message: "ปิดรับ On-time เรียบร้อย",
      ontime_closed_at: closedAt
    });

  } catch (error: any) {
    console.error(`${logPrefix} Error:`, error);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
});

/**
 * POST /api/palms/meeting/:meetingId/reopen-ontime
 * Admin reopens on-time check-in window (undo close)
 */
router.post("/meeting/:meetingId/reopen-ontime", verifySupabaseAuth, async (req: AuthenticatedRequest, res: Response) => {
  const requestId = crypto.randomUUID().slice(0, 8);
  const logPrefix = `[palms-reopen-ontime:${requestId}]`;

  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    const { meetingId } = req.params;

    // Get meeting to verify tenant
    const { data: meeting, error: meetingError } = await supabaseAdmin
      .from("meetings")
      .select("meeting_id, tenant_id")
      .eq("meeting_id", meetingId)
      .single();

    if (meetingError || !meeting) {
      return res.status(404).json({ success: false, error: "Meeting not found" });
    }

    // Verify admin access
    const hasAccess = await checkAdminAccess(user.id, meeting.tenant_id);
    if (!hasAccess) {
      return res.status(403).json({ success: false, error: "Access denied" });
    }

    // Reopen on-time window
    const { error: updateError } = await supabaseAdmin
      .from("meetings")
      .update({ ontime_closed_at: null })
      .eq("meeting_id", meetingId);

    if (updateError) {
      console.error(`${logPrefix} Update error:`, updateError);
      return res.status(500).json({ success: false, error: "Failed to reopen on-time" });
    }

    console.log(`${logPrefix} On-time reopened for meeting:`, meetingId);
    
    return res.json({
      success: true,
      message: "เปิดรับ On-time อีกครั้ง"
    });

  } catch (error: any) {
    console.error(`${logPrefix} Error:`, error);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
});

// ============================================
// CLOSE MEETING
// ============================================

/**
 * POST /api/palms/meeting/:meetingId/close
 * Close the meeting - anyone who hasn't checked in will be marked as absent
 */
router.post("/meeting/:meetingId/close", verifySupabaseAuth, async (req: AuthenticatedRequest, res: Response) => {
  const requestId = crypto.randomUUID().slice(0, 8);
  const logPrefix = `[palms-close-meeting:${requestId}]`;

  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    const { meetingId } = req.params;

    // Get meeting info
    const { data: meeting, error: meetingError } = await supabaseAdmin
      .from("meetings")
      .select("meeting_id, tenant_id, meeting_closed_at")
      .eq("meeting_id", meetingId)
      .single();

    if (meetingError || !meeting) {
      return res.status(404).json({ success: false, error: "Meeting not found" });
    }

    // Verify admin access
    const hasAccess = await checkAdminAccess(user.id, meeting.tenant_id);
    if (!hasAccess) {
      return res.status(403).json({ success: false, error: "Access denied" });
    }

    // Check if already closed
    if (meeting.meeting_closed_at) {
      return res.status(400).json({ 
        success: false, 
        error: "Meeting is already closed",
        meeting_closed_at: meeting.meeting_closed_at
      });
    }

    // Close the meeting
    const closedAt = new Date().toISOString();
    const { error: updateError } = await supabaseAdmin
      .from("meetings")
      .update({ meeting_closed_at: closedAt })
      .eq("meeting_id", meetingId);

    if (updateError) {
      console.error(`${logPrefix} Update error:`, updateError);
      return res.status(500).json({ success: false, error: "Failed to close meeting" });
    }

    console.log(`${logPrefix} Meeting closed:`, meetingId, "at:", closedAt);
    
    return res.json({
      success: true,
      message: "ปิด Meeting เรียบร้อย",
      meeting_closed_at: closedAt
    });

  } catch (error: any) {
    console.error(`${logPrefix} Error:`, error);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
});

// ============================================
// MEETING ATTENDANCE REPORT
// ============================================

/**
 * GET /api/palms/meeting/:meetingId/attendance-report
 * Get detailed attendance report showing member status breakdown:
 * - มา (ตรงเวลา) - Checked in before on-time closed (is_late = false or null)
 * - มา (สาย) - Checked in after on-time closed (is_late = true)
 * - ส่งตัวแทน - Has confirmed substitute request
 * - ขาด - No check-in and no substitute
 */
router.get("/meeting/:meetingId/attendance-report", verifySupabaseAuth, async (req: AuthenticatedRequest, res: Response) => {
  const requestId = crypto.randomUUID().slice(0, 8);
  const logPrefix = `[palms-attendance-report:${requestId}]`;

  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    const { meetingId } = req.params;

    // Get meeting info
    const { data: meeting, error: meetingError } = await supabaseAdmin
      .from("meetings")
      .select("meeting_id, tenant_id, meeting_date, theme, ontime_closed_at, meeting_closed_at")
      .eq("meeting_id", meetingId)
      .single();

    if (meetingError || !meeting) {
      return res.status(404).json({ success: false, error: "Meeting not found" });
    }

    // Verify admin access
    const hasAccess = await checkAdminAccess(user.id, meeting.tenant_id);
    if (!hasAccess) {
      return res.status(403).json({ success: false, error: "Access denied" });
    }

    // Get all members for this tenant
    const { data: members, error: membersError } = await supabaseAdmin
      .from("participants")
      .select("participant_id, full_name_th, nickname_th, phone, photo_url, company, position")
      .eq("tenant_id", meeting.tenant_id)
      .eq("status", "member")
      .order("full_name_th");

    if (membersError) {
      console.error(`${logPrefix} Members query error:`, membersError);
      return res.status(500).json({ success: false, error: "Failed to fetch members" });
    }

    // Get check-ins for this meeting (with is_late field)
    const { data: checkins, error: checkinsError } = await supabaseAdmin
      .from("checkins")
      .select("participant_id, checkin_time, is_late")
      .eq("meeting_id", meetingId);

    if (checkinsError) {
      console.error(`${logPrefix} Checkins query error:`, checkinsError);
      return res.status(500).json({ success: false, error: "Failed to fetch checkins" });
    }

    // Get confirmed substitute requests for this meeting
    const { data: substituteRequests, error: subsError } = await supabaseAdmin
      .from("substitute_requests")
      .select("member_participant_id, substitute_name, substitute_phone, status, confirmed_at")
      .eq("meeting_id", meetingId)
      .eq("status", "confirmed");

    if (subsError) {
      console.error(`${logPrefix} Substitute requests query error:`, subsError);
      return res.status(500).json({ success: false, error: "Failed to fetch substitute requests" });
    }

    // Create maps for quick lookup
    const checkinMap = new Map(
      (checkins || []).map(c => [c.participant_id, c])
    );
    const substituteMap = new Map(
      (substituteRequests || []).map(s => [s.member_participant_id, s])
    );

    // Check if meeting has ended (either explicitly closed OR meeting_date < today)
    const today = new Date().toISOString().split('T')[0];
    const meetingHasPassed = !!meeting.meeting_closed_at || meeting.meeting_date < today;

    // Categorize each member
    type AttendanceStatus = "on_time" | "late" | "substitute" | "absent" | "pending";
    
    interface MemberReport {
      participant_id: string;
      full_name_th: string;
      nickname_th: string | null;
      phone: string | null;
      photo_url: string | null;
      company: string | null;
      position: string | null;
      attendance_status: AttendanceStatus;
      status_label: string;
      checkin_time: string | null;
      substitute_name: string | null;
      substitute_phone: string | null;
    }

    const memberReports: MemberReport[] = (members || []).map(member => {
      const checkin = checkinMap.get(member.participant_id);
      const substitute = substituteMap.get(member.participant_id);

      let attendanceStatus: AttendanceStatus;
      let statusLabel: string;

      if (substitute) {
        // Has confirmed substitute
        attendanceStatus = "substitute";
        statusLabel = "ส่งตัวแทน";
      } else if (checkin) {
        // Checked in - check if late
        if (checkin.is_late === true) {
          attendanceStatus = "late";
          statusLabel = "มา (สาย)";
        } else {
          attendanceStatus = "on_time";
          statusLabel = "มา (ตรงเวลา)";
        }
      } else if (!meetingHasPassed) {
        // Meeting hasn't happened yet - show pending
        attendanceStatus = "pending";
        statusLabel = "รอเข้าร่วม";
      } else {
        // Meeting has passed, no check-in and no substitute = absent
        attendanceStatus = "absent";
        statusLabel = "ขาด";
      }

      return {
        participant_id: member.participant_id,
        full_name_th: member.full_name_th,
        nickname_th: member.nickname_th,
        phone: member.phone,
        photo_url: member.photo_url,
        company: member.company,
        position: member.position,
        attendance_status: attendanceStatus,
        status_label: statusLabel,
        checkin_time: checkin?.checkin_time || null,
        substitute_name: substitute?.substitute_name || null,
        substitute_phone: substitute?.substitute_phone || null
      };
    });

    // Calculate summary counts
    const summary = {
      total_members: memberReports.length,
      on_time: memberReports.filter(m => m.attendance_status === "on_time").length,
      late: memberReports.filter(m => m.attendance_status === "late").length,
      substitute: memberReports.filter(m => m.attendance_status === "substitute").length,
      absent: memberReports.filter(m => m.attendance_status === "absent").length,
      pending: memberReports.filter(m => m.attendance_status === "pending").length,
      attendance_rate: 0,
      meeting_has_passed: meetingHasPassed
    };

    // Calculate attendance rate (on_time + late + substitute / total)
    const attendedCount = summary.on_time + summary.late + summary.substitute;
    summary.attendance_rate = summary.total_members > 0 
      ? Math.round((attendedCount / summary.total_members) * 100) 
      : 0;

    console.log(`${logPrefix} Generated attendance report for meeting:`, meetingId, "summary:", summary);

    return res.json({
      success: true,
      meeting: {
        meeting_id: meeting.meeting_id,
        meeting_date: meeting.meeting_date,
        theme: meeting.theme,
        ontime_closed_at: meeting.ontime_closed_at,
        meeting_closed_at: meeting.meeting_closed_at
      },
      summary,
      members: memberReports
    });

  } catch (error: any) {
    console.error(`${logPrefix} Error:`, error);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
});

/**
 * GET /api/palms/meeting/:meetingId/registered-visitors
 * Get visitors who registered for a meeting (via meeting_registrations) with their check-in status
 * Returns: visitors with phone, line_user_id, and check-in status for follow-up
 */
router.get("/meeting/:meetingId/registered-visitors", verifySupabaseAuth, async (req: AuthenticatedRequest, res: Response) => {
  const requestId = crypto.randomUUID().slice(0, 8);
  const logPrefix = `[palms-registered-visitors:${requestId}]`;

  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    const { meetingId } = req.params;

    // Get meeting info
    const { data: meeting, error: meetingError } = await supabaseAdmin
      .from("meetings")
      .select("meeting_id, tenant_id, meeting_date, theme, meeting_closed_at")
      .eq("meeting_id", meetingId)
      .single();

    if (meetingError || !meeting) {
      return res.status(404).json({ success: false, error: "Meeting not found" });
    }

    // Verify admin access
    const hasAccess = await checkAdminAccess(user.id, meeting.tenant_id);
    if (!hasAccess) {
      return res.status(403).json({ success: false, error: "Access denied" });
    }

    // Get ALL registered visitors from meeting_registrations table
    // Important: Don't filter by participant.status because visitors may have converted to members
    const { data: registrations, error: registrationsError } = await supabaseAdmin
      .from("meeting_registrations")
      .select(`
        registration_id,
        participant_id,
        registration_status,
        registered_at,
        participant:participants!inner(
          participant_id,
          full_name_th,
          nickname_th,
          phone,
          company,
          line_user_id,
          photo_url,
          status,
          referred_by_participant_id
        )
      `)
      .eq("meeting_id", meetingId);

    if (registrationsError) {
      console.error(`${logPrefix} Registrations query error:`, registrationsError);
      return res.status(500).json({ success: false, error: "Failed to fetch registrations" });
    }

    // Short-circuit if no registrations exist
    if (!registrations || registrations.length === 0) {
      console.log(`${logPrefix} No registered visitors found for meeting, returning empty list`);
      return res.json({
        success: true,
        meeting: {
          meeting_id: meeting.meeting_id,
          meeting_date: meeting.meeting_date,
          theme: meeting.theme,
          meeting_closed_at: meeting.meeting_closed_at
        },
        visitors: [],
        summary: { total: 0, checked_in: 0, not_checked_in: 0 }
      });
    }

    // Get participant IDs from registrations
    const participantIds = registrations.map(r => r.participant_id);

    // Get referrer IDs to fetch their names
    const referrerIds = registrations
      .map(r => (r.participant as any).referred_by_participant_id)
      .filter((id: string | null) => id !== null) as string[];

    // Get referrer names if there are any
    let referrerMap = new Map<string, { full_name_th: string; nickname_th: string | null }>();
    if (referrerIds.length > 0) {
      const { data: referrers } = await supabaseAdmin
        .from("participants")
        .select("participant_id, full_name_th, nickname_th")
        .in("participant_id", referrerIds);
      
      if (referrers) {
        referrerMap = new Map(
          referrers.map(r => [r.participant_id, { full_name_th: r.full_name_th, nickname_th: r.nickname_th }])
        );
      }
    }

    // Get check-ins for these registered visitors
    const { data: checkins, error: checkinsError } = await supabaseAdmin
      .from("checkins")
      .select("participant_id, checkin_time, is_late")
      .eq("meeting_id", meetingId)
      .in("participant_id", participantIds);

    if (checkinsError) {
      console.error(`${logPrefix} Checkins query error:`, checkinsError);
      return res.status(500).json({ success: false, error: "Failed to fetch checkins" });
    }

    // Create checkin map for quick lookup
    const checkinMap = new Map(
      (checkins || []).map(c => [c.participant_id, c])
    );

    // Build visitor list with check-in status, current status, and referrer info
    const registeredVisitors = registrations.map(reg => {
      const participant = reg.participant as any;
      const checkin = checkinMap.get(reg.participant_id) as any;
      const referrerId = participant.referred_by_participant_id;
      const referrer = referrerId ? referrerMap.get(referrerId) : null;
      
      // Check if this visitor has been converted to a member
      const currentStatus = participant.status; // "visitor", "prospect", "member", etc.
      const isConvertedMember = currentStatus === "member";
      
      return {
        participant_id: participant.participant_id,
        full_name_th: participant.full_name_th,
        nickname_th: participant.nickname_th,
        phone: participant.phone,
        company: participant.company,
        line_user_id: participant.line_user_id,
        photo_url: participant.photo_url,
        registered_at: reg.registered_at,
        checked_in: !!checkin,
        checkin_time: checkin?.checkin_time || null,
        is_late: checkin?.is_late || false,
        referred_by_name: referrer?.full_name_th || null,
        referred_by_nickname: referrer?.nickname_th || null,
        current_status: currentStatus,
        is_converted_member: isConvertedMember
      };
    });

    const checkedInCount = registeredVisitors.filter(v => v.checked_in).length;
    const notCheckedInCount = registeredVisitors.filter(v => !v.checked_in).length;
    const convertedMemberCount = registeredVisitors.filter(v => v.is_converted_member).length;

    console.log(`${logPrefix} Found ${registeredVisitors.length} registered visitors for meeting:`, meetingId, 
      `(checked_in: ${checkedInCount}, not_checked_in: ${notCheckedInCount}, converted_to_member: ${convertedMemberCount})`);

    return res.json({
      success: true,
      meeting: {
        meeting_id: meeting.meeting_id,
        meeting_date: meeting.meeting_date,
        theme: meeting.theme,
        meeting_closed_at: meeting.meeting_closed_at
      },
      visitors: registeredVisitors,
      summary: {
        total: registeredVisitors.length,
        checked_in: checkedInCount,
        not_checked_in: notCheckedInCount,
        converted_to_member: convertedMemberCount
      }
    });

  } catch (error: any) {
    console.error(`${logPrefix} Error:`, error);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
});

/**
 * GET /api/palms/meeting/:meetingId/visitor-stats
 * Get aggregated visitor statistics for a meeting including trends and conversions
 */
router.get("/meeting/:meetingId/visitor-stats", verifySupabaseAuth, async (req: AuthenticatedRequest, res: Response) => {
  const requestId = crypto.randomUUID().slice(0, 8);
  const logPrefix = `[palms-visitor-stats:${requestId}]`;

  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    const { meetingId } = req.params;

    // Get meeting info
    const { data: meeting, error: meetingError } = await supabaseAdmin
      .from("meetings")
      .select("meeting_id, tenant_id, meeting_date, theme")
      .eq("meeting_id", meetingId)
      .single();

    if (meetingError || !meeting) {
      return res.status(404).json({ success: false, error: "Meeting not found" });
    }

    // Verify admin access
    const hasAccess = await checkAdminAccess(user.id, meeting.tenant_id);
    if (!hasAccess) {
      return res.status(403).json({ success: false, error: "Access denied" });
    }

    // Get ALL registered visitors for this meeting (including those who became members)
    // This counts everyone who was a visitor at time of registration
    const { data: registrations, error: regError } = await supabaseAdmin
      .from("meeting_registrations")
      .select(`
        participant_id,
        registered_at,
        participant:participants!inner(
          participant_id,
          full_name_th,
          nickname_th,
          status,
          company,
          phone,
          photo_url,
          referred_by_participant_id,
          updated_at
        )
      `)
      .eq("meeting_id", meetingId);

    if (regError) {
      console.error(`${logPrefix} Registration query error:`, regError);
      return res.status(500).json({ success: false, error: "Database error" });
    }

    // Filter to visitors/prospects at time of meeting (exclude members who registered as members)
    // A member who was a visitor and converted would still be counted
    const visitorRegistrations = (registrations || []).filter(r => {
      const p = r.participant as any;
      // Include visitors, prospects, AND members who recently converted (likely were visitors)
      return p.status === "visitor" || p.status === "prospect" || p.status === "member";
    });

    const participantIds = visitorRegistrations.map(r => r.participant_id);

    // Get check-ins for visitors
    const { data: checkins } = await supabaseAdmin
      .from("checkins")
      .select("participant_id, checkin_time")
      .eq("meeting_id", meetingId)
      .in("participant_id", participantIds.length > 0 ? participantIds : ['none']);

    const checkinSet = new Set((checkins || []).map(c => c.participant_id));
    const checkedInCount = visitorRegistrations.filter(r => checkinSet.has(r.participant_id)).length;
    const noShowCount = visitorRegistrations.length - checkedInCount;

    // Get previous 4 meetings for trend comparison
    const { data: previousMeetings } = await supabaseAdmin
      .from("meetings")
      .select("meeting_id, meeting_date")
      .eq("tenant_id", meeting.tenant_id)
      .lt("meeting_date", meeting.meeting_date)
      .order("meeting_date", { ascending: false })
      .limit(4);

    // Get ALL previous meetings for repeat visitor detection (no limit)
    const { data: allPreviousMeetings } = await supabaseAdmin
      .from("meetings")
      .select("meeting_id, meeting_date")
      .eq("tenant_id", meeting.tenant_id)
      .lt("meeting_date", meeting.meeting_date)
      .order("meeting_date", { ascending: false });

    let previousAvg = 0;
    let repeatVisitors: any[] = [];

    if (previousMeetings && previousMeetings.length > 0) {
      const prevMeetingIds = previousMeetings.map(m => m.meeting_id);

      // Get visitor counts for previous meetings (for trend)
      const { data: prevRegs } = await supabaseAdmin
        .from("meeting_registrations")
        .select(`
          meeting_id,
          participant:participants!inner(status)
        `)
        .in("meeting_id", prevMeetingIds)
        .in("participant.status", ["visitor", "prospect"]);

      if (prevRegs && prevRegs.length > 0) {
        // Divide by actual number of meetings, not fixed 4
        previousAvg = Math.round(prevRegs.length / previousMeetings.length);
      }
    }

    // Find repeat visitors (ONLY from check-ins, looking at ALL previous meetings)
    if (participantIds.length > 0 && allPreviousMeetings && allPreviousMeetings.length > 0) {
      const allPrevMeetingIds = allPreviousMeetings.map(m => m.meeting_id);
      
      // Create meeting date lookup for last visit date
      const meetingDateMap = new Map<string, string>();
      allPreviousMeetings.forEach(m => {
        meetingDateMap.set(m.meeting_id, m.meeting_date);
      });

      // Get previous check-ins ONLY (not registrations)
      const { data: prevCheckins } = await supabaseAdmin
        .from("checkins")
        .select("participant_id, meeting_id")
        .in("meeting_id", allPrevMeetingIds)
        .in("participant_id", participantIds);

      if (prevCheckins && prevCheckins.length > 0) {
        // Count unique meetings per participant and track last visit
        const visitData = new Map<string, { meetings: Set<string>; lastVisitDate: string | null }>();
        
        prevCheckins.forEach(c => {
          if (!visitData.has(c.participant_id)) {
            visitData.set(c.participant_id, { meetings: new Set(), lastVisitDate: null });
          }
          const data = visitData.get(c.participant_id)!;
          data.meetings.add(c.meeting_id);
          
          // Track the most recent visit date using Date objects for accurate comparison
          const meetingDate = meetingDateMap.get(c.meeting_id);
          if (meetingDate) {
            const newDate = new Date(meetingDate);
            const currentLastDate = data.lastVisitDate ? new Date(data.lastVisitDate) : null;
            if (!currentLastDate || newDate > currentLastDate) {
              data.lastVisitDate = meetingDate;
            }
          }
        });

        // Get participant details for repeat visitors
        repeatVisitors = visitorRegistrations
          .filter(r => visitData.has(r.participant_id))
          .map(r => {
            const p = r.participant as any;
            const data = visitData.get(r.participant_id)!;
            return {
              participant_id: p.participant_id,
              full_name_th: p.full_name_th,
              nickname_th: p.nickname_th,
              company: p.company,
              photo_url: p.photo_url,
              previous_visits: data.meetings.size,
              last_visit_date: data.lastVisitDate
            };
          });
      }
    }

    // Get conversion stats: visitors who registered for this meeting and are now members
    // This counts per-meeting conversion, not lifetime
    const registeredParticipantIds = visitorRegistrations.map(r => r.participant_id);
    let convertedToMemberCount = 0;
    
    if (registeredParticipantIds.length > 0) {
      const { count } = await supabaseAdmin
        .from("participants")
        .select("participant_id", { count: "exact", head: true })
        .in("participant_id", registeredParticipantIds)
        .eq("status", "member");
      
      convertedToMemberCount = count || 0;
    }

    // Get visitors with referrals (indicates engagement)
    const referredVisitors = visitorRegistrations.filter(r => {
      const p = r.participant as any;
      return p.referred_by_participant_id != null;
    }).length;

    // Calculate trend delta
    const trendDelta = previousAvg > 0 
      ? Math.round(((visitorRegistrations.length - previousAvg) / previousAvg) * 100)
      : 0;

    console.log(`${logPrefix} Visitor stats for meeting:`, meetingId, {
      total: visitorRegistrations.length,
      checkedIn: checkedInCount,
      noShow: noShowCount,
      repeatCount: repeatVisitors.length,
      previousAvg,
      trendDelta
    });

    return res.json({
      success: true,
      stats: {
        total_registered: visitorRegistrations.length,
        checked_in: checkedInCount,
        no_show: noShowCount,
        no_show_rate: visitorRegistrations.length > 0 
          ? Math.round((noShowCount / visitorRegistrations.length) * 100) 
          : 0,
        repeat_visitors: repeatVisitors.length,
        referred_visitors: referredVisitors,
        converted_to_member: convertedToMemberCount,
        previous_avg: previousAvg,
        trend_delta: trendDelta
      },
      repeat_visitor_list: repeatVisitors
    });

  } catch (error: any) {
    console.error(`${logPrefix} Error:`, error);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
});

// ============================================
// CONVERT VISITOR TO MEMBER
// ============================================

/**
 * POST /api/palms/participants/:participantId/convert-to-member
 * Admin converts a visitor/prospect to member status
 */
router.post("/participants/:participantId/convert-to-member", verifySupabaseAuth, async (req: AuthenticatedRequest, res: Response) => {
  const requestId = crypto.randomUUID().slice(0, 8);
  const logPrefix = `[palms-convert:${requestId}]`;

  try {
    const userId = req.user?.id;
    const { participantId } = req.params;
    const { tenant_id } = req.body;

    if (!userId) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    if (!participantId || !tenant_id) {
      return res.status(400).json({ success: false, error: "Missing participantId or tenant_id" });
    }

    console.log(`${logPrefix} User ${userId} converting participant ${participantId} to member`);

    // Check admin access
    const hasAccess = await checkAdminAccess(userId, tenant_id);
    if (!hasAccess) {
      return res.status(403).json({ success: false, error: "ไม่มีสิทธิ์ดำเนินการ" });
    }

    // Get participant info
    const { data: participant, error: participantError } = await supabaseAdmin
      .from("participants")
      .select("participant_id, full_name_th, nickname_th, status, tenant_id, phone")
      .eq("participant_id", participantId)
      .single();

    if (participantError || !participant) {
      return res.status(404).json({ success: false, error: "ไม่พบข้อมูลผู้เยี่ยมชม" });
    }

    // Verify tenant matches
    if (participant.tenant_id !== tenant_id) {
      return res.status(403).json({ success: false, error: "ข้อมูลไม่ตรงกับ Chapter" });
    }

    // Check if already a member
    if (participant.status === "member") {
      return res.status(400).json({ success: false, error: "บุคคลนี้เป็นสมาชิกอยู่แล้ว" });
    }

    // Update participant status to member
    const { error: updateError } = await supabaseAdmin
      .from("participants")
      .update({ 
        status: "member",
        updated_at: new Date().toISOString()
      })
      .eq("participant_id", participantId);

    if (updateError) {
      console.error(`${logPrefix} Error updating participant:`, updateError);
      return res.status(500).json({ success: false, error: "ไม่สามารถอัพเดทสถานะได้" });
    }

    console.log(`${logPrefix} Successfully converted ${participant.full_name_th || participant.nickname_th} to member`);

    return res.json({
      success: true,
      message: `แปลง ${participant.nickname_th || participant.full_name_th} เป็นสมาชิกสำเร็จ`,
      participant: {
        participant_id: participantId,
        full_name_th: participant.full_name_th,
        nickname_th: participant.nickname_th,
        status: "member"
      }
    });

  } catch (error: any) {
    console.error(`${logPrefix} Error:`, error);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
});

export default router;
