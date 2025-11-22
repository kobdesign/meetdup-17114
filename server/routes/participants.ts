import { Router, Request, Response } from "express";
import { supabaseAdmin } from "../utils/supabaseClient";
import { verifySupabaseAuth, AuthenticatedRequest } from "../utils/auth";
import { generateVCard, getVCardFilename, VCardData } from "../services/line/vcard";
import { generateProfileToken, verifyProfileToken } from "../utils/profileToken";
import { LineClient } from "../services/line/lineClient";
import multer from "multer";
import path from "path";
import crypto from "crypto";

const router = Router();

/**
 * Helper function to generate activation token and send LIFF Flex Message
 * Reusable for both admin manual send and auto-send after LINE registration
 */
async function sendLiffActivationLink(params: {
  participantId: string;
  tenantId: string;
  lineUserId: string;
  fullName: string;
  logPrefix?: string;
}): Promise<{ success: boolean; error?: string; token?: string; liffUrl?: string }> {
  const { participantId, tenantId, lineUserId, fullName, logPrefix = "[sendLiffActivationLink]" } = params;

  try {
    // Revoke any existing unused tokens for this participant to prevent duplicates
    const { error: revokeError } = await supabaseAdmin
      .from("activation_tokens")
      .update({ used_at: new Date().toISOString() })
      .eq("participant_id", participantId)
      .is("used_at", null);

    if (revokeError) {
      console.warn(`${logPrefix} Failed to revoke old tokens:`, revokeError);
      // Continue anyway - this is not critical
    }

    // Generate activation token (7 days expiry)
    const token = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const { error: tokenError } = await supabaseAdmin
      .from("activation_tokens")
      .insert({
        token,
        participant_id: participantId,
        tenant_id: tenantId,
        expires_at: expiresAt.toISOString()
        // used_at is null by default (unused token)
      });

    if (tokenError) {
      console.error(`${logPrefix} Failed to create token:`, tokenError);
      return { success: false, error: "Failed to generate activation token" };
    }

    // Get tenant info for LINE credentials
    const { data: tenantData } = await supabaseAdmin
      .from("tenants")
      .select("tenant_name, line_channel_access_token")
      .eq("tenant_id", tenantId)
      .single();

    if (!tenantData?.line_channel_access_token) {
      return { success: false, error: "LINE channel not configured for this tenant" };
    }

    // Generate LIFF URL
    const liffId = process.env.LIFF_ID;
    if (!liffId) {
      return { success: false, error: "LIFF ID not configured" };
    }

    const liffUrl = `https://liff.line.me/${liffId}?token=${token}`;

    // Send LINE Flex Message
    const lineClient = new LineClient(tenantData.line_channel_access_token);
    
    const flexMessage = {
      type: "flex" as const,
      altText: `ลงทะเบียนบัญชีสำหรับ ${tenantData.tenant_name}`,
      contents: {
        type: "bubble",
        body: {
          type: "box",
          layout: "vertical",
          contents: [
            {
              type: "text",
              text: "🎉 เชิญลงทะเบียน",
              weight: "bold",
              size: "xl",
              color: "#1DB446"
            },
            {
              type: "text",
              text: tenantData.tenant_name,
              size: "sm",
              color: "#999999",
              margin: "md"
            },
            {
              type: "separator",
              margin: "xxl"
            },
            {
              type: "box",
              layout: "vertical",
              margin: "xxl",
              spacing: "sm",
              contents: [
                {
                  type: "text",
                  text: `สวัสดี คุณ${fullName}`,
                  size: "md",
                  wrap: true
                },
                {
                  type: "text",
                  text: "กรุณากดปุ่มด้านล่างเพื่อลงทะเบียนบัญชีผู้ใช้ของคุณ",
                  size: "sm",
                  color: "#666666",
                  margin: "md",
                  wrap: true
                },
                {
                  type: "text",
                  text: "ลิงก์นี้จะหมดอายุใน 7 วัน",
                  size: "xs",
                  color: "#999999",
                  margin: "md"
                }
              ]
            }
          ]
        },
        footer: {
          type: "box",
          layout: "vertical",
          spacing: "sm",
          contents: [
            {
              type: "button",
              style: "primary",
              height: "sm",
              action: {
                type: "uri",
                label: "ลงทะเบียนเลย",
                uri: liffUrl
              }
            },
            {
              type: "box",
              layout: "vertical",
              contents: [],
              margin: "sm"
            }
          ]
        }
      }
    };

    await lineClient.pushMessage(lineUserId, flexMessage);

    console.log(`${logPrefix} Successfully sent LIFF activation link`, {
      participant_id: participantId,
      line_user_id: lineUserId,
      liff_url: liffUrl
    });

    return {
      success: true,
      token,
      liffUrl
    };
  } catch (error: any) {
    console.error(`${logPrefix} Error:`, error);
    return {
      success: false,
      error: error.message || "Internal server error"
    };
  }
}

// Configure multer for avatar uploads (memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, WEBP, and GIF are allowed.'));
    }
  },
});

// Lookup participant by phone number (public endpoint - no auth required)
// Used in check-in flow to find existing participants
router.get("/lookup-by-phone", async (req: Request, res: Response) => {
  const requestId = crypto.randomUUID();
  const logPrefix = `[lookup-by-phone:${requestId}]`;

  try {
    const { phone, meeting_id } = req.query;

    console.log(`${logPrefix} Looking up participant`, {
      phone_masked: phone ? `${String(phone).slice(0, 3)}****` : undefined,
      meeting_id,
    });

    // Validate required fields
    if (!phone || !meeting_id) {
      return res.status(400).json({
        success: false,
        error: "Missing required parameters",
        message: "phone and meeting_id are required"
      });
    }

    // Normalize phone (strip non-digits)
    const normalizedPhone = String(phone).replace(/\D/g, "");
    if (!normalizedPhone) {
      return res.status(400).json({
        success: false,
        error: "Invalid phone number",
        message: "Phone number must contain digits"
      });
    }

    // Get meeting to find tenant_id
    const { data: meeting, error: meetingError } = await supabaseAdmin
      .from("meetings")
      .select("tenant_id")
      .eq("meeting_id", meeting_id)
      .single();

    if (meetingError || !meeting) {
      console.error(`${logPrefix} Meeting not found`, meetingError);
      return res.status(404).json({
        success: false,
        error: "Meeting not found",
        message: "The selected meeting does not exist"
      });
    }

    // Lookup participant by phone (using normalized phone)
    const { data: participant, error: lookupError } = await supabaseAdmin
      .from("participants")
      .select("participant_id, full_name, email, phone, status, company, nickname")
      .eq("tenant_id", meeting.tenant_id)
      .eq("phone", normalizedPhone)
      .maybeSingle();

    if (lookupError) {
      console.error(`${logPrefix} Error looking up participant:`, lookupError);
      return res.status(500).json({
        success: false,
        error: "Database error",
        message: lookupError.message
      });
    }

    console.log(`${logPrefix} Participant ${participant ? 'found' : 'not found'}`);

    return res.json({
      success: true,
      found: !!participant,
      participant: participant || null
    });

  } catch (error: any) {
    console.error(`${logPrefix} Unexpected error:`, error);
    return res.status(500).json({
      success: false,
      error: "Internal server error",
      message: error.message
    });
  }
});

// Check-in participant to a meeting (public endpoint - no auth required)
// New flow: Frontend looks up participant first, then sends participant_id
router.post("/check-in", async (req: Request, res: Response) => {
  const requestId = crypto.randomUUID();
  const logPrefix = `[check-in:${requestId}]`;

  try {
    const { meeting_id, participant_id } = req.body;

    console.log(`${logPrefix} Incoming check-in request`, {
      meeting_id,
      participant_id,
    });

    // Validate required fields
    if (!meeting_id || !participant_id) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields",
        message: "meeting_id and participant_id are required"
      });
    }

    // Get meeting details
    const { data: meeting, error: meetingError } = await supabaseAdmin
      .from("meetings")
      .select("meeting_id, tenant_id")
      .eq("meeting_id", meeting_id)
      .single();

    if (meetingError || !meeting) {
      console.error(`${logPrefix} Meeting not found`, meetingError);
      return res.status(404).json({
        success: false,
        error: "Meeting not found",
        message: "The selected meeting does not exist"
      });
    }

    // Get participant details
    const { data: participant, error: participantError } = await supabaseAdmin
      .from("participants")
      .select("participant_id, full_name, status")
      .eq("participant_id", participant_id)
      .eq("tenant_id", meeting.tenant_id)
      .single();

    if (participantError || !participant) {
      console.error(`${logPrefix} Participant not found`, participantError);
      return res.status(404).json({
        success: false,
        error: "Participant not found",
        message: "Participant does not exist in this tenant"
      });
    }

    console.log(`${logPrefix} Participant found`, {
      participant_id: participant.participant_id,
      status: participant.status,
    });

    // Check if already checked in
    const { data: existingCheckin, error: checkLookupErr } = await supabaseAdmin
      .from("checkins")
      .select("checkin_id")
      .eq("meeting_id", meeting_id)
      .eq("participant_id", participant_id)
      .maybeSingle();

    if (checkLookupErr) {
      console.error(`${logPrefix} Error checking existing check-in:`, checkLookupErr);
    }

    if (existingCheckin) {
      console.log(`${logPrefix} Participant already checked in`);
      return res.json({
        success: false,
        already_checked_in: true,
        message: "คุณได้เช็คอินการประชุมนี้แล้ว"
      });
    }

    // Auto-create meeting_registration if not exists
    const { data: existingRegistration } = await supabaseAdmin
      .from("meeting_registrations")
      .select("registration_id")
      .eq("meeting_id", meeting_id)
      .eq("participant_id", participant_id)
      .maybeSingle();

    if (!existingRegistration) {
      console.log(`${logPrefix} Auto-creating meeting_registration`);
      const { error: regError } = await supabaseAdmin
        .from("meeting_registrations")
        .insert({
          tenant_id: meeting.tenant_id,
          meeting_id,
          participant_id,
          registration_status: "registered"
        });

      if (regError) {
        console.error(`${logPrefix} Failed to auto-create registration:`, regError);
        // Don't fail the check-in, just log the error
      } else {
        console.log(`${logPrefix} Auto-registration successful`);
      }
    }

    // Prepare check-in notes for Alumni revisit
    let checkinNotes = null;
    if (participant.status === "alumni") {
      checkinNotes = `Alumni revisit - ${participant.full_name} กลับมาเยี่ยมชม`;
      console.log(`${logPrefix} Alumni revisit detected`);
    }

    // Auto-upgrade from prospect to visitor upon first check-in
    if (participant.status === "prospect") {
      console.log(`${logPrefix} Upgrading prospect to visitor`);
      const { error: updateError } = await supabaseAdmin
        .from("participants")
        .update({ status: "visitor" })
        .eq("participant_id", participant_id);

      if (updateError) {
        console.error(`${logPrefix} Failed to update status to visitor:`, updateError);
      } else {
        // Write audit log (best-effort)
        try {
          await supabaseAdmin.from("status_audit").insert({
            tenant_id: meeting.tenant_id,
            participant_id: participant_id,
            reason: "First check-in (auto)",
          });
        } catch (e) {
          console.warn(`${logPrefix} status_audit insert failed (ignored)`, e);
        }
      }
    }

    // Create check-in record
    const { error: checkinError } = await supabaseAdmin
      .from("checkins")
      .insert({
        tenant_id: meeting.tenant_id,
        meeting_id,
        participant_id,
        notes: checkinNotes,
        status: "approved", // Auto-approve check-ins
      });

    if (checkinError) {
      console.error(`${logPrefix} Failed to create check-in:`, checkinError);
      return res.status(500).json({
        success: false,
        error: "Failed to create check-in",
        message: checkinError.message
      });
    }

    console.log(`${logPrefix} Check-in successful`);
    return res.json({
      success: true,
      participant_id: participant_id,
      participant_name: participant.full_name,
      participant_status: participant.status,
      message: "Check-in successful"
    });

  } catch (error: any) {
    console.error(`${logPrefix} Error in check-in:`, error);
    return res.status(500).json({
      success: false,
      error: "Internal server error",
      message: error.message
    });
  }
});

