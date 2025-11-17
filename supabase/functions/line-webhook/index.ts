// @ts-ignore Deno imports
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";
// @ts-ignore Deno imports
import { createHmac } from "node:crypto";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-line-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface LineEvent {
  type: string;
  message?: {
    type: string;
    id: string;
    text?: string;
  };
  postback?: {
    data: string;
    params?: Record<string, any>;
  };
  replyToken: string;
  source: {
    type: "user" | "group" | "room";
    userId?: string;
    groupId?: string;
    roomId?: string;
  };
  timestamp: number;
}

interface TenantCredentials {
  tenantId: string;
  accessToken: string;
  channelSecret: string;
}

interface QuickReplyItem {
  type: "action";
  action: {
    type: "message" | "postback" | "uri" | "datetimepicker" | "camera" | "cameraRoll" | "location";
    label: string;
    text?: string;
    data?: string;
    displayText?: string;
    uri?: string;
    mode?: "date" | "time" | "datetime";
    initial?: string;
    max?: string;
    min?: string;
  };
  imageUrl?: string;
}

interface QuickReplyPayload {
  items: QuickReplyItem[];
}

const credentialsCache = new Map<string, { credentials: TenantCredentials; expiresAt: number }>();
const CACHE_TTL = 5 * 60 * 1000;

// Conversation state management (for phone linking flow)
interface ConversationState {
  step: "awaiting_phone" | "idle";
  action: "link_line" | null;
  expiresAt: number;
}
const conversationStates = new Map<string, ConversationState>();
const CONVERSATION_TIMEOUT = 5 * 60 * 1000; // 5 minutes

function validateSignature(body: string, channelSecret: string, signature: string): boolean {
  try {
    const hash = createHmac("sha256", channelSecret)
      .update(body)
      .digest("base64");
    return hash === signature;
  } catch (error) {
    console.error("Signature validation error:", error);
    return false;
  }
}

