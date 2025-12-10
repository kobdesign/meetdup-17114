import { Router, Request, Response } from "express";
import crypto from "crypto";
import { verifySupabaseAuth, AuthenticatedRequest } from "../../utils/auth";
import { getCredentialsByBotUserId } from "../../services/line/credentials";
import { validateLineSignature, processWebhookEvents, LineWebhookPayload } from "../../services/line/webhook";
import { handleViewCard, handleMemberSearch, handleCardSearch, handleEditProfileRequest, handleCategorySearch, handleCategorySelection, handleBusinessCardPagePostback, replyMessage } from "../../services/line/handlers/businessCardHandler";
import { startPhoneLinkingFlow, handlePhoneLinking, getConversationState, clearConversationState } from "../../services/line/handlers/phoneLinkingHandler";
import { handleResendActivation } from "../../services/line/handlers/resendActivationHandler";
import { handleGoalsSummaryRequest } from "../../services/line/handlers/goalsSummaryHandler";

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
    
    // Priority 7: Goals summary command - show progress summary to admins
    // Support variations: "สรุปเป้าหมาย", "เป้าหมาย", "goals", "progress", with optional Thai particles
    const goalsSummaryPattern = /^(สรุปเป้าหมาย|เป้าหมาย|goals|goal\s*summary|progress)(ค่ะ|ครับ|นะ|คะ)?$/i;
    if (goalsSummaryPattern.test(textLower.trim())) {
      console.log(`${logPrefix} Command: GOALS_SUMMARY`);
      await handleGoalsSummaryRequest(event, tenantId, accessToken, logPrefix);
      return;
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

export default router;