// Lookup participant by phone number (public endpoint - no auth required)
// Used for 2-step registration: check if phone exists, then pre-fill form
router.post("/lookup-by-phone", async (req: Request, res: Response) => {
  const requestId = crypto.randomUUID();
  const logPrefix = `[lookup-by-phone:${requestId}]`;

  try {
    const { phone, meeting_id } = req.body;

    if (!phone) {
      return res.status(400).json({
        error: "Missing phone number",
        message: "phone is required"
      });
    }

    if (!meeting_id) {
      return res.status(400).json({
        error: "Missing meeting_id",
        message: "meeting_id is required"
      });
    }

    // Normalize phone (strip non-digits)
    const normalizedPhone = String(phone).replace(/\D/g, "");
    console.log(`${logPrefix} Looking up phone:`, normalizedPhone.slice(0, 3) + '****');

    // Get meeting to derive tenant_id (security: prevents cross-tenant lookups)
    const { data: meeting, error: meetingError } = await supabaseAdmin
      .from("meetings")
      .select("tenant_id")
      .eq("meeting_id", meeting_id)
      .single();

    if (meetingError || !meeting) {
      return res.status(400).json({
        error: "Invalid meeting",
        message: "The selected meeting does not exist"
      });
    }

    // Lookup participant by phone within this tenant
    const { data: participant, error: lookupError } = await supabaseAdmin
      .from("participants")
      .select(`
        participant_id,
        full_name,
        email,
        phone,
        company,
        business_type,
        goal,
        notes,
        status,
        referred_by_participant_id
      `)
      .eq("phone", normalizedPhone)
      .eq("tenant_id", meeting.tenant_id)
      .maybeSingle();

    if (lookupError) {
      console.error(`${logPrefix} Lookup error:`, lookupError);
      return res.status(500).json({
        error: "Lookup failed",
        message: lookupError.message
      });
    }

    if (participant) {
      console.log(`${logPrefix} Found existing participant:`, participant.participant_id);
      return res.json({
        success: true,
        exists: true,
        participant
      });
    } else {
      console.log(`${logPrefix} No participant found for this phone`);
      return res.json({
        success: true,
        exists: false,
        participant: null
      });
    }

  } catch (error: any) {
    console.error(`${logPrefix} Error in phone lookup:`, error);
    return res.status(500).json({
      error: "Internal server error",
      message: error.message
    });
  }
});

