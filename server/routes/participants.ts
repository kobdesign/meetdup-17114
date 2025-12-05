import { Router, Request, Response } from "express";
import { supabaseAdmin } from "../utils/supabaseClient";
import { verifySupabaseAuth, AuthenticatedRequest } from "../utils/auth";
import { generateVCard, getVCardFilename, VCardData } from "../services/line/vcard";
import { generateProfileToken, verifyProfileToken } from "../utils/profileToken";
import { LineClient } from "../services/line/lineClient";
import { getLineCredentials } from "../services/line/credentials";
import { createBusinessCardFlexMessage, BusinessCardData } from "../services/line/templates/businessCard";
import { createActivationSuccessFlexMessage } from "../services/line/templates/activationSuccess";
import { getProductionBaseUrl } from "../utils/getProductionUrl";
import { sendGoalAchievementNotification } from "../services/goals/achievementNotification";
import multer from "multer";
import path from "path";
import crypto from "crypto";

async function checkVisitorGoalsAchievement(tenantId: string, meetingId?: string): Promise<void> {
  try {
    const { data: activeGoals, error } = await supabaseAdmin
      .from("chapter_goals")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("status", "active")
      .in("metric_type", ["weekly_visitors", "monthly_visitors", "meeting_visitors"]);

    if (error || !activeGoals || activeGoals.length === 0) return;

    for (const goal of activeGoals) {
      if (goal.metric_type === "meeting_visitors" && goal.meeting_id !== meetingId) {
        continue;
      }

      let currentValue = 0;
      const endDateWithTime = goal.end_date + "T23:59:59.999Z";

      if (goal.metric_type === "meeting_visitors" && goal.meeting_id) {
        const { data } = await supabaseAdmin
          .from("meeting_registrations")
          .select(`
            registration_id,
            registered_at,
            participant:participants!inner(participant_id, status)
          `)
          .eq("meeting_id", goal.meeting_id)
          .in("registration_status", ["registered", "attended"])
          .gte("registered_at", goal.start_date)
          .lte("registered_at", endDateWithTime);

        currentValue = data?.filter((r: any) => 
          r.participant?.status === 'visitor' || r.participant?.status === 'prospect'
        ).length || 0;
      } else {
        const { count } = await supabaseAdmin
          .from("participants")
          .select("*", { count: "exact", head: true })
          .eq("tenant_id", tenantId)
          .in("status", ["visitor", "prospect"])
          .gte("created_at", goal.start_date)
          .lte("created_at", endDateWithTime);
        currentValue = count || 0;
      }

      const isAchieved = currentValue >= goal.target_value;

      if (isAchieved && !goal.line_notified_at) {
        console.log(`[GoalTrigger] Goal "${goal.name}" achieved! (${currentValue}/${goal.target_value})`);
        
        await supabaseAdmin
          .from("chapter_goals")
          .update({
            current_value: currentValue,
            status: "achieved",
            achieved_at: new Date().toISOString()
          })
          .eq("goal_id", goal.goal_id);

        sendGoalAchievementNotification({
          ...goal,
          current_value: currentValue
        }).then(result => {
          console.log(`[GoalTrigger] Notification sent:`, result);
        }).catch(err => {
          console.error(`[GoalTrigger] Failed to send notification:`, err);
        });
      }
    }
  } catch (err) {
    console.error(`[GoalTrigger] Error checking goals:`, err);
  }
}

const router = Router();

/**
 * Helper function to generate activation token and send Activation Link via LINE
 * Reusable for both admin manual send and auto-send after LINE registration
 */
