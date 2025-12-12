import { Router, Request, Response } from "express";
import crypto from "crypto";
import { supabaseAdmin } from "../utils/supabaseClient";
import { verifySupabaseAuth, AuthenticatedRequest } from "../utils/auth";
import { verifyProfileToken, ProfileTokenPayload } from "../utils/profileToken";

const router = Router();

// Extended request type for substitute token auth
interface SubstituteTokenRequest extends Request {
  tokenPayload?: ProfileTokenPayload;
}

// Helper: Check if user has admin access to tenant
async function checkAdminAccess(userId: string, tenantId: string): Promise<boolean> {
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

export default router;
