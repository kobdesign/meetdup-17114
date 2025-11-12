import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-line-signature',
};

// Rate limiting: Track requests per userId per minute
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 20; // 20 requests per minute per user
const RATE_LIMIT_WINDOW = 60000; // 1 minute

interface LineWebhookEvent {
  type: string;
  message?: {
    type: string;
    id: string;
    text?: string;
  };
  replyToken: string;
  source: {
    userId: string;
    type: string;
  };
  timestamp: number;
  mode: string;
}

interface TenantSecrets {
  tenant_id: string;
  tenant_slug: string;
  tenant_name: string;
  line_channel_secret?: string;
  line_access_token?: string;
  liff_id_checkin?: string;
  default_visitor_fee?: number;
}

/**
 * Verify LINE signature using Web Crypto API
 */
async function verifyLineSignature(
  body: string,
  signature: string,
  channelSecret: string
): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(channelSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signatureBuffer = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(body)
  );
  
  // Convert to base64
  const base64Signature = btoa(
    String.fromCharCode(...new Uint8Array(signatureBuffer))
  );
  
  return base64Signature === signature;
}

/**
 * Check rate limit for user
 */
function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const userLimit = rateLimitMap.get(userId);

  if (!userLimit || now > userLimit.resetAt) {
    // New window
    rateLimitMap.set(userId, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW
    });
    return true;
  }

  if (userLimit.count >= RATE_LIMIT_MAX) {
    return false; // Rate limit exceeded
  }

  userLimit.count++;
  return true;
}

/**
 * Log integration event to database
 */
async function logIntegrationEvent(
  supabase: any,
  tenantId: string,
  eventType: string,
  payload: any,
  metadata?: any
) {
  try {
    await supabase
      .from('integration_logs')
      .insert({
        tenant_id: tenantId,
        source: 'line',
        event_type: eventType,
        payload,
        metadata
      });
  } catch (error) {
    console.error('Failed to log integration event:', error);
  }
}

/**
 * Resolve tenant secrets and settings
 */
async function resolveTenantSecrets(
  tenantSlug: string,
  supabase: any
): Promise<TenantSecrets | null> {
  try {
    // Get tenant
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('tenant_id, slug, name')
      .eq('slug', tenantSlug)
      .eq('status', 'active')
      .single();

    if (tenantError || !tenant) {
      console.error('Tenant not found:', tenantSlug);
      return null;
    }

    // Get secrets
    const { data: secrets } = await supabase
      .from('tenant_secrets')
      .select('line_channel_secret, line_access_token, liff_id_checkin')
      .eq('tenant_id', tenant.tenant_id)
      .single();

    // Get settings
    const { data: settings } = await supabase
      .from('tenant_settings')
      .select('default_visitor_fee')
      .eq('tenant_id', tenant.tenant_id)
      .single();

    return {
      tenant_id: tenant.tenant_id,
      tenant_slug: tenant.slug,
      tenant_name: tenant.name,
      line_channel_secret: secrets?.line_channel_secret,
      line_access_token: secrets?.line_access_token,
      liff_id_checkin: secrets?.liff_id_checkin,
      default_visitor_fee: settings?.default_visitor_fee || 650
    };
  } catch (error) {
    console.error('Error resolving tenant secrets:', error);
    return null;
  }
}

/**
 * Send reply message to LINE user
 */
async function replyToLine(
  replyToken: string,
  messages: any[],
  accessToken: string
) {
  const response = await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    },
    body: JSON.stringify({
      replyToken,
      messages
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`LINE API error: ${error}`);
  }
}

/**
 * Handle "card" command - search business card
 */
function handleCardCommand(keyword: string, tenantName: string): any[] {
  return [{
    type: 'text',
    text: `🔍 กำลังค้นหานามบัตร "${keyword}" ใน ${tenantName}\n\n` +
          `ฟีเจอร์นี้จะเชื่อมต่อกับฐานข้อมูล participants เร็วๆ นี้\n\n` +
          `สามารถค้นหาได้ด้วย: ชื่อ, บริษัท, หรือ business_type`
  }];
}

/**
 * Handle "checkin" command - send check-in link
 */
function handleCheckinCommand(tenantSlug: string, liffId?: string): any[] {
  if (!liffId) {
    return [{
      type: 'text',
      text: '⚠️ ระบบ Check-in ยังไม่ได้ตั้งค่า LIFF ID\n\n' +
            'กรุณาติดต่อผู้ดูแลระบบเพื่อตั้งค่า LIFF Application'
    }];
  }

  const liffUrl = `https://liff.line.me/${liffId}?tenant=${tenantSlug}`;
  
  return [{
    type: 'text',
    text: `✅ Check-in สำหรับการประชุม\n\nกดลิงก์ด้านล่างเพื่อ check-in:\n${liffUrl}`,
    quickReply: {
      items: [{
        type: 'action',
        action: {
          type: 'uri',
          label: '📱 เปิด Check-in',
          uri: liffUrl
        }
      }]
    }
  }];
}

/**
 * Handle "pay" command - send payment info
 */
