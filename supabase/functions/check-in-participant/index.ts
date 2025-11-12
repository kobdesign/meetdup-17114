import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID();
  const logPrefix = `[check-in-participant:${requestId}]`;

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error(`${logPrefix} Missing env vars SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY`);
      return new Response(
        JSON.stringify({ error: 'Server misconfiguration' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Robust body parsing
    const contentType = req.headers.get('content-type') || '';
    let body: any = {};

    try {
      if (contentType.includes('application/json')) {
        body = await req.json();
      } else {
        const raw = await req.text();
        console.log(`${logPrefix} Non-JSON content-type received:`, contentType, 'raw length:', raw?.length ?? 0);
        body = raw ? JSON.parse(raw) : {};
      }
    } catch (parseErr) {
      console.error(`${logPrefix} Failed to parse request body:`, parseErr);
      return new Response(
        JSON.stringify({ error: 'Invalid JSON body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { meeting_id, full_name, email, phone } = body || {};

    console.log(`${logPrefix} Incoming check-in request`, {
      meeting_id,
      full_name,
      email,
      phone_masked: phone ? `${String(phone).slice(0,3)}****` : undefined,
    });

    // Validate required fields
    if (!meeting_id || !full_name || !email || !phone) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get meeting details
    const { data: meeting, error: meetingError } = await supabase
      .from('meetings')
      .select('meeting_id, tenant_id')
      .eq('meeting_id', meeting_id)
      .single();

    if (meetingError || !meeting) {
      console.error(`${logPrefix} Meeting not found`, meetingError);
      return new Response(
        JSON.stringify({ error: 'Meeting not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if participant exists
    let participantId: string;
    let participantStatus: string | null = null;

    const { data: existingParticipant, error: lookupError } = await supabase
      .from('participants')
      .select('participant_id, status')
      .eq('tenant_id', meeting.tenant_id)
      .eq('email', email)
      .maybeSingle();

    if (lookupError) {
      console.error(`${logPrefix} Error looking up participant:`, lookupError);
    }

    if (existingParticipant) {
      console.log(`${logPrefix} Existing participant found`, existingParticipant);
      participantId = existingParticipant.participant_id;
      participantStatus = existingParticipant.status;
    } else {
      // Create new participant as 'prospect'
      console.log(`${logPrefix} Creating new participant`);
      const { data: newParticipant, error: participantError } = await supabase
        .from('participants')
        .insert({
          tenant_id: meeting.tenant_id,
          full_name,
          email,
          phone,
          status: 'prospect',
        })
        .select()
        .single();

      if (participantError) {
        console.error(`${logPrefix} Failed to create participant:`, participantError);
        return new Response(
          JSON.stringify({ error: 'Failed to create participant' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      participantId = newParticipant.participant_id;
      participantStatus = 'prospect';
      console.log(`${logPrefix} New participant created:`, participantId);
    }

    // Check if already checked in
    const { data: existingCheckin, error: checkLookupErr } = await supabase
      .from('checkins')
      .select('checkin_id')
      .eq('meeting_id', meeting_id)
      .eq('participant_id', participantId)
      .maybeSingle();

    if (checkLookupErr) {
      console.error(`${logPrefix} Error checking existing check-in:`, checkLookupErr);
    }

    if (existingCheckin) {
      console.log(`${logPrefix} Participant already checked in`);
      return new Response(
        JSON.stringify({ error: 'Already checked in', already_checked_in: true }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Auto status change: prospect -> visitor on first check-in
    if (participantStatus === 'prospect') {
      console.log(`${logPrefix} Upgrading prospect to visitor`);
      const { error: updateError } = await supabase
        .from('participants')
        .update({ status: 'visitor' })
        .eq('participant_id', participantId);

      if (updateError) {
        console.error(`${logPrefix} Failed to update status to visitor:`, updateError);
      } else {
        // Write audit log (best-effort)
        try {
          const { error: auditErr } = await supabase.from('status_audit').insert({
            tenant_id: meeting.tenant_id,
            participant_id: participantId,
            reason: 'First check-in (auto)',
          });
          if (auditErr) console.warn(`${logPrefix} status_audit insert failed (ignored)`, auditErr);
        } catch (e) {
          console.warn(`${logPrefix} status_audit insert threw (ignored)`, e);
        }
      }
    }

    // Create check-in record
    const { error: checkinError } = await supabase
      .from('checkins')
      .insert({
        tenant_id: meeting.tenant_id,
        meeting_id,
        participant_id: participantId,
        source: 'manual',
      });

    if (checkinError) {
      console.error(`${logPrefix} Failed to create check-in:`, checkinError);
      return new Response(
        JSON.stringify({ error: 'Failed to create check-in' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`${logPrefix} Check-in successful`);

    return new Response(
      JSON.stringify({
        success: true,
        participant_id: participantId,
        message: 'Check-in successful'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error(`${logPrefix} Error in check-in-participant function:`, error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Unexpected error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