// Register a visitor (public endpoint - no auth required)
// Supports two modes:
//   1. INSERT: Create new participant (participant_id not provided)
//   2. UPDATE: Update existing participant (participant_id provided from phone lookup)
// Also supports auto-checkin (status=visitor + immediate check-in)
router.post("/register-visitor", async (req: Request, res: Response) => {
  const requestId = crypto.randomUUID();
  const logPrefix = `[register-visitor:${requestId}]`;

  try {
    const { 
      participant_id, // NEW: If provided, UPDATE existing participant instead of INSERT
      meeting_id, 
      full_name, 
      email, 
      phone, 
      company, 
      business_type, 
      goal, 
      notes,
      auto_checkin, // If true, create as visitor + auto check-in
      referred_by_participant_id // Referral tracking
    } = req.body;

    const isUpdate = !!participant_id;
    console.log(`${logPrefix} Registration request (${isUpdate ? 'UPDATE' : 'INSERT'})`, {
      participant_id,
      meeting_id,
      phone_masked: phone ? `${String(phone).slice(0, 3)}****` : undefined,
      auto_checkin: !!auto_checkin,
    });

    // Validate required fields
    if (!full_name || !email || !phone) {
      return res.status(400).json({ 
        error: "Missing required fields",
        message: "full_name, email, and phone are required"
      });
    }

    // Normalize phone (strip non-digits)
    const normalizedPhone = String(phone).replace(/\D/g, "");
    if (!normalizedPhone) {
      return res.status(400).json({
        error: "Invalid phone number",
        message: "Phone number must contain digits"
      });
    }

    // Derive tenant_id from meeting_id (SECURITY: prevent tenant spoofing)
    let tenant_id: string;
    
    if (meeting_id) {
      const { data: meeting, error: meetingError } = await supabaseAdmin
        .from("meetings")
        .select("tenant_id")
        .eq("meeting_id", meeting_id)
        .single();

      if (meetingError || !meeting) {
        console.error(`${logPrefix} Invalid meeting_id:`, meetingError);
        return res.status(400).json({ 
          error: "Invalid meeting",
          message: "The selected meeting does not exist"
        });
      }

      tenant_id = meeting.tenant_id;
      console.log(`${logPrefix} Derived tenant_id from meeting:`, tenant_id);
    } else {
      // If no meeting_id, reject request (tenant_id is required)
      return res.status(400).json({
        error: "Missing meeting_id",
        message: "meeting_id is required to determine the chapter"
      });
    }

    let participant: any;

    if (isUpdate) {
      // UPDATE MODE: Update existing participant
      console.log(`${logPrefix} Updating existing participant:`, participant_id);

      // SECURITY: First verify participant belongs to this tenant
      const { data: existingParticipant, error: verifyError } = await supabaseAdmin
        .from("participants")
        .select("tenant_id")
        .eq("participant_id", participant_id)
        .single();

      if (verifyError || !existingParticipant) {
        console.error(`${logPrefix} Participant not found:`, verifyError);
        return res.status(404).json({
          error: "Participant not found",
          message: "The participant does not exist"
        });
      }

      if (existingParticipant.tenant_id !== tenant_id) {
        console.error(`${logPrefix} Cross-tenant update attempt! participant tenant: ${existingParticipant.tenant_id}, meeting tenant: ${tenant_id}`);
        return res.status(403).json({
          error: "Forbidden",
          message: "You cannot update a participant from another chapter"
        });
      }

      // Proceed with update
      const { data: updatedParticipant, error: updateError } = await supabaseAdmin
        .from("participants")
        .update({
          full_name,
          email,
          phone: normalizedPhone,
          company: company || null,
          business_type: business_type || null,
          goal: goal || null,
          notes: notes || null,
          referred_by_participant_id: referred_by_participant_id || null,
        })
        .eq("participant_id", participant_id)
        .select()
        .single();

      if (updateError) {
        console.error(`${logPrefix} Error updating participant:`, updateError);
        return res.status(500).json({ 
          error: "Failed to update participant",
          message: updateError.message
        });
      }

      participant = updatedParticipant;
      console.log(`${logPrefix} Participant updated successfully`);

    } else {
      // INSERT MODE: Create new participant
      const initialStatus = auto_checkin ? "visitor" : "prospect";
      console.log(`${logPrefix} Creating new participant with status: ${initialStatus}`);

      const { data: newParticipant, error: participantError } = await supabaseAdmin
        .from("participants")
        .insert({
          tenant_id,
          full_name,
          email,
          phone: normalizedPhone,
          company: company || null,
          business_type: business_type || null,
          goal: goal || null,
          notes: notes || null,
          status: initialStatus,
          referred_by_participant_id: referred_by_participant_id || null,
        })
        .select()
        .single();

      if (participantError) {
        console.error(`${logPrefix} Error creating participant:`, participantError);
        
        // Check if it's a unique constraint violation (Postgres error code 23505)
        // This catches duplicate phone numbers for the same tenant
        if (participantError.code === '23505') {
          return res.status(409).json({ 
            error: "Duplicate phone number",
            message: "หากเคยลงทะเบียนแล้ว ให้เช็คอินด้วยเบอร์โทรศัพท์โดยตรง"
          });
        }
        
        return res.status(500).json({ 
          error: "Failed to create participant",
          message: participantError.message
        });
      }

      participant = newParticipant;
      console.log(`${logPrefix} Participant created successfully`);
    }

    console.log(`${logPrefix} Participant created:`, participant.participant_id);

    // If meeting_id is provided, create a meeting registration
    if (meeting_id) {
      const { error: registrationError } = await supabaseAdmin
        .from("meeting_registrations")
        .insert({
          participant_id: participant.participant_id,
          meeting_id,
          registration_status: "registered"
        });

      if (registrationError) {
        console.error(`${logPrefix} Error creating meeting registration:`, registrationError);
        
        // Delete the participant we just created to rollback
        await supabaseAdmin
          .from("participants")
          .delete()
          .eq("participant_id", participant.participant_id);

        return res.status(500).json({ 
          error: "Failed to create meeting registration",
          message: "Could not register for the meeting. Please try again."
        });
      }
    }

    // If auto_checkin is enabled, create check-in record immediately
    if (auto_checkin && meeting_id) {
      console.log(`${logPrefix} Creating auto check-in`);
      
      const { error: checkinError } = await supabaseAdmin
        .from("checkins")
        .insert({
          tenant_id,
          meeting_id,
          participant_id: participant.participant_id,
          status: "approved",
          notes: "Auto check-in from registration"
        });

      if (checkinError) {
        console.error(`${logPrefix} Error creating auto check-in:`, checkinError);
        
        // Rollback: delete registration and participant
        await supabaseAdmin
          .from("meeting_registrations")
          .delete()
          .eq("participant_id", participant.participant_id)
          .eq("meeting_id", meeting_id);
        
        await supabaseAdmin
          .from("participants")
          .delete()
          .eq("participant_id", participant.participant_id);

        return res.status(500).json({ 
          error: "Failed to auto check-in",
          message: "Could not complete auto check-in. Please try again."
        });
      }

      console.log(`${logPrefix} Auto check-in successful`);
    }

    return res.json({
      success: true,
      participant_id: participant.participant_id,
      status: participant.status,
      auto_checked_in: !!auto_checkin,
      message: auto_checkin 
        ? "Registration and check-in successful" 
        : "Registration successful"
    });

  } catch (error: any) {
    console.error(`${logPrefix} Visitor registration error:`, error);
    return res.status(500).json({ 
      error: "Internal server error",
      message: error.message
    });
  }
});

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
        checkins!checkins_participant_id_fkey (
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
        participant:participants!checkins_participant_id_fkey!inner (
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

// Get visitor pipeline data with upcoming meeting dates and referral info (authenticated endpoint)
router.get("/visitor-pipeline", verifySupabaseAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { tenant_id } = req.query;
    const userId = req.user?.id;

    if (!tenant_id) {
      return res.status(400).json({
        error: "Missing tenant_id",
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

    const isSuperAdmin = userRoles.some(r => r.role === "super_admin" && !r.tenant_id);
    const hasAccessToTenant = userRoles.some(r => r.tenant_id === tenant_id);
    
    if (!isSuperAdmin && !hasAccessToTenant) {
      return res.status(403).json({ 
        error: "Forbidden",
        message: "You don't have access to this chapter"
      });
    }

    // Get participants (prospects, visitors, declined)
    const { data: participants, error: participantsError } = await supabaseAdmin
      .from("participants")
      .select(`
        participant_id,
        tenant_id,
        full_name,
        email,
        phone,
        company,
        nickname,
        business_type,
        status,
        created_at,
        referred_by_participant_id
      `)
      .eq("tenant_id", tenant_id)
      .in("status", ["prospect", "visitor", "declined"])
      .order("created_at", { ascending: false });

    if (participantsError) {
      console.error("Error fetching participants:", participantsError);
      return res.status(500).json({ 
        error: "Failed to fetch participants",
        message: participantsError.message
      });
    }

    // Get referred_by participant info separately (to avoid self-referencing issues)
    const referredByIds = [...new Set(
      participants
        ?.map(p => p.referred_by_participant_id)
        .filter(Boolean) || []
    )];
    
    let referredByMap = new Map<string, any>();
    if (referredByIds.length > 0) {
      const { data: referredByParticipants } = await supabaseAdmin
        .from("participants")
        .select("participant_id, full_name, nickname")
        .in("participant_id", referredByIds);

      if (referredByParticipants) {
        referredByParticipants.forEach(p => {
          referredByMap.set(p.participant_id, p);
        });
      }
    }

    // Get upcoming meetings for each participant
    const participantIds = participants?.map(p => p.participant_id) || [];
    
    let upcomingMeetings: any[] = [];
    if (participantIds.length > 0) {
      const { data: registrations, error: regError } = await supabaseAdmin
        .from("meeting_registrations")
        .select(`
          participant_id,
          meeting:meetings!meeting_registrations_meeting_id_fkey (
            meeting_id,
            meeting_date,
            meeting_time
          )
        `)
        .in("participant_id", participantIds);

      if (regError) {
        console.error("[visitor-pipeline] Error fetching meeting registrations:", regError);
      }

      if (registrations) {
        console.log(`[visitor-pipeline] Raw registrations from Supabase:`, JSON.stringify(registrations.slice(0, 2), null, 2));
        
        const today = new Date().toISOString().split('T')[0];
        
        upcomingMeetings = registrations
          .filter(r => {
            const meeting = r.meeting as any;
            return meeting && meeting.meeting_date && meeting.meeting_date >= today;
          })
          .sort((a, b) => {
            const meetingA = a.meeting as any;
            const meetingB = b.meeting as any;
            const dateA = new Date(meetingA.meeting_date).getTime();
            const dateB = new Date(meetingB.meeting_date).getTime();
            return dateA - dateB;
          });
        
        console.log(`[visitor-pipeline] Found ${upcomingMeetings.length} upcoming meeting registrations from ${registrations.length} total`);
        if (upcomingMeetings.length > 0) {
          console.log(`[visitor-pipeline] Sample upcoming meeting:`, JSON.stringify(upcomingMeetings[0], null, 2));
        }
      }
    }

    // Get check-ins count for each participant (for Hot Leads filtering)
    let checkinCounts = new Map<string, number>();
    if (participantIds.length > 0) {
      const { data: checkinsData } = await supabaseAdmin
        .from("checkins")
        .select("participant_id")
        .in("participant_id", participantIds);

      if (checkinsData) {
        checkinsData.forEach((checkin: any) => {
          const count = checkinCounts.get(checkin.participant_id) || 0;
          checkinCounts.set(checkin.participant_id, count + 1);
        });
      }
    }

    // Combine data: add upcoming meeting, referred_by info, and checkins count to each participant
    const enrichedParticipants = participants?.map((p: any) => {
      const participantUpcomingMeetings = upcomingMeetings
        .filter(r => r.participant_id === p.participant_id)
        .sort((a, b) => {
          const meetingA = a.meeting as any;
          const meetingB = b.meeting as any;
          const dateA = new Date(meetingA.meeting_date).getTime();
          const dateB = new Date(meetingB.meeting_date).getTime();
          return dateA - dateB;
        });
      
      const upcomingReg = participantUpcomingMeetings[0];
      const upcomingMeeting = upcomingReg?.meeting as any;
      
      const referredBy = p.referred_by_participant_id 
        ? referredByMap.get(p.referred_by_participant_id)
        : null;
      
      return {
        ...p,
        upcoming_meeting_date: upcomingMeeting?.meeting_date || null,
        upcoming_meeting_time: upcomingMeeting?.meeting_time || null,
        referred_by_name: referredBy?.nickname || referredBy?.full_name || null,
        checkins_count: checkinCounts.get(p.participant_id) || 0
      };
    });

    return res.json({
      success: true,
      participants: enrichedParticipants || []
    });

  } catch (error: any) {
    console.error("Visitor pipeline error:", error);
    return res.status(500).json({ 
      error: "Internal server error",
      message: error.message
    });
  }
});

// Get participant business card data (public endpoint - for LINE integration)
// Security: Only returns business cards for members (not prospects/visitors)
router.get("/:participantId/business-card", async (req: Request, res: Response) => {
  try {
    const { participantId } = req.params;
    const { tenant_id } = req.query;

    if (!participantId) {
      return res.status(400).json({
        error: "Missing participant ID",
        message: "participantId is required"
      });
    }

    // Require tenant_id for security scoping
    if (!tenant_id) {
      return res.status(400).json({
        error: "Missing tenant ID",
        message: "tenant_id query parameter is required"
      });
    }

    const { data: participant, error } = await supabaseAdmin
      .from("participants")
      .select(`
        participant_id,
        full_name,
        email,
        phone,
        company,
        position,
        business_type,
        tagline,
        photo_url,
        website_url,
        business_address,
        facebook_url,
        instagram_url,
        line_user_id,
        status,
        tenant_id
      `)
      .eq("participant_id", participantId)
      .eq("tenant_id", tenant_id)
      .in("status", ["member", "visitor"]) // Only show active members/visitors
      .single();

    if (error || !participant) {
      console.error("Participant not found:", error);
      return res.status(404).json({
        error: "Participant not found",
        message: "No participant found with this ID or you don't have permission to view"
      });
    }

    // Return business card data
    return res.json({
      success: true,
      businessCard: participant
    });

  } catch (error: any) {
    console.error("Business card fetch error:", error);
    return res.status(500).json({
      error: "Internal server error",
      message: error.message
    });
  }
});

// Download vCard (.vcf file) for a participant (public endpoint - for LINE integration)
// Security: Only returns vCards for members (not prospects/visitors)
router.get("/:participantId/vcard", async (req: Request, res: Response) => {
  try {
    const { participantId } = req.params;
    const { tenant_id } = req.query;

    if (!participantId) {
      return res.status(400).json({
        error: "Missing participant ID",
        message: "participantId is required"
      });
    }

    // Require tenant_id for security scoping
    if (!tenant_id) {
      return res.status(400).json({
        error: "Missing tenant ID",
        message: "tenant_id query parameter is required"
      });
    }

    const { data: participant, error } = await supabaseAdmin
      .from("participants")
      .select(`
        full_name,
        position,
        company,
        email,
        phone,
        website_url,
        business_address,
        photo_url,
        status
      `)
      .eq("participant_id", participantId)
      .eq("tenant_id", tenant_id)
      .in("status", ["member", "visitor"]) // Only show active members/visitors
      .single();

    if (error || !participant) {
      console.error("Participant not found:", error);
      return res.status(404).json({
        error: "Participant not found",
        message: "No participant found with this ID or you don't have permission to view"
      });
    }

    // Generate vCard content
    const vCardContent = generateVCard(participant as VCardData);
    const filename = getVCardFilename(participant.full_name);

    // Set headers for file download
    res.setHeader("Content-Type", "text/vcard; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    
    return res.send(vCardContent);

  } catch (error: any) {
    console.error("vCard generation error:", error);
    return res.status(500).json({
      error: "Internal server error",
      message: error.message
    });
  }
});

// Update participant details (authenticated endpoint - for admin editing)
router.patch("/:participantId", verifySupabaseAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { participantId } = req.params;
    const { full_name, email, phone, company, business_type, status, referred_by_participant_id } = req.body;
    const userId = req.user?.id;

    if (!participantId) {
      return res.status(400).json({
        error: "Missing participant ID",
        message: "participantId is required"
      });
    }

    // Get existing participant to verify tenant ownership
    const { data: existingParticipant, error: fetchError } = await supabaseAdmin
      .from("participants")
      .select("participant_id, tenant_id, phone")
      .eq("participant_id", participantId)
      .single();

    if (fetchError || !existingParticipant) {
      return res.status(404).json({
        error: "Participant not found",
        message: "No participant found with this ID"
      });
    }

    // Verify user has access to this tenant
    // First check if user is a super admin (they can edit any tenant)
    const { data: superAdminRole } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "super_admin")
      .maybeSingle();

    // If not a super admin, check for tenant-specific role
    if (!superAdminRole) {
      const { data: userRole } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("tenant_id", existingParticipant.tenant_id)
        .single();

      if (!userRole) {
        return res.status(403).json({
          error: "Forbidden",
          message: "You don't have permission to edit participants in this chapter"
        });
      }
    }

    // Prepare update data (only update provided fields)
    const updateData: any = {};
    if (full_name !== undefined) updateData.full_name = full_name;
    if (email !== undefined) updateData.email = email || null;
    if (company !== undefined) updateData.company = company || null;
    if (business_type !== undefined) updateData.business_type = business_type || null;
    if (status !== undefined) updateData.status = status;
    if (referred_by_participant_id !== undefined) updateData.referred_by_participant_id = referred_by_participant_id || null;
    
    // Phone number cannot be changed (it's the unique identifier)
    // Silently ignore phone updates

    // Update participant
    const { data: updatedParticipant, error: updateError } = await supabaseAdmin
      .from("participants")
      .update(updateData)
      .eq("participant_id", participantId)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating participant:", updateError);
      return res.status(500).json({
        error: "Failed to update participant",
        message: updateError.message
      });
    }

    return res.json({
      success: true,
      participant: updatedParticipant
    });

  } catch (error: any) {
    console.error("Participant update error:", error);
    return res.status(500).json({
      error: "Internal server error",
      message: error.message
    });
  }
});

