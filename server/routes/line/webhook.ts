import { Router, Request, Response } from "express";
import crypto from "crypto";
import { verifySupabaseAuth, AuthenticatedRequest } from "../../utils/auth";
import { supabaseAdmin } from "../../utils/supabaseClient";
import { getCredentialsByBotUserId } from "../../services/line/credentials";
import { validateLineSignature, processWebhookEvents, LineWebhookPayload } from "../../services/line/webhook";
import { handleViewCard, handleMemberSearch, handleCardSearch, handleEditProfileRequest, handleCategorySearch, handleCategorySelection, handleBusinessCardPagePostback, handleCategoryPagePostback, replyMessage } from "../../services/line/handlers/businessCardHandler";
import { startPhoneLinkingFlow, handlePhoneLinking, getConversationState, clearConversationState } from "../../services/line/handlers/phoneLinkingHandler";
import { handleResendActivation } from "../../services/line/handlers/resendActivationHandler";
import { handleGoalsSummaryRequest } from "../../services/line/handlers/goalsSummaryHandler";
import { handleApplyMember, handleSkipApply, handleApproveMember, handleRejectMember } from "../../services/line/handlers/memberApplicationHandler";
import { handleRsvpConfirm, handleRsvpSubstitute, handleRsvpLeave, handleLeaveReason, getLeaveConversationState, clearLeaveConversationState } from "../../services/line/handlers/rsvpHandler";
import { processChapterAIQuery, isChapterAIQuery } from "../../services/chapterAI";
import { isN8nAIEnabled, forwardToN8nAI } from "../../services/n8nAIQuery";

const router = Router();

// AI Session Management - track active AI chat sessions
// Key: `${tenantId}:${lineUserId}`, Value: lastActivityTimestamp
const activeAISessions = new Map<string, number>();
const AI_SESSION_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

function getAISessionKey(tenantId: string, lineUserId: string): string {
  return `${tenantId}:${lineUserId}`;
}

function isInAISession(tenantId: string, lineUserId: string): boolean {
  const key = getAISessionKey(tenantId, lineUserId);
  const lastActivity = activeAISessions.get(key);
  if (!lastActivity) return false;
  
  // Check if session expired
  if (Date.now() - lastActivity > AI_SESSION_TIMEOUT_MS) {
    activeAISessions.delete(key);
    return false;
  }
  return true;
}

function startAISession(tenantId: string, lineUserId: string): void {
  const key = getAISessionKey(tenantId, lineUserId);
  activeAISessions.set(key, Date.now());
  console.log(`[AI Session] Started for ${lineUserId} in tenant ${tenantId}`);
}

function refreshAISession(tenantId: string, lineUserId: string): void {
  const key = getAISessionKey(tenantId, lineUserId);
  activeAISessions.set(key, Date.now());
}

function endAISession(tenantId: string, lineUserId: string): void {
  const key = getAISessionKey(tenantId, lineUserId);
  activeAISessions.delete(key);
  console.log(`[AI Session] Ended for ${lineUserId} in tenant ${tenantId}`);
}

router.post("/", async (req: Request, res: Response) => {
  const requestId = crypto.randomUUID();
  const logPrefix = `[LINE Webhook:${requestId}]`;

  try {
    console.log(`${logPrefix} Incoming webhook request`);

    const signature = req.headers["x-line-signature"] as string;
    const authHeader = req.headers.authorization;
    const body = JSON.stringify(req.body);

    // Check if this is an internal test
    const isInternalTest = authHeader && authHeader.startsWith("Bearer ");

    if (!isInternalTest && !signature) {
      console.error(`${logPrefix} Missing LINE signature`);
      console.error(`${logPrefix} Headers:`, {
        "content-type": req.headers["content-type"],
        "x-line-signature": "missing",
        "user-agent": req.headers["user-agent"],
      });
      return res.status(400).json({ 
        error: "Missing x-line-signature header",
        hint: "LINE webhooks must include x-line-signature for HMAC validation"
      });
    }

    const payload: LineWebhookPayload = req.body;

    if (!payload.destination) {
      console.error(`${logPrefix} Missing destination field in payload`);
      console.error(`${logPrefix} Payload keys:`, Object.keys(payload));
      console.error(`${logPrefix} Payload sample:`, JSON.stringify(payload).slice(0, 200));
      return res.status(400).json({ 
        error: "Missing destination field",
        hint: "Webhook payload must include 'destination' (bot user ID) for tenant resolution"
      });
    }

    if (!payload.events || !Array.isArray(payload.events)) {
      console.error(`${logPrefix} Invalid events field`);
      return res.status(400).json({ error: "Invalid events field" });
    }

    // For internal tests with auth header, skip signature validation
    if (isInternalTest) {
      console.log(`${logPrefix} Internal test mode detected`);
      console.log(`${logPrefix} Test payload:`, payload);
      return res.json({ 
        success: true, 
        mode: "test",
        eventsReceived: payload.events.length
      });
    }

    // Resolve tenant by bot user ID (destination)
    const credentials = await getCredentialsByBotUserId(payload.destination);

    if (!credentials) {
      console.error(`${logPrefix} No credentials found for destination: ${payload.destination}`);
      return res.status(404).json({ error: "Tenant not found for this LINE bot" });
    }

    console.log(`${logPrefix} Resolved to tenant: ${credentials.tenantId}`);

    // Validate HMAC signature
    const isValid = validateLineSignature(body, signature, credentials.channelSecret);

    if (!isValid) {
      console.error(`${logPrefix} Invalid signature for tenant ${credentials.tenantId}`);
      return res.status(403).json({ error: "Invalid signature" });
    }

    console.log(`${logPrefix} Signature validated for tenant ${credentials.tenantId}`);

    // Process each event
    for (const event of payload.events) {
      try {
        await processEvent(event, credentials.tenantId, credentials.channelAccessToken, logPrefix);
      } catch (eventError: any) {
        console.error(`${logPrefix} Error processing event:`, eventError);
        // Continue processing other events even if one fails
      }
    }

    console.log(`${logPrefix} Successfully processed ${payload.events.length} events`);
    
    return res.json({ success: true });
  } catch (error: any) {
    console.error(`${logPrefix} Error:`, error);
    return res.status(500).json({ 
      error: "Internal server error",
      message: error.message
    });
  }
});

