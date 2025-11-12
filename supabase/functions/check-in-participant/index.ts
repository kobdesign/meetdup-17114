import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { meeting_id, full_name, email, phone } = await req.json();

    console.log('Check-in request:', { meeting_id, full_name, email, phone });

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
      console.error('Meeting not found:', meetingError);
      return new Response(
        JSON.stringify({ error: 'Meeting not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if participant exists
    let participantId: string;
    let participantStatus: string | null = null;
    
    const { data: existingParticipant } = await supabase
      .from('participants')
      .select('participant_id, status')
      .eq('tenant_id', meeting.tenant_id)
      .eq('email', email)
      .maybeSingle();

    if (existingParticipant) {
      console.log('Existing participant found:', existingParticipant);
      participantId = existingParticipant.participant_id;
      participantStatus = existingParticipant.status;
    } else {
      // Create new participant as 'prospect'
      console.log('Creating new participant');
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
        console.error('Failed to create participant:', participantError);
        throw participantError;
      }

      participantId = newParticipant.participant_id;
      participantStatus = 'prospect';
      console.log('New participant created:', participantId);
    }

    // Check if already checked in
    const { data: existingCheckin } = await supabase
      .from('checkins')
      .select('checkin_id')
      .eq('meeting_id', meeting_id)
      .eq('participant_id', participantId)
      .maybeSingle();

    if (existingCheckin) {
      console.log('Participant already checked in');
      return new Response(
        JSON.stringify({ error: 'Already checked in', already_checked_in: true }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Auto status change: prospect -> visitor on first check-in
    if (participantStatus === 'prospect') {
      console.log('Upgrading prospect to visitor');
      const { error: updateError } = await supabase
        .from('participants')
        .update({ status: 'visitor' })
        .eq('participant_id', participantId);

      if (updateError) {
        console.error('Failed to update status to visitor:', updateError);
      } else {
        // Write audit log (best-effort)
        try {
          await supabase.from('status_audit').insert({
            tenant_id: meeting.tenant_id,
            participant_id: participantId,
            reason: 'First check-in (auto)',
          });
        } catch (e) {
          console.warn('status_audit insert failed (ignored)', e);
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
      console.error('Failed to create check-in:', checkinError);
      throw checkinError;
    }

    console.log('Check-in successful');

    return new Response(
      JSON.stringify({ 
        success: true, 
        participant_id: participantId,
        message: 'Check-in successful' 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in check-in-participant function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
