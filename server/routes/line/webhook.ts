import { Router, Request, Response } from "express";
import crypto from "crypto";
import { validateLineSignature, LineWebhookPayload } from "../../services/line/webhook";
import { getSharedLineConfig, findParticipantByLineUserId, getTenantRichMenuId } from "../../services/line/sharedConfig";
import { handleViewCard, handleMemberSearch, handleCardSearch, handleEditProfileRequest } from "../../services/line/handlers/businessCardHandler";
import { startPhoneLinkingFlow, handlePhoneLinking, getConversationState, clearConversationState, setConversationState } from "../../services/line/handlers/phoneLinkingHandler";
import { handleResendActivation } from "../../services/line/handlers/resendActivationHandler";
import { LineClient } from "../../services/line/lineClient";
import { supabaseAdmin } from "../../utils/supabaseClient";

const router = Router();

/**
 * Shared LINE OA Webhook
 * 
 * All chapters use the same LINE Official Account.
 * Tenant identification happens via user's participant record (line_user_id).
 */
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
      return res.status(400).json({ 
        error: "Missing x-line-signature header",
        hint: "LINE webhooks must include x-line-signature for HMAC validation"
      });
    }

    const payload: LineWebhookPayload = req.body;

    if (!payload.events || !Array.isArray(payload.events)) {
      console.error(`${logPrefix} Invalid events field`);
      return res.status(400).json({ error: "Invalid events field" });
    }

    // For internal tests with auth header, skip signature validation
    if (isInternalTest) {
      console.log(`${logPrefix} Internal test mode detected`);
      return res.json({ 
        success: true, 
        mode: "test",
        eventsReceived: payload.events.length
      });
    }

    // Get shared LINE config
    const sharedConfig = getSharedLineConfig();
    
    if (!sharedConfig) {
      console.error(`${logPrefix} Shared LINE config not available`);
      return res.status(500).json({ error: "LINE configuration not available" });
    }

    // Validate HMAC signature using shared config
    const isValid = validateLineSignature(body, signature, sharedConfig.channelSecret);

    if (!isValid) {
      console.error(`${logPrefix} Invalid signature`);
      return res.status(403).json({ error: "Invalid signature" });
    }

    console.log(`${logPrefix} Signature validated for shared LINE OA`);

    // Process each event
    for (const event of payload.events) {
      try {
        await processEvent(event, sharedConfig.channelAccessToken, logPrefix);
      } catch (eventError: any) {
        console.error(`${logPrefix} Error processing event:`, eventError);
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
 * Tenant is identified from user's participant record
 */
async function processEvent(
  event: any,
  accessToken: string,
  logPrefix: string
): Promise<void> {
  console.log(`${logPrefix} Processing event type: ${event.type}`);

  const userId = event.source?.userId;
  
  if (!userId) {
    console.log(`${logPrefix} No userId in event, skipping`);
    return;
  }

  // Look up participant to find tenant
  const participant = await findParticipantByLineUserId(userId);
  
  // Handle follow event - special case for new users
  if (event.type === "follow") {
    console.log(`${logPrefix} User followed: ${userId}`);
    await handleFollowEvent(event, userId, participant, accessToken, logPrefix);
    return;
  }

  if (event.type === "unfollow") {
    console.log(`${logPrefix} User unfollowed: ${userId}`);
    return;
  }

  // For message/postback events, check if user is linked
  if (!participant) {
    console.log(`${logPrefix} User not linked to any chapter: ${userId}`);
    await sendUnlinkedUserMessage(event, accessToken, logPrefix);
    return;
  }

  const tenantId = participant.tenant_id;
  console.log(`${logPrefix} User belongs to tenant: ${tenantId}`);

  // Handle text messages
  if (event.type === "message" && event.message?.type === "text") {
    await handleTextMessage(event, tenantId, accessToken, participant, logPrefix);
    return;
  }

  // Handle postback events
  if (event.type === "postback") {
    await handlePostbackEvent(event, tenantId, accessToken, logPrefix);
    return;
  }
}

/**
 * Handle follow event - welcome new users or returning users
 */
async function handleFollowEvent(
  event: any,
  userId: string,
  participant: any,
  accessToken: string,
  logPrefix: string
): Promise<void> {
  const lineClient = new LineClient(accessToken);

  if (participant) {
    // User is already linked - welcome them back and set their rich menu
    console.log(`${logPrefix} Returning user: ${participant.full_name}`);
    
    const richMenuId = await getTenantRichMenuId(participant.tenant_id);
    if (richMenuId) {
      try {
        await lineClient.linkRichMenuToUser(userId, richMenuId);
        console.log(`${logPrefix} Rich menu set for returning user`);
      } catch (err) {
        console.error(`${logPrefix} Failed to set rich menu:`, err);
      }
    }

    await lineClient.replyMessage(event.replyToken, [
      {
        type: "text",
        text: `ยินดีต้อนรับกลับ ${participant.nickname || participant.full_name}! 👋\n\nพิมพ์ "ค้นหานามบัตร" เพื่อค้นหานามบัตรสมาชิก`,
      },
    ]);
  } else {
    // New user - prompt them to register
    await lineClient.replyMessage(event.replyToken, [
      {
        type: "text",
        text: `สวัสดี! ยินดีต้อนรับสู่ Meetdup 👋\n\nเพื่อเริ่มใช้งาน กรุณาพิมพ์ "ลงทะเบียน" แล้วใส่เบอร์โทรศัพท์ที่ลงทะเบียนไว้กับ Chapter ของคุณ`,
      },
    ]);
  }
}

/**
 * Handle text messages
 */
async function handleTextMessage(
  event: any,
  tenantId: string,
  accessToken: string,
  participant: any,
  logPrefix: string
): Promise<void> {
  const text = event.message.text
    .replace(/　/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const textLower = text.toLowerCase();
  const userId = event.source.userId;
  
  console.log(`${logPrefix} Text message: "${text}"`);

  // Check conversation state first (for multi-step flows like phone linking)
  const state = getConversationState(tenantId, userId);
  
  if (state && state.step === "awaiting_phone" && state.action === "link_line") {
    console.log(`${logPrefix} Processing phone number in conversation flow`);
    const success = await handlePhoneLinking(event, text, tenantId, accessToken, logPrefix);
    
    if (success) {
      clearConversationState(tenantId, userId);
      
      // Set rich menu for newly linked user
      const richMenuId = await getTenantRichMenuId(tenantId);
      if (richMenuId) {
        const lineClient = new LineClient(accessToken);
        try {
          await lineClient.linkRichMenuToUser(userId, richMenuId);
          console.log(`${logPrefix} Rich menu set for newly linked user`);
        } catch (err) {
          console.error(`${logPrefix} Failed to set rich menu:`, err);
        }
      }
    }
    return;
  }
  
  // Card search commands
  if (textLower.startsWith("card ") || textLower.startsWith("นามบัตร ") || textLower === "ค้นหานามบัตร") {
    let searchTerm = "";
    if (textLower.startsWith("card ")) {
      searchTerm = text.substring(5).trim();
    } else if (textLower.startsWith("นามบัตร ")) {
      searchTerm = text.substring(8).trim();
    }
    
    console.log(`${logPrefix} Command: CARD_SEARCH, term: "${searchTerm}"`);
    await handleCardSearch(event, tenantId, accessToken, searchTerm);
    return;
  }
  
  // Member search commands
  const searchPattern = /^(หา|ค้นหา|search)\s*สมาชิก\s+(.+)$/i;
  const match = text.match(searchPattern);
  
  if (match) {
    const searchTerm = match[2].trim();
    console.log(`${logPrefix} Command: MEMBER_SEARCH, term: "${searchTerm}"`);
    await handleMemberSearch(event, tenantId, accessToken, searchTerm);
    return;
  }

  // Resend activation link command
  if (textLower === "ขอลิงก์ใหม่" || textLower === "ขอลิงค์" || textLower === "activate") {
    console.log(`${logPrefix} Command: RESEND_ACTIVATION`);
    await handleResendActivation(event, tenantId, accessToken, logPrefix);
    return;
  }

  // Handle other text messages
  console.log(`${logPrefix} No matching command handler for: "${text}"`);
}

/**
 * Handle postback events
 */
async function handlePostbackEvent(
  event: any,
  tenantId: string,
  accessToken: string,
  logPrefix: string
): Promise<void> {
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

/**
 * Send message to unlinked users prompting them to register
 */
async function sendUnlinkedUserMessage(
  event: any,
  accessToken: string,
  logPrefix: string
): Promise<void> {
  if (!event.replyToken) {
    console.log(`${logPrefix} No reply token for unlinked user message`);
    return;
  }

  const lineClient = new LineClient(accessToken);
  const userId = event.source.userId;
  
  // Check if they have a pending participant record (imported but not activated)
  const { data: pendingParticipant } = await supabaseAdmin
    .from("participants")
    .select("id, tenant_id, full_name, phone")
    .is("line_user_id", null)
    .eq("status", "active")
    .limit(1);

  // Check conversation state - maybe they're in the middle of phone linking
  // Use a special "global" tenant key for unlinked users
  const state = getConversationState("__unlinked__", userId);
  
  if (state && state.step === "awaiting_phone") {
    // They're entering their phone number
    const text = event.message?.text?.trim();
    if (text) {
      console.log(`${logPrefix} Unlinked user entering phone: ${text}`);
      
      // Try to find participant by phone and link them
      const normalizedPhone = text.replace(/\D/g, "");
      
      const { data: participant } = await supabaseAdmin
        .from("participants")
        .select("id, tenant_id, full_name, nickname")
        .eq("phone", normalizedPhone)
        .is("line_user_id", null)
        .eq("status", "active")
        .single();

      if (participant) {
        // Link the user
        const { error: updateError } = await supabaseAdmin
          .from("participants")
          .update({ line_user_id: userId })
          .eq("id", participant.id);

        if (!updateError) {
          clearConversationState("__unlinked__", userId);
          
          // Set rich menu
          const richMenuId = await getTenantRichMenuId(participant.tenant_id);
          if (richMenuId) {
            try {
              await lineClient.linkRichMenuToUser(userId, richMenuId);
            } catch (err) {
              console.error(`${logPrefix} Failed to set rich menu:`, err);
            }
          }

          await lineClient.replyMessage(event.replyToken, [
            {
              type: "text",
              text: `🎉 ลงทะเบียนสำเร็จ!\n\nยินดีต้อนรับ ${participant.nickname || participant.full_name}!\n\nตอนนี้คุณสามารถใช้งานได้แล้ว:\n• พิมพ์ "ค้นหานามบัตร" เพื่อค้นหานามบัตรสมาชิก\n• ใช้เมนูด้านล่างเพื่อเข้าถึงฟีเจอร์ต่างๆ`,
            },
          ]);
          return;
        }
      }

      // Phone not found
      await lineClient.replyMessage(event.replyToken, [
        {
          type: "text",
          text: `ไม่พบเบอร์ ${text} ในระบบ\n\nกรุณาตรวจสอบว่าเบอร์โทรศัพท์ถูกต้องและตรงกับที่ลงทะเบียนไว้กับ Chapter ของคุณ\n\nหากยังพบปัญหา กรุณาติดต่อ Admin ของ Chapter`,
        },
      ]);
      clearConversationState("__unlinked__", userId);
      return;
    }
  }

  // Check if this is a registration command
  const text = event.message?.text?.toLowerCase().trim();
  if (text === "ลงทะเบียน" || text === "link" || text === "register") {
    // Start phone linking flow for unlinked user
    await startPhoneLinkingFlowForUnlinked(event, userId, accessToken, logPrefix);
    return;
  }

  // Default message for unlinked users
  await lineClient.replyMessage(event.replyToken, [
    {
      type: "text",
      text: `คุณยังไม่ได้ลงทะเบียนกับ Chapter ใดๆ\n\nกรุณาพิมพ์ "ลงทะเบียน" แล้วใส่เบอร์โทรศัพท์ที่ลงทะเบียนไว้กับ Chapter ของคุณ`,
    },
  ]);
}

/**
 * Start phone linking flow for unlinked users
 */
async function startPhoneLinkingFlowForUnlinked(
  event: any,
  userId: string,
  accessToken: string,
  logPrefix: string
): Promise<void> {
  const lineClient = new LineClient(accessToken);

  // Set conversation state for unlinked user
  setConversationState("__unlinked__", userId, {
    action: "link_line",
    step: "awaiting_phone",
    startedAt: Date.now(),
  });

  await lineClient.replyMessage(event.replyToken, [
    {
      type: "text",
      text: `📱 ลงทะเบียนเชื่อมต่อ LINE\n\nกรุณาพิมพ์เบอร์โทรศัพท์ที่คุณลงทะเบียนไว้กับ Chapter\n\nตัวอย่าง: 0812345678`,
    },
  ]);
}

export default router;
