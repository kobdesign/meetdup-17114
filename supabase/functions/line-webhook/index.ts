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
  line_channel_id?: string;
  liff_id_checkin?: string;
  liff_id_share?: string;
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
      .select('line_channel_secret, line_access_token, line_channel_id, liff_id_checkin, liff_id_share')
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
      line_channel_id: secrets?.line_channel_id,
      liff_id_checkin: secrets?.liff_id_checkin,
      liff_id_share: secrets?.liff_id_share,
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
 * Search participant by keyword (full_name or nickname)
 */
async function searchParticipant(
  supabase: any,
  tenantId: string,
  keyword: string
): Promise<any | null> {
  const searchPattern = `%${keyword}%`;
  
  const { data, error } = await supabase
    .from('participants')
    .select('*')
    .eq('tenant_id', tenantId)
    .or(`full_name.ilike.${searchPattern},nickname.ilike.${searchPattern}`)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Error searching participant:', error);
    return null;
  }

  return data;
}

/**
 * Get payment status for participant
 */
async function getPaymentStatus(
  supabase: any,
  participantId: string,
  tenantId: string
): Promise<string> {
  const { data } = await supabase
    .from('payments')
    .select('status')
    .eq('participant_id', participantId)
    .eq('tenant_id', tenantId)
    .eq('status', 'completed')
    .limit(1)
    .maybeSingle();

  return data ? '✅ Paid' : '❌ Pending';
}

/**
 * Get inviter name
 */
async function getInviterName(
  supabase: any,
  invitedBy: string | null
): Promise<string> {
  if (!invitedBy) return 'N/A';

  const { data } = await supabase
    .from('participants')
    .select('full_name, nickname')
    .eq('participant_id', invitedBy)
    .maybeSingle();

  if (!data) return 'N/A';
  return data.nickname || data.full_name || 'N/A';
}

/**
 * Build LINE Flex Message for business card
 */