function handlePayCommand(tenantSlug: string, visitorFee: number, currency: string = 'THB'): any[] {
  const paymentUrl = `${Deno.env.get('SUPABASE_URL')?.replace('supabase.co', 'lovableproject.com')}/payment/${tenantSlug}`;
  
  return [{
    type: 'text',
    text: `💰 ชำระค่าผู้เยี่ยมชม\n\n` +
          `ค่าเข้าร่วม: ${visitorFee} ${currency}\n\n` +
          `กดลิงก์ด้านล่างเพื่อชำระเงิน:`,
    quickReply: {
      items: [{
        type: 'action',
        action: {
          type: 'uri',
          label: '💳 ชำระเงิน',
          uri: paymentUrl
        }
      }]
    }
  }];
}

/**
 * Handle help/unknown command
 */
function handleHelpCommand(tenantName: string): any[] {
  return [{
    type: 'text',
    text: `👋 สวัสดีค่ะ! ${tenantName}\n\n` +
          `คำสั่งที่ใช้ได้:\n\n` +
          `📇 card <ชื่อ> - ค้นหานามบัตร\n` +
          `✅ checkin - เปิด check-in\n` +
          `💰 pay - ชำระค่าผู้เยี่ยมชม\n\n` +
          `ตัวอย่าง: card john`
  }];
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Extract tenant_slug from path: /line-webhook/{tenant_slug}
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    const tenantSlug = pathParts[pathParts.length - 1];

    console.log(`LINE webhook received for tenant: ${tenantSlug}`);

    if (!tenantSlug || tenantSlug === 'line-webhook') {
      return new Response(
        JSON.stringify({ error: 'Tenant slug is required in path' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Resolve tenant secrets
    const tenantSecrets = await resolveTenantSecrets(tenantSlug, supabase);
    
    if (!tenantSecrets) {
      return new Response(
        JSON.stringify({ error: 'Tenant not found or inactive' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!tenantSecrets.line_channel_secret || !tenantSecrets.line_access_token) {
      console.error('LINE credentials not configured for tenant:', tenantSlug);
      return new Response(
        JSON.stringify({ error: 'LINE integration not configured' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get request body as text for signature verification
    const bodyText = await req.text();
    const signature = req.headers.get('X-Line-Signature');

    if (!signature) {
      await logIntegrationEvent(
        supabase,
        tenantSecrets.tenant_id,
        'webhook_error',
        null,
        { error: 'Missing X-Line-Signature header' }
      );
      return new Response(
        JSON.stringify({ error: 'Missing signature' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify LINE signature
    const isValid = await verifyLineSignature(
      bodyText,
      signature,
      tenantSecrets.line_channel_secret
    );

    if (!isValid) {
      await logIntegrationEvent(
        supabase,
        tenantSecrets.tenant_id,
        'webhook_error',
        null,
        { error: 'Invalid signature' }
      );
      return new Response(
        JSON.stringify({ error: 'Invalid signature' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse webhook body
    const body = JSON.parse(bodyText);
    const events: LineWebhookEvent[] = body.events || [];

    console.log(`Processing ${events.length} LINE events`);

    // Process each event
    for (const event of events) {
      const userId = event.source.userId;

      // Log webhook event
      await logIntegrationEvent(
        supabase,
        tenantSecrets.tenant_id,
        event.type,
        event,
        { user_id: userId }
      );

      // Check rate limit
      if (!checkRateLimit(userId)) {
        console.warn(`Rate limit exceeded for user: ${userId}`);
        await replyToLine(
          event.replyToken,
          [{
            type: 'text',
            text: '⚠️ คุณส่งข้อความมากเกินไป กรุณารอสักครู่แล้วลองใหม่'
          }],
          tenantSecrets.line_access_token
        );
        continue;
      }

      // Handle message events
      if (event.type === 'message' && event.message?.type === 'text') {
        const messageText = event.message.text?.trim().toLowerCase() || '';
        console.log(`Message received: "${messageText}"`);

        let replyMessages: any[] = [];

        // Command: card <keyword>
        if (messageText.startsWith('card ')) {
          const keyword = messageText.substring(5).trim();
          replyMessages = handleCardCommand(keyword, tenantSecrets.tenant_name);
        }
        // Command: checkin
        else if (messageText === 'checkin') {
          replyMessages = handleCheckinCommand(
            tenantSecrets.tenant_slug,
            tenantSecrets.liff_id_checkin
          );
        }
        // Command: pay
        else if (messageText === 'pay') {
          replyMessages = handlePayCommand(
            tenantSecrets.tenant_slug,
            tenantSecrets.default_visitor_fee || 650
          );
        }
        // Default: help
        else {
          replyMessages = handleHelpCommand(tenantSecrets.tenant_name);
        }

        // Send reply
        await replyToLine(
          event.replyToken,
          replyMessages,
          tenantSecrets.line_access_token
        );

        await logIntegrationEvent(
          supabase,
          tenantSecrets.tenant_id,
          'message_replied',
          { message: messageText, reply: replyMessages },
          { user_id: userId }
        );
      }
      // Handle follow event (user adds bot as friend)
      else if (event.type === 'follow') {
        await replyToLine(
          event.replyToken,
          [{
            type: 'text',
            text: `🎉 ยินดีต้อนรับสู่ ${tenantSecrets.tenant_name}!\n\n` +
                  `พิมพ์ "help" เพื่อดูคำสั่งที่ใช้ได้`
          }],
          tenantSecrets.line_access_token
        );
      }
      // Handle unfollow event
      else if (event.type === 'unfollow') {
        console.log(`User ${userId} unfollowed the bot`);
        // No reply needed for unfollow
      }
    }

    return new Response(
      JSON.stringify({ success: true, processed: events.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in LINE webhook:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
