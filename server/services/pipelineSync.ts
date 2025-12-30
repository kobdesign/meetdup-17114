import { supabaseAdmin } from "../utils/supabaseClient";

/**
 * Create or update a pipeline record when a visitor registers for a meeting
 * Called when meeting_registrations are created
 */
export async function syncVisitorToPipeline(params: {
  tenant_id: string;
  participant_id: string;
  meeting_id: string;
  source?: string;
  source_details?: string;
  referrer_participant_id?: string;
}) {
  const { tenant_id, participant_id, meeting_id, source, source_details, referrer_participant_id } = params;
  const logPrefix = `[pipelineSync]`;

  try {
    // Check if pipeline tables exist (graceful degradation if not migrated yet)
    const { data: stageCheck, error: stageError } = await supabaseAdmin
      .from("pipeline_stages")
      .select("stage_key")
      .eq("stage_key", "rsvp_confirmed")
      .maybeSingle();

    if (stageError || !stageCheck) {
      console.log(`${logPrefix} Pipeline tables not ready, skipping sync`);
      return { success: false, reason: "pipeline_not_ready" };
    }

    // Get participant info
    const { data: participant, error: participantError } = await supabaseAdmin
      .from("participants")
      .select("full_name_th, phone, email, line_id")
      .eq("participant_id", participant_id)
      .single();

    if (participantError || !participant) {
      console.error(`${logPrefix} Participant not found:`, participantError);
      return { success: false, reason: "participant_not_found" };
    }

    // Check if pipeline record already exists for this visitor in this tenant
    const { data: existingRecord } = await supabaseAdmin
      .from("pipeline_records")
      .select("id, current_stage, meetings_attended")
      .eq("tenant_id", tenant_id)
      .eq("visitor_id", participant_id)
      .maybeSingle();

    if (existingRecord) {
      // Already in pipeline - check if we need to update meeting count
      console.log(`${logPrefix} Existing pipeline record found:`, existingRecord.id);
      
      // Update meeting tracking if first meeting or new meeting
      const { error: updateError } = await supabaseAdmin
        .from("pipeline_records")
        .update({
          last_meeting_id: meeting_id,
          updated_at: new Date().toISOString()
        })
        .eq("id", existingRecord.id);

      if (updateError) {
        console.error(`${logPrefix} Error updating pipeline record:`, updateError);
      }

      return { 
        success: true, 
        action: "updated", 
        record_id: existingRecord.id,
        current_stage: existingRecord.current_stage
      };
    }

    // Create new pipeline record at rsvp_confirmed stage
    const { data: newRecord, error: insertError } = await supabaseAdmin
      .from("pipeline_records")
      .insert({
        tenant_id,
        visitor_id: participant_id,
        full_name: participant.full_name_th,
        phone: participant.phone,
        email: participant.email,
        line_id: participant.line_id,
        current_stage: "rsvp_confirmed",
        stage_entered_at: new Date().toISOString(),
        source: source || "meeting_registration",
        source_details: source_details || `Registered for meeting ${meeting_id}`,
        referrer_participant_id,
        first_meeting_id: meeting_id,
        last_meeting_id: meeting_id,
        meetings_attended: 0
      })
      .select("id")
      .single();

    if (insertError) {
      console.error(`${logPrefix} Error creating pipeline record:`, insertError);
      return { success: false, reason: "insert_failed", error: insertError.message };
    }

    // Create initial transition record
    await supabaseAdmin
      .from("pipeline_transitions")
      .insert({
        pipeline_record_id: newRecord.id,
        to_stage: "rsvp_confirmed",
        is_automatic: true,
        change_reason: "Auto-created from meeting registration"
      });

    console.log(`${logPrefix} Created new pipeline record:`, newRecord.id);
    return { success: true, action: "created", record_id: newRecord.id };

  } catch (error: any) {
    console.error(`${logPrefix} Unexpected error:`, error);
    return { success: false, reason: "exception", error: error.message };
  }
}

/**
 * Move pipeline record to attended_meeting stage when visitor checks in
 */
export async function syncCheckInToPipeline(params: {
  tenant_id: string;
  participant_id: string;
  meeting_id: string;
}) {
  const { tenant_id, participant_id, meeting_id } = params;
  const logPrefix = `[pipelineSync:checkIn]`;

  try {
    // Find existing pipeline record
    const { data: record, error: findError } = await supabaseAdmin
      .from("pipeline_records")
      .select("id, current_stage, meetings_attended")
      .eq("tenant_id", tenant_id)
      .eq("visitor_id", participant_id)
      .is("archived_at", null)
      .maybeSingle();

    if (findError || !record) {
      console.log(`${logPrefix} No pipeline record found for visitor`);
      return { success: false, reason: "record_not_found" };
    }

    // Get meeting date for tracking
    const { data: meeting } = await supabaseAdmin
      .from("meetings")
      .select("meeting_date")
      .eq("meeting_id", meeting_id)
      .single();

    const newMeetingsAttended = (record.meetings_attended || 0) + 1;
    const now = new Date().toISOString();

    // Determine target stage based on attendance count
    let targetStage = record.current_stage;
    
    // Only move if they're in early stages
    const earlyStages = ["lead_capture", "prospect_qualified", "invite_scheduled", "rsvp_confirmed"];
    if (earlyStages.includes(record.current_stage)) {
      targetStage = "attended_meeting";
    }

    // If attended multiple times, move to follow_up
    if (newMeetingsAttended >= 2 && record.current_stage === "attended_meeting") {
      targetStage = "follow_up";
    }

    // Update record
    const { error: updateError } = await supabaseAdmin
      .from("pipeline_records")
      .update({
        current_stage: targetStage,
        current_sub_status: targetStage === "follow_up" ? "interested" : null,
        stage_entered_at: targetStage !== record.current_stage ? now : undefined,
        last_meeting_id: meeting_id,
        last_meeting_date: meeting?.meeting_date,
        meetings_attended: newMeetingsAttended,
        updated_at: now
      })
      .eq("id", record.id);

    if (updateError) {
      console.error(`${logPrefix} Error updating pipeline record:`, updateError);
      return { success: false, reason: "update_failed", error: updateError.message };
    }

    // Create transition record if stage changed
    if (targetStage !== record.current_stage) {
      await supabaseAdmin
        .from("pipeline_transitions")
        .insert({
          pipeline_record_id: record.id,
          from_stage: record.current_stage,
          to_stage: targetStage,
          to_sub_status: targetStage === "follow_up" ? "interested" : null,
          is_automatic: true,
          change_reason: `Auto-moved after check-in (meeting #${newMeetingsAttended})`
        });

      console.log(`${logPrefix} Moved record from ${record.current_stage} to ${targetStage}`);
    }

    return { 
      success: true, 
      action: targetStage !== record.current_stage ? "moved" : "updated",
      record_id: record.id,
      from_stage: record.current_stage,
      to_stage: targetStage,
      meetings_attended: newMeetingsAttended
    };

  } catch (error: any) {
    console.error(`${logPrefix} Unexpected error:`, error);
    return { success: false, reason: "exception", error: error.message };
  }
}