async function getTenantCredentials(
  destination: string,
  supabase: any,
  logPrefix: string
): Promise<TenantCredentials | null> {
  const cached = credentialsCache.get(destination);
  if (cached && cached.expiresAt > Date.now()) {
    console.log(`${logPrefix} Using cached credentials for destination: ${destination}`);
    return cached.credentials;
  }

  console.log(`${logPrefix} Fetching credentials for destination: ${destination}`);
  
  // Query credentials using key-value schema
  const { data, error } = await supabase
    .from("tenant_secrets")
    .select("tenant_id, secret_key, secret_value")
    .in("secret_key", ["line_channel_id", "line_channel_access_token", "line_channel_secret"]);

  if (error || !data || data.length === 0) {
    console.error(`${logPrefix} Error fetching credentials:`, error);
    return null;
  }

  // Find tenant by matching channel ID
  const channelIdRecords = data.filter(r => r.secret_key === "line_channel_id");
  let matchedTenantId: string | null = null;

  for (const record of channelIdRecords) {
    try {
      // Note: In Edge Function, credentials are stored encrypted
      // For now, we'll match the encrypted value directly
      // TODO: Implement decryption if needed
      const channelIdValue = JSON.parse(record.secret_value);
      // Check if destination matches (this is a simplified check)
      if (record.tenant_id) {
        matchedTenantId = record.tenant_id;
        break;
      }
    } catch (e) {
      console.error(`${logPrefix} Error parsing secret:`, e);
    }
  }

  if (!matchedTenantId) {
    console.error(`${logPrefix} No tenant found for destination: ${destination}`);
    return null;
  }

  // Get all credentials for this tenant
  const tenantSecrets = data.filter(r => r.tenant_id === matchedTenantId);
  const accessTokenRecord = tenantSecrets.find(r => r.secret_key === "line_channel_access_token");
  const channelSecretRecord = tenantSecrets.find(r => r.secret_key === "line_channel_secret");

  if (!accessTokenRecord || !channelSecretRecord) {
    console.error(`${logPrefix} Missing credentials for tenant: ${matchedTenantId}`);
    return null;
  }

  // Parse encrypted values
  try {
    const accessTokenData = JSON.parse(accessTokenRecord.secret_value);
    const channelSecretData = JSON.parse(channelSecretRecord.secret_value);

    const credentials: TenantCredentials = {
      tenantId: matchedTenantId,
      accessToken: accessTokenData.encrypted, // TODO: Decrypt if needed
      channelSecret: channelSecretData.encrypted, // TODO: Decrypt if needed
    };

    credentialsCache.set(destination, {
      credentials,
      expiresAt: Date.now() + CACHE_TTL,
    });

    return credentials;
  } catch (e) {
    console.error(`${logPrefix} Error parsing credentials:`, e);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID();
  const logPrefix = `[line-webhook:${requestId}]`;

  try {
    console.log(`${logPrefix} Incoming LINE webhook request`);

    // @ts-ignore Deno runtime
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    // @ts-ignore Deno runtime
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.text();
    const signature = req.headers.get("x-line-signature");
    const authHeader = req.headers.get("authorization");

    // Parse JSON body first to check for verification requests
    let payload;
    try {
      payload = JSON.parse(body);
    } catch (e) {
      console.error(`${logPrefix} Invalid JSON body:`, e);
      console.error(`${logPrefix} Body preview:`, body.substring(0, 200));
      return new Response(
        JSON.stringify({ error: "Invalid JSON", details: (e as Error).message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const destination = payload.destination;
    const events: LineEvent[] = payload.events || [];

    // Handle LINE webhook verification request FIRST (before signature check)
    // Verification requests have either:
    // 1. Empty events array, OR
    // 2. No destination field (or empty destination)
    // Return 200 OK immediately for verification
    if (!events || events.length === 0 || !destination) {
      console.log(`${logPrefix} LINE verification request detected`);
      console.log(`${logPrefix} - Events: ${events?.length || 0}, Destination: ${destination || 'none'}`);
      return new Response(
        JSON.stringify({ success: true, message: "Webhook endpoint verified" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check for internal test mode
    let isInternalTest = false;
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      
      if (!authError && user) {
        isInternalTest = true;
        console.log(`${logPrefix} Authenticated internal test from user: ${user.id}`);
      } else {
        console.error(`${logPrefix} Invalid auth token in test mode`);
      }
    }

    // For real webhook events, signature is required
    if (!signature && !isInternalTest) {
      console.error(`${logPrefix} Missing LINE signature - not an internal test`);
      console.error(`${logPrefix} Headers: ${JSON.stringify(Object.fromEntries(req.headers.entries()))}`);
      return new Response(
        JSON.stringify({ error: "Missing signature" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (isInternalTest) {
      console.log(`${logPrefix} Internal test mode - bypassing signature validation`);
      console.log(`${logPrefix} Received ${events.length} test events`);
      console.log(`${logPrefix} Test payload:`, JSON.stringify(payload));
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Test webhook received successfully",
          processed: events.length,
          mode: "test"
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!destination) {
      console.error(`${logPrefix} Missing destination field in payload`);
      console.error(`${logPrefix} Payload keys:`, Object.keys(payload));
      return new Response(
        JSON.stringify({ error: "Missing destination", hint: "This is a production webhook. LINE webhooks require a destination field." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const credentials = await getTenantCredentials(destination, supabase, logPrefix);
    if (!credentials) {
      console.error(`${logPrefix} No tenant configured for destination: ${destination}`);
      return new Response(
        JSON.stringify({ error: "Tenant not configured" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!validateSignature(body, credentials.channelSecret, signature!)) {
      console.error(`${logPrefix} Invalid LINE signature`);
      return new Response(
        JSON.stringify({ error: "Invalid signature" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`${logPrefix} Signature validated for tenant: ${credentials.tenantId}`);
    console.log(`${logPrefix} Processing ${events.length} events`);

    for (const event of events) {
      console.log(`${logPrefix} Event type: ${event.type}, source: ${event.source.type}`);

      try {
        await processLineEvent(event, supabase, credentials, logPrefix);
      } catch (error) {
        console.error(`${logPrefix} Error processing event:`, error);
      }
    }

    return new Response(
      JSON.stringify({ success: true, processed: events.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error(`${logPrefix} Fatal error:`, error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function processLineEvent(
  event: LineEvent, 
  supabase: any, 
  credentials: TenantCredentials,
  logPrefix: string
) {
  if (event.type === "message" && event.message?.type === "text") {
    await handleTextMessage(event, supabase, credentials, logPrefix);
  } else if (event.type === "postback") {
    await handlePostback(event, supabase, credentials, logPrefix);
  } else if (event.type === "follow") {
    await handleFollow(event, supabase, credentials, logPrefix);
  } else if (event.type === "unfollow") {
    await handleUnfollow(event, supabase, credentials, logPrefix);
  } else if (event.type === "join") {
    await handleGroupJoin(event, supabase, credentials, logPrefix);
  } else if (event.type === "leave") {
    await handleGroupLeave(event, supabase, credentials, logPrefix);
  }
}

async function handleTextMessage(
  event: LineEvent, 
  supabase: any,
  credentials: TenantCredentials,
  logPrefix: string
) {
  const text = event.message?.text?.trim() || "";
  const textLower = text.toLowerCase();
  const userId = event.source.userId;
  const groupId = event.source.groupId;
  const isGroup = event.source.type === "group";

  console.log(`${logPrefix} Text: "${text}" from ${isGroup ? "group" : "user"}`);

  if (!userId) {
    console.error(`${logPrefix} No userId found`);
    return;
  }

  // Check conversation state (for multi-step flows)
  const stateKey = `${credentials.tenantId}:${userId}`;
  const state = conversationStates.get(stateKey);

  if (state && state.expiresAt > Date.now()) {
    // Handle conversation flow
    if (state.step === "awaiting_phone" && state.action === "link_line") {
      await handlePhoneLinking(event, text, supabase, credentials, logPrefix);
      conversationStates.delete(stateKey); // Clear state
      return;
    }
  }

  // Regular command parsing
  if (textLower.includes("สวัสดี") || textLower.includes("hello") || textLower.includes("hi")) {
    await sendGreeting(event, credentials, logPrefix);
  } else if (textLower.includes("help") || textLower.includes("ช่วยเหลือ") || textLower.includes("เมนู")) {
    await sendHelp(event, credentials, logPrefix);
  } else if (textLower.includes("ลงทะเบียน") || textLower.includes("register") || textLower.includes("เชื่อมต่อ")) {
    // Start phone linking flow
    await startPhoneLinkingFlow(event, credentials, logPrefix, userId);
  } else if (textLower.startsWith("card ") || textLower.startsWith("นามบัตร ")) {
    // Search business card: "card กบ" or "นามบัตร สมชาย"
    const searchTerm = textLower.startsWith("card ") 
      ? text.substring(5).trim() 
      : text.substring(8).trim();
    
    if (searchTerm) {
      await searchAndShowBusinessCard(event, searchTerm, supabase, credentials, logPrefix);
    } else {
      await replyMessage(event.replyToken, {
        type: "text",
        text: "💼 วิธีใช้:\n\nพิมพ์ card ตามด้วยชื่อที่ต้องการค้นหา\n\nตัวอย่าง:\n• card กบ\n• card สมชาย\n• นามบัตร จอห์น"
      }, credentials, logPrefix);
    }
  } else if (textLower.includes("นามบัตร") || textLower.includes("business card")) {
    // Show own business card
    await handlePostbackProfile(event, supabase, credentials, logPrefix, new URLSearchParams());
  } else if (textLower.includes("เช็คอิน") || textLower.includes("checkin") || textLower.includes("check-in")) {
    await handleCheckIn(event, supabase, credentials, logPrefix);
  } else {
    await sendHelp(event, credentials, logPrefix);
  }
}

async function handlePostback(
  event: LineEvent,
  supabase: any,
  credentials: TenantCredentials,
  logPrefix: string
) {
  const postbackData = event.postback?.data || "";
  console.log(`${logPrefix} Postback data: ${postbackData}`);

  // Parse postback data (format: action=value&key=value or JSON)
  const params = new URLSearchParams(postbackData);
  const action = params.get("action");

  if (!action) {
    console.error(`${logPrefix} No action in postback data`);
    await replyMessage(event.replyToken, {
      type: "text",
      text: "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง"
    }, credentials, logPrefix);
    return;
  }

  console.log(`${logPrefix} Postback action: ${action}`);

  // Handle different postback actions
  switch (action) {
    case "checkin":
      await handlePostbackCheckIn(event, supabase, credentials, logPrefix, params);
      break;
    
    case "meeting_info":
      await handlePostbackMeetingInfo(event, supabase, credentials, logPrefix, params);
      break;
    
    case "payment":
      await handlePostbackPayment(event, supabase, credentials, logPrefix, params);
      break;
    
    case "profile":
      await handlePostbackProfile(event, supabase, credentials, logPrefix, params);
      break;
    
    case "help":
      await sendHelp(event, credentials, logPrefix);
      break;
    
    default:
      console.warn(`${logPrefix} Unknown postback action: ${action}`);
      await replyMessage(event.replyToken, {
        type: "text",
        text: "ไม่พบคำสั่งที่คุณต้องการ กรุณาลองใหม่อีกครั้ง"
      }, credentials, logPrefix);
  }
}

async function handlePostbackCheckIn(
  event: LineEvent,
  supabase: any,
  credentials: TenantCredentials,
  logPrefix: string,
  params: URLSearchParams
) {
  const meetingId = params.get("meeting_id");
  
  if (!meetingId) {
    await replyMessage(event.replyToken, {
      type: "text",
      text: "⚠️ ไม่พบข้อมูลการประชุม\n\nกรุณาใช้ QR Code สำหรับเช็คอินครับ"
    }, credentials, logPrefix);
    return;
  }

  // TODO: Implement actual check-in logic with meeting_id
  await replyMessage(event.replyToken, {
    type: "text",
    text: "⏳ ระบบเช็คอินผ่าน Rich Menu กำลังอยู่ระหว่างการพัฒนา\n\nกรุณาใช้ QR Code สำหรับเช็คอินในตอนนี้ครับ"
  }, credentials, logPrefix);
}

async function handlePostbackMeetingInfo(
  event: LineEvent,
  supabase: any,
  credentials: TenantCredentials,
  logPrefix: string,
  params: URLSearchParams
) {
  const userId = event.source.userId;
  
  if (!userId) {
    await replyMessage(event.replyToken, {
      type: "text",
      text: "ไม่สามารถระบุตัวตนได้ กรุณาเพิ่มเพื่อนก่อนครับ"
    }, credentials, logPrefix);
    return;
  }

  // TODO: Fetch upcoming meetings from database
  await replyMessage(event.replyToken, {
    type: "text",
    text: "📅 การประชุมที่กำลังจะมาถึง\n\n⏳ กำลังโหลดข้อมูล..."
  }, credentials, logPrefix);
}

async function handlePostbackPayment(
  event: LineEvent,
  supabase: any,
  credentials: TenantCredentials,
  logPrefix: string,
  params: URLSearchParams
) {
  const userId = event.source.userId;
  
  if (!userId) {
    await replyMessage(event.replyToken, {
      type: "text",
      text: "ไม่สามารถระบุตัวตนได้ กรุณาเพิ่มเพื่อนก่อนครับ"
    }, credentials, logPrefix);
    return;
  }

  // TODO: Fetch payment info and generate payment link
  await replyMessage(event.replyToken, {
    type: "text",
    text: "💰 ข้อมูลการชำระเงิน\n\n⏳ กำลังโหลดข้อมูล..."
  }, credentials, logPrefix);
}

async function handlePostbackProfile(
  event: LineEvent,
  supabase: any,
  credentials: TenantCredentials,
  logPrefix: string,
  params: URLSearchParams
) {
  const userId = event.source.userId;
  
  if (!userId) {
    await replyMessage(event.replyToken, {
      type: "text",
      text: "ไม่สามารถระบุตัวตนได้ กรุณาเพิ่มเพื่อนก่อนครับ"
    }, credentials, logPrefix);
    return;
  }

  // Fetch participant profile with tenant info
  const { data: participant, error } = await supabase
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
      status,
      tenants!inner (
        tenant_name,
        logo_url
      )
    `)
    .eq("tenant_id", credentials.tenantId)
    .eq("line_user_id", userId)
    .single();

  if (error || !participant) {
    console.error(`${logPrefix} Participant not found:`, error);
    await replyMessage(event.replyToken, {
      type: "text",
      text: "ไม่พบข้อมูลของคุณในระบบ\n\nกรุณาติดต่อผู้ดูแลระบบครับ"
    }, credentials, logPrefix);
    return;
  }

  console.log(`${logPrefix} Building business card for participant: ${participant.participant_id}`);

  // Generate profile edit token (via backend API)
  const baseUrl = `https://${Deno.env.get("REPLIT_DEV_DOMAIN") || "your-app.replit.dev"}`;
  let editProfileUrl = "#";
  
  try {
    const tokenResponse = await fetch(`${baseUrl}/api/participants/generate-profile-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        participant_id: participant.participant_id,
        tenant_id: credentials.tenantId
      })
    });
    
    if (tokenResponse.ok) {
      const tokenData = await tokenResponse.json();
      editProfileUrl = tokenData.profile_url;
      console.log(`${logPrefix} Profile edit URL generated`);
    } else {
      console.warn(`${logPrefix} Failed to generate profile token`);
    }
  } catch (err) {
    console.error(`${logPrefix} Error generating token:`, err);
  }

  // Build Corporate Style Business Card (Flex Message)
  const businessCard = createBusinessCardFlexMessage(participant, editProfileUrl);

  await replyMessage(event.replyToken, businessCard, credentials, logPrefix);
}

async function startPhoneLinkingFlow(
  event: LineEvent,
  credentials: TenantCredentials,
  logPrefix: string,
  userId: string
) {
  console.log(`${logPrefix} Starting phone linking flow for user: ${userId}`);

  // Set conversation state
  const stateKey = `${credentials.tenantId}:${userId}`;
  conversationStates.set(stateKey, {
    step: "awaiting_phone",
    action: "link_line",
    expiresAt: Date.now() + CONVERSATION_TIMEOUT
  });

  await replyMessage(event.replyToken, {
    type: "text",
    text: "🔗 เชื่อมโยง LINE Account\n\n" +
          "กรุณาส่งเบอร์โทรศัพท์ที่คุณลงทะเบียนไว้\n\n" +
          "ตัวอย่าง: 0812345678\n\n" +
          "⏱️ คำสั่งนี้จะหมดอายุใน 5 นาที"
  }, credentials, logPrefix);
}

async function handlePhoneLinking(
  event: LineEvent,
  phoneText: string,
  supabase: any,
  credentials: TenantCredentials,
  logPrefix: string
) {
  const userId = event.source.userId;
  if (!userId) {
    await replyMessage(event.replyToken, {
      type: "text",
      text: "⚠️ ไม่สามารถระบุตัวตนได้"
    }, credentials, logPrefix);
    return;
  }

  // Normalize phone (remove non-digits)
  const normalizedPhone = phoneText.replace(/\D/g, '');
  
  if (normalizedPhone.length < 9 || normalizedPhone.length > 15) {
    await replyMessage(event.replyToken, {
      type: "text",
      text: "⚠️ เบอร์โทรศัพท์ไม่ถูกต้อง\n\nกรุณาส่งเบอร์โทรศัพท์ใหม่อีกครั้ง"
    }, credentials, logPrefix);
    
    // Keep conversation state
    const stateKey = `${credentials.tenantId}:${userId}`;
    conversationStates.set(stateKey, {
      step: "awaiting_phone",
      action: "link_line",
      expiresAt: Date.now() + CONVERSATION_TIMEOUT
    });
    return;
  }

  console.log(`${logPrefix} Looking up participant with phone: ${normalizedPhone}`);

  // Find participant by phone
  const { data: participant, error } = await supabase
    .from("participants")
    .select("participant_id, full_name, line_user_id, status")
    .eq("tenant_id", credentials.tenantId)
    .eq("phone", normalizedPhone)
    .maybeSingle();

  if (error) {
    console.error(`${logPrefix} Database error:`, error);
    await replyMessage(event.replyToken, {
      type: "text",
      text: "⚠️ เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง"
    }, credentials, logPrefix);
    return;
  }

  if (!participant) {
    await replyMessage(event.replyToken, {
      type: "text",
      text: "❌ ไม่พบข้อมูลเบอร์โทรนี้ในระบบ\n\n" +
            "กรุณาตรวจสอบว่าลงทะเบียนแล้ว หรือติดต่อผู้ดูแลระบบ"
    }, credentials, logPrefix);
    return;
  }

  // Check if already linked
  if (participant.line_user_id) {
    if (participant.line_user_id === userId) {
      await replyMessage(event.replyToken, {
        type: "text",
        text: `✅ บัญชี LINE ของคุณเชื่อมโยงแล้ว\n\nชื่อ: ${participant.full_name}\nสถานะ: ${getStatusLabel(participant.status)}`
      }, credentials, logPrefix);
    } else {
      await replyMessage(event.replyToken, {
        type: "text",
        text: "⚠️ เบอร์โทรนี้เชื่อมโยงกับ LINE account อื่นอยู่แล้ว\n\nกรุณาติดต่อผู้ดูแลระบบ"
      }, credentials, logPrefix);
    }
    return;
  }

  // Link LINE User ID (with defensive tenant check)
  const { error: updateError } = await supabase
    .from("participants")
    .update({ line_user_id: userId })
    .eq("participant_id", participant.participant_id)
    .eq("tenant_id", credentials.tenantId);

  if (updateError) {
    console.error(`${logPrefix} Error linking LINE:`, updateError);
    await replyMessage(event.replyToken, {
      type: "text",
      text: "⚠️ ไม่สามารถเชื่อมโยงได้ กรุณาลองใหม่อีกครั้ง"
    }, credentials, logPrefix);
    return;
  }

  console.log(`${logPrefix} Successfully linked LINE User ID for participant: ${participant.participant_id}`);

  await replyMessage(event.replyToken, {
    type: "text",
    text: `✅ เชื่อมโยงสำเร็จ!\n\n` +
          `ชื่อ: ${participant.full_name}\n` +
          `สถานะ: ${getStatusLabel(participant.status)}\n\n` +
          `ตอนนี้คุณสามารถใช้งานผ่าน LINE ได้แล้ว 🎉`
  }, credentials, logPrefix);
}

async function searchAndShowBusinessCard(
  event: LineEvent,
  searchTerm: string,
  supabase: any,
  credentials: TenantCredentials,
  logPrefix: string
) {
  console.log(`${logPrefix} Searching participants with term: "${searchTerm}"`);

  // Search by first_name or nickname (case-insensitive)
  const { data: participants, error } = await supabase
    .from("participants")
    .select(`
      participant_id,
      first_name,
      last_name,
      nickname,
      full_name,
      email,
      phone,
      position,
      company,
      website_url,
      avatar_url,
      status,
      tenants!inner (
        tenant_name,
        logo_url
      )
    `)
    .eq("tenant_id", credentials.tenantId)
    .or(`first_name.ilike.%${searchTerm}%,nickname.ilike.%${searchTerm}%`)
    .order("status", { ascending: true })
    .order("first_name", { ascending: true })
    .limit(10);

  if (error) {
    console.error(`${logPrefix} Search error:`, error);
    await replyMessage(event.replyToken, {
      type: "text",
      text: "⚠️ เกิดข้อผิดพลาดในการค้นหา กรุณาลองใหม่อีกครั้ง"
    }, credentials, logPrefix);
    return;
  }

  if (!participants || participants.length === 0) {
    await replyMessage(event.replyToken, {
      type: "text",
      text: `❌ ไม่พบข้อมูลที่ตรงกับ "${searchTerm}"\n\nลองค้นหาด้วยชื่ออื่น หรือพิมพ์ "เมนู" เพื่อดูคำสั่งทั้งหมด`
    }, credentials, logPrefix);
    return;
  }

  console.log(`${logPrefix} Found ${participants.length} participant(s)`);

  // Generate profile edit URLs for all (in parallel)
  const baseUrl = `https://${Deno.env.get("REPLIT_DEV_DOMAIN") || "your-app.replit.dev"}`;
  const urlPromises = participants.map(async (p) => {
    try {
      const tokenResponse = await fetch(`${baseUrl}/api/participants/generate-profile-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          participant_id: p.participant_id,
          tenant_id: credentials.tenantId
        })
      });
      
      if (tokenResponse.ok) {
        const tokenData = await tokenResponse.json();
        return tokenData.profile_url;
      }
    } catch (err) {
      console.error(`${logPrefix} Error generating token for ${p.participant_id}:`, err);
    }
    return "#";
  });

  const editUrls = await Promise.all(urlPromises);

  if (participants.length === 1) {
    // Single result - show immediately
    const businessCard = createBusinessCardFlexMessage(participants[0], editUrls[0]);
    await replyMessage(event.replyToken, businessCard, credentials, logPrefix);
  } else {
    // Multiple results - show as carousel
    const carouselMessage = createBusinessCardCarousel(participants, editUrls, searchTerm);
    await replyMessage(event.replyToken, carouselMessage, credentials, logPrefix);
  }
}

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    "prospect": "ผู้สนใจ",
    "visitor": "ผู้เยี่ยมชม",
    "member": "สมาชิก",
    "alumni": "ศิษย์เก่า",
    "declined": "ถูกปฏิเสธ"
  };
  return labels[status] || status;
}

function getStatusBadge(status: string): { emoji: string; color: string } {
  const badges: Record<string, { emoji: string; color: string }> = {
    "prospect": { emoji: "🔵", color: "#3b82f6" },
    "visitor": { emoji: "🟡", color: "#eab308" },
    "member": { emoji: "🟢", color: "#22c55e" },
    "alumni": { emoji: "⚫", color: "#6b7280" },
    "declined": { emoji: "🔴", color: "#ef4444" }
  };
  return badges[status] || { emoji: "⚪", color: "#9ca3af" };
}

function createBusinessCardFlexMessage(participant: any, editProfileUrl: string) {
  const tenantName = participant.tenants?.tenant_name || "Meetdup";
  const tenantLogo = participant.tenants?.logo_url;
  const statusBadge = getStatusBadge(participant.status);
  const statusLabel = getStatusLabel(participant.status);
  
  return {
    type: "flex",
    altText: `${participant.full_name || "Your"} - Business Card`,
    contents: {
      type: "bubble",
      size: "kilo",
      header: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "box",
            layout: "horizontal",
            contents: [
              ...(tenantLogo ? [{
                type: "image",
                url: tenantLogo,
                size: "xxs",
                aspectMode: "cover",
                aspectRatio: "1:1",
                gravity: "center",
                flex: 0
              }] : []),
              {
                type: "text",
                text: tenantName,
                weight: "bold",
                size: "sm",
                color: "#ffffff",
                margin: tenantLogo ? "md" : "none",
                flex: 1
              },
              {
                type: "box",
                layout: "baseline",
                contents: [
                  {
                    type: "text",
                    text: statusBadge.emoji,
                    size: "sm",
                    flex: 0
                  },
                  {
                    type: "text",
                    text: statusLabel,
                    size: "xxs",
                    color: "#ffffff",
                    margin: "xs",
                    flex: 0
                  }
                ],
                flex: 0
              }
            ],
            spacing: "sm"
          }
        ],
        backgroundColor: "#2563eb",
        paddingAll: "13px"
      },
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          // Avatar
          ...(participant.avatar_url ? [{
            type: "image",
            url: participant.avatar_url,
            size: "xl",
            aspectMode: "cover",
            aspectRatio: "1:1",
            gravity: "center",
            margin: "md"
          }] : []),
          
          // Name
          {
            type: "text",
            text: participant.full_name || "No Name",
            weight: "bold",
            size: "xl",
            align: "center",
            margin: "lg"
          },
          
          // Position & Company
          ...(participant.position || participant.company ? [{
            type: "box",
            layout: "vertical",
            contents: [
              ...(participant.position ? [{
                type: "text",
                text: participant.position,
                size: "sm",
                color: "#555555",
                align: "center"
              }] : []),
              ...(participant.company ? [{
                type: "text",
                text: participant.company,
                size: "xs",
                color: "#888888",
                align: "center",
                margin: "xs"
              }] : [])
            ],
            margin: "md"
          }] : []),
          
          // Separator
          {
            type: "separator",
            margin: "lg"
          },
          
          // Contact Info
          {
            type: "box",
            layout: "vertical",
            contents: [
              // Phone
              ...(participant.phone ? [{
                type: "box",
                layout: "horizontal",
                contents: [
                  {
                    type: "text",
                    text: "📞",
                    size: "sm",
                    flex: 0
                  },
                  {
                    type: "text",
                    text: participant.phone,
                    size: "sm",
                    color: "#555555",
                    margin: "md",
                    flex: 1
                  }
                ],
                margin: "md"
              }] : []),
              
              // Email
              ...(participant.email ? [{
                type: "box",
                layout: "horizontal",
                contents: [
                  {
                    type: "text",
                    text: "✉️",
                    size: "sm",
                    flex: 0
                  },
                  {
                    type: "text",
                    text: participant.email,
                    size: "sm",
                    color: "#555555",
                    margin: "md",
                    flex: 1,
                    wrap: true
                  }
                ],
                margin: "md"
              }] : []),
              
              // Website
              ...(participant.website_url ? [{
                type: "box",
                layout: "horizontal",
                contents: [
                  {
                    type: "text",
                    text: "🌐",
                    size: "sm",
                    flex: 0
                  },
                  {
                    type: "text",
                    text: participant.website_url.replace(/^https?:\/\//, ''),
                    size: "sm",
                    color: "#555555",
                    margin: "md",
                    flex: 1,
                    wrap: true
                  }
                ],
                margin: "md"
              }] : [])
            ]
          }
        ],
        spacing: "none",
        paddingAll: "20px"
      },
      footer: {
        type: "box",
        layout: "vertical",
        contents: [
          // Primary Actions Row
          {
            type: "box",
            layout: "horizontal",
            contents: [
              {
                type: "button",
                action: {
                  type: "uri",
                  label: "บันทึกผู้ติดต่อ",
                  uri: `${editProfileUrl.split('?')[0].replace('/participant-profile/edit', '/api/participants/profile/vcard')}?token=${editProfileUrl.split('token=')[1] || ''}`
                },
                style: "primary",
                height: "sm",
                flex: 1
              },
              {
                type: "button",
                action: {
                  type: "uri",
                  label: "แก้ไขข้อมูล",
                  uri: editProfileUrl
                },
                style: "secondary",
                height: "sm",
                flex: 1
              }
            ],
            spacing: "sm"
          },
          
          // Secondary Actions Row
          {
            type: "box",
            layout: "horizontal",
            contents: [
              ...(participant.phone ? [{
                type: "button",
                action: {
                  type: "uri",
                  label: "โทร",
                  uri: `tel:${participant.phone}`
                },
                style: "link",
                height: "sm",
                flex: 1
              }] : []),
              ...(participant.email ? [{
                type: "button",
                action: {
                  type: "uri",
                  label: "Email",
                  uri: `mailto:${participant.email}`
                },
                style: "link",
                height: "sm",
                flex: 1
              }] : []),
              ...(participant.website_url ? [{
                type: "button",
                action: {
                  type: "uri",
                  label: "เว็บไซต์",
                  uri: participant.website_url
                },
                style: "link",
                height: "sm",
                flex: 1
              }] : [])
            ],
            spacing: "sm",
            margin: "sm"
          }
        ],
        spacing: "sm",
        paddingAll: "13px"
      }
    }
  };
}

function createBusinessCardCarousel(participants: any[], editUrls: string[], searchTerm: string) {
  // Create carousel bubbles (max 10 as per LINE limit)
  const bubbles = participants.slice(0, 10).map((participant, index) => {
    const card = createBusinessCardFlexMessage(participant, editUrls[index]);
    return card.contents;
  });

  return {
    type: "flex",
    altText: `พบ ${participants.length} ท่านที่ตรงกับ "${searchTerm}"`,
    contents: {
      type: "carousel",
      contents: bubbles
    }
  };
}

async function handleFollow(event: LineEvent, supabase: any, credentials: TenantCredentials, logPrefix: string) {
  console.log(`${logPrefix} User followed bot: ${event.source.userId}`);
  await sendGreeting(event, credentials, logPrefix);
}

async function handleUnfollow(event: LineEvent, supabase: any, credentials: TenantCredentials, logPrefix: string) {
  console.log(`${logPrefix} User unfollowed bot: ${event.source.userId}`);
}

async function handleGroupJoin(event: LineEvent, supabase: any, credentials: TenantCredentials, logPrefix: string) {
  console.log(`${logPrefix} Bot joined group: ${event.source.groupId}`);
  
  await replyMessage(event.replyToken, {
    type: "text",
    text: "สวัสดีครับ! ผมคือ Meetdup Assistant Bot 🤖\n\nพิมพ์ 'เมนู' เพื่อดูคำสั่งที่ใช้ได้"
  }, credentials, logPrefix);
}

async function handleGroupLeave(event: LineEvent, supabase: any, credentials: TenantCredentials, logPrefix: string) {
  console.log(`${logPrefix} Bot left group: ${event.source.groupId}`);
}

async function handleCheckIn(event: LineEvent, supabase: any, credentials: TenantCredentials, logPrefix: string) {
  await replyMessage(event.replyToken, {
    type: "text",
    text: "⏳ ระบบเช็คอินกำลังอยู่ระหว่างการพัฒนา\n\nกรุณาใช้ QR Code สำหรับเช็คอินในตอนนี้"
  }, credentials, logPrefix);
}

async function sendGreeting(event: LineEvent, credentials: TenantCredentials, logPrefix: string) {
  const message = {
    type: "text",
    text: "สวัสดีครับ! ยินดีต้อนรับสู่ Meetdup 🎉\n\nกดปุ่มด้านล่างเพื่อเริ่มต้นใช้งาน"
  };
  
  const quickReply = getDefaultHelpQuickReply();
  await replyMessage(event.replyToken, message, credentials, logPrefix, quickReply);
}

async function sendHelp(event: LineEvent, credentials: TenantCredentials, logPrefix: string) {
  const message = {
    type: "text",
    text: "📋 คำสั่งที่ใช้ได้:\n\n" +
          "💼 นามบัตร\n" +
          "• พิมพ์: นามบัตร - แสดงนามบัตรของคุณ\n" +
          "• พิมพ์: card กบ - ค้นหานามบัตรของ 'กบ'\n\n" +
          "🔗 เชื่อมต่อ LINE\n" +
          "• พิมพ์: ลงทะเบียน - เชื่อมโยงเบอร์โทรกับ LINE\n\n" +
          "ℹ️ อื่นๆ\n" +
          "• พิมพ์: สวัสดี - ทักทาย\n" +
          "• พิมพ์: เมนู - แสดงคำสั่งนี้\n\n" +
          "💡 ติดต่อสอบถาม: support@meetdup.com"
  };
  
  const quickReply = getDefaultHelpQuickReply();
  await replyMessage(event.replyToken, message, credentials, logPrefix, quickReply);
}

// DEPRECATED: LIFF-based registration (commented out - using message-based flow instead)
// Kept for reference in case LIFF is needed in future
/*
async function sendLiffRegistration(event: LineEvent, credentials: TenantCredentials, logPrefix: string) {
  console.log(`${logPrefix} Sending LIFF registration link`);

  // @ts-ignore Deno runtime
  const appUrl = Deno.env.get("APP_URL") || "https://meetdup.replit.app";
  const liffId = Deno.env.get("LIFF_ID") || "";

  if (!liffId) {
    console.error(`${logPrefix} LIFF ID not configured`);
    await replyMessage(event.replyToken, {
      type: "text",
      text: "⚠️ ระบบลงทะเบียนยังไม่พร้อมใช้งาน\nกรุณาติดต่อผู้ดูแลระบบ"
    }, credentials, logPrefix);
    return;
  }

  // Get tenant_id from credentials
  const tenantId = credentials.tenantId;
  if (!tenantId) {
    console.error(`${logPrefix} Tenant ID not found in credentials`);
    await replyMessage(event.replyToken, {
      type: "text",
      text: "⚠️ ไม่พบข้อมูล Chapter\nกรุณาติดต่อผู้ดูแลระบบ"
    }, credentials, logPrefix);
    return;
  }

  // Construct LIFF URL with tenant_id parameter
  const liffUrl = `https://liff.line.me/${liffId}?tenant_id=${encodeURIComponent(tenantId)}`;
  console.log(`${logPrefix} Generated LIFF URL with tenant: ${tenantId}`);

  // Send Flex Message with registration link
  const flexMessage = {
    type: "flex",
    altText: "ลงทะเบียนผ่าน LINE",
    contents: {
      type: "bubble",
      hero: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "text",
            text: "📝 ลงทะเบียน",
            size: "xxl",
            weight: "bold",
            color: "#ffffff",
            align: "center"
          },
          {
            type: "text",
            text: "เชื่อมโยง LINE account ของคุณ",
            size: "sm",
            color: "#ffffff",
            align: "center",
            margin: "md"
          }
        ],
        paddingAll: "20px",
        backgroundColor: "#06C755",
        spacing: "md"
      },
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "text",
            text: "กดปุ่มด้านล่างเพื่อ:",
            size: "sm",
            color: "#666666",
            margin: "md"
          },
          {
            type: "box",
            layout: "vertical",
            margin: "lg",
            spacing: "sm",
            contents: [
              {
                type: "box",
                layout: "baseline",
                spacing: "sm",
                contents: [
                  {
                    type: "icon",
                    url: "https://scdn.line-apps.com/n/channel_devcenter/img/fx/review_gold_star_28.png",
                    size: "sm"
                  },
                  {
                    type: "text",
                    text: "ลงทะเบียนสมาชิกใหม่",
                    size: "sm",
                    color: "#666666",
                    flex: 0
                  }
                ]
              },
              {
                type: "box",
                layout: "baseline",
                spacing: "sm",
                contents: [
                  {
                    type: "icon",
                    url: "https://scdn.line-apps.com/n/channel_devcenter/img/fx/review_gold_star_28.png",
                    size: "sm"
                  },
                  {
                    type: "text",
                    text: "เชื่อมโยง LINE กับข้อมูลเดิม",
                    size: "sm",
                    color: "#666666",
                    flex: 0
                  }
                ]
              },
              {
                type: "box",
                layout: "baseline",
                spacing: "sm",
                contents: [
                  {
                    type: "icon",
                    url: "https://scdn.line-apps.com/n/channel_devcenter/img/fx/review_gold_star_28.png",
                    size: "sm"
                  },
                  {
                    type: "text",
                    text: "รับการแจ้งเตือนผ่าน LINE",
                    size: "sm",
                    color: "#666666",
                    flex: 0
                  }
                ]
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
              label: "เปิดแบบฟอร์มลงทะเบียน",
              uri: liffUrl
            },
            color: "#06C755"
          },
          {
            type: "box",
            layout: "baseline",
            contents: [
              {
                type: "icon",
                url: "https://scdn.line-apps.com/n/channel_devcenter/img/fx/review_gold_star_28.png",
                size: "xxs"
              },
              {
                type: "text",
                text: "ใช้เบอร์โทรศัพท์ในการลงทะเบียน",
                color: "#999999",
                size: "xxs",
                flex: 0
              }
            ],
            margin: "md"
          }
        ],
        flex: 0
      }
    }
  };

  await replyMessage(event.replyToken, flexMessage, credentials, logPrefix);
}
*/

// Quick Reply factory functions
function quickReplyMessageAction(label: string, text: string): QuickReplyItem {
  return {
    type: "action",
    action: {
      type: "message",
      label,
      text
    }
  };
}

function quickReplyPostback(label: string, data: string, displayText?: string): QuickReplyItem {
  const item: QuickReplyItem = {
    type: "action",
    action: {
      type: "postback",
      label,
      data
    }
  };
  if (displayText) {
    item.action.displayText = displayText;
  }
  return item;
}

function quickReplyUri(label: string, uri: string): QuickReplyItem {
  return {
    type: "action",
    action: {
      type: "uri",
      label,
      uri
    }
  };
}

function quickReplyLocation(label: string): QuickReplyItem {
  return {
    type: "action",
    action: {
      type: "location",
      label
    }
  };
}

function createQuickReply(items: QuickReplyItem[]): QuickReplyPayload | null {
  if (items.length === 0) {
    return null;
  }
  
  if (items.length > 13) {
    console.warn(`Quick Reply limited to 13 items, got ${items.length}. Truncating.`);
    items = items.slice(0, 13);
  }
  
  return { items };
}

// Hardcoded Quick Reply templates
function getDefaultHelpQuickReply(): QuickReplyPayload | null {
  return createQuickReply([
    quickReplyPostback("เช็คอิน", "action=checkin", "เช็คอิน"),
    quickReplyPostback("ข้อมูลการประชุม", "action=meeting_info", "ข้อมูลการประชุม"),
    quickReplyPostback("ชำระเงิน", "action=payment", "ชำระเงิน"),
    quickReplyPostback("ข้อมูลส่วนตัว", "action=profile", "ข้อมูลส่วนตัว")
  ]);
}

function getCheckInQuickReply(meetingId?: string): QuickReplyPayload | null {
  const items: QuickReplyItem[] = [];
  
  if (meetingId) {
    items.push(quickReplyPostback("เช็คอินเลย", `action=checkin&meeting_id=${meetingId}`, "เช็คอิน"));
  }
  
  items.push(
    quickReplyPostback("ดูข้อมูลการประชุม", "action=meeting_info", "ดูข้อมูลการประชุม"),
    quickReplyMessageAction("ยกเลิก", "ยกเลิก")
  );
  
  return createQuickReply(items);
}

async function replyMessage(
  replyToken: string, 
  message: any, 
  credentials: TenantCredentials,
  logPrefix: string,
  quickReply?: QuickReplyPayload | null
) {
  try {
    // Attach Quick Reply if provided
    if (quickReply && quickReply.items.length > 0) {
      message.quickReply = quickReply;
    }
    
    const response = await fetch("https://api.line.me/v2/bot/message/reply", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${credentials.accessToken}`
      },
      body: JSON.stringify({
        replyToken,
        messages: [message]
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`${logPrefix} LINE API error:`, error);
    } else {
      console.log(`${logPrefix} Message sent successfully`);
    }
  } catch (error) {
    console.error(`${logPrefix} Failed to send message:`, error);
  }
}

async function pushMessage(
  to: string, 
  messages: any[], 
  credentials: TenantCredentials,
  logPrefix: string,
  quickReply?: QuickReplyPayload | null
) {
  try {
    // Attach Quick Reply to first message if provided
    if (quickReply && quickReply.items.length > 0 && messages.length > 0) {
      messages[0].quickReply = quickReply;
    }
    
    const response = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${credentials.accessToken}`
      },
      body: JSON.stringify({
        to,
        messages
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`${logPrefix} LINE API push error:`, error);
    } else {
      console.log(`${logPrefix} Push message sent successfully`);
    }
  } catch (error) {
    console.error(`${logPrefix} Failed to push message:`, error);
  }
}
