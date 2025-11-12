import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Rate limiting per user
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW = 60000; // 1 minute

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const userLimit = rateLimitMap.get(userId);

  if (!userLimit || now > userLimit.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return true;
  }

  if (userLimit.count >= RATE_LIMIT_MAX) {
    return false;
  }

  userLimit.count++;
  return true;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const url = new URL(req.url);
    const tenantSlug = url.searchParams.get('tenant_slug');
    const participantId = url.searchParams.get('participant_id');
    const userId = url.searchParams.get('user_id') || 'anonymous';

    if (!tenantSlug || !participantId) {
      return new Response(
        JSON.stringify({ error: 'tenant_slug and participant_id are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check rate limit
    if (!checkRateLimit(userId)) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get tenant
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('tenant_id, slug, name')
      .eq('slug', tenantSlug)
      .eq('status', 'active')
      .single();

    if (tenantError || !tenant) {
      return new Response(
        JSON.stringify({ error: 'Tenant not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get participant and validate it belongs to tenant
    const { data: participant, error: participantError } = await supabase
      .from('participants')
      .select('*')
      .eq('participant_id', participantId)
      .eq('tenant_id', tenant.tenant_id)
      .single();

    if (participantError || !participant) {
      return new Response(
        JSON.stringify({ error: 'Participant not found or does not belong to tenant' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get payment status for visitors
    let paymentStatus = '';
    let inviterName = '';
    const isVisitor = participant.status === 'visitor' || participant.status === 'prospect';

    if (isVisitor) {
      const { data: payment } = await supabase
        .from('payments')
        .select('status')
        .eq('participant_id', participantId)
        .eq('tenant_id', tenant.tenant_id)
        .eq('status', 'completed')
        .limit(1)
        .maybeSingle();

      paymentStatus = payment ? '✅ Paid' : '❌ Pending';

      if (participant.invited_by) {
        const { data: inviter } = await supabase
          .from('participants')
          .select('full_name, nickname')
          .eq('participant_id', participant.invited_by)
          .maybeSingle();

        inviterName = inviter ? (inviter.nickname || inviter.full_name || 'N/A') : 'N/A';
      } else {
        inviterName = 'N/A';
      }
    }

    // Get tenant secrets (only public fields)
    const { data: secrets } = await supabase
      .from('tenant_secrets')
      .select('line_channel_id, liff_id_share')
      .eq('tenant_id', tenant.tenant_id)
      .single();

    return new Response(
      JSON.stringify({
        participant: {
          participant_id: participant.participant_id,
          full_name: participant.full_name,
          nickname: participant.nickname,
          company: participant.company,
          business_type: participant.business_type,
          phone: participant.phone,
          email: participant.email,
          goal: participant.goal,
          status: participant.status
        },
        tenant: {
          tenant_id: tenant.tenant_id,
          slug: tenant.slug,
          name: tenant.name
        },
        visitor_info: isVisitor ? {
          payment_status: paymentStatus,
          inviter_name: inviterName
        } : null,
        public_secrets: {
          line_channel_id: secrets?.line_channel_id,
          liff_id_share: secrets?.liff_id_share
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in get-participant-card:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