async function buildBusinessCardFlex(
  supabase: any,
  participant: any,
  tenantSecrets: TenantSecrets,
  host: string
): Promise<any> {
  const isVisitor = participant.status === 'visitor' || participant.status === 'prospect';
  
  // Get payment status for visitors
  let paymentStatus = '';
  let inviterName = '';
  if (isVisitor) {
    paymentStatus = await getPaymentStatus(supabase, participant.participant_id, participant.tenant_id);
    inviterName = await getInviterName(supabase, participant.invited_by);
  }

  const avatarUrl = `https://cdn.lovableproject.com/avatars/${participant.participant_id}.jpg`;
  const fallbackAvatar = 'https://via.placeholder.com/400x300?text=No+Photo';

  // Build body contents
  const bodyContents: any[] = [
    {
      type: 'text',
      text: participant.full_name,
      weight: 'bold',
      size: 'xl',
      margin: 'md'
    }
  ];

  if (participant.nickname) {
    bodyContents.push({
      type: 'text',
      text: `(${participant.nickname})`,
      size: 'sm',
      color: '#999999',
      margin: 'sm'
    });
  }

  if (participant.company) {
    bodyContents.push({
      type: 'text',
      text: participant.company,
      size: 'md',
      color: '#555555',
      margin: 'md'
    });
  }

  if (participant.business_type) {
    bodyContents.push({
      type: 'text',
      text: `🏢 ${participant.business_type}`,
      size: 'sm',
      color: '#999999',
      margin: 'sm'
    });
  }

  // Add visitor-specific section
  if (isVisitor) {
    bodyContents.push({
      type: 'separator',
      margin: 'xl'
    });

    if (participant.goal) {
      bodyContents.push({
        type: 'box',
        layout: 'baseline',
        margin: 'md',
        contents: [
          {
            type: 'text',
            text: 'เป้าหมาย:',
            size: 'sm',
            color: '#999999',
            flex: 0
          },
          {
            type: 'text',
            text: participant.goal,
            size: 'sm',
            color: '#555555',
            wrap: true,
            flex: 1,
            margin: 'sm'
          }
        ]
      });
    }

    bodyContents.push({
      type: 'box',
      layout: 'baseline',
      margin: 'sm',
      contents: [
        {
          type: 'text',
          text: 'ผู้แนะนำ:',
          size: 'sm',
          color: '#999999',
          flex: 0
        },
        {
          type: 'text',
          text: inviterName,
          size: 'sm',
          color: '#555555',
          flex: 1,
          margin: 'sm'
        }
      ]
    });

    bodyContents.push({
      type: 'box',
      layout: 'baseline',
      margin: 'sm',
      contents: [
        {
          type: 'text',
          text: 'สถานะ:',
          size: 'sm',
          color: '#999999',
          flex: 0
        },
        {
          type: 'text',
          text: paymentStatus,
          size: 'sm',
          color: paymentStatus.includes('✅') ? '#06c755' : '#ff334b',
          flex: 1,
          margin: 'sm'
        }
      ]
    });
  }

  // Build footer buttons
  const footerContents: any[] = [];

  // Call button
  if (participant.phone) {
    footerContents.push({
      type: 'button',
      style: 'primary',
      color: '#06c755',
      action: {
        type: 'uri',
        label: '📞 โทร',
        uri: `tel:${participant.phone}`
      }
    });
  }

  // Message OA button
  if (tenantSecrets.line_channel_id) {
    const oaId = tenantSecrets.line_channel_id.replace('@', '');
    const nickname = participant.nickname || participant.full_name;
    footerContents.push({
      type: 'button',
      style: 'primary',
      action: {
        type: 'uri',
        label: '💬 ส่งข้อความ',
        uri: `line://oaMessage/${oaId}/?text=Hi%20${encodeURIComponent(nickname)}%21`
      }
    });
  }

  // Share Card button
  const shareUrl = tenantSecrets.liff_id_share
    ? `line://app/${tenantSecrets.liff_id_share}?pid=${participant.participant_id}`
    : `https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(`${host}/profile/${tenantSecrets.tenant_slug}/${participant.participant_id}`)}`;
  
  footerContents.push({
    type: 'button',
    style: 'link',
    action: {
      type: 'uri',
      label: '🔗 แชร์นามบัตร',
      uri: shareUrl
    }
  });

  // Check-in button
  footerContents.push({
    type: 'button',
    style: 'link',
    action: {
      type: 'uri',
      label: '✅ Check-in',
      uri: `${host}/checkin?tenant=${tenantSecrets.tenant_slug}&pid=${participant.participant_id}`
    }
  });

  return {
    type: 'bubble',
    size: 'mega',
    hero: {
      type: 'image',
      url: avatarUrl,
      size: 'full',
      aspectRatio: '20:13',
      aspectMode: 'cover',
      action: {
        type: 'uri',
        uri: avatarUrl
      }
    },
    body: {
      type: 'box',
      layout: 'vertical',
      contents: bodyContents
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      spacing: 'sm',
      contents: footerContents
    }
  };
}

/**
 * Handle "card" command - search and send business card
 */
async function sendBusinessCardFlex(
  supabase: any,
  keyword: string,
  tenantSecrets: TenantSecrets,
  host: string
): Promise<any[]> {
  // Search participant
  const participant = await searchParticipant(
    supabase,
    tenantSecrets.tenant_id,
    keyword
  );

  if (!participant) {
    return [{
      type: 'text',
      text: `❌ ไม่พบรายชื่อที่ค้นหา "${keyword}"\n\nลองค้นหาด้วยชื่อหรือชื่อเล่น`
    }];
  }

  // Build Flex Message
  const flexMessage = await buildBusinessCardFlex(
    supabase,
    participant,
    tenantSecrets,
    host
  );

  return [{
    type: 'flex',
    altText: `นามบัตร: ${participant.full_name}`,
    contents: flexMessage
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
          const host = new URL(req.url).origin;
          replyMessages = await sendBusinessCardFlex(
            supabase,
            keyword,
            tenantSecrets,
            host
          );
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
