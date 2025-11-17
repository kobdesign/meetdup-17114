// @ts-ignore Deno imports
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
// @ts-ignore Deno imports
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";
// @ts-ignore Deno imports
import { createHmac } from "https://deno.land/std@0.190.0/node/crypto.ts";

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
  
  const { data, error } = await supabase
    .from("tenant_secrets")
    .select("tenant_id, line_access_token, line_channel_secret, line_channel_id")
    .eq("line_channel_id", destination)
    .single();

  if (error || !data || !data.line_access_token || !data.line_channel_secret) {
    console.error(`${logPrefix} Tenant not found or credentials missing for destination: ${destination}`);
    return null;
  }

  const credentials: TenantCredentials = {
    tenantId: data.tenant_id,
    accessToken: data.line_access_token,
    channelSecret: data.line_channel_secret,
  };

  credentialsCache.set(destination, {
    credentials,
    expiresAt: Date.now() + CACHE_TTL,
  });

  return credentials;
}

serve(async (req) => {
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

    if (!signature && !isInternalTest) {
      console.error(`${logPrefix} Missing LINE signature - not an internal test`);
      console.error(`${logPrefix} Headers: ${JSON.stringify(Object.fromEntries(req.headers.entries()))}`);
      return new Response(
        JSON.stringify({ error: "Missing signature" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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

    // Handle LINE webhook verification request (empty events or no destination)
    if ((!events || events.length === 0) && !isInternalTest) {
      console.log(`${logPrefix} LINE verification request detected (empty events)`);
      return new Response(
        JSON.stringify({ success: true, message: "Webhook endpoint verified" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
  const text = event.message?.text?.toLowerCase().trim() || "";
  const userId = event.source.userId;
  const groupId = event.source.groupId;
  const isGroup = event.source.type === "group";

  console.log(`${logPrefix} Text: "${text}" from ${isGroup ? "group" : "user"}`);

  if (text.includes("สวัสดี") || text.includes("hello") || text.includes("hi")) {
    await sendGreeting(event, credentials, logPrefix);
  } else if (text.includes("help") || text.includes("ช่วยเหลือ") || text.includes("เมนู")) {
    await sendHelp(event, credentials, logPrefix);
  } else if (text.includes("เช็คอิน") || text.includes("checkin") || text.includes("check-in")) {
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

  // Fetch participant profile
  const { data: participant, error } = await supabase
    .from("participants")
    .select("*")
    .eq("tenant_id", credentials.tenantId)
    .eq("line_user_id", userId)
    .single();

  if (error || !participant) {
    await replyMessage(event.replyToken, {
      type: "text",
      text: "ไม่พบข้อมูลของคุณในระบบ\n\nกรุณาติดต่อผู้ดูแลระบบครับ"
    }, credentials, logPrefix);
    return;
  }

  const statusText = {
    'prospect': 'ผู้สนใจ',
    'visitor': 'ผู้เยี่ยมชม',
    'member': 'สมาชิก',
    'alumni': 'ศิษย์เก่า'
  }[participant.participant_status] || participant.participant_status;

  await replyMessage(event.replyToken, {
    type: "text",
    text: `👤 ข้อมูลส่วนตัว\n\n` +
          `ชื่อ: ${participant.first_name} ${participant.last_name}\n` +
          `สถานะ: ${statusText}\n` +
          `อีเมล: ${participant.email || '-'}\n` +
          `โทรศัพท์: ${participant.phone || '-'}`
  }, credentials, logPrefix);
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
          "กดปุ่มด้านล่างเพื่อเลือกคำสั่ง หรือพิมพ์:\n" +
          "• สวัสดี - ทักทาย\n" +
          "• เมนู - แสดงคำสั่งนี้\n\n" +
          "💡 ติดต่อสอบถาม: support@meetdup.com"
  };
  
  const quickReply = getDefaultHelpQuickReply();
  await replyMessage(event.replyToken, message, credentials, logPrefix, quickReply);
}

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

function createBusinessCardFlexMessage(participant: any): any {
  return {
    type: "flex",
    altText: `นามบัตร: ${participant.display_name}`,
    contents: {
      type: "bubble",
      size: "giga",
      header: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "text",
            text: "BUSINESS CARD",
            size: "xs",
            color: "#ffffff",
            weight: "bold"
          },
          {
            type: "text",
            text: participant.chapter_name || "Meetdup",
            size: "sm",
            color: "#ffffff",
            margin: "xs"
          }
        ],
        backgroundColor: "#1a73e8",
        paddingAll: "15px"
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
                type: "box",
                layout: "vertical",
                contents: [
                  {
                    type: "text",
                    text: participant.display_name || "ไม่ระบุชื่อ",
                    size: "xl",
                    weight: "bold",
                    wrap: true
                  },
                  {
                    type: "text",
                    text: participant.company || "",
                    size: "sm",
                    color: "#666666",
                    wrap: true,
                    margin: "xs"
                  },
                  {
                    type: "text",
                    text: participant.position || "",
                    size: "xs",
                    color: "#999999",
                    wrap: true,
                    margin: "xs"
                  }
                ],
                flex: 1
              }
            ],
            margin: "lg"
          },
          {
            type: "separator",
            margin: "lg"
          },
          {
            type: "box",
            layout: "vertical",
            contents: [
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
                    color: "#666666",
                    margin: "sm",
                    flex: 1,
                    wrap: true
                  }
                ],
                margin: "md"
              }] : []),
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
                    color: "#666666",
                    margin: "sm",
                    flex: 1,
                    wrap: true
                  }
                ],
                margin: "md"
              }] : []),
              ...(participant.line_id ? [{
                type: "box",
                layout: "horizontal",
                contents: [
                  {
                    type: "text",
                    text: "LINE",
                    size: "sm",
                    flex: 0,
                    color: "#06c755",
                    weight: "bold"
                  },
                  {
                    type: "text",
                    text: participant.line_id,
                    size: "sm",
                    color: "#666666",
                    margin: "sm",
                    flex: 1,
                    wrap: true
                  }
                ],
                margin: "md"
              }] : [])
            ],
            margin: "lg"
          }
        ]
      },
      footer: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "text",
            text: "Powered by Meetdup",
            size: "xxs",
            color: "#999999",
            align: "center"
          }
        ],
        paddingAll: "10px"
      }
    }
  };
}
