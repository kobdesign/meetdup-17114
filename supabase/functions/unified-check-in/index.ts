import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1';
import { requireTenantContext, TenantContext } from '../_shared/tenantGuard.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Rate limiting for check-ins
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW = 60000; // 1 minute

interface CheckInRequest {
  tenant_slug: string;
  participant_id: string;
  meeting_id: string;
  source: 'liff' | 'manual' | 'qr';
  line_user_id?: string;
}

interface CheckInResponse {
  ok?: boolean;
  checkin_time?: string;
  status?: string;
  require_payment?: boolean;
  pay_url?: string;
  amount?: number;
  currency?: string;
  error?: string;
  details?: string;
}

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const limit = rateLimitMap.get(key);

  if (!limit || now > limit.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return true;
  }

  if (limit.count >= RATE_LIMIT_MAX) {
    return false;
  }

  limit.count++;
  return true;
}

async function logIntegrationEvent(
  supabase: any,
  tenantId: string,
  eventType: string,
  payload: any,
  metadata?: any
) {
  try {
    await supabase.from('integration_logs').insert({
      tenant_id: tenantId,
      source: 'check-in',
      event_type: eventType,
      payload,
      metadata
    });
  } catch (error) {
    console.error('Failed to log integration event:', error);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse request body
    const body: CheckInRequest = await req.json();
    const { tenant_slug, participant_id, meeting_id, source, line_user_id } = body;

    console.log(`Check-in request: tenant=${tenant_slug}, participant=${participant_id}, meeting=${meeting_id}, source=${source}`);

    // Validate required fields
    if (!tenant_slug || !participant_id || !meeting_id || !source) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields', details: 'tenant_slug, participant_id, meeting_id, and source are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Resolve tenant context
    const tenantContext = await requireTenantContext(req, supabase);
    if (!tenantContext) {
      return new Response(
        JSON.stringify({ error: 'Tenant not found or inactive' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Rate limit check
    const rateLimitKey = `${tenantContext.tenant_id}:${participant_id}`;
    if (!checkRateLimit(rateLimitKey)) {
      console.warn(`Rate limit exceeded for: ${rateLimitKey}`);
      return new Response(
        JSON.stringify({ error: 'Too many check-in attempts', details: 'กรุณารอสักครู่แล้วลองใหม่' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch participant
    const { data: participant, error: participantError } = await supabase
      .from('participants')
      .select('*')
      .eq('participant_id', participant_id)
      .eq('tenant_id', tenantContext.tenant_id)
      .single();

    if (participantError || !participant) {
      console.error('Participant not found:', participantError);
      return new Response(
        JSON.stringify({ error: 'Participant not found', details: 'ไม่พบข้อมูลผู้เข้าร่วม' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch meeting
    const { data: meeting, error: meetingError } = await supabase
      .from('meetings')
      .select('*')
      .eq('meeting_id', meeting_id)
      .eq('tenant_id', tenantContext.tenant_id)
      .single();

    if (meetingError || !meeting) {
      console.error('Meeting not found:', meetingError);
      return new Response(
        JSON.stringify({ error: 'Meeting not found', details: 'ไม่พบข้อมูลการประชุม' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Bind LINE user ID if provided and not already bound
    if (line_user_id && !participant.line_user_id) {
      console.log(`Binding LINE user ID ${line_user_id} to participant ${participant_id}`);
      const { error: bindError } = await supabase
        .from('participants')
        .update({ line_user_id })
        .eq('participant_id', participant_id)
        .eq('tenant_id', tenantContext.tenant_id);

      if (bindError) {
        console.error('Failed to bind LINE user ID:', bindError);
        // Non-fatal, continue with check-in
      }
    }

    // Check for existing check-in
    const { data: existingCheckin } = await supabase
      .from('checkins')
      .select('checkin_id, checkin_time')
      .eq('tenant_id', tenantContext.tenant_id)
      .eq('participant_id', participant_id)
      .eq('meeting_id', meeting_id)
      .maybeSingle();

    if (existingCheckin) {
      console.log('Participant already checked in');
      return new Response(
        JSON.stringify({
          ok: true,
          checkin_time: existingCheckin.checkin_time,
          status: 'already_checked_in',
          message: 'คุณเช็คอินแล้ว'
        } as CheckInResponse),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get tenant settings
    const { data: settings } = await supabase
      .from('tenant_settings')
      .select('default_visitor_fee, currency, require_visitor_payment')
      .eq('tenant_id', tenantContext.tenant_id)
      .single();

    const defaultVisitorFee = settings?.default_visitor_fee || 650;
    const currency = settings?.currency || 'THB';
    const requirePayment = settings?.require_visitor_payment !== false;

    // Check-in logic based on participant status
    const status = participant.status;

    // Case 1: Member - can check in directly
    if (status === 'member') {
      const { data: checkin, error: checkinError } = await supabase
        .from('checkins')
        .insert({
          tenant_id: tenantContext.tenant_id,
          participant_id,
          meeting_id,
          source
        })
        .select('checkin_time')
        .single();

      if (checkinError) {
        console.error('Failed to create check-in:', checkinError);
        return new Response(
          JSON.stringify({ error: 'Failed to check in', details: checkinError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      await logIntegrationEvent(
        supabase,
        tenantContext.tenant_id,
        'check_in_success',
        { participant_id, meeting_id, status: 'member' },
        { source, line_user_id }
      );

      return new Response(
        JSON.stringify({
          ok: true,
          checkin_time: checkin.checkin_time,
          status: 'checked_in'
        } as CheckInResponse),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Case 2: Visitor - check payment status
    if (status === 'visitor') {
      // Check if payment exists and is completed
      const { data: payment } = await supabase
        .from('payments')
        .select('status')
        .eq('participant_id', participant_id)
        .eq('meeting_id', meeting_id)
        .eq('tenant_id', tenantContext.tenant_id)
        .in('status', ['completed', 'waived'])
        .maybeSingle();

      if (payment || !requirePayment) {
        // Payment completed or not required - allow check-in
        const { data: checkin, error: checkinError } = await supabase
          .from('checkins')
          .insert({
            tenant_id: tenantContext.tenant_id,
            participant_id,
            meeting_id,
            source
          })
          .select('checkin_time')
          .single();

        if (checkinError) {
          console.error('Failed to create check-in:', checkinError);
          return new Response(
            JSON.stringify({ error: 'Failed to check in', details: checkinError.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        await logIntegrationEvent(
          supabase,
          tenantContext.tenant_id,
          'check_in_success',
          { participant_id, meeting_id, status: 'visitor', payment_status: payment?.status || 'not_required' },
          { source, line_user_id }
        );

        return new Response(
          JSON.stringify({
            ok: true,
            checkin_time: checkin.checkin_time,
            status: 'checked_in'
          } as CheckInResponse),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else {
        // Payment required but not completed
        const payUrl = `/pay?tenant=${tenant_slug}&pid=${participant_id}&meeting=${meeting_id}`;
        
        await logIntegrationEvent(
          supabase,
          tenantContext.tenant_id,
          'check_in_payment_required',
          { participant_id, meeting_id, status: 'visitor' },
          { source, line_user_id }
        );

        return new Response(
          JSON.stringify({
            require_payment: true,
            pay_url: payUrl,
            amount: defaultVisitorFee,
            currency
          } as CheckInResponse),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Case 3: Prospect - upgrade to visitor and require payment
    if (status === 'prospect') {
      // Upgrade to visitor
      const { error: updateError } = await supabase
        .from('participants')
        .update({ status: 'visitor' })
        .eq('participant_id', participant_id)
        .eq('tenant_id', tenantContext.tenant_id);

      if (updateError) {
        console.error('Failed to upgrade participant status:', updateError);
        return new Response(
          JSON.stringify({ error: 'Failed to upgrade participant status', details: updateError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Create status audit log
      await supabase
        .from('status_audit')
        .insert({
          tenant_id: tenantContext.tenant_id,
          participant_id,
          reason: 'Auto-upgraded from prospect to visitor on check-in attempt'
        });

      await logIntegrationEvent(
        supabase,
        tenantContext.tenant_id,
        'participant_upgraded',
        { participant_id, from: 'prospect', to: 'visitor' },
        { source, line_user_id }
      );

      if (requirePayment) {
        // Payment required
        const payUrl = `/pay?tenant=${tenant_slug}&pid=${participant_id}&meeting=${meeting_id}`;
        
        return new Response(
          JSON.stringify({
            require_payment: true,
            pay_url: payUrl,
            amount: defaultVisitorFee,
            currency
          } as CheckInResponse),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else {
        // Payment not required - create check-in directly
        const { data: checkin, error: checkinError } = await supabase
          .from('checkins')
          .insert({
            tenant_id: tenantContext.tenant_id,
            participant_id,
            meeting_id,
            source
          })
          .select('checkin_time')
          .single();

        if (checkinError) {
          console.error('Failed to create check-in:', checkinError);
          return new Response(
            JSON.stringify({ error: 'Failed to check in', details: checkinError.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({
            ok: true,
            checkin_time: checkin.checkin_time,
            status: 'checked_in'
          } as CheckInResponse),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Case 4: Other statuses - not allowed
    await logIntegrationEvent(
      supabase,
      tenantContext.tenant_id,
      'check_in_rejected',
      { participant_id, meeting_id, status },
      { source, line_user_id }
    );

    return new Response(
      JSON.stringify({
        error: 'Invalid participant status',
        details: `ไม่สามารถเช็คอินได้เนื่องจากสถานะของคุณเป็น "${status}" กรุณาติดต่อผู้ดูแลระบบ`
      } as CheckInResponse),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in unified-check-in:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