async function sendActivationLink(params: {
  participantId: string;
  tenantId: string;
  lineUserId: string;
  fullName: string;
  logPrefix?: string;
}): Promise<{ success: boolean; error?: string; token?: string; activationUrl?: string }> {
  const { participantId, tenantId, lineUserId, fullName, logPrefix = "[sendActivationLink]" } = params;

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

    // Get LINE credentials for this tenant
    const credentials = await getLineCredentials(tenantId);
    if (!credentials) {
      return { success: false, error: "LINE channel not configured for this tenant" };
    }

    // Get tenant name for message
    const { data: tenantData } = await supabaseAdmin
      .from("tenants")
      .select("tenant_name")
      .eq("tenant_id", tenantId)
      .single();

    if (!tenantData) {
      return { success: false, error: "Tenant not found" };
    }

    // Generate web activation URL (no LIFF needed)
    const baseUrl = getProductionBaseUrl();
    
    const activationUrl = `${baseUrl}/activate/${token}`;

    // Send LINE Flex Message
    const lineClient = new LineClient(credentials.channelAccessToken);
    
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
                uri: activationUrl
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

    console.log(`${logPrefix} Successfully sent activation link`, {
      participant_id: participantId,
      line_user_id: lineUserId,
      activation_url: activationUrl
    });

    return {
      success: true,
      token,
      activationUrl
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
      .select("participant_id, full_name_th, email, phone, status, company, nickname")
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
      .select("participant_id, full_name_th, status")
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
      checkinNotes = `Alumni revisit - ${participant.full_name_th} กลับมาเยี่ยมชม`;
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
      participant_name: participant.full_name_th,
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
        full_name_th,
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
      full_name_th, 
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
    if (!full_name_th || !email || !phone) {
      return res.status(400).json({ 
        error: "Missing required fields",
        message: "full_name_th, email, and phone are required"
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
          full_name_th,
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
          full_name_th,
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

    // Generate profile edit token for immediate profile editing
    const profileToken = generateProfileToken(participant.participant_id, tenant_id);
    console.log(`${logPrefix} Generated profile token for participant`);

    // Check if any visitor goals are achieved after new registration
    checkVisitorGoalsAchievement(tenant_id, meeting_id).catch(err => {
      console.error(`${logPrefix} Error checking visitor goals:`, err);
    });

    return res.json({
      success: true,
      participant_id: participant.participant_id,
      status: participant.status,
      auto_checked_in: !!auto_checkin,
      profile_token: profileToken,
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
        full_name_th,
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
        .select("participant_id, full_name_th, nickname")
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
        referred_by_name: referredBy?.nickname || referredBy?.full_name_th || null,
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
        full_name_th,
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
        full_name_th,
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
    const filename = getVCardFilename(participant.full_name_th);

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

// Complete profile after accepting invite (session-based auth)
router.post("/complete-profile", verifySupabaseAuth, async (req: AuthenticatedRequest, res: Response) => {
  const requestId = crypto.randomUUID();
  const logPrefix = `[complete-profile:${requestId}]`;

  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized"
      });
    }

    const { tenant_id, full_name_th, phone, position, company } = req.body;

    if (!tenant_id) {
      return res.status(400).json({
        success: false,
        error: "Missing tenant_id"
      });
    }

    if (!full_name_th || !phone) {
      return res.status(400).json({
        success: false,
        error: "Name and phone are required"
      });
    }

    // Normalize phone
    const normalizedPhone = phone.replace(/\D/g, "");
    
    if (normalizedPhone.length < 9 || normalizedPhone.length > 10) {
      return res.status(400).json({
        success: false,
        error: "Invalid phone number format"
      });
    }

    console.log(`${logPrefix} Completing profile for user ${userId} in tenant ${tenant_id}`);

    // Check if participant exists for this user and tenant
    const { data: existingParticipant, error: fetchError } = await supabaseAdmin
      .from("participants")
      .select("participant_id, full_name_th, phone")
      .eq("user_id", userId)
      .eq("tenant_id", tenant_id)
      .maybeSingle();

    if (fetchError) {
      console.error(`${logPrefix} Error fetching participant:`, fetchError);
      return res.status(500).json({
        success: false,
        error: "Database error"
      });
    }

    if (existingParticipant) {
      // Update existing participant
      const { error: updateError } = await supabaseAdmin
        .from("participants")
        .update({
          full_name_th: full_name_th.trim(),
          phone: normalizedPhone,
          position: position?.trim() || null,
          company: company?.trim() || null,
          updated_at: new Date().toISOString()
        })
        .eq("participant_id", existingParticipant.participant_id);

      if (updateError) {
        console.error(`${logPrefix} Error updating participant:`, updateError);
        return res.status(500).json({
          success: false,
          error: "Failed to update profile"
        });
      }

      console.log(`${logPrefix} Updated existing participant ${existingParticipant.participant_id}`);
    } else {
      // Create new participant record
      const { data: newParticipant, error: insertError } = await supabaseAdmin
        .from("participants")
        .insert({
          user_id: userId,
          tenant_id: tenant_id,
          full_name_th: full_name_th.trim(),
          phone: normalizedPhone,
          position: position?.trim() || null,
          company: company?.trim() || null,
          status: "member",
          joined_date: new Date().toISOString().split('T')[0]
        })
        .select("participant_id")
        .single();

      if (insertError) {
        console.error(`${logPrefix} Error creating participant:`, insertError);
        return res.status(500).json({
          success: false,
          error: "Failed to create profile"
        });
      }

      console.log(`${logPrefix} Created new participant ${newParticipant.participant_id}`);
    }

    // Also update the profiles table with phone (for fallback lookup)
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .upsert({
        id: userId,
        full_name: full_name_th.trim(),
        phone: normalizedPhone,
        updated_at: new Date().toISOString()
      });

    if (profileError) {
      console.warn(`${logPrefix} Failed to update profiles table:`, profileError);
      // Not critical, continue
    }

    return res.status(200).json({
      success: true,
      message: "Profile completed successfully"
    });

  } catch (error: any) {
    console.error(`${logPrefix} Unexpected error:`, error);
    return res.status(500).json({
      success: false,
      error: error.message || "Internal server error"
    });
  }
});

// Update participant profile (token-based auth) - MUST be before /:participantId to avoid route conflict
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

    const { 
      full_name_th, 
      full_name_en,
      nickname,
      nickname_th,
      nickname_en,
      position, 
      company, 
      tagline,
      business_type,
      business_type_code,
      goal,
      phone, 
      email, 
      website_url,
      facebook_url,
      instagram_url,
      linkedin_url,
      line_id,
      business_address,
      tags,
      referral_origin,
      referred_by_participant_id,
      notes,
    } = req.body;

    // Validate required fields - Thai full name and phone are required
    if (!full_name_th || !phone) {
      return res.status(400).json({
        success: false,
        error: "Validation error",
        message: "Thai full name and phone are required"
      });
    }

    console.log(`${logPrefix} Updating profile for participant ${decoded.participant_id}`);

    // Normalize phone
    const normalizedPhone = phone.replace(/\D/g, "");

    console.log(`${logPrefix} Received data:`, { 
      business_type, 
      business_type_code, 
      tags,
      full_name_th,
      phone: normalizedPhone
    });

    // Update participant
    const { data: updatedParticipant, error: updateError } = await supabaseAdmin
      .from("participants")
      .update({
        full_name_th: full_name_th,
        full_name_en: full_name_en || null,
        nickname: nickname || nickname_th || null,
        nickname_th: nickname_th || null,
        nickname_en: nickname_en || null,
        position: position || null,
        company: company || null,
        tagline: tagline || null,
        business_type: business_type || null,
        business_type_code: business_type_code || null,
        goal: goal || null,
        phone: normalizedPhone,
        email: email || null,
        website_url: website_url || null,
        facebook_url: facebook_url || null,
        instagram_url: instagram_url || null,
        linkedin_url: linkedin_url || null,
        line_id: line_id || null,
        business_address: business_address || null,
        tags: tags || null,
        referral_origin: referral_origin || null,
        referred_by_participant_id: referral_origin === "member" ? referred_by_participant_id : null,
        notes: notes || null,
        updated_at: new Date().toISOString(),
      })
      .eq("participant_id", decoded.participant_id)
      .eq("tenant_id", decoded.tenant_id)
      .select(`
        participant_id,
        full_name_th,
        full_name_en,
        nickname,
        nickname_th,
        nickname_en,
        email,
        phone,
        position,
        company,
        tagline,
        business_type,
        business_type_code,
        goal,
        website_url,
        facebook_url,
        instagram_url,
        linkedin_url,
        line_id,
        business_address,
        tags,
        photo_url,
        tenant_id,
        line_user_id,
        referral_origin,
        referred_by_participant_id,
        notes
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

    // Send LINE notification if user has LINE linked
    if (updatedParticipant?.line_user_id) {
      try {
        // Get LINE credentials for this tenant using existing helper
        const lineCredentials = await getLineCredentials(decoded.tenant_id);

        if (lineCredentials?.channelAccessToken) {
          const lineClient = new LineClient(lineCredentials.channelAccessToken);
          
          // Create success notification Flex Message
          const baseUrl = getProductionBaseUrl();
          
          const businessCardUrl = `${baseUrl}/api/participants/${updatedParticipant.participant_id}/business-card?tenant_id=${decoded.tenant_id}`;
          
          const successFlexMessage = {
            type: "flex",
            altText: "อัพเดตข้อมูลสำเร็จ",
            contents: {
              type: "bubble",
              size: "kilo",
              header: {
                type: "box",
                layout: "vertical",
                backgroundColor: "#10B981",
                paddingAll: "16px",
                contents: [
                  {
                    type: "text",
                    text: "บันทึกข้อมูลสำเร็จ",
                    color: "#FFFFFF",
                    weight: "bold",
                    size: "lg"
                  }
                ]
              },
              body: {
                type: "box",
                layout: "vertical",
                spacing: "md",
                paddingAll: "16px",
                contents: [
                  {
                    type: "text",
                    text: updatedParticipant.full_name_th,
                    weight: "bold",
                    size: "lg",
                    wrap: true
                  },
                  ...(updatedParticipant.position || updatedParticipant.company ? [{
                    type: "text",
                    text: [updatedParticipant.position, updatedParticipant.company].filter(Boolean).join(" | "),
                    size: "sm",
                    color: "#666666",
                    wrap: true
                  }] : []),
                  {
                    type: "text",
                    text: "ข้อมูลของคุณถูกบันทึกเรียบร้อยแล้ว",
                    size: "sm",
                    color: "#444444",
                    wrap: true,
                    margin: "lg"
                  }
                ]
              }
            }
          };

          // Send success notification first
          await lineClient.pushMessage(updatedParticipant.line_user_id, successFlexMessage);
          console.log(`${logPrefix} Sent LINE success notification to ${updatedParticipant.line_user_id.slice(0, 8)}...`);

          // Fetch complete participant data for business card (same query as card command)
          const { data: cardData, error: cardError } = await supabaseAdmin
            .from("participants")
            .select(`
              participant_id,
              tenant_id,
              full_name_th,
              nickname_th,
              position,
              company,
              tagline,
              photo_url,
              company_logo_url,
              email,
              phone,
              website_url,
              facebook_url,
              instagram_url,
              linkedin_url,
              business_address,
              line_user_id,
              line_id,
              tags,
              onepage_url
            `)
            .eq("participant_id", updatedParticipant.participant_id)
            .eq("tenant_id", decoded.tenant_id)
            .single();

          // Use fresh data if available, otherwise fall back to update response
          let businessCardData: BusinessCardData;
          
          if (cardError || !cardData) {
            console.warn(`${logPrefix} Fresh query failed, using update response:`, cardError?.message);
            // Fallback: construct from updatedParticipant (may have fewer fields)
            businessCardData = {
              participant_id: updatedParticipant.participant_id,
              tenant_id: decoded.tenant_id,
              full_name_th: updatedParticipant.full_name_th,
              nickname_th: updatedParticipant.nickname_th || updatedParticipant.nickname || null,
              position: updatedParticipant.position,
              company: updatedParticipant.company,
              tagline: updatedParticipant.tagline,
              photo_url: updatedParticipant.photo_url,
              email: updatedParticipant.email,
              phone: updatedParticipant.phone,
              website_url: updatedParticipant.website_url,
              facebook_url: updatedParticipant.facebook_url,
              instagram_url: updatedParticipant.instagram_url,
              linkedin_url: updatedParticipant.linkedin_url,
              business_address: updatedParticipant.business_address,
              line_user_id: updatedParticipant.line_user_id,
              line_id: updatedParticipant.line_id,
              tags: updatedParticipant.tags,
            };
          } else {
            businessCardData = cardData as BusinessCardData;
          }

          // Create and send business card Flex Message
          const businessCardFlexMessage = createBusinessCardFlexMessage(businessCardData, baseUrl);
          await lineClient.pushMessage(updatedParticipant.line_user_id, businessCardFlexMessage);
          console.log(`${logPrefix} Sent business card to ${updatedParticipant.line_user_id.slice(0, 8)}...`);
        }
      } catch (lineError: any) {
        // Don't fail the request if LINE notification fails
        console.error(`${logPrefix} Failed to send LINE notification:`, lineError.message);
      }
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

// Update participant details (authenticated endpoint - for admin editing)
router.patch("/:participantId", verifySupabaseAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { participantId } = req.params;
    const { full_name_th, email, phone, company, business_type, status, referred_by_participant_id } = req.body;
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
    if (full_name_th !== undefined) updateData.full_name_th = full_name_th;
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

/**
 * Delete participant completely
 * Removes: participants, user_roles, activation_tokens, and auth.users
 * This ensures clean deletion without orphaned records
 */
router.delete("/:participantId", verifySupabaseAuth, async (req: AuthenticatedRequest, res: Response) => {
  const requestId = crypto.randomUUID();
  const logPrefix = `[delete-participant:${requestId}]`;

  try {
    const { participantId } = req.params;
    const userId = req.user?.id;

    console.log(`${logPrefix} Delete request for participant: ${participantId}`);

    if (!participantId) {
      return res.status(400).json({
        success: false,
        error: "Missing participant ID"
      });
    }

    // Get participant to verify ownership and get user_id
    const { data: participant, error: fetchError } = await supabaseAdmin
      .from("participants")
      .select("participant_id, tenant_id, user_id, full_name_th, email")
      .eq("participant_id", participantId)
      .single();

    if (fetchError || !participant) {
      console.log(`${logPrefix} Participant not found`);
      return res.status(404).json({
        success: false,
        error: "Participant not found"
      });
    }

    // Verify user has permission (super_admin or tenant admin)
    const { data: superAdminRole } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "super_admin")
      .maybeSingle();

    if (!superAdminRole) {
      const { data: userRole } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("tenant_id", participant.tenant_id)
        .in("role", ["chapter_admin", "admin"])
        .maybeSingle();

      if (!userRole) {
        console.log(`${logPrefix} User ${userId} not authorized for tenant ${participant.tenant_id}`);
        return res.status(403).json({
          success: false,
          error: "You don't have permission to delete participants in this chapter"
        });
      }
    }

    // Check for dependencies (checkins)
    const { data: checkins } = await supabaseAdmin
      .from("checkins")
      .select("checkin_id")
      .eq("participant_id", participantId)
      .limit(1);

    if (checkins && checkins.length > 0) {
      console.log(`${logPrefix} Cannot delete - has checkin history`);
      return res.status(400).json({
        success: false,
        error: "Cannot delete participant with check-in history"
      });
    }

    // Begin deletion process
    console.log(`${logPrefix} Starting deletion for ${participant.full_name_th} (user_id: ${participant.user_id || 'none'})`);

    // 1. Delete activation_tokens
    const { error: tokenDeleteError } = await supabaseAdmin
      .from("activation_tokens")
      .delete()
      .eq("participant_id", participantId);

    if (tokenDeleteError) {
      console.warn(`${logPrefix} Failed to delete activation_tokens:`, tokenDeleteError);
      // Continue - not critical
    } else {
      console.log(`${logPrefix} Deleted activation_tokens`);
    }

    // If participant has a linked user account, clean up user-related records
    if (participant.user_id) {
      // 2. First check if user has roles in OTHER tenants OR is a super_admin
      // IMPORTANT: Use separate queries because .neq() doesn't work with NULL values
      
      // Check for super_admin role (tenant_id = null)
      const { data: superAdminRoles } = await supabaseAdmin
        .from("user_roles")
        .select("id, tenant_id, role")
        .eq("user_id", participant.user_id)
        .eq("role", "super_admin")
        .is("tenant_id", null);

      // Check for roles in other tenants (not this one, not null)
      const { data: otherTenantRoles } = await supabaseAdmin
        .from("user_roles")
        .select("id, tenant_id, role")
        .eq("user_id", participant.user_id)
        .not("tenant_id", "is", null)
        .neq("tenant_id", participant.tenant_id);

      const hasSuperAdmin = superAdminRoles && superAdminRoles.length > 0;
      const hasOtherTenants = otherTenantRoles && otherTenantRoles.length > 0;

      if (hasSuperAdmin || hasOtherTenants) {
        // User has super_admin role or roles in other tenants - KEEP the user and auth account
        console.log(`${logPrefix} User has super_admin=${hasSuperAdmin} or other tenants=${hasOtherTenants} - keeping auth user`);
        
        // Delete only this tenant's role (not super_admin)
        const { error: roleDeleteError } = await supabaseAdmin
          .from("user_roles")
          .delete()
          .eq("user_id", participant.user_id)
          .eq("tenant_id", participant.tenant_id);

        if (roleDeleteError) {
          console.error(`${logPrefix} Failed to delete user_roles:`, roleDeleteError);
          return res.status(500).json({
            success: false,
            error: "Failed to delete user role",
            message: roleDeleteError.message
          });
        }
        console.log(`${logPrefix} Deleted user_roles for this tenant only - preserved super_admin and other roles`);
      } else {
        // User only has roles in this tenant and is not super_admin - safe to delete everything
        console.log(`${logPrefix} User has no super_admin or other tenant roles - deleting all user data`);
        
        // Delete all roles for this user (should be just this tenant)
        const { error: roleDeleteError } = await supabaseAdmin
          .from("user_roles")
          .delete()
          .eq("user_id", participant.user_id);

        if (roleDeleteError) {
          console.error(`${logPrefix} Failed to delete user_roles:`, roleDeleteError);
          return res.status(500).json({
            success: false,
            error: "Failed to delete user roles",
            message: roleDeleteError.message
          });
        }
        console.log(`${logPrefix} Deleted all user_roles`);

        // Delete auth user
        const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(
          participant.user_id
        );

        if (authDeleteError) {
          console.error(`${logPrefix} Failed to delete auth user:`, authDeleteError);
          return res.status(500).json({
            success: false,
            error: "Failed to delete user account",
            message: authDeleteError.message
          });
        }
        console.log(`${logPrefix} Deleted auth user`);
      }
    }

    // 4. Delete the participant record
    const { error: participantDeleteError } = await supabaseAdmin
      .from("participants")
      .delete()
      .eq("participant_id", participantId);

    if (participantDeleteError) {
      console.error(`${logPrefix} Failed to delete participant:`, participantDeleteError);
      return res.status(500).json({
        success: false,
        error: "Failed to delete participant",
        message: participantDeleteError.message
      });
    }

    console.log(`${logPrefix} Successfully deleted participant ${participant.full_name_th}`);

    return res.json({
      success: true,
      message: `Deleted participant: ${participant.full_name_th}`
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

// Get members for referral dropdown (public endpoint - used in registration forms)
// Returns members with nickname and full_name_th for selection
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
      .select("participant_id, full_name_th, nickname")
      .eq("tenant_id", meeting.tenant_id)
      .eq("status", "member")
      .order("nickname", { ascending: true, nullsFirst: false })
      .order("full_name_th", { ascending: true });

    if (error) {
      console.error("Failed to fetch members:", error);
      return res.status(500).json({
        error: "Database error",
        message: error.message
      });
    }

    // Return members with display_name (nickname or full_name_th)
    const membersWithDisplay = (members || []).map(m => ({
      participant_id: m.participant_id,
      full_name_th: m.full_name_th,
      nickname: m.nickname,
      display_name: m.nickname || m.full_name_th
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
    // Note: Using columns that exist after migration (full_name_th, full_name_en, nickname_th, nickname_en)
    const { data: participant, error } = await supabaseAdmin
      .from("participants")
      .select(`
        participant_id,
        full_name_th,
        full_name_en,
        nickname,
        nickname_th,
        nickname_en,
        email,
        phone,
        position,
        company,
        tagline,
        business_type,
        business_type_code,
        goal,
        website_url,
        facebook_url,
        instagram_url,
        linkedin_url,
        line_id,
        business_address,
        photo_url,
        company_logo_url,
        onepage_url,
        tags,
        tenant_id,
        referral_origin,
        referred_by_participant_id,
        notes,
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

    // Get members list for referral selector (same tenant, status = member, exclude self)
    const { data: members } = await supabaseAdmin
      .from("participants")
      .select("participant_id, full_name_th, nickname_th")
      .eq("tenant_id", decoded.tenant_id)
      .eq("status", "member")
      .neq("participant_id", decoded.participant_id)
      .order("full_name_th", { ascending: true });

    // Extract tenant info (Supabase returns it as an object, not array with .single())
    const tenantInfo = Array.isArray(participant.tenants) ? participant.tenants[0] : participant.tenants;
    
    return res.json({
      success: true,
      participant: {
        ...participant,
        tenant_name: tenantInfo?.tenant_name,
        logo_url: tenantInfo?.logo_url,
      },
      members: members || [],
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

    // Get current participant to check for existing avatar (using photo_url column)
    const { data: participant } = await supabaseAdmin
      .from("participants")
      .select("photo_url")
      .eq("participant_id", decoded.participant_id)
      .single();

    // Delete old avatar if exists
    if (participant?.photo_url) {
      try {
        const oldPath = participant.photo_url.split('/').pop();
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

    // Update participant photo_url
    const { error: updateError } = await supabaseAdmin
      .from('participants')
      .update({ photo_url: publicUrl })
      .eq('participant_id', decoded.participant_id);

    if (updateError) {
      console.error(`${logPrefix} Database update error:`, updateError);
      return res.status(500).json({
        success: false,
        error: "Failed to update photo URL",
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

// Configure multer for company logo uploads
const logoUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB max for logos
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, WEBP, and SVG are allowed.'));
    }
  },
});

// Upload company logo (token-based auth)
router.post("/profile/company-logo", logoUpload.single('logo'), async (req: Request, res: Response) => {
  const requestId = crypto.randomUUID();
  const logPrefix = `[upload-company-logo:${requestId}]`;

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

    console.log(`${logPrefix} Uploading company logo for participant ${decoded.participant_id}`);

    // Get current participant to check for existing logo
    const { data: participant } = await supabaseAdmin
      .from("participants")
      .select("company_logo_url")
      .eq("participant_id", decoded.participant_id)
      .single();

    // Delete old logo if exists
    if (participant?.company_logo_url) {
      try {
        // Extract storage path from public URL: .../avatars/company-logos/{participant_id}/{filename}
        // Also strip query string (?t=...) that Supabase adds for cache busting
        const urlMatch = participant.company_logo_url.match(/\/avatars\/([^?]+)/);
        if (urlMatch && urlMatch[1]) {
          const storagePath = decodeURIComponent(urlMatch[1]);
          console.log(`${logPrefix} Deleting old logo at path: ${storagePath}`);
          await supabaseAdmin.storage
            .from('avatars')
            .remove([storagePath]);
        }
      } catch (err) {
        console.warn(`${logPrefix} Could not delete old logo:`, err);
      }
    }

    // Upload new logo to Supabase Storage
    const fileExt = path.extname(file.originalname) || '.png';
    const fileName = `${Date.now()}${fileExt}`;
    const filePath = `company-logos/${decoded.participant_id}/${fileName}`;

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

    // Update participant company_logo_url
    const { error: updateError } = await supabaseAdmin
      .from('participants')
      .update({ company_logo_url: publicUrl })
      .eq('participant_id', decoded.participant_id);

    if (updateError) {
      console.error(`${logPrefix} Database update error:`, updateError);
      return res.status(500).json({
        success: false,
        error: "Failed to update logo URL",
        message: updateError.message
      });
    }

    console.log(`${logPrefix} Company logo uploaded successfully`);

    return res.json({
      success: true,
      logo_url: publicUrl
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

// Delete company logo (token-based auth)
router.delete("/profile/company-logo", async (req: Request, res: Response) => {
  const requestId = crypto.randomUUID();
  const logPrefix = `[delete-company-logo:${requestId}]`;

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

    console.log(`${logPrefix} Deleting company logo for participant ${decoded.participant_id}`);

    // Get current participant to find existing logo
    const { data: participant } = await supabaseAdmin
      .from("participants")
      .select("company_logo_url")
      .eq("participant_id", decoded.participant_id)
      .single();

    if (participant?.company_logo_url) {
      try {
        // Extract storage path from public URL: .../avatars/company-logos/{participant_id}/{filename}
        // Also strip query string (?t=...) that Supabase adds for cache busting
        const urlMatch = participant.company_logo_url.match(/\/avatars\/([^?]+)/);
        if (urlMatch && urlMatch[1]) {
          const storagePath = decodeURIComponent(urlMatch[1]);
          console.log(`${logPrefix} Deleting logo at path: ${storagePath}`);
          await supabaseAdmin.storage
            .from('avatars')
            .remove([storagePath]);
        }
      } catch (err) {
        console.warn(`${logPrefix} Could not delete logo file:`, err);
      }
    }

    // Update participant to remove logo URL
    const { error: updateError } = await supabaseAdmin
      .from('participants')
      .update({ company_logo_url: null })
      .eq('participant_id', decoded.participant_id);

    if (updateError) {
      console.error(`${logPrefix} Database update error:`, updateError);
      return res.status(500).json({
        success: false,
        error: "Failed to update database",
        message: updateError.message
      });
    }

    console.log(`${logPrefix} Company logo deleted successfully`);

    return res.json({
      success: true,
      message: "Logo deleted successfully"
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

// Configure multer for onepage uploads (image or PDF)
const onepageUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max for onepage
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, WEBP, and PDF are allowed.'));
    }
  },
});

// Upload participant onepage (token-based auth)
router.post("/profile/onepage", onepageUpload.single('onepage'), async (req: Request, res: Response) => {
  const requestId = crypto.randomUUID();
  const logPrefix = `[upload-onepage:${requestId}]`;

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
        message: "Please upload an image or PDF file"
      });
    }

    console.log(`${logPrefix} Uploading onepage for participant ${decoded.participant_id}`);

    // Get current participant to check for existing onepage
    const { data: participant } = await supabaseAdmin
      .from("participants")
      .select("onepage_url")
      .eq("participant_id", decoded.participant_id)
      .single();

    // Delete old onepage if exists
    if (participant?.onepage_url) {
      try {
        // Extract path from URL (format: .../onepages/tenant_id/participant_id/filename)
        const urlParts = participant.onepage_url.split('/onepages/');
        if (urlParts.length > 1) {
          const oldPath = urlParts[1];
          await supabaseAdmin.storage
            .from('onepages')
            .remove([oldPath]);
          console.log(`${logPrefix} Deleted old onepage: ${oldPath}`);
        }
      } catch (err) {
        console.warn(`${logPrefix} Could not delete old onepage:`, err);
      }
    }

    // Upload new onepage to Supabase Storage
    const fileExt = path.extname(file.originalname) || (file.mimetype === 'application/pdf' ? '.pdf' : '.jpg');
    const fileName = `onepage_${Date.now()}${fileExt}`;
    const filePath = `${decoded.tenant_id}/${decoded.participant_id}/${fileName}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from('onepages')
      .upload(filePath, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });

    if (uploadError) {
      console.error(`${logPrefix} Upload error:`, uploadError);
      return res.status(500).json({
        success: false,
        error: "Failed to upload file",
        message: uploadError.message
      });
    }

    // Get public URL
    const { data: { publicUrl } } = supabaseAdmin.storage
      .from('onepages')
      .getPublicUrl(filePath);

    // Update participant onepage_url
    const { error: updateError } = await supabaseAdmin
      .from('participants')
      .update({ onepage_url: publicUrl })
      .eq('participant_id', decoded.participant_id);

    if (updateError) {
      console.error(`${logPrefix} Database update error:`, updateError);
      return res.status(500).json({
        success: false,
        error: "Failed to update onepage URL",
        message: updateError.message
      });
    }

    console.log(`${logPrefix} Onepage uploaded successfully: ${publicUrl}`);

    return res.json({
      success: true,
      onepage_url: publicUrl
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
      .select("full_name_th, position, company, email, phone, website_url, avatar_url")
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
      full_name_th: participant.full_name_th,
      position: participant.position,
      company: participant.company,
      email: participant.email,
      phone: participant.phone,
      website_url: participant.website_url,
      photo_url: participant.avatar_url,
    };

    const vCardContent = generateVCard(vCardData);
    const filename = getVCardFilename(participant.full_name_th);

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
      .select("participant_id, tenant_id, full_name_th, email, phone, company, business_type, goal, notes, status, line_user_id")
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
      full_name_th,
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

    if (!line_user_id || !phone || !full_name_th || !email) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields",
        message: "line_user_id, phone, full_name_th, and email are required",
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
        .select("participant_id, tenant_id, line_user_id, photo_url")
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
          full_name_th,
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
          full_name_th,
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

    // Helper function to find column value with flexible matching
    const getColumnValue = (row: any, ...possibleNames: string[]): string => {
      // First try exact matches
      for (const name of possibleNames) {
        if (row[name] !== undefined && row[name] !== '') {
          return String(row[name]);
        }
      }
      // Then try trimmed keys matching trimmed names
      const rowKeys = Object.keys(row);
      for (const name of possibleNames) {
        const trimmedName = name.trim().toLowerCase();
        for (const key of rowKeys) {
          if (key.trim().toLowerCase() === trimmedName) {
            if (row[key] !== undefined && row[key] !== '') {
              return String(row[key]);
            }
          }
        }
      }
      return '';
    };

    // Log column names from first row for debugging
    if (rawData.length > 0) {
      const firstRow = rawData[0] as Record<string, unknown>;
      const columnNames = Object.keys(firstRow);
      console.log(`${logPrefix} Excel columns found:`, columnNames);
    }

    // Map Excel columns to our schema
    const participants = rawData.map((row: any, index: number) => {
      const fullNameTh = getColumnValue(row, 'ชื่อ - สกุล', 'ชื่อ-สกุล', 'ชื่อ', 'full_name_th', 'full_name', 'name');
      const nickname = getColumnValue(row, 'ชื่อเล่น', 'nickname', 'nick');
      const company = getColumnValue(row, 'บริษัทฯ', 'บริษัท', 'company');
      const businessType = getColumnValue(row, 'ธุรกิจ', 'business_type', 'business');
      const phone = getColumnValue(row, 'เบอร์โทร', 'โทร', 'phone', 'tel');
      
      // Debug log for first few rows
      if (index < 3) {
        console.log(`${logPrefix} Row ${index + 2}: name="${fullNameTh}", nickname="${nickname}", phone="${phone}"`);
      }

      // Normalize phone (strip non-digits)
      const normalizedPhone = String(phone).replace(/\D/g, '');

      return {
        row_number: index + 2, // +2 because Excel is 1-indexed and has header row
        tenant_id,
        full_name_th: fullNameTh.trim(),
        nickname_th: nickname.trim() || null, // Use nickname_th (new schema)
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
      if (!p.full_name_th) {
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
      .select("phone, full_name_th, participant_id")
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
          `Row ${p.row_number}: Phone ${p.phone} already exists (${existing.full_name_th})`
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
      .select("user_id, full_name_th, phone")
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
    const baseUrl = getProductionBaseUrl();
    
    const activationUrl = `${baseUrl}/activate/${result.token}`;

    console.log(`${logPrefix} Activation link generated successfully`);

    return res.json({
      success: true,
      token: result.token,
      activation_url: activationUrl,
      participant: {
        full_name_th: participant.full_name_th,
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
 * Check if participant has linked LINE (polling endpoint)
 * Used by activation flow to wait for LINE webhook to update line_user_id
 * Public endpoint (no auth required)
 */
router.get("/check-line-link/:token", async (req: Request, res: Response) => {
  const requestId = crypto.randomUUID();
  const logPrefix = `[check-line-link:${requestId}]`;

  try {
    const { token } = req.params;

    console.log(`${logPrefix} Checking LINE link status`, {
      token_prefix: token ? token.slice(0, 8) + '...' : undefined
    });

    if (!token) {
      return res.status(400).json({
        success: false,
        error: "Token required"
      });
    }

    // Find the token and check participant's line_user_id
    const { data: tokenData, error: tokenError } = await supabaseAdmin
      .from('activation_tokens')
      .select(`
        participant_id,
        participants (
          line_user_id,
          full_name_th,
          phone
        )
      `)
      .eq('token', token)
      .single();

    if (tokenError || !tokenData) {
      console.error(`${logPrefix} Token lookup failed:`, tokenError);
      return res.status(400).json({
        success: false,
        error: "Invalid token"
      });
    }

    const participant = Array.isArray(tokenData.participants)
      ? tokenData.participants[0]
      : tokenData.participants;

    const hasLinkedLine = !!(participant?.line_user_id);

    console.log(`${logPrefix} LINE link status:`, { hasLinkedLine });

    return res.json({
      success: true,
      hasLinkedLine,
      participant: participant ? {
        full_name_th: participant.full_name_th,
        phone: participant.phone
      } : null
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
          full_name_th,
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

    // Get current participant status to check if already a member
    const { data: currentParticipant } = await supabaseAdmin
      .from("participants")
      .select("status, joined_date")
      .eq("participant_id", participant.participant_id)
      .single();

    // Only upgrade status and set joined_date if not already a member
    const isAlreadyMember = currentParticipant?.status === "member";
    const updateData: Record<string, any> = { user_id: userId };
    
    if (!isAlreadyMember) {
      updateData.status = "member";
      // Only set joined_date if not already set
      if (!currentParticipant?.joined_date) {
        updateData.joined_date = new Date().toISOString();
      }
    }

    // Link this participant to user AND upgrade status to member (if not already)
    const { error: linkError } = await supabaseAdmin
      .from("participants")
      .update(updateData)
      .eq("participant_id", participant.participant_id);

    if (linkError) {
      console.error(`${logPrefix} Failed to link participant:`, linkError);
      return res.status(500).json({
        success: false,
        error: "Failed to link participant"
      });
    }

    if (!isAlreadyMember) {
      console.log(`${logPrefix} Participant status upgraded to member`);
    } else {
      console.log(`${logPrefix} Participant already a member, status preserved`);
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
 * Send activation link via LINE
 * Requires participant to have line_user_id linked
 * Protected endpoint (chapter_admin or super_admin)
 */
router.post("/send-activation", verifySupabaseAuth, async (req: AuthenticatedRequest, res: Response) => {
  const requestId = crypto.randomUUID();
  const logPrefix = `[send-activation:${requestId}]`;

  try {
    const { participant_id, tenant_id } = req.body;

    console.log(`${logPrefix} Request to send activation link`, {
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
      .select("participant_id, full_name_th, phone, line_user_id, user_id")
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
    const result = await sendActivationLink({
      participantId: participant.participant_id,
      tenantId: tenant_id,
      lineUserId: participant.line_user_id,
      fullName: participant.full_name_th,
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
      message: "Activation link sent via LINE",
      activation_url: result.activationUrl
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
 * Auto-send activation link after LINE phone linking
 * Called by Edge Function webhook, no auth required
 * Public endpoint (internal use only)
 */
router.post("/send-activation-auto", async (req: Request, res: Response) => {
  const requestId = crypto.randomUUID();
  const logPrefix = `[send-activation-auto:${requestId}]`;

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

    const { participant_id, tenant_id, line_user_id, full_name_th } = req.body;

    console.log(`${logPrefix} Auto-send activation request`, {
      participant_id,
      tenant_id,
      line_user_id: line_user_id ? '***' : undefined
    });

    if (!participant_id || !tenant_id || !line_user_id || !full_name_th) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: participant_id, tenant_id, line_user_id, full_name_th"
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
    const result = await sendActivationLink({
      participantId: participant_id,
      tenantId: tenant_id,
      lineUserId: line_user_id,
      fullName: full_name_th,
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
      message: "Activation link sent automatically",
      activation_url: result.activationUrl
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
 * Activate account via web form
 * Creates user account and links to participant
 * LINE linking happens separately via phone number registration
 * Public endpoint (no auth required)
 */
router.post("/activate", async (req: Request, res: Response) => {
  const requestId = crypto.randomUUID();
  const logPrefix = `[activate:${requestId}]`;

  try {
    const { token, email, password } = req.body;

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

    // CRITICAL: Mark token as used immediately to prevent reuse
    // If account creation fails, user must request new token
    const markResult = await markTokenAsUsed(supabaseAdmin, token);
    if (!markResult.success) {
      console.error(`${logPrefix} Failed to mark token as used:`, markResult.error);
      return res.status(500).json({
        success: false,
        error: "Failed to process activation token"
      });
    }

    // Create user account
    const { data: authData, error: signUpError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: participant.full_name_th,
        phone: participant.phone
      }
    });

    if (signUpError || !authData.user) {
      console.error(`${logPrefix} Sign up error:`, signUpError);
      // Token is already marked as used - user must request new activation link
      return res.status(400).json({
        success: false,
        error: "Failed to create account. Please contact administrator for new activation link.",
        message: signUpError?.message
      });
    }

    const userId = authData.user.id;

    // Get current participant status to check if already a member
    const { data: currentParticipant } = await supabaseAdmin
      .from("participants")
      .select("status, joined_date")
      .eq("participant_id", participant.participant_id)
      .single();

    // Only upgrade status and set joined_date if not already a member
    const isAlreadyMember = currentParticipant?.status === "member";
    const updateData: Record<string, any> = { user_id: userId };
    
    if (!isAlreadyMember) {
      updateData.status = "member";
      // Only set joined_date if not already set
      if (!currentParticipant?.joined_date) {
        updateData.joined_date = new Date().toISOString();
      }
    }

    // Link user to participant AND upgrade status to member (if not already)
    // LINE linking will happen separately when user registers via LINE
    const { error: linkError } = await supabaseAdmin
      .from('participants')
      .update(updateData)
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

    if (!isAlreadyMember) {
      console.log(`${logPrefix} Participant status upgraded to member`);
    } else {
      console.log(`${logPrefix} Participant already a member, status preserved`);
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

    // Update participant's email if provided
    if (participant.email !== email) {
      await supabaseAdmin
        .from("participants")
        .update({ email })
        .eq("participant_id", participant.participant_id);
    }

    console.log(`${logPrefix} Successfully created account and linked participant`, {
      user_id: userId,
      participant_id: participant.participant_id
    });

    // Send LINE notification if participant has linked LINE account
    // Non-blocking - errors are logged but don't affect activation success
    if (participant.line_user_id) {
      console.log(`${logPrefix} Sending LINE notification to user`, {
        line_user_id: participant.line_user_id
      });

      try {
        // Get tenant LINE credentials from tenant_secrets
        const lineCredentials = await getLineCredentials(tenantId);

        if (!lineCredentials) {
          console.error(`${logPrefix} No LINE credentials found for tenant`);
        } else {
          // Get tenant name for the message
          const { data: tenant } = await supabaseAdmin
            .from("tenants")
            .select("tenant_name")
            .eq("tenant_id", tenantId)
            .single();

          const lineClient = new LineClient(lineCredentials.channelAccessToken);

          // Build base URL for profile link
          const baseUrl = getProductionBaseUrl();

          // Generate profile edit token (24h expiry)
          const profileToken = generateProfileToken(participant.participant_id, tenantId);

          // Create success Flex Message with profile edit button
          const successMessage = createActivationSuccessFlexMessage({
            participant_id: participant.participant_id,
            full_name_th: participant.full_name_th,
            nickname: participant.nickname,
            chapter_name: tenant?.tenant_name || "Chapter",
            status: participant.status || "member",
            profile_token: profileToken
          }, baseUrl);

          await lineClient.pushMessage(participant.line_user_id, [successMessage]);
          console.log(`${logPrefix} LINE notification sent successfully`);
        }
      } catch (lineError: any) {
        console.error(`${logPrefix} Failed to send LINE notification:`, lineError.message);
        // Don't fail the activation if LINE notification fails
      }
    } else {
      console.log(`${logPrefix} No LINE account linked, skipping notification`);
    }

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

/**
 * TEMPORARY: Reset participant for testing
 * Remove after testing is complete
 * Admin-only endpoint
 */
router.post("/reset-for-testing", verifySupabaseAuth, async (req: AuthenticatedRequest, res: Response) => {
  const requestId = crypto.randomUUID();
  const logPrefix = `[reset-testing:${requestId}]`;

  try {
    const { phone } = req.body;
    const userId = req.user?.id;

    console.log(`${logPrefix} Reset request for phone:`, phone?.slice(0, 3) + '****');

    if (!userId || !phone) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields"
      });
    }

    // Verify user is super_admin
    const { data: userRoles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    const isSuperAdmin = userRoles?.some(r => r.role === 'super_admin');

    if (!isSuperAdmin) {
      return res.status(403).json({
        success: false,
        error: "Unauthorized: Super admin access required"
      });
    }

    // Find participant by phone - include user_id
    const { data: participant, error: findError } = await supabaseAdmin
      .from("participants")
      .select("participant_id, full_name_th, phone, line_user_id, user_id, tenant_id")
      .eq("phone", phone)
      .maybeSingle();

    if (findError) {
      console.error(`${logPrefix} Error finding participant:`, findError);
      return res.status(500).json({
        success: false,
        error: "Database error",
        message: findError.message
      });
    }

    if (!participant) {
      return res.status(404).json({
        success: false,
        error: "Participant not found"
      });
    }

    console.log(`${logPrefix} Found participant:`, {
      participant_id: participant.participant_id,
      full_name_th: participant.full_name_th,
      has_line: !!participant.line_user_id,
      has_user: !!participant.user_id
    });

    // If participant has user_id, delete the auth user and user_roles
    if (participant.user_id) {
      console.log(`${logPrefix} Deleting auth user:`, participant.user_id);

      // Delete user_roles first
      const { error: roleDeleteError } = await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", participant.user_id);

      if (roleDeleteError) {
        console.error(`${logPrefix} Error deleting user_roles:`, roleDeleteError);
        // Continue anyway - not critical
      }

      // Delete auth user
      const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(
        participant.user_id
      );

      if (authDeleteError) {
        console.error(`${logPrefix} Error deleting auth user:`, authDeleteError);
        // Continue anyway - user might have been manually deleted
      } else {
        console.log(`${logPrefix} Auth user deleted successfully`);
      }
    }

    // Clear line_user_id and user_id
    const { error: updateError } = await supabaseAdmin
      .from("participants")
      .update({ 
        line_user_id: null,
        user_id: null
      })
      .eq("participant_id", participant.participant_id);

    if (updateError) {
      console.error(`${logPrefix} Error clearing participant links:`, updateError);
      return res.status(500).json({
        success: false,
        error: "Failed to clear participant links",
        message: updateError.message
      });
    }

    // Delete ALL activation tokens for this participant (used and unused)
    const { error: deleteTokenError } = await supabaseAdmin
      .from("activation_tokens")
      .delete()
      .eq("participant_id", participant.participant_id);

    if (deleteTokenError) {
      console.error(`${logPrefix} Error deleting tokens:`, deleteTokenError);
      // Don't fail the whole operation if token deletion fails
    }

    console.log(`${logPrefix} Successfully reset participant data - fully cleaned`);

    return res.json({
      success: true,
      message: "Participant reset successfully (auth user, roles, and links cleared)",
      participant: {
        participant_id: participant.participant_id,
        full_name_th: participant.full_name_th,
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
 * PUBLIC: Get participant profile for public sharing
 * No authentication required - only returns public-safe fields
 */
router.get("/public/:participantId", async (req: Request, res: Response) => {
  const requestId = crypto.randomUUID().slice(0, 8);
  const logPrefix = `[public-profile:${requestId}]`;
  
  try {
    const { participantId } = req.params;
    
    if (!participantId) {
      return res.status(400).json({
        success: false,
        error: "Participant ID is required"
      });
    }
    
    console.log(`${logPrefix} Fetching public profile for:`, participantId);
    
    // Fetch participant with tenant info - only public fields
    const { data: participant, error } = await supabaseAdmin
      .from("participants")
      .select(`
        participant_id,
        tenant_id,
        full_name_th,
        nickname,
        position,
        company,
        company_logo_url,
        tagline,
        photo_url,
        email,
        phone,
        website_url,
        facebook_url,
        instagram_url,
        linkedin_url,
        line_id,
        business_address,
        tags,
        onepage_url,
        status
      `)
      .eq("participant_id", participantId)
      .in("status", ["member", "visitor"])
      .single();
    
    if (error || !participant) {
      console.log(`${logPrefix} Participant not found or not active`);
      return res.status(404).json({
        success: false,
        error: "Profile not found"
      });
    }
    
    // Fetch tenant info for branding
    const { data: tenant } = await supabaseAdmin
      .from("tenants")
      .select("tenant_name, subdomain")
      .eq("tenant_id", participant.tenant_id)
      .single();
    
    // Fetch tenant settings for logo/branding
    const { data: settings } = await supabaseAdmin
      .from("tenant_settings")
      .select("logo_url, branding_color")
      .eq("tenant_id", participant.tenant_id)
      .single();
    
    console.log(`${logPrefix} Found profile for:`, participant.full_name_th);
    
    // Generate signed URLs for private storage assets
    let signedPhotoUrl = participant.photo_url;
    let signedCompanyLogoUrl = participant.company_logo_url;
    
    // Sign photo_url if it's a Supabase storage URL
    if (participant.photo_url && participant.photo_url.includes('supabase.co/storage')) {
      try {
        // Extract path from URL: /storage/v1/object/public/avatars/... or /storage/v1/object/sign/avatars/...
        const pathMatch = participant.photo_url.match(/\/avatars\/([^?]+)/);
        if (pathMatch) {
          const storagePath = pathMatch[1];
          const { data: signedData } = await supabaseAdmin.storage
            .from('avatars')
            .createSignedUrl(storagePath, 60 * 60 * 24); // 24 hours
          if (signedData?.signedUrl) {
            signedPhotoUrl = signedData.signedUrl;
            console.log(`${logPrefix} Generated signed URL for photo`);
          }
        }
      } catch (e) {
        console.log(`${logPrefix} Failed to sign photo URL:`, e);
      }
    }
    
    // Sign company_logo_url if it's a Supabase storage URL
    if (participant.company_logo_url && participant.company_logo_url.includes('supabase.co/storage')) {
      try {
        const pathMatch = participant.company_logo_url.match(/\/avatars\/([^?]+)/);
        if (pathMatch) {
          const storagePath = pathMatch[1];
          const { data: signedData } = await supabaseAdmin.storage
            .from('avatars')
            .createSignedUrl(storagePath, 60 * 60 * 24); // 24 hours
          if (signedData?.signedUrl) {
            signedCompanyLogoUrl = signedData.signedUrl;
            console.log(`${logPrefix} Generated signed URL for company logo`);
          }
        }
      } catch (e) {
        console.log(`${logPrefix} Failed to sign company logo URL:`, e);
      }
    }
    
    return res.json({
      success: true,
      profile: {
        ...participant,
        photo_url: signedPhotoUrl,
        company_logo_url: signedCompanyLogoUrl,
        tenant: {
          name: tenant?.tenant_name || "Unknown",
          subdomain: tenant?.subdomain || null,
          logo_url: settings?.logo_url || null,
          branding_color: settings?.branding_color || "#1e40af"
        }
      }
    });
    
  } catch (error: any) {
    console.error(`${logPrefix} Error:`, error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch profile"
    });
  }
});

/**
 * PUBLIC: Generate vCard for download
 */
router.get("/public/:participantId/vcard", async (req: Request, res: Response) => {
  const requestId = crypto.randomUUID().slice(0, 8);
  const logPrefix = `[vcard-download:${requestId}]`;
  
  try {
    const { participantId } = req.params;
    
    console.log(`${logPrefix} Generating vCard for:`, participantId);
    
    // Fetch participant data
    const { data: participant, error } = await supabaseAdmin
      .from("participants")
      .select(`
        full_name_th,
        nickname,
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
      .in("status", ["member", "visitor"])
      .single();
    
    if (error || !participant) {
      return res.status(404).json({
        success: false,
        error: "Profile not found"
      });
    }
    
    // Generate vCard
    const vCardData: VCardData = {
      full_name_th: participant.full_name_th,
      position: participant.position || undefined,
      company: participant.company || undefined,
      email: participant.email || undefined,
      phone: participant.phone || undefined,
      website_url: participant.website_url || undefined,
      business_address: participant.business_address || undefined,
      photo_url: participant.photo_url || undefined
    };
    
    const vCardContent = generateVCard(vCardData);
    const filename = getVCardFilename(participant.full_name_th);
    
    res.setHeader("Content-Type", "text/vcard; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(vCardContent);
    
    console.log(`${logPrefix} vCard generated for:`, participant.full_name_th);
    
  } catch (error: any) {
    console.error(`${logPrefix} Error:`, error);
    return res.status(500).json({
      success: false,
      error: "Failed to generate vCard"
    });
  }
});

export default router;