// Get members for referral dropdown (public endpoint - used in registration forms)
// Returns members with nickname and full_name for selection
// Uses meeting_id for implicit tenant authorization (prevent data leaks)
router.get("/members-for-referral", async (req: Request, res: Response) => {
  try {
    const { meeting_id } = req.query;

    if (!meeting_id) {
      return res.status(400).json({
        error: "Missing meeting_id",
        message: "meeting_id query parameter is required"
      });
    }

    // Get meeting to find tenant_id (security: prevents arbitrary tenant access)
    const { data: meeting, error: meetingError } = await supabaseAdmin
      .from("meetings")
      .select("tenant_id")
      .eq("meeting_id", meeting_id)
      .single();

    if (meetingError || !meeting) {
      return res.status(404).json({
        error: "Meeting not found",
        message: "The selected meeting does not exist"
      });
    }

    // Query active members only
    const { data: members, error } = await supabaseAdmin
      .from("participants")
      .select("participant_id, full_name, nickname")
      .eq("tenant_id", meeting.tenant_id)
      .eq("status", "member")
      .order("nickname", { ascending: true, nullsFirst: false })
      .order("full_name", { ascending: true });

    if (error) {
      console.error("Failed to fetch members:", error);
      return res.status(500).json({
        error: "Database error",
        message: error.message
      });
    }

    // Return members with display_name (nickname or full_name)
    const membersWithDisplay = (members || []).map(m => ({
      participant_id: m.participant_id,
      full_name: m.full_name,
      nickname: m.nickname,
      display_name: m.nickname || m.full_name
    }));

    return res.json({
      success: true,
      members: membersWithDisplay
    });

  } catch (error: any) {
    console.error("Members query error:", error);
    return res.status(500).json({
      error: "Internal server error",
      message: error.message
    });
  }
});

// ==========================================
// PARTICIPANT PROFILE MANAGEMENT (Token-based auth for LINE users)
// ==========================================

// Generate profile edit token (used by LINE webhook or admin)
// Returns a temporary token that allows participant to edit their profile
router.post("/generate-profile-token", async (req: Request, res: Response) => {
  const requestId = crypto.randomUUID();
  const logPrefix = `[generate-profile-token:${requestId}]`;

  try {
    const { participant_id, tenant_id } = req.body;

    if (!participant_id || !tenant_id) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields",
        message: "participant_id and tenant_id are required"
      });
    }

    // Verify participant exists and belongs to tenant
    const { data: participant, error: participantError } = await supabaseAdmin
      .from("participants")
      .select("participant_id")
      .eq("participant_id", participant_id)
      .eq("tenant_id", tenant_id)
      .single();

    if (participantError || !participant) {
      console.error(`${logPrefix} Participant not found`, participantError);
      return res.status(404).json({
        success: false,
        error: "Participant not found",
        message: "The participant does not exist or does not belong to this chapter"
      });
    }

    // Generate token (valid for 24 hours)
    const token = generateProfileToken(participant_id, tenant_id);

    console.log(`${logPrefix} Token generated for participant ${participant_id}`);

    return res.json({
      success: true,
      token,
      profile_url: `${process.env.REPLIT_DEPLOYMENT_URL || req.get('origin')}/participant-profile/edit?token=${token}`
    });

  } catch (error: any) {
    console.error(`${logPrefix} Error:`, error);
    return res.status(500).json({
      success: false,
      error: "Internal server error",
      message: error.message
    });
  }
});

// Get participant profile (token-based auth - no login required)
router.get("/profile", async (req: Request, res: Response) => {
  const requestId = crypto.randomUUID();
  const logPrefix = `[get-profile:${requestId}]`;

  try {
    const { token } = req.query;

    if (!token || typeof token !== 'string') {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
        message: "Valid token is required"
      });
    }

    // Verify token
    const decoded = verifyProfileToken(token);
    if (!decoded) {
      return res.status(401).json({
        success: false,
        error: "Invalid token",
        message: "Token is invalid or expired"
      });
    }

    console.log(`${logPrefix} Loading profile for participant ${decoded.participant_id}`);

    // Get participant with tenant info
    const { data: participant, error } = await supabaseAdmin
      .from("participants")
      .select(`
        participant_id,
        full_name,
        email,
        phone,
        position,
        company,
        website_url,
        avatar_url,
        tenant_id,
        tenants!inner (
          tenant_name,
          logo_url
        )
      `)
      .eq("participant_id", decoded.participant_id)
      .eq("tenant_id", decoded.tenant_id)
      .single();

    if (error || !participant) {
      console.error(`${logPrefix} Participant not found:`, error);
      return res.status(404).json({
        success: false,
        error: "Participant not found",
        message: "Could not load profile data"
      });
    }

    // Extract tenant info (Supabase returns it as an object, not array with .single())
    const tenantInfo = Array.isArray(participant.tenants) ? participant.tenants[0] : participant.tenants;
    
    return res.json({
      success: true,
      participant: {
        ...participant,
        tenant_name: tenantInfo?.tenant_name,
        logo_url: tenantInfo?.logo_url,
      }
    });

  } catch (error: any) {
    console.error(`${logPrefix} Error:`, error);
    return res.status(500).json({
      success: false,
      error: "Internal server error",
      message: error.message
    });
  }
});

// Update participant profile (token-based auth)
router.patch("/profile", async (req: Request, res: Response) => {
  const requestId = crypto.randomUUID();
  const logPrefix = `[update-profile:${requestId}]`;

  try {
    const { token } = req.query;

    if (!token || typeof token !== 'string') {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
        message: "Valid token is required"
      });
    }

    // Verify token
    const decoded = verifyProfileToken(token);
    if (!decoded) {
      return res.status(401).json({
        success: false,
        error: "Invalid token",
        message: "Token is invalid or expired"
      });
    }

    const { full_name, position, company, phone, email, website_url } = req.body;

    // Validate required fields
    if (!full_name || !phone) {
      return res.status(400).json({
        success: false,
        error: "Validation error",
        message: "full_name and phone are required"
      });
    }

    console.log(`${logPrefix} Updating profile for participant ${decoded.participant_id}`);

    // Normalize phone
    const normalizedPhone = phone.replace(/\D/g, "");

    // Update participant
    const { data: updatedParticipant, error: updateError } = await supabaseAdmin
      .from("participants")
      .update({
        full_name,
        position: position || null,
        company: company || null,
        phone: normalizedPhone,
        email: email || null,
        website_url: website_url || null,
        updated_at: new Date().toISOString(),
      })
      .eq("participant_id", decoded.participant_id)
      .eq("tenant_id", decoded.tenant_id)
      .select(`
        participant_id,
        full_name,
        email,
        phone,
        position,
        company,
        website_url,
        avatar_url,
        tenant_id
      `)
      .single();

    if (updateError) {
      console.error(`${logPrefix} Update error:`, updateError);
      return res.status(500).json({
        success: false,
        error: "Failed to update profile",
        message: updateError.message
      });
    }

    return res.json({
      success: true,
      participant: updatedParticipant
    });

  } catch (error: any) {
    console.error(`${logPrefix} Error:`, error);
    return res.status(500).json({
      success: false,
      error: "Internal server error",
      message: error.message
    });
  }
});

