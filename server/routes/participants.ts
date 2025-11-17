import { Router, Request, Response } from "express";
import { supabaseAdmin } from "../utils/supabaseClient";
import { verifySupabaseAuth, AuthenticatedRequest } from "../utils/auth";
import { generateVCard, getVCardFilename, VCardData } from "../services/line/vcard";

const router = Router();

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

export default router;
