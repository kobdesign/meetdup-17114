import { Router, Request, Response } from "express";
import crypto from "crypto";
import { verifySupabaseAuth, AuthenticatedRequest } from "../../utils/auth";
import { getCredentialsByBotUserId } from "../../services/line/credentials";
import { validateLineSignature, processWebhookEvents, LineWebhookPayload } from "../../services/line/webhook";
import { handleViewCard, handleMemberSearch, handleCardSearch, handleEditProfileRequest, handleCategorySearch } from "../../services/line/handlers/businessCardHandler";
import { startPhoneLinkingFlow, handlePhoneLinking, getConversationState, clearConversationState } from "../../services/line/handlers/phoneLinkingHandler";
import { handleResendActivation } from "../../services/line/handlers/resendActivationHandler";

const router = Router();

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

    // Handle other text messages
    console.log(`${logPrefix} No matching command handler for: "${text}"`);
  }

  // Handle postback events
  if (event.type === "postback") {
    const params = new URLSearchParams(event.postback.data);
    const action = params.get("action");

    console.log(`${logPrefix} Postback action: ${action}`);

    switch (action) {
      case "view_card":
        await handleViewCard(event, tenantId, accessToken, params);
        break;
      
      case "edit_profile":
        await handleEditProfileRequest(event, tenantId, accessToken);
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

export default router;