// Upload participant avatar (token-based auth)
router.post("/profile/avatar", upload.single('avatar'), async (req: Request, res: Response) => {
  const requestId = crypto.randomUUID();
  const logPrefix = `[upload-avatar:${requestId}]`;

  try {
    const { token } = req.query;

    if (!token || typeof token !== 'string') {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
        message: "Valid token is required"
      });
    }

    // Verify token
    const decoded = verifyProfileToken(token);
    if (!decoded) {
      return res.status(401).json({
        success: false,
        error: "Invalid token",
        message: "Token is invalid or expired"
      });
    }

    const file = req.file;
    if (!file) {
      return res.status(400).json({
        success: false,
        error: "No file uploaded",
        message: "Please upload an image file"
      });
    }

    console.log(`${logPrefix} Uploading avatar for participant ${decoded.participant_id}`);

    // Get current participant to check for existing avatar
    const { data: participant } = await supabaseAdmin
      .from("participants")
      .select("avatar_url")
      .eq("participant_id", decoded.participant_id)
      .single();

    // Delete old avatar if exists
    if (participant?.avatar_url) {
      try {
        const oldPath = participant.avatar_url.split('/').pop();
        if (oldPath) {
          await supabaseAdmin.storage
            .from('avatars')
            .remove([`participants/${decoded.participant_id}/${oldPath}`]);
        }
      } catch (err) {
        console.warn(`${logPrefix} Could not delete old avatar:`, err);
      }
    }

    // Upload new avatar to Supabase Storage
    const fileExt = path.extname(file.originalname);
    const fileName = `${Date.now()}${fileExt}`;
    const filePath = `participants/${decoded.participant_id}/${fileName}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from('avatars')
      .upload(filePath, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });

    if (uploadError) {
      console.error(`${logPrefix} Upload error:`, uploadError);
      return res.status(500).json({
        success: false,
        error: "Failed to upload image",
        message: uploadError.message
      });
    }

    // Get public URL
    const { data: { publicUrl } } = supabaseAdmin.storage
      .from('avatars')
      .getPublicUrl(filePath);

    // Update participant avatar_url
    const { error: updateError } = await supabaseAdmin
      .from('participants')
      .update({ avatar_url: publicUrl })
      .eq('participant_id', decoded.participant_id);

    if (updateError) {
      console.error(`${logPrefix} Database update error:`, updateError);
      return res.status(500).json({
        success: false,
        error: "Failed to update avatar URL",
        message: updateError.message
      });
    }

    console.log(`${logPrefix} Avatar uploaded successfully`);

    return res.json({
      success: true,
      avatar_url: publicUrl
    });

  } catch (error: any) {
    console.error(`${logPrefix} Error:`, error);
    return res.status(500).json({
      success: false,
      error: "Internal server error",
      message: error.message
    });
  }
});

// Download participant vCard (token-based auth)
router.get("/profile/vcard", async (req: Request, res: Response) => {
  const requestId = crypto.randomUUID();
  const logPrefix = `[download-vcard:${requestId}]`;

  try {
    const { token } = req.query;

    if (!token || typeof token !== 'string') {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
        message: "Valid token is required"
      });
    }

    // Verify token
    const decoded = verifyProfileToken(token);
    if (!decoded) {
      return res.status(401).json({
        success: false,
        error: "Invalid token",
        message: "Token is invalid or expired"
      });
    }

    console.log(`${logPrefix} Generating vCard for participant ${decoded.participant_id}`);

    // Get participant data
    const { data: participant, error } = await supabaseAdmin
      .from("participants")
      .select("full_name, position, company, email, phone, website_url, avatar_url")
      .eq("participant_id", decoded.participant_id)
      .eq("tenant_id", decoded.tenant_id)
      .single();

    if (error || !participant) {
      console.error(`${logPrefix} Participant not found:`, error);
      return res.status(404).json({
        success: false,
        error: "Participant not found",
        message: "Could not load profile data"
      });
    }

    // Generate vCard
    const vCardData: VCardData = {
      full_name: participant.full_name,
      position: participant.position,
      company: participant.company,
      email: participant.email,
      phone: participant.phone,
      website_url: participant.website_url,
      photo_url: participant.avatar_url,
    };

    const vCardContent = generateVCard(vCardData);
    const filename = getVCardFilename(participant.full_name);

    console.log(`${logPrefix} vCard generated successfully: ${filename}`);

    // Send as downloadable file
    res.setHeader('Content-Type', 'text/vcard; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(vCardContent);

  } catch (error: any) {
    console.error(`${logPrefix} Error:`, error);
    return res.status(500).json({
      success: false,
      error: "Internal server error",
      message: error.message
    });
  }
});

// LINE Registration: Lookup participant by phone (with LINE user awareness)
router.post("/lookup-by-line-phone", async (req: Request, res: Response) => {
  const requestId = crypto.randomUUID();
  const logPrefix = `[lookup-by-line-phone:${requestId}]`;

  try {
    const { phone, line_user_id, tenant_id } = req.body;

    console.log(`${logPrefix} Looking up participant for LINE registration`, {
      phone_masked: phone ? `${String(phone).slice(0, 3)}****` : undefined,
      line_user_id_masked: line_user_id ? `${line_user_id.slice(0, 5)}...` : undefined,
      tenant_id,
    });

    if (!phone) {
      return res.status(400).json({
        success: false,
        error: "Missing phone number",
        message: "Phone number is required",
      });
    }

    if (!tenant_id) {
      return res.status(400).json({
        success: false,
        error: "Missing tenant_id",
        message: "Chapter information is required",
      });
    }

    // Normalize phone
    const normalizedPhone = String(phone).replace(/\D/g, "");
    if (!normalizedPhone) {
      return res.status(400).json({
        success: false,
        error: "Invalid phone number",
        message: "Phone number must contain digits",
      });
    }

    // Lookup participant by phone within the specified tenant
    const { data: participant, error: lookupError } = await supabaseAdmin
      .from("participants")
      .select("participant_id, tenant_id, full_name, email, phone, company, business_type, goal, notes, status, line_user_id")
      .eq("tenant_id", tenant_id)
      .eq("phone", normalizedPhone)
      .maybeSingle();

    if (lookupError) {
      console.error(`${logPrefix} Error looking up participant:`, lookupError);
      return res.status(500).json({
        success: false,
        error: "Database error",
        message: lookupError.message,
      });
    }

    if (!participant) {
      console.log(`${logPrefix} No participant found in tenant ${tenant_id}`);
      return res.json({
        success: true,
        found: false,
        participant: null,
      });
    }

    console.log(`${logPrefix} Participant found in tenant ${participant.tenant_id}`);

    return res.json({
      success: true,
      found: true,
      participant,
    });

  } catch (error: any) {
    console.error(`${logPrefix} Unexpected error:`, error);
    return res.status(500).json({
      success: false,
      error: "Internal server error",
      message: error.message,
    });
  }
});

// LINE Registration: Register new participant or link LINE User ID to existing
router.post("/line-register", async (req: Request, res: Response) => {
  const requestId = crypto.randomUUID();
  const logPrefix = `[line-register:${requestId}]`;

  try {
    const {
      tenant_id,
      line_user_id,
      line_display_name,
      line_picture_url,
      phone,
      full_name,
      email,
      company,
      business_type,
      goal,
      notes,
      is_update,
      participant_id,
    } = req.body;

    console.log(`${logPrefix} LINE registration request (${is_update ? 'UPDATE' : 'INSERT'})`, {
      tenant_id,
      line_user_id_masked: line_user_id ? `${line_user_id.slice(0, 5)}...` : undefined,
      phone_masked: phone ? `${String(phone).slice(0, 3)}****` : undefined,
      is_update,
    });

    // Validate required fields
    if (!tenant_id) {
      return res.status(400).json({
        success: false,
        error: "Missing tenant_id",
        message: "Chapter information is required",
      });
    }

    if (!line_user_id || !phone || !full_name || !email) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields",
        message: "line_user_id, phone, full_name, and email are required",
      });
    }

    // Normalize phone
    const normalizedPhone = String(phone).replace(/\D/g, "");
    if (!normalizedPhone) {
      return res.status(400).json({
        success: false,
        error: "Invalid phone number",
        message: "Phone number must contain digits",
      });
    }

    let result;

    if (is_update && participant_id) {
      // UPDATE MODE: Link LINE User ID to existing participant
      console.log(`${logPrefix} Updating existing participant: ${participant_id}`);

      // Verify participant exists and belongs to the correct tenant
      const { data: existing, error: checkError } = await supabaseAdmin
        .from("participants")
        .select("participant_id, tenant_id, line_user_id")
        .eq("participant_id", participant_id)
        .eq("tenant_id", tenant_id)
        .single();

      if (checkError || !existing) {
        console.error(`${logPrefix} Participant not found:`, checkError);
        return res.status(404).json({
          success: false,
          error: "Participant not found",
          message: "The participant does not exist in this chapter",
        });
      }

      // Check if LINE User ID is already linked to different participant
      if (existing.line_user_id && existing.line_user_id !== line_user_id) {
        return res.status(409).json({
          success: false,
          error: "Already linked",
          message: "This participant is already linked to a different LINE account",
        });
      }

      // Update participant with LINE info
      const { data: updated, error: updateError } = await supabaseAdmin
        .from("participants")
        .update({
          line_user_id,
          full_name,
          email,
          company: company || null,
          business_type: business_type || null,
          goal: goal || null,
          notes: notes || null,
          photo_url: line_picture_url || existing.photo_url,
          updated_at: new Date().toISOString(),
        })
        .eq("participant_id", participant_id)
        .select()
        .single();

      if (updateError) {
        console.error(`${logPrefix} Update failed:`, updateError);
        return res.status(500).json({
          success: false,
          error: "Update failed",
          message: updateError.message,
        });
      }

      console.log(`${logPrefix} Successfully linked LINE account to participant`);
      result = updated;

    } else {
      // INSERT MODE: Create new participant with LINE User ID
      console.log(`${logPrefix} Creating new participant with LINE link in tenant ${tenant_id}`);

      // Check if LINE User ID is already used in this tenant
      const { data: existingLineUser } = await supabaseAdmin
        .from("participants")
        .select("participant_id")
        .eq("tenant_id", tenant_id)
        .eq("line_user_id", line_user_id)
        .maybeSingle();

      if (existingLineUser) {
        return res.status(409).json({
          success: false,
          error: "LINE account already registered",
          message: "This LINE account is already linked to another participant in this chapter",
        });
      }

      // Verify tenant exists
      const { data: tenant, error: tenantError } = await supabaseAdmin
        .from("tenants")
        .select("tenant_id, name")
        .eq("tenant_id", tenant_id)
        .single();

      if (tenantError || !tenant) {
        console.error(`${logPrefix} Tenant not found:`, tenantError);
        return res.status(404).json({
          success: false,
          error: "Chapter not found",
          message: "The specified chapter does not exist",
        });
      }

      console.log(`${logPrefix} Verified tenant: ${tenant.name}`);

      // Create new participant
      const { data: newParticipant, error: insertError } = await supabaseAdmin
        .from("participants")
        .insert({
          tenant_id,
          line_user_id,
          phone: normalizedPhone,
          full_name,
          email,
          company: company || null,
          business_type: business_type || null,
          goal: goal || null,
          notes: notes || null,
          photo_url: line_picture_url || null,
          status: "prospect",
        })
        .select()
        .single();

      if (insertError) {
        console.error(`${logPrefix} Insert failed:`, insertError);
        return res.status(500).json({
          success: false,
          error: "Registration failed",
          message: insertError.message,
        });
      }

      console.log(`${logPrefix} Successfully created new participant with LINE link`);
      result = newParticipant;
    }

    return res.json({
      success: true,
      message: is_update ? "LINE account linked successfully" : "Registration successful",
      participant: result,
    });

  } catch (error: any) {
    console.error(`${logPrefix} Unexpected error:`, error);
    return res.status(500).json({
      success: false,
      error: "Internal server error",
      message: error.message,
    });
  }
});

// Configure multer for Excel file uploads
const uploadExcel = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
      'text/csv', // .csv
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only Excel (.xlsx, .xls) and CSV files are allowed.'));
    }
  },
});

// Import members from Excel file (authenticated endpoint)
// Expected columns: ชื่อ - สกุล, ชื่อเล่น, บริษัทฯ, ธุรกิจ, เบอร์โทร, ผู้เชิญ
router.post("/import-members", verifySupabaseAuth, uploadExcel.single('file'), async (req: AuthenticatedRequest, res) => {
  const requestId = crypto.randomUUID();
  const logPrefix = `[import-members:${requestId}]`;

  try {
    const userId = req.user?.id;
    const { tenant_id } = req.body;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!tenant_id) {
      return res.status(400).json({ 
        error: "Missing tenant_id",
        message: "tenant_id is required"
      });
    }

    if (!req.file) {
      return res.status(400).json({ 
        error: "Missing file",
        message: "Please upload an Excel file"
      });
    }

    // Verify user has access to this tenant (must be admin or super_admin)
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

    const isSuperAdmin = userRoles.some(r => r.role === "super_admin" && !r.tenant_id);
    const isChapterAdmin = userRoles.some(r => 
      r.tenant_id === tenant_id && (r.role === "chapter_admin" || r.role === "super_admin")
    );

    if (!isSuperAdmin && !isChapterAdmin) {
      return res.status(403).json({ 
        error: "Forbidden",
        message: "You must be a chapter admin to import members"
      });
    }

    console.log(`${logPrefix} Parsing Excel file:`, req.file.originalname);

    // Parse Excel file
    const XLSX = await import('xlsx');
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rawData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

    console.log(`${logPrefix} Found ${rawData.length} rows in Excel`);

    if (rawData.length === 0) {
      return res.status(400).json({
        error: "Empty file",
        message: "The Excel file is empty"
      });
    }

    // Map Excel columns to our schema
    const participants = rawData.map((row: any, index: number) => {
      const fullName = row['ชื่อ - สกุล'] || row['full_name'] || '';
      const nickname = row['ชื่อเล่น'] || row['nickname'] || '';
      const company = row['บริษัทฯ'] || row['company'] || '';
      const businessType = row['ธุรกิจ'] || row['business_type'] || '';
      const phone = row['เบอร์โทร'] || row['phone'] || '';

      // Normalize phone (strip non-digits)
      const normalizedPhone = String(phone).replace(/\D/g, '');

      return {
        row_number: index + 2, // +2 because Excel is 1-indexed and has header row
        tenant_id,
        full_name: fullName.trim(),
        nickname: nickname.trim(),
        company: company.trim() || null,
        business_type: businessType.trim() || null,
        phone: normalizedPhone || null,
        status: 'member' as const, // Import as existing members
        invited_by_name: row['ผู้เชิญ'] || '', // We'll resolve this later if needed
      };
    });

    // Validate required fields
    const validationErrors: string[] = [];
    participants.forEach((p) => {
      if (!p.full_name) {
        validationErrors.push(`Row ${p.row_number}: Missing name (ชื่อ - สกุล)`);
      }
      if (!p.phone) {
        validationErrors.push(`Row ${p.row_number}: Missing phone number (เบอร์โทร)`);
      } else if (p.phone.length < 9) {
        validationErrors.push(`Row ${p.row_number}: Invalid phone number "${p.phone}" (too short)`);
      }
    });

    if (validationErrors.length > 0) {
      console.error(`${logPrefix} Validation errors:`, validationErrors);
      return res.status(400).json({
        error: "Validation failed",
        message: "Some rows have invalid data",
        validation_errors: validationErrors.slice(0, 10), // Return first 10 errors
        total_errors: validationErrors.length
      });
    }

    // Check for duplicate phone numbers within the import
    const phoneMap = new Map<string, number[]>();
    participants.forEach((p) => {
      if (p.phone) {
        if (!phoneMap.has(p.phone)) {
          phoneMap.set(p.phone, []);
        }
        phoneMap.get(p.phone)!.push(p.row_number);
      }
    });

    const duplicatesInFile: string[] = [];
    phoneMap.forEach((rows, phone) => {
      if (rows.length > 1) {
        duplicatesInFile.push(`Phone ${phone} appears in rows: ${rows.join(', ')}`);
      }
    });

    if (duplicatesInFile.length > 0) {
      console.error(`${logPrefix} Duplicate phones in file:`, duplicatesInFile);
      return res.status(400).json({
        error: "Duplicate phone numbers",
        message: "Some phone numbers appear multiple times in the file",
        duplicates: duplicatesInFile
      });
    }

    // Check for existing phone numbers in database
    const phonesToCheck = participants.map(p => p.phone).filter(Boolean);
    const { data: existingParticipants, error: checkError } = await supabaseAdmin
      .from("participants")
      .select("phone, full_name, participant_id")
      .eq("tenant_id", tenant_id)
      .in("phone", phonesToCheck);

    if (checkError) {
      console.error(`${logPrefix} Error checking existing phones:`, checkError);
      return res.status(500).json({
        error: "Database error",
        message: checkError.message
      });
    }

    const existingPhoneMap = new Map(
      (existingParticipants || []).map(p => [p.phone, p])
    );

    const conflicts: string[] = [];
    participants.forEach((p) => {
      if (p.phone && existingPhoneMap.has(p.phone)) {
        const existing = existingPhoneMap.get(p.phone)!;
        conflicts.push(
          `Row ${p.row_number}: Phone ${p.phone} already exists (${existing.full_name})`
        );
      }
    });

    if (conflicts.length > 0) {
      console.error(`${logPrefix} Phone conflicts with existing data:`, conflicts);
      return res.status(409).json({
        error: "Duplicate phone numbers",
        message: "Some phone numbers already exist in the database",
        conflicts: conflicts.slice(0, 10),
        total_conflicts: conflicts.length
      });
    }

    // Prepare data for insert (remove row_number and invited_by_name)
    const dataToInsert = participants.map(({ row_number, invited_by_name, ...p }) => p);

    // Insert all participants
    console.log(`${logPrefix} Inserting ${dataToInsert.length} participants...`);
    const { data: insertedData, error: insertError } = await supabaseAdmin
      .from("participants")
      .insert(dataToInsert)
      .select();

    if (insertError) {
      console.error(`${logPrefix} Insert error:`, insertError);
      return res.status(500).json({
        error: "Import failed",
        message: insertError.message
      });
    }

    console.log(`${logPrefix} Successfully imported ${insertedData.length} members`);

    return res.json({
      success: true,
      imported_count: insertedData.length,
      message: `Successfully imported ${insertedData.length} members`,
      participants: insertedData
    });

  } catch (error: any) {
    console.error(`${logPrefix} Error importing members:`, error);
    return res.status(500).json({
      error: "Internal server error",
      message: error.message
    });
  }
});

// ==========================================
// ACTIVATION & AUTO-LINK ENDPOINTS
// ==========================================

import {
  linkUserToParticipant,
  createActivationToken,
  validateActivationToken,
  markTokenAsUsed,
  normalizePhone
} from "../lib/participants";

/**
 * Auto-link user account to participant based on phone number
 * Called during registration to connect user_id to existing participant
 */
router.post("/link-account", verifySupabaseAuth, async (req: AuthenticatedRequest, res: Response) => {
  const requestId = crypto.randomUUID();
  const logPrefix = `[link-account:${requestId}]`;

  try {
    const { phone, tenant_id } = req.body;
    const userId = req.user?.id;

    console.log(`${logPrefix} Auto-link request`, {
      user_id: userId,
      tenant_id,
      phone_masked: phone ? `${String(phone).slice(0, 3)}****` : undefined
    });

    if (!userId || !phone || !tenant_id) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields"
      });
    }

    const result = await linkUserToParticipant(
      supabaseAdmin,
      userId,
      phone,
      tenant_id
    );

    if (!result.success) {
      return res.status(400).json(result);
    }

    console.log(`${logPrefix} Successfully linked user to participant`, {
      participant_id: result.participantId
    });

    return res.json(result);
  } catch (error: any) {
    console.error(`${logPrefix} Error:`, error);
    return res.status(500).json({
      success: false,
      error: "Internal server error",
      message: error.message
    });
  }
});

/**
 * Generate activation link for a participant
 * Admin endpoint to create activation tokens
 */
router.post("/generate-activation-link", verifySupabaseAuth, async (req: AuthenticatedRequest, res: Response) => {
  const requestId = crypto.randomUUID();
  const logPrefix = `[generate-activation:${requestId}]`;

  try {
    const { participant_id, tenant_id } = req.body;
    const userId = req.user?.id;

    console.log(`${logPrefix} Generate activation link`, {
      participant_id,
      tenant_id,
      created_by: userId
    });

    if (!userId || !participant_id || !tenant_id) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields"
      });
    }

    // Verify user has admin access to this tenant
    // Check if user is super_admin (can access all tenants) OR has admin role in this tenant
    const { data: userRoles } = await supabaseAdmin
      .from("user_roles")
      .select("role, tenant_id")
      .eq("user_id", userId);

    const isSuperAdmin = userRoles?.some(r => r.role === 'super_admin');
    const isChapterAdmin = userRoles?.some(r => r.tenant_id === tenant_id && r.role === 'chapter_admin');

    if (!isSuperAdmin && !isChapterAdmin) {
      return res.status(403).json({
        success: false,
        error: "Unauthorized: Admin access required"
      });
    }

    // Check if participant already has a user account
    const { data: participant } = await supabaseAdmin
      .from("participants")
      .select("user_id, full_name, phone")
      .eq("participant_id", participant_id)
      .eq("tenant_id", tenant_id)
      .single();

    if (!participant) {
      return res.status(404).json({
        success: false,
        error: "Participant not found"
      });
    }

    if (participant.user_id) {
      return res.status(400).json({
        success: false,
        error: "This participant already has an active account"
      });
    }

    // Create activation token
    const result = await createActivationToken(
      supabaseAdmin,
      participant_id,
      tenant_id,
      userId,
      7 // expires in 7 days
    );

    if (!result.success) {
      return res.status(500).json(result);
    }

    // Build activation URL
    const baseUrl = process.env.REPLIT_DOMAINS 
      ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}`
      : 'http://localhost:5000';
    
    const activationUrl = `${baseUrl}/activate/${result.token}`;

    console.log(`${logPrefix} Activation link generated successfully`);

    return res.json({
      success: true,
      token: result.token,
      activation_url: activationUrl,
      participant: {
        full_name: participant.full_name,
        phone: participant.phone
      }
    });
  } catch (error: any) {
    console.error(`${logPrefix} Error:`, error);
    return res.status(500).json({
      success: false,
      error: "Internal server error",
      message: error.message
    });
  }
});

