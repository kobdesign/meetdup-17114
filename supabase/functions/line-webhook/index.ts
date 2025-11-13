import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";
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

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
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
      console.error(`${logPrefix} Missing LINE signature`);
      return new Response(
        JSON.stringify({ error: "Missing signature" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let payload;
    try {
      payload = JSON.parse(body);
    } catch (e) {
      console.error(`${logPrefix} Invalid JSON body`);
      return new Response(
        JSON.stringify({ error: "Invalid JSON" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const destination = payload.destination;
    const events: LineEvent[] = payload.events || [];

    if (isInternalTest) {
      console.log(`${logPrefix} Internal test mode - bypassing signature validation`);
      console.log(`${logPrefix} Received ${events.length} test events`);
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
      console.error(`${logPrefix} Missing destination field`);
      return new Response(
        JSON.stringify({ error: "Missing destination" }),
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
    text: "สวัสดีครับ! ผมคือ BNI Assistant Bot 🤖\n\nพิมพ์ 'เมนู' เพื่อดูคำสั่งที่ใช้ได้"
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
    text: "สวัสดีครับ! ยินดีต้อนรับสู่ BNI Meetdup 🎉\n\nพิมพ์ 'เมนู' เพื่อดูคำสั่งที่ใช้ได้"
  };
  
  await replyMessage(event.replyToken, message, credentials, logPrefix);
}

async function sendHelp(event: LineEvent, credentials: TenantCredentials, logPrefix: string) {
  const message = {
    type: "text",
    text: "📋 คำสั่งที่ใช้ได้:\n\n" +
          "• สวัสดี - ทักทาย\n" +
          "• เมนู - แสดงคำสั่งนี้\n" +
          "• เช็คอิน - เช็คอินเข้าร่วมงาน (เร็วๆ นี้)\n\n" +
          "💡 ติดต่อสอบถาม: support@meetdup.com"
  };
  
  await replyMessage(event.replyToken, message, credentials, logPrefix);
}

async function replyMessage(
  replyToken: string, 
  message: any, 
  credentials: TenantCredentials,
  logPrefix: string
) {
  try {
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
  logPrefix: string
) {
  try {
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
            text: participant.chapter_name || "BNI",
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
            text: "Powered by BNI Meetdup",
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