/**
 * Process individual LINE webhook event
 */
async function processEvent(
  event: any,
  tenantId: string,
  accessToken: string,
  logPrefix: string
): Promise<void> {
  console.log(`${logPrefix} Processing event type: ${event.type}`);

  // Handle text messages
  if (event.type === "message" && event.message?.type === "text") {
    const text = event.message.text
      .replace(/　/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const textLower = text.toLowerCase();
    
    console.log(`${logPrefix} Text message: "${text}"`);

    const userId = event.source.userId;
    
    // Check conversation state first (for multi-step flows)
    if (userId) {
      // Check phone linking conversation state
      const state = getConversationState(tenantId, userId);
      
      if (state && state.step === "awaiting_phone" && state.action === "link_line") {
        console.log(`${logPrefix} Processing phone number in conversation flow`);
        const success = await handlePhoneLinking(event, text, tenantId, accessToken, logPrefix);
        
        if (success) {
          console.log(`${logPrefix} Phone linking completed successfully, clearing conversation state`);
          clearConversationState(tenantId, userId);
        } else {
          console.log(`${logPrefix} Phone linking failed or needs retry, keeping conversation state`);
        }
        return;
      }

      // Check leave reason conversation state
      const leaveState = getLeaveConversationState(tenantId, userId);
      if (leaveState && leaveState.step === "awaiting_leave_reason") {
        console.log(`${logPrefix} Processing leave reason in conversation flow`);
        const handled = await handleLeaveReason(event, text, tenantId, accessToken, logPrefix);
        if (handled) {
          return;
        }
      }
    }
    
    // Priority 0: Group menu command - show Quick Reply menu for group chats
    if (textLower === "เมนู" || textLower === "เมนูในกลุ่ม" || textLower === "menu" || textLower === "world") {
      console.log(`${logPrefix} Command: GROUP_MENU`);
      await sendGroupMenu(event, accessToken);
      return;
    }
    
    // Priority 1: Phone linking command
    if (textLower === "ลงทะเบียน" || textLower === "link" || textLower === "register") {
      console.log(`${logPrefix} Command: PHONE_LINKING`);
      await startPhoneLinkingFlow(event, tenantId, accessToken, logPrefix);
      return;
    }
    
    // Priority 2: Resend activation link command
    if (textLower === "ขอลิงก์ใหม่" || textLower === "ขอลิงค์" || textLower === "activate") {
      console.log(`${logPrefix} Command: RESEND_ACTIVATION`);
      await handleResendActivation(event, tenantId, accessToken, logPrefix);
      return;
    }
    
    // Priority 3: Card search commands (must check BEFORE member search)
    // Support: "card กบ", "นามบัตร john", "ค้นหา กบ", "ค้นหานามบัตร" (empty triggers prompt)
    if (textLower.startsWith("card ") || textLower.startsWith("นามบัตร ") || 
        textLower.startsWith("ค้นหา ") || textLower === "ค้นหานามบัตร") {
      let searchTerm = "";
      if (textLower.startsWith("card ")) {
        searchTerm = text.substring(5).trim();
      } else if (textLower.startsWith("นามบัตร ")) {
        searchTerm = text.substring(8).trim();
      } else if (textLower.startsWith("ค้นหา ")) {
        searchTerm = text.substring(6).trim();
      }
      // If "ค้นหานามบัตร" with no term, searchTerm remains empty → triggers prompt
      
      console.log(`${logPrefix} Command: CARD_SEARCH, term: "${searchTerm}"`);
      await handleCardSearch(event, tenantId, accessToken, searchTerm);
      return;
    }
    
    // Priority 4: Member search commands
    const searchPattern = /^(หา|ค้นหา|search)\s*สมาชิก\s+(.+)$/i;
    const match = text.match(searchPattern);
    
    if (match) {
      const searchTerm = match[2].trim();
      console.log(`${logPrefix} Command: MEMBER_SEARCH, term: "${searchTerm}"`);
      await handleMemberSearch(event, tenantId, accessToken, searchTerm);
      return;
    }
    
    // Priority 5: Search by business category - open LIFF
    if (textLower === "ค้นหาตามประเภทธุรกิจ" || textLower === "ประเภทธุรกิจ" || 
        textLower === "ค้นหาประเภทธุรกิจ" || textLower === "member ตามประเภทธุรกิจ" ||
        textLower === "search category") {
      console.log(`${logPrefix} Command: CATEGORY_SEARCH - opening LIFF`);
      await handleCategorySearch(event, tenantId, accessToken, logPrefix);
      return;
    }

    // Priority 6: Edit profile command - send Magic Link
    if (textLower === "แก้ไขโปรไฟล์" || textLower === "edit profile" || textLower === "update profile" ||
        textLower === "อัพเดทโปรไฟล์" || textLower === "แก้ไขข้อมูล") {
      console.log(`${logPrefix} Command: EDIT_PROFILE`);
      await handleEditProfileRequest(event, tenantId, accessToken);
      return;
    }
    
    // Priority 6.5: Check-in QR code command - send QR for POS check-in
    if (textLower === "qr" || textLower === "เช็คอิน" || textLower === "checkin" || textLower === "check-in") {
      console.log(`${logPrefix} Command: CHECKIN_QR`);
      await handleCheckinQRRequest(event, tenantId, accessToken, logPrefix);
      return;
    }

    // Priority 6.6: Substitute request command - open LIFF page
    if (textLower === "ส่งตัวแทน" || textLower === "substitute" || textLower === "sub" || 
        textLower === "ตัวแทน" || textLower === "ส่ง sub") {
      console.log(`${logPrefix} Command: SUBSTITUTE_REQUEST`);
      await handleSubstituteRequest(event, tenantId, accessToken, logPrefix);
      return;
    }
    
    // Priority 7: Goals summary command - show progress summary to admins
    // Support variations: "สรุปเป้าหมาย", "เป้าหมาย", "goals", "progress", with optional Thai particles
    const goalsSummaryPattern = /^(สรุปเป้าหมาย|เป้าหมาย|goals|goal\s*summary|progress)(ค่ะ|ครับ|นะ|คะ)?$/i;
    if (goalsSummaryPattern.test(textLower.trim())) {
      console.log(`${logPrefix} Command: GOALS_SUMMARY`);
      await handleGoalsSummaryRequest(event, tenantId, accessToken, logPrefix);
      return;
    }

    // Priority 8: Apply for membership command - for prospects/visitors to apply
    // Support variations with Thai polite particles: สมัครสมาชิก, สมัครสมาชิกครับ, สมัครสมาชิกค่ะ, etc.
    const applyMemberPattern = /^(สมัครสมาชิก|apply\s*member|apply)(ค่ะ|ครับ|นะ|คะ)?$/i;
    if (applyMemberPattern.test(textLower.trim())) {
      console.log(`${logPrefix} Command: APPLY_MEMBER_TEXT`);
      const lineUserId = event.source.userId;
      
      if (!lineUserId) {
        await replyMessage(event.replyToken, {
          type: "text",
          text: "⚠️ ไม่สามารถระบุตัวตนได้ กรุณาลองใหม่"
        }, accessToken, tenantId);
        return;
      }
      
      // Look up participant by LINE user ID
      const { data: participant, error: participantError } = await supabaseAdmin
        .from("participants")
        .select("participant_id, status, tenant_id")
        .eq("line_user_id", lineUserId)
        .eq("tenant_id", tenantId)
        .maybeSingle();
      
      if (participantError || !participant) {
        console.log(`${logPrefix} No participant found for LINE user - asking to link phone first`);
        // Start phone linking flow - this will send the prompt message
        await startPhoneLinkingFlow(event, tenantId, accessToken, logPrefix);
        return;
      }
      
      // Call handleApplyMember with the participant info
      await handleApplyMember(event, participant.participant_id, tenantId, accessToken, logPrefix);
      return;
    }

    // Priority 9: Apps list command - show available apps for chapter members
    const appsPattern = /^(apps|แอป|แอพ|app)(ค่ะ|ครับ|นะ|คะ)?$/i;
    if (appsPattern.test(textLower.trim())) {
      console.log(`${logPrefix} Command: APPS_LIST`);
      await handleAppsListRequest(event, tenantId, accessToken, logPrefix);
      return;
    }

    // Priority 10: AI Chatbot with Session Support
    const lineUserId = event.source.userId;
    if (lineUserId) {
      // Check for AI session start command: "hi ai", "hello ai", "สวัสดี ai"
      const startAIPattern = /^(hi|hello|สวัสดี|หวัดดี)\s*(ai|เอไอ)$/i;
      if (startAIPattern.test(textLower.trim())) {
        console.log(`${logPrefix} Command: AI_SESSION_START`);
        startAISession(tenantId, lineUserId);
        await replyMessage(event.replyToken, {
          type: "text",
          text: "สวัสดีครับ ผมเป็น BNI Chapter Data Assistant พร้อมช่วยเหลือแล้วครับ\n\nสามารถถามคำถามได้เลย เช่น:\n- มี member กี่คน\n- Meeting ล่าสุดวันไหน\n- ใครมาประชุมบ้าง\n\nพิมพ์ 'bye' เพื่อจบการสนทนา"
        }, accessToken, tenantId);
        return;
      }
      
      // Check for AI session end command: "bye", "ai bye", "ลาก่อน"
      const endAIPattern = /^(bye|ai\s*bye|ลาก่อน|บาย|จบ)$/i;
      if (endAIPattern.test(textLower.trim()) && isInAISession(tenantId, lineUserId)) {
        console.log(`${logPrefix} Command: AI_SESSION_END`);
        endAISession(tenantId, lineUserId);
        await replyMessage(event.replyToken, {
          type: "text",
          text: "ขอบคุณครับ หากต้องการคุยกับ AI อีกครั้ง พิมพ์ 'hi ai' ได้เลยครับ"
        }, accessToken, tenantId);
        return;
      }
      
      // If user is in active AI session, forward ALL messages to n8n
      if (isInAISession(tenantId, lineUserId)) {
        console.log(`${logPrefix} Command: AI_CHATBOT (session active)`);
        refreshAISession(tenantId, lineUserId);
        await handleChapterAIQuery(event, text, tenantId, accessToken, logPrefix);
        return;
      }
      
      // Fallback: Check pattern-based AI queries (for backward compatibility)
      if (isChapterAIQuery(text)) {
        console.log(`${logPrefix} Command: AI_CHATBOT (pattern match)`);
        // Auto-start session when pattern matches
        startAISession(tenantId, lineUserId);
        await handleChapterAIQuery(event, text, tenantId, accessToken, logPrefix);
        return;
      }
    }

    // Handle other text messages
    console.log(`${logPrefix} No matching command handler for: "${text}"`);
  }

  // Handle postback events
  if (event.type === "postback") {
    const postbackData = event.postback.data;
    console.log(`${logPrefix} ========== POSTBACK EVENT RECEIVED ==========`);
    console.log(`${logPrefix} Raw postback data: "${postbackData}"`);
    console.log(`${logPrefix} Postback data length: ${postbackData.length}`);

    // Parse action-based postback data (format: action=xxx&param=value)
    const rsvpParams = new URLSearchParams(postbackData);
    const rsvpAction = rsvpParams.get("action");

    // RSVP postback handlers
    if (rsvpAction === "rsvp_confirm") {
      const meetingId = rsvpParams.get("meeting_id");
      if (meetingId) {
        console.log(`${logPrefix} RSVP Confirm for meeting: ${meetingId}`);
        await handleRsvpConfirm(event, meetingId, tenantId, accessToken, logPrefix);
        return;
      }
    }

    if (rsvpAction === "rsvp_substitute") {
      const meetingId = rsvpParams.get("meeting_id");
      if (meetingId) {
        console.log(`${logPrefix} RSVP Substitute for meeting: ${meetingId}`);
        await handleRsvpSubstitute(event, meetingId, tenantId, accessToken, logPrefix);
        return;
      }
    }

    if (rsvpAction === "rsvp_leave") {
      const meetingId = rsvpParams.get("meeting_id");
      if (meetingId) {
        console.log(`${logPrefix} RSVP Leave for meeting: ${meetingId}`);
        await handleRsvpLeave(event, meetingId, tenantId, accessToken, logPrefix);
        return;
      }
    }
    
    // Check for category_page pagination postback (format: category_page:pageNum:categoryCode)
    if (postbackData.startsWith("category_page:")) {
      console.log(`${logPrefix} Matched category_page pattern`);
      const parts = postbackData.split(":");
      
      if (parts.length >= 3) {
        const page = parseInt(parts[1], 10);
        const categoryCode = parts[2];
        
        if (isNaN(page) || page < 1 || !categoryCode) {
          console.log(`${logPrefix} Invalid category_page format: page=${page}, categoryCode=${categoryCode}`);
          try {
            await replyMessage(event.replyToken, {
              type: "text",
              text: "รูปแบบไม่ถูกต้อง กรุณาลองใหม่"
            }, accessToken, tenantId);
          } catch (replyError) {
            console.error(`${logPrefix} Failed to send validation error reply:`, replyError);
          }
          return;
        }
        
        console.log(`${logPrefix} Calling handleCategoryPagePostback: page=${page}, categoryCode="${categoryCode}"`);
        try {
          await handleCategoryPagePostback(event, tenantId, accessToken, page, categoryCode, logPrefix);
          console.log(`${logPrefix} handleCategoryPagePostback completed successfully`);
        } catch (handlerError) {
          console.error(`${logPrefix} handleCategoryPagePostback FAILED:`, handlerError);
          try {
            await replyMessage(event.replyToken, {
              type: "text",
              text: "เกิดข้อผิดพลาดในการโหลดหน้าถัดไป กรุณาลองใหม่"
            }, accessToken, tenantId);
          } catch (replyError) {
            console.error(`${logPrefix} Failed to send error reply:`, replyError);
          }
        }
        return;
      }
    }
    
    // Check for business_card_page pagination postback (format: business_card_page:pageNum:encodedSearchTerm)
    if (postbackData.startsWith("business_card_page:")) {
      console.log(`${logPrefix} Matched business_card_page pattern`);
      const parts = postbackData.split(":");
      console.log(`${logPrefix} Split parts count: ${parts.length}, parts: [${parts.map(p => `"${p}"`).join(', ')}]`);
      
      if (parts.length >= 3) {
        const page = parseInt(parts[1], 10);
        const encodedSearchTerm = parts.slice(2).join(":"); // Handle search terms that may contain ":"
        console.log(`${logPrefix} Encoded search term: "${encodedSearchTerm}"`);
        
        let searchTerm: string;
        try {
          searchTerm = decodeURIComponent(encodedSearchTerm);
          console.log(`${logPrefix} Decoded search term: "${searchTerm}"`);
        } catch (decodeError) {
          console.error(`${logPrefix} Failed to decode search term: "${encodedSearchTerm}"`, decodeError);
          try {
            await replyMessage(event.replyToken, {
              type: "text",
              text: "เกิดข้อผิดพลาดในการถอดรหัสคำค้นหา กรุณาลองค้นหาใหม่"
            }, accessToken, tenantId);
          } catch (replyError) {
            console.error(`${logPrefix} Failed to send decode error reply:`, replyError);
          }
          return;
        }
        
        // Validate page number
        if (isNaN(page) || page < 1) {
          console.log(`${logPrefix} Invalid page number: ${page}`);
          try {
            await replyMessage(event.replyToken, {
              type: "text",
              text: "หมายเลขหน้าไม่ถูกต้อง กรุณาลองใหม่"
            }, accessToken, tenantId);
          } catch (replyError) {
            console.error(`${logPrefix} Failed to send page validation error reply:`, replyError);
          }
          return;
        }
        
        console.log(`${logPrefix} Calling handleBusinessCardPagePostback: page=${page}, searchTerm="${searchTerm}"`);
        try {
          await handleBusinessCardPagePostback(event, tenantId, accessToken, page, searchTerm, logPrefix);
          console.log(`${logPrefix} handleBusinessCardPagePostback completed successfully`);
        } catch (handlerError) {
          console.error(`${logPrefix} handleBusinessCardPagePostback FAILED:`, handlerError);
          try {
            await replyMessage(event.replyToken, {
              type: "text",
              text: "เกิดข้อผิดพลาดในการโหลดหน้าถัดไป กรุณาลองใหม่"
            }, accessToken, tenantId);
          } catch (replyError) {
            console.error(`${logPrefix} Failed to send error reply:`, replyError);
          }
        }
        return;
      } else {
        console.log(`${logPrefix} Invalid business_card_page format: parts.length=${parts.length}`);
      }
    }
    
    const params = new URLSearchParams(postbackData);
    const action = params.get("action");

    console.log(`${logPrefix} Postback action: ${action}`);

    switch (action) {
      case "view_card":
        await handleViewCard(event, tenantId, accessToken, params);
        break;
      
      case "edit_profile":
        await handleEditProfileRequest(event, tenantId, accessToken);
        break;
      
      case "search_category":
        const categoryCode = params.get("category");
        if (categoryCode) {
          await handleCategorySelection(event, tenantId, accessToken, categoryCode, logPrefix);
        }
        break;
      
      case "apply_member":
        const applyParticipantId = params.get("participant_id");
        const applyPostbackTenantId = params.get("tenant_id");
        // Security: Verify postback tenant_id matches server-resolved tenant
        if (applyParticipantId && applyPostbackTenantId === tenantId) {
          await handleApplyMember(event, applyParticipantId, tenantId, accessToken, logPrefix);
        } else if (applyPostbackTenantId !== tenantId) {
          console.warn(`${logPrefix} Security: tenant_id mismatch in apply_member postback. Expected ${tenantId}, got ${applyPostbackTenantId}`);
        }
        break;
      
      case "skip_apply":
        await handleSkipApply(event, accessToken, logPrefix);
        break;
      
      case "approve_member":
        const approveParticipantId = params.get("participant_id");
        const approvePostbackTenantId = params.get("tenant_id");
        if (approveParticipantId && approvePostbackTenantId === tenantId) {
          await handleApproveMember(event, approveParticipantId, tenantId, accessToken, logPrefix);
        } else if (approvePostbackTenantId !== tenantId) {
          console.warn(`${logPrefix} Security: tenant_id mismatch in approve_member postback`);
        }
        break;
      
      case "reject_member":
        const rejectParticipantId = params.get("participant_id");
        const rejectPostbackTenantId = params.get("tenant_id");
        if (rejectParticipantId && rejectPostbackTenantId === tenantId) {
          await handleRejectMember(event, rejectParticipantId, tenantId, accessToken, logPrefix);
        } else if (rejectPostbackTenantId !== tenantId) {
          console.warn(`${logPrefix} Security: tenant_id mismatch in reject_member postback`);
        }
        break;
      
      default:
        console.log(`${logPrefix} Unknown postback action: ${action}`);
    }
  }

  // Handle follow/unfollow events
  if (event.type === "follow") {
    console.log(`${logPrefix} User followed: ${event.source.userId}`);
    // TODO: Send welcome message with business card introduction
  }

  if (event.type === "unfollow") {
    console.log(`${logPrefix} User unfollowed: ${event.source.userId}`);
  }
}

/**
 * Handle check-in QR code request
 * Generates a secure signed QR code for POS check-in
 */
async function handleCheckinQRRequest(
  event: any,
  tenantId: string,
  accessToken: string,
  logPrefix: string
): Promise<void> {
  const lineUserId = event.source.userId;
  
  console.log(`${logPrefix} Check-in QR request from:`, lineUserId);
  
  try {
    const { supabaseAdmin } = await import("../../utils/supabaseClient");
    const { generateCheckinToken } = await import("../../utils/checkinToken");
    const { getProductionBaseUrl } = await import("../../utils/getProductionUrl");
    
    // Find participant by LINE user ID
    const { data: participant, error } = await supabaseAdmin
      .from("participants")
      .select("participant_id, tenant_id, full_name_th, status")
      .eq("line_user_id", lineUserId)
      .eq("tenant_id", tenantId)
      .single();
    
    if (error || !participant) {
      console.log(`${logPrefix} Participant not found for LINE user:`, lineUserId);
      await replyMessage(event.replyToken, {
        type: "text",
        text: "ไม่พบข้อมูลของคุณในระบบ\n\nกรุณาลงทะเบียนก่อนโดยพิมพ์ \"ลงทะเบียน\""
      }, accessToken, tenantId);
      return;
    }
    
    // Check eligibility
    const allowedStatuses = ["member", "visitor", "prospect"];
    if (!allowedStatuses.includes(participant.status)) {
      await replyMessage(event.replyToken, {
        type: "text",
        text: "สถานะของคุณไม่สามารถขอ QR เช็คอินได้"
      }, accessToken, tenantId);
      return;
    }
    
    // Generate secure signed token with 15-minute expiry
    const qrToken = generateCheckinToken(participant.participant_id, participant.tenant_id);
    const baseUrl = getProductionBaseUrl();
    const qrUrl = `${baseUrl}/pos-qr?token=${encodeURIComponent(qrToken)}`;
    
    // Create Flex Message with QR code
    const flexMessage = {
      type: "flex",
      altText: `QR Code สำหรับเช็คอิน - ${participant.full_name_th}`,
      contents: {
        type: "bubble",
        size: "mega",
        header: {
          type: "box",
          layout: "vertical",
          contents: [
            {
              type: "text",
              text: "QR Code สำหรับเช็คอิน",
              weight: "bold",
              size: "lg",
              color: "#1F2937"
            }
          ],
          paddingAll: "15px",
          backgroundColor: "#F3F4F6"
        },
        body: {
          type: "box",
          layout: "vertical",
          contents: [
            {
              type: "text",
              text: participant.full_name_th,
              weight: "bold",
              size: "xl",
              align: "center",
              color: "#1F2937"
            },
            {
              type: "text",
              text: participant.status === "member" ? "สมาชิก" : "ผู้เยี่ยมชม",
              size: "sm",
              align: "center",
              color: "#6B7280",
              margin: "sm"
            },
            {
              type: "separator",
              margin: "lg"
            },
            {
              type: "box",
              layout: "vertical",
              contents: [
                {
                  type: "image",
                  url: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrToken)}`,
                  size: "full",
                  aspectMode: "fit",
                  aspectRatio: "1:1"
                }
              ],
              margin: "lg",
              paddingAll: "10px",
              backgroundColor: "#FFFFFF",
              cornerRadius: "md"
            },
            {
              type: "text",
              text: "QR นี้ใช้ได้ 15 นาที",
              size: "xs",
              color: "#EF4444",
              align: "center",
              margin: "md"
            }
          ],
          paddingAll: "20px"
        },
        footer: {
          type: "box",
          layout: "vertical",
          contents: [
            {
              type: "text",
              text: "แสดง QR นี้ให้เจ้าหน้าที่ลงทะเบียน",
              size: "xs",
              color: "#9CA3AF",
              align: "center"
            }
          ],
          paddingAll: "15px"
        }
      }
    };
    
    await replyMessage(event.replyToken, flexMessage, accessToken, tenantId);
    
    console.log(`${logPrefix} Secure check-in QR sent for:`, participant.full_name_th);
    
  } catch (error: any) {
    console.error(`${logPrefix} Error generating check-in QR:`, error);
    await replyMessage(event.replyToken, {
      type: "text",
      text: "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง"
    }, accessToken, tenantId);
  }
}

/**
 * Handle substitute request command
 * Sends LIFF link for member to submit substitute info
 */
async function handleSubstituteRequest(
  event: any,
  tenantId: string,
  accessToken: string,
  logPrefix: string
): Promise<void> {
  const lineUserId = event.source.userId;
  
  console.log(`${logPrefix} Substitute request from:`, lineUserId);
  
  try {
    const { supabaseAdmin } = await import("../../utils/supabaseClient");
    
    // Find participant by LINE user ID
    const { data: participant, error } = await supabaseAdmin
      .from("participants")
      .select("participant_id, tenant_id, full_name_th, status")
      .eq("line_user_id", lineUserId)
      .eq("tenant_id", tenantId)
      .single();
    
    if (error || !participant) {
      console.log(`${logPrefix} Participant not found for LINE user:`, lineUserId);
      await replyMessage(event.replyToken, {
        type: "text",
        text: "ไม่พบข้อมูลของคุณในระบบ\n\nกรุณาลงทะเบียนก่อนโดยพิมพ์ \"ลงทะเบียน\""
      }, accessToken, tenantId);
      return;
    }
    
    // Only members can send substitutes
    if (participant.status !== "member") {
      await replyMessage(event.replyToken, {
        type: "text",
        text: "เฉพาะสมาชิกเท่านั้นที่สามารถส่งตัวแทนได้"
      }, accessToken, tenantId);
      return;
    }
    
    // Get next meeting
    const today = new Date().toISOString().split("T")[0];
    const { data: meeting } = await supabaseAdmin
      .from("meetings")
      .select("meeting_id, meeting_date, theme")
      .eq("tenant_id", tenantId)
      .gte("meeting_date", today)
      .order("meeting_date", { ascending: true })
      .limit(1)
      .single();
    
    if (!meeting) {
      await replyMessage(event.replyToken, {
        type: "text",
        text: "ไม่พบ Meeting ที่กำลังจะมาถึง"
      }, accessToken, tenantId);
      return;
    }
    
    // Use direct URL with token (same pattern as edit profile) - no LIFF login needed
    const { generateSubstituteToken } = await import("../../utils/profileToken");
    const { getBaseUrl } = await import("../../services/line/handlers/businessCardHandler");
    const baseUrl = getBaseUrl();
    const token = generateSubstituteToken(participant.participant_id, tenantId, meeting.meeting_id);
    const substituteUrl = `${baseUrl}/liff/substitute?token=${token}`;
    
    const meetingDate = new Date(meeting.meeting_date);
    const dateStr = meetingDate.toLocaleDateString("th-TH", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric"
    });
    
    const flexMessage = {
      type: "flex",
      altText: "แจ้งส่งตัวแทน",
      contents: {
        type: "bubble",
        size: "kilo",
        header: {
          type: "box",
          layout: "vertical",
          contents: [
            {
              type: "text",
              text: "แจ้งส่งตัวแทน",
              weight: "bold",
              size: "lg",
              color: "#1F2937"
            }
          ],
          paddingAll: "15px",
          backgroundColor: "#F3F4F6"
        },
        body: {
          type: "box",
          layout: "vertical",
          contents: [
            {
              type: "text",
              text: `Meeting: ${dateStr}`,
              size: "sm",
              color: "#374151",
              wrap: true
            },
            {
              type: "text",
              text: meeting.theme || "",
              size: "xs",
              color: "#6B7280",
              margin: "sm",
              wrap: true
            },
            {
              type: "button",
              action: {
                type: "uri",
                label: "กรอกข้อมูลตัวแทน",
                uri: substituteUrl
              },
              style: "primary",
              margin: "lg"
            }
          ],
          paddingAll: "15px"
        }
      }
    };
    
    await replyMessage(event.replyToken, flexMessage, accessToken, tenantId);
    console.log(`${logPrefix} Substitute request link sent to:`, participant.full_name_th);
    
  } catch (error: any) {
    console.error(`${logPrefix} Error handling substitute request:`, error);
    await replyMessage(event.replyToken, {
      type: "text",
      text: "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง"
    }, accessToken, tenantId);
  }
}

/**
 * Send group menu with Quick Reply options
 */
async function sendGroupMenu(event: any, accessToken: string): Promise<void> {
  const message = {
    type: "text",
    text: "เลือกเมนูที่ต้องการ:",
    quickReply: {
      items: [
        {
          type: "action",
          action: {
            type: "message",
            label: "ค้นหาประเภทธุรกิจ",
            text: "ค้นหาประเภทธุรกิจ"
          }
        },
        {
          type: "action",
          action: {
            type: "message",
            label: "ค้นหานามบัตร",
            text: "ค้นหานามบัตร"
          }
        },
        {
          type: "action",
          action: {
            type: "message",
            label: "ลงทะเบียน",
            text: "ลงทะเบียน"
          }
        },
        {
          type: "action",
          action: {
            type: "message",
            label: "ขอลิงก์ใหม่",
            text: "ขอลิงก์ใหม่"
          }
        },
        {
          type: "action",
          action: {
            type: "message",
            label: "แก้ไขโปรไฟล์",
            text: "แก้ไขโปรไฟล์"
          }
        },
        {
          type: "action",
          action: {
            type: "message",
            label: "แอป",
            text: "แอป"
          }
        }
      ]
    }
  };

  const response = await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${accessToken}`
    },
    body: JSON.stringify({
      replyToken: event.replyToken,
      messages: [message]
    })
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("[GroupMenu] Failed to send menu:", error);
  }
}

async function handleChapterAIQuery(
  event: any,
  text: string,
  tenantId: string,
  accessToken: string,
  logPrefix: string
): Promise<void> {
  const lineUserId = event.source?.userId;

  if (!lineUserId) {
    console.log(`${logPrefix} AI query received without userId`);
    return;
  }

  console.log(`${logPrefix} Processing AI query: "${text}"`);

  try {
    let response: string;

    // Check if n8n Text-to-SQL is enabled
    if (isN8nAIEnabled()) {
      console.log(`${logPrefix} Using n8n Text-to-SQL backend`);
      
      // Get user info for role-based access
      const { data: participant } = await supabaseAdmin
        .from("participants")
        .select("full_name_th, nickname_th, status")
        .eq("line_user_id", lineUserId)
        .eq("tenant_id", tenantId)
        .maybeSingle();

      // Determine user role
      let userRole: 'admin' | 'member' | 'visitor' = 'visitor';
      if (participant?.status === 'member') {
        // Check if admin
        const { data: adminRole } = await supabaseAdmin
          .from("user_roles")
          .select("role")
          .eq("tenant_id", tenantId)
          .eq("user_id", (await supabaseAdmin
            .from("participants")
            .select("user_id")
            .eq("line_user_id", lineUserId)
            .eq("tenant_id", tenantId)
            .maybeSingle()).data?.user_id)
          .maybeSingle();
        
        userRole = adminRole?.role === 'chapter_admin' ? 'admin' : 'member';
      }

      const userName = participant?.nickname_th || participant?.full_name_th || 'Unknown';
      
      response = await forwardToN8nAI(tenantId, lineUserId, userRole, userName, text);
    } else {
      // Use built-in OpenAI processing
      response = await processChapterAIQuery(text, tenantId, lineUserId);
    }

    await replyMessage(event.replyToken, {
      type: "text",
      text: response
    }, accessToken, tenantId);

    console.log(`${logPrefix} AI query response sent successfully`);
  } catch (error: any) {
    console.error(`${logPrefix} Error processing AI query:`, error);
    await replyMessage(event.replyToken, {
      type: "text",
      text: "ขออภัย เกิดข้อผิดพลาดในการประมวลผลคำถาม กรุณาลองใหม่อีกครั้ง"
    }, accessToken, tenantId);
  }
}

async function handleAppsListRequest(
  event: any,
  tenantId: string,
  accessToken: string,
  logPrefix: string
): Promise<void> {
  const lineUserId = event.source?.userId;
  
  if (!lineUserId) {
    console.log(`${logPrefix} Apps command received without userId - cannot identify user`);
    await replyMessage(event.replyToken, {
      type: "text",
      text: "ไม่สามารถระบุตัวตนได้ กรุณาส่งข้อความจากแชทส่วนตัวกับ LINE Official Account"
    }, accessToken, tenantId);
    return;
  }
  
  console.log(`${logPrefix} Apps list request from:`, lineUserId);
  
  try {
    const { data: participant, error: participantError } = await supabaseAdmin
      .from("participants")
      .select("participant_id, status, full_name_th, nickname_th")
      .eq("line_user_id", lineUserId)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    
    if (participantError || !participant || participant.status !== "member") {
      console.log(`${logPrefix} Non-member trying to access apps:`, lineUserId);
      await replyMessage(event.replyToken, {
        type: "text",
        text: "แอปพลิเคชันเหล่านี้สำหรับสมาชิกเท่านั้น\n\nหากคุณเป็นสมาชิก กรุณาลงทะเบียนก่อนโดยพิมพ์ \"ลงทะเบียน\""
      }, accessToken, tenantId);
      return;
    }
    
    const { data: enabledApps, error: appsError } = await supabaseAdmin
      .from("chapter_apps")
      .select(`
        app_id,
        apps:app_id (
          app_id,
          name,
          description,
          icon,
          route
        )
      `)
      .eq("tenant_id", tenantId)
      .eq("is_enabled", true);
    
    if (appsError) {
      console.error(`${logPrefix} Error fetching apps:`, appsError);
      await replyMessage(event.replyToken, {
        type: "text",
        text: "เกิดข้อผิดพลาดในการโหลดรายการแอป กรุณาลองใหม่ภายหลัง"
      }, accessToken, tenantId);
      return;
    }
    
    const apps = (enabledApps || [])
      .map(item => item.apps)
      .filter(app => app !== null);
    
    if (apps.length === 0) {
      await replyMessage(event.replyToken, {
        type: "text",
        text: "ยังไม่มีแอปพลิเคชันที่เปิดใช้งานใน Chapter นี้"
      }, accessToken, tenantId);
      return;
    }
    
    const { getAppsLiffId } = await import("../../utils/liffConfig");
    const appsLiffId = await getAppsLiffId();
    
    if (!appsLiffId) {
      console.error(`${logPrefix} No Apps LIFF ID configured`);
      await replyMessage(event.replyToken, {
        type: "text",
        text: "ระบบยังไม่ได้ตั้งค่า LIFF สำหรับ Apps กรุณาติดต่อผู้ดูแลระบบ"
      }, accessToken, tenantId);
      return;
    }
    
    const appBubbles = apps.map((app: any) => {
      const appSlug = app.route?.replace("/apps/", "") || app.app_id;
      const liffUrl = `https://liff.line.me/${appsLiffId}/liff/apps/${appSlug}?tenant=${tenantId}`;
      
      return {
        type: "bubble",
        size: "kilo",
        body: {
          type: "box",
          layout: "horizontal",
          contents: [
            {
              type: "box",
              layout: "vertical",
              contents: [
                {
                  type: "text",
                  text: app.icon || "App",
                  size: "xl",
                  align: "center",
                  gravity: "center"
                }
              ],
              width: "50px",
              height: "50px",
              backgroundColor: "#F0F4F8",
              cornerRadius: "8px"
            },
            {
              type: "box",
              layout: "vertical",
              contents: [
                {
                  type: "text",
                  text: app.name,
                  weight: "bold",
                  size: "md",
                  wrap: true
                },
                {
                  type: "text",
                  text: app.description || "",
                  size: "xs",
                  color: "#8C8C8C",
                  wrap: true
                }
              ],
              flex: 1,
              paddingStart: "12px"
            }
          ],
          paddingAll: "12px",
          action: {
            type: "uri",
            label: app.name,
            uri: liffUrl
          }
        }
      };
    });
    
    const flexMessage = {
      type: "flex",
      altText: "Chapter Apps",
      contents: {
        type: "carousel",
        contents: appBubbles
      }
    };
    
    await replyMessage(event.replyToken, flexMessage, accessToken, tenantId);
    console.log(`${logPrefix} Sent apps list with ${apps.length} apps`);
    
  } catch (error: any) {
    console.error(`${logPrefix} Error in handleAppsListRequest:`, error);
    await replyMessage(event.replyToken, {
      type: "text",
      text: "เกิดข้อผิดพลาด กรุณาลองใหม่ภายหลัง"
    }, accessToken, tenantId);
  }
}

export default router;