/**
 * Validate activation token and get participant info
 * Public endpoint (no auth required)
 */
router.get("/validate-token/:token", async (req: Request, res: Response) => {
  const requestId = crypto.randomUUID();
  const logPrefix = `[validate-token:${requestId}]`;

  try {
    const { token } = req.params;

    console.log(`${logPrefix} Validating token`, {
      token_prefix: token ? token.slice(0, 8) + '...' : undefined
    });

    if (!token) {
      return res.status(400).json({
        success: false,
        error: "Token required"
      });
    }

    const result = await validateActivationToken(supabaseAdmin, token);

    if (!result.success) {
      return res.status(400).json(result);
    }

    console.log(`${logPrefix} Token valid`);

    return res.json(result);
  } catch (error: any) {
    console.error(`${logPrefix} Error:`, error);
    return res.status(500).json({
      success: false,
      error: "Internal server error",
      message: error.message
    });
  }
});

/**
 * Join existing account to new chapter
 * Used when user already has an account but wants to join another chapter
 * Authenticated endpoint
 */
router.post("/join-existing", verifySupabaseAuth, async (req: AuthenticatedRequest, res: Response) => {
  const requestId = crypto.randomUUID();
  const logPrefix = `[join-existing:${requestId}]`;

  try {
    const { token } = req.body;
    const userId = req.user?.id;

    console.log(`${logPrefix} Join existing account`, {
      token_prefix: token ? token.slice(0, 8) + '...' : undefined,
      user_id: userId
    });

    if (!token || !userId) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields"
      });
    }

    // Validate token (but skip user_id check since we expect existing account)
    // We'll manually validate the token without the user_id check
    const { data: tokenData, error: tokenError } = await supabaseAdmin
      .from('activation_tokens')
      .select(`
        token_id,
        participant_id,
        tenant_id,
        expires_at,
        used_at,
        participants (
          participant_id,
          full_name,
          phone,
          email,
          user_id
        )
      `)
      .eq('token', token)
      .single();

    if (tokenError || !tokenData) {
      console.error(`${logPrefix} Token lookup failed:`, tokenError);
      return res.status(400).json({
        success: false,
        error: "Invalid activation link"
      });
    }

    // Check if already used
    if (tokenData.used_at) {
      return res.status(400).json({
        success: false,
        error: "This activation link has already been used"
      });
    }

    // Check if expired
    if (new Date(tokenData.expires_at) < new Date()) {
      return res.status(400).json({
        success: false,
        error: "This activation link has expired"
      });
    }

    const participant = Array.isArray(tokenData.participants) 
      ? tokenData.participants[0] 
      : tokenData.participants;

    const tenantId = tokenData.tenant_id;

    // Security: Verify that this authenticated user owns the phone number from the token
    // Get all participants for this user across all tenants to verify phone ownership
    const normalizedTokenPhone = normalizePhone(participant.phone);
    
    if (!normalizedTokenPhone) {
      return res.status(400).json({
        success: false,
        error: "Invalid phone number in token"
      });
    }

    const { data: userParticipants } = await supabaseAdmin
      .from("participants")
      .select("phone, user_id")
      .eq("user_id", userId)
      .not("user_id", "is", null);

    if (!userParticipants || userParticipants.length === 0) {
      return res.status(403).json({
        success: false,
        error: "No existing account found. Please use the regular activation flow."
      });
    }

    // Verify that at least one of the user's participant records has matching phone
    const phoneMatches = userParticipants.some(p => {
      const normalizedUserPhone = normalizePhone(p.phone);
      return normalizedUserPhone === normalizedTokenPhone;
    });

    if (!phoneMatches) {
      console.error(`${logPrefix} Phone mismatch:`, {
        tokenPhone: normalizedTokenPhone,
        userPhones: userParticipants.map(p => normalizePhone(p.phone))
      });
      return res.status(403).json({
        success: false,
        error: "Phone number verification failed. This activation link is for a different phone number."
      });
    }

    // Link this participant to user
    const { error: linkError } = await supabaseAdmin
      .from("participants")
      .update({ user_id: userId })
      .eq("participant_id", participant.participant_id);

    if (linkError) {
      console.error(`${logPrefix} Failed to link participant:`, linkError);
      return res.status(500).json({
        success: false,
        error: "Failed to link participant"
      });
    }

    // Check if user_role already exists
    const { data: existingRole } = await supabaseAdmin
      .from("user_roles")
      .select("role_id")
      .eq("user_id", userId)
      .eq("tenant_id", tenantId)
      .single();

    // Create user_role only if it doesn't exist
    if (!existingRole) {
      const { error: roleError } = await supabaseAdmin
        .from("user_roles")
        .insert({
          user_id: userId,
          tenant_id: tenantId,
          role: "member",
        });

      if (roleError) {
        console.error(`${logPrefix} Failed to create role:`, roleError);
        return res.status(500).json({
          success: false,
          error: "Failed to create role"
        });
      }
    } else {
      console.log(`${logPrefix} User role already exists for this tenant`);
    }

    // Mark token as used
    await markTokenAsUsed(supabaseAdmin, token);

    console.log(`${logPrefix} Successfully joined chapter`, {
      user_id: userId,
      tenant_id: tenantId,
      participant_id: participant.participant_id
    });

    return res.json({
      success: true,
      message: "Successfully joined chapter",
      participant_id: participant.participant_id,
      tenant_id: tenantId
    });
  } catch (error: any) {
    console.error(`${logPrefix} Error:`, error);
    return res.status(500).json({
      success: false,
      error: "Internal server error",
      message: error.message
    });
  }
});

/**
 * Complete activation by creating user account and linking
 * Public endpoint (no auth required)
 */
router.post("/activate", async (req: Request, res: Response) => {
  const requestId = crypto.randomUUID();
  const logPrefix = `[activate:${requestId}]`;

  try {
    const { token, email, password, full_name } = req.body;

    console.log(`${logPrefix} Activation request`, {
      token_prefix: token ? token.slice(0, 8) + '...' : undefined,
      email
    });

    if (!token || !email || !password) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: token, email, password"
      });
    }

    // Validate token first
    const validation = await validateActivationToken(supabaseAdmin, token);
    if (!validation.success || !validation.participant || !validation.tenantId) {
      return res.status(400).json({
        success: false,
        error: validation.error || "Invalid token"
      });
    }

    const participant = validation.participant;
    const tenantId = validation.tenantId;

    // Create user account
    const { data: authData, error: signUpError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: full_name || participant.full_name,
        phone: participant.phone
      }
    });

    if (signUpError || !authData.user) {
      console.error(`${logPrefix} Sign up error:`, signUpError);
      return res.status(400).json({
        success: false,
        error: "Failed to create account",
        message: signUpError?.message
      });
    }

    const userId = authData.user.id;

    // Link user to participant directly using participant_id
    const { error: linkError } = await supabaseAdmin
      .from('participants')
      .update({ user_id: userId })
      .eq('participant_id', participant.participant_id);

    if (linkError) {
      console.error(`${logPrefix} Failed to link participant:`, linkError);
      // Rollback: delete the user account
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return res.status(500).json({
        success: false,
        error: "Failed to link account",
        message: linkError.message
      });
    }

    // Create user_role for this tenant
    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .insert({
        user_id: userId,
        tenant_id: tenantId,
        role: "member",
      });

    if (roleError) {
      console.error(`${logPrefix} Failed to create role:`, roleError);
      // Don't rollback if role creation fails, just log it
    }

    // Mark token as used
    await markTokenAsUsed(supabaseAdmin, token);

    // Update participant's email if provided
    if (participant.email !== email) {
      await supabaseAdmin
        .from("participants")
        .update({ email })
        .eq("participant_id", participant.participant_id);
    }

    console.log(`${logPrefix} Activation successful`, {
      user_id: userId,
      participant_id: participant.participant_id
    });

    return res.json({
      success: true,
      message: "Account activated successfully",
      user_id: userId,
      participant_id: participant.participant_id
    });
  } catch (error: any) {
    console.error(`${logPrefix} Error:`, error);
    return res.status(500).json({
      success: false,
      error: "Internal server error",
      message: error.message
    });
  }
});

/**
 * Send LIFF activation link via LINE
 * Requires participant to have line_user_id linked
 * Protected endpoint (chapter_admin or super_admin)
 */
router.post("/send-liff-activation", verifySupabaseAuth, async (req: AuthenticatedRequest, res: Response) => {
  const requestId = crypto.randomUUID();
  const logPrefix = `[send-liff-activation:${requestId}]`;

  try {
    const { participant_id, tenant_id } = req.body;

    console.log(`${logPrefix} Request to send LIFF link`, {
      participant_id,
      tenant_id,
      user_id: req.user?.id
    });

    if (!participant_id || !tenant_id) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: participant_id, tenant_id"
      });
    }

    // Verify user has permission (chapter_admin or super_admin)
    const { data: userRoles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", req.user!.id)
      .eq("tenant_id", tenant_id)
      .single();

    if (!userRoles || !["chapter_admin", "super_admin"].includes(userRoles.role)) {
      return res.status(403).json({
        success: false,
        error: "Unauthorized: Requires chapter_admin or super_admin role"
      });
    }

    // Get participant data
    const { data: participant, error: participantError } = await supabaseAdmin
      .from("participants")
      .select("participant_id, full_name, phone, line_user_id, user_id")
      .eq("participant_id", participant_id)
      .eq("tenant_id", tenant_id)
      .single();

    if (participantError || !participant) {
      return res.status(404).json({
        success: false,
        error: "Participant not found"
      });
    }

    // Check if participant already has account
    if (participant.user_id) {
      return res.status(400).json({
        success: false,
        error: "Participant already has an account"
      });
    }

    // Check if participant has LINE linked
    if (!participant.line_user_id) {
      return res.status(400).json({
        success: false,
        error: "Participant does not have LINE linked. They must register via LINE first (type 'ลงทะเบียน' in LINE chat)."
      });
    }

    // Use helper function to send activation link
    const result = await sendLiffActivationLink({
      participantId: participant.participant_id,
      tenantId: tenant_id,
      lineUserId: participant.line_user_id,
      fullName: participant.full_name,
      logPrefix
    });

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error
      });
    }

    return res.json({
      success: true,
      message: "LIFF activation link sent via LINE",
      liff_url: result.liffUrl
    });
  } catch (error: any) {
    console.error(`${logPrefix} Error:`, error);
    return res.status(500).json({
      success: false,
      error: "Internal server error",
      message: error.message
    });
  }
});

/**
 * Auto-send LIFF activation link after LINE phone linking
 * Called by Edge Function webhook, no auth required
 * Public endpoint (internal use only)
 */
router.post("/send-liff-activation-auto", async (req: Request, res: Response) => {
  const requestId = crypto.randomUUID();
  const logPrefix = `[send-liff-activation-auto:${requestId}]`;

  try {
    // Verify internal API secret to prevent unauthorized access
    const internalSecret = process.env.INTERNAL_API_SECRET;
    const providedSecret = req.headers['x-internal-secret'];
    
    if (!internalSecret || providedSecret !== internalSecret) {
      console.error(`${logPrefix} Unauthorized access attempt - invalid secret`);
      return res.status(401).json({
        success: false,
        error: "Unauthorized"
      });
    }

    const { participant_id, tenant_id, line_user_id, full_name } = req.body;

    console.log(`${logPrefix} Auto-send LIFF activation request`, {
      participant_id,
      tenant_id,
      line_user_id: line_user_id ? '***' : undefined
    });

    if (!participant_id || !tenant_id || !line_user_id || !full_name) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: participant_id, tenant_id, line_user_id, full_name"
      });
    }

    // Verify participant exists and belongs to tenant (security check)
    const { data: participant, error: participantError } = await supabaseAdmin
      .from("participants")
      .select("participant_id, user_id, line_user_id")
      .eq("participant_id", participant_id)
      .eq("tenant_id", tenant_id)
      .single();

    if (participantError || !participant) {
      console.error(`${logPrefix} Participant not found or tenant mismatch`);
      return res.status(404).json({
        success: false,
        error: "Participant not found"
      });
    }

    // Check if participant already has account
    if (participant.user_id) {
      console.log(`${logPrefix} Participant already has account, skipping activation send`);
      return res.json({
        success: true,
        message: "Participant already has account",
        skipped: true
      });
    }

    // Verify LINE User ID matches
    if (participant.line_user_id !== line_user_id) {
      console.error(`${logPrefix} LINE User ID mismatch`);
      return res.status(400).json({
        success: false,
        error: "LINE User ID mismatch"
      });
    }

    // Use helper function to send activation link
    const result = await sendLiffActivationLink({
      participantId: participant_id,
      tenantId: tenant_id,
      lineUserId: line_user_id,
      fullName: full_name,
      logPrefix
    });

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error
      });
    }

    return res.json({
      success: true,
      message: "LIFF activation link sent automatically",
      liff_url: result.liffUrl
    });
  } catch (error: any) {
    console.error(`${logPrefix} Error:`, error);
    return res.status(500).json({
      success: false,
      error: "Internal server error",
      message: error.message
    });
  }
});

/**
 * Activate account via LINE LIFF
 * Links LINE User ID automatically
 * Public endpoint (no auth required)
 */
router.post("/activate-via-line", async (req: Request, res: Response) => {
  const requestId = crypto.randomUUID();
  const logPrefix = `[activate-via-line:${requestId}]`;

  try {
    const { token, email, password, line_user_id } = req.body;

    console.log(`${logPrefix} LINE Activation request`, {
      token_prefix: token ? token.slice(0, 8) + '...' : undefined,
      email,
      has_line_user_id: !!line_user_id
    });

    if (!token || !email || !password || !line_user_id) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: token, email, password, line_user_id"
      });
    }

    // Validate token first
    const validation = await validateActivationToken(supabaseAdmin, token);
    if (!validation.success || !validation.participant || !validation.tenantId) {
      return res.status(400).json({
        success: false,
        error: validation.error || "Invalid token"
      });
    }

    const participant = validation.participant;
    const tenantId = validation.tenantId;

    // Create user account
    const { data: authData, error: signUpError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: participant.full_name,
        phone: participant.phone
      }
    });

    if (signUpError || !authData.user) {
      console.error(`${logPrefix} Sign up error:`, signUpError);
      return res.status(400).json({
        success: false,
        error: "Failed to create account",
        message: signUpError?.message
      });
    }

    const userId = authData.user.id;

    // Link user to participant AND LINE User ID
    const { error: linkError } = await supabaseAdmin
      .from('participants')
      .update({ 
        user_id: userId,
        line_user_id: line_user_id // Link LINE account automatically
      })
      .eq('participant_id', participant.participant_id);

    if (linkError) {
      console.error(`${logPrefix} Failed to link participant:`, linkError);
      // Rollback: delete the user account
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return res.status(500).json({
        success: false,
        error: "Failed to link account",
        message: linkError.message
      });
    }

    // Create user_role for this tenant
    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .insert({
        user_id: userId,
        tenant_id: tenantId,
        role: "member",
      });

    if (roleError) {
      console.error(`${logPrefix} Failed to create role:`, roleError);
      // Don't rollback if role creation fails, just log it
    }

    // Mark token as used
    await markTokenAsUsed(supabaseAdmin, token);

    // Update participant's email if provided
    if (participant.email !== email) {
      await supabaseAdmin
        .from("participants")
        .update({ email })
        .eq("participant_id", participant.participant_id);
    }

    // Send confirmation message via LINE
    try {
      const { data: tenantData } = await supabaseAdmin
        .from('tenants')
        .select('tenant_name, line_channel_access_token')
        .eq('tenant_id', tenantId)
        .single();

      if (tenantData?.line_channel_access_token) {
        const lineClient = new LineClient(tenantData.line_channel_access_token);
        await lineClient.pushMessage(line_user_id, {
          type: 'text',
          text: `✅ สร้างบัญชีสำเร็จ!\n\nยินดีต้อนรับสู่ ${tenantData.tenant_name}\n\nคุณสามารถ:\n- เข้าสู่ระบบ: ${process.env.REPLIT_DEV_DOMAIN || 'meetdup.app'}\n- ดูนามบัตรสมาชิก: พิมพ์ "card ชื่อ"\n- ลงทะเบียนประชุม: ติดตามข้อมูลผ่านระบบ`
        });
        console.log(`${logPrefix} Sent LINE confirmation message`);
      }
    } catch (lineError) {
      console.error(`${logPrefix} Failed to send LINE confirmation:`, lineError);
      // Don't fail the request if LINE message fails
    }

    console.log(`${logPrefix} Successfully created account and linked LINE`, {
      user_id: userId,
      line_user_id,
      participant_id: participant.participant_id
    });

    return res.json({
      success: true,
      message: "Account created successfully",
      user_id: userId,
      participant_id: participant.participant_id
    });
  } catch (error: any) {
    console.error(`${logPrefix} Error:`, error);
    return res.status(500).json({
      success: false,
      error: "Internal server error",
      message: error.message
    });
  }
});

export default router;
