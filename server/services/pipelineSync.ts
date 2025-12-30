import { supabaseAdmin } from "../utils/supabaseClient";

// Define stage order for no-backward rule
const STAGE_ORDER: Record<string, number> = {
  lead: 1,
  attended: 2,
  revisit: 3,
  follow_up: 4,
  application_submitted: 5,
  active_member: 6,
  onboarding: 7,
  archived: 8
};

// Stages that should not be auto-moved backward from
const PROTECTED_STAGES = ['follow_up', 'application_submitted', 'active_member', 'onboarding', 'archived'];

/**
 * Check if a stage transition is allowed (no backward movement from protected stages)
 */
function canAutoMoveToStage(currentStage: string, targetStage: string): boolean {
  // If current stage is protected, only allow forward movement
  if (PROTECTED_STAGES.includes(currentStage)) {
    const currentOrder = STAGE_ORDER[currentStage] || 0;
    const targetOrder = STAGE_ORDER[targetStage] || 0;
    return targetOrder > currentOrder;
  }
  return true;
}

/**
 * Create or update a pipeline record when a visitor registers for a meeting
 * Called when meeting_registrations are created or admin adds visitor
 * Auto-sync: New registration → Lead stage
 * Auto-sync: Repeat registration (if stage < follow_up) → Revisit stage
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
      .eq("stage_key", "lead")
      .eq("is_active", true)
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
      .or(`visitor_id.eq.${participant_id},participant_id.eq.${participant_id}`)
      .is("archived_at", null)
      .maybeSingle();

    if (existingRecord) {
      // Already in pipeline - check if we should move to revisit stage
      console.log(`${logPrefix} Existing pipeline record found:`, existingRecord.id, "stage:", existingRecord.current_stage);
      
      const now = new Date().toISOString();
      let targetStage = existingRecord.current_stage;
      let stageChanged = false;

      // If in early stages and registering again, move to revisit (but not if already at revisit+)
      if (existingRecord.current_stage === 'lead' || existingRecord.current_stage === 'attended') {
        if (canAutoMoveToStage(existingRecord.current_stage, 'revisit')) {
          targetStage = 'revisit';
          stageChanged = true;
        }
      }

      // Update meeting tracking
      const updateData: any = {
        last_meeting_id: meeting_id,
        updated_at: now
      };

      if (stageChanged) {
        updateData.current_stage = targetStage;
        updateData.stage_entered_at = now;
      }

      const { error: updateError } = await supabaseAdmin
        .from("pipeline_records")
        .update(updateData)
        .eq("id", existingRecord.id);

      if (updateError) {
        console.error(`${logPrefix} Error updating pipeline record:`, updateError);
      }

      // Create transition record if stage changed
      if (stageChanged) {
        await supabaseAdmin
          .from("pipeline_transitions")
          .insert({
            pipeline_record_id: existingRecord.id,
            from_stage: existingRecord.current_stage,
            to_stage: targetStage,
            is_automatic: true,
            change_reason: "Auto-moved to revisit from repeat registration"
          });

        console.log(`${logPrefix} Moved record from ${existingRecord.current_stage} to ${targetStage}`);
      }

      return { 
        success: true, 
        action: stageChanged ? "moved" : "updated", 
        record_id: existingRecord.id,
        from_stage: existingRecord.current_stage,
        to_stage: targetStage
      };
    }

    // Query historical check-in count to populate meetings_attended correctly
    const { count: historicalCheckIns } = await supabaseAdmin
      .from("checkins")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenant_id)
      .eq("participant_id", participant_id);

    const actualMeetingsAttended = historicalCheckIns || 0;

    // Determine initial stage based on historical attendance
    let initialStage = "lead";
    if (actualMeetingsAttended >= 2) {
      initialStage = "revisit";
    } else if (actualMeetingsAttended === 1) {
      initialStage = "attended";
    }

    console.log(`${logPrefix} Historical check-ins: ${actualMeetingsAttended}, initial stage: ${initialStage}`);

    // Create new pipeline record with correct initial stage
    const { data: newRecord, error: insertError } = await supabaseAdmin
      .from("pipeline_records")
      .insert({
        tenant_id,
        visitor_id: participant_id,
        full_name: participant.full_name_th,
        phone: participant.phone,
        email: participant.email,
        line_id: participant.line_id,
        current_stage: initialStage,
        stage_entered_at: new Date().toISOString(),
        source: source || "meeting_registration",
        source_details: source_details || `Registered for meeting ${meeting_id}`,
        referrer_participant_id,
        first_meeting_id: meeting_id,
        last_meeting_id: meeting_id,
        meetings_attended: actualMeetingsAttended
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
        to_stage: initialStage,
        is_automatic: true,
        change_reason: actualMeetingsAttended > 0 
          ? `Auto-created with ${actualMeetingsAttended} historical check-in(s)`
          : "Auto-created from registration"
      });

    console.log(`${logPrefix} Created new pipeline record:`, newRecord.id, "stage:", initialStage, "meetings:", actualMeetingsAttended);
    return { success: true, action: "created", record_id: newRecord.id, initial_stage: initialStage, meetings_attended: actualMeetingsAttended };

  } catch (error: any) {
    console.error(`${logPrefix} Unexpected error:`, error);
    return { success: false, reason: "exception", error: error.message };
  }
}

/**
 * Move pipeline record to attended stage when visitor checks in
 * Auto-sync: First check-in → Attended stage
 * Auto-sync: Repeat check-in (if stage < follow_up) → Revisit stage
 * No-backward rule: If stage >= follow_up, don't change stage
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
      .or(`visitor_id.eq.${participant_id},participant_id.eq.${participant_id}`)
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

    // Determine target stage based on current stage and attendance count
    let targetStage = record.current_stage;
    
    // Check if we can auto-move (no-backward rule)
    if (!PROTECTED_STAGES.includes(record.current_stage)) {
      if (record.current_stage === 'lead') {
        // First check-in: move to attended
        targetStage = 'attended';
      } else if (record.current_stage === 'attended' && newMeetingsAttended >= 2) {
        // Repeat check-in: move to revisit
        targetStage = 'revisit';
      }
    } else {
      console.log(`${logPrefix} Stage ${record.current_stage} is protected, not auto-moving`);
    }

    // Update record
    const updateData: any = {
      last_meeting_id: meeting_id,
      last_meeting_date: meeting?.meeting_date,
      meetings_attended: newMeetingsAttended,
      updated_at: now
    };

    if (targetStage !== record.current_stage) {
      updateData.current_stage = targetStage;
      updateData.stage_entered_at = now;
    }

    const { error: updateError } = await supabaseAdmin
      .from("pipeline_records")
      .update(updateData)
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

/**
 * Move pipeline record to active_member stage when participant becomes a member
 * Called when: 
 * - Admin converts visitor to member via Meeting Operations
 * - User activates via LINE
 * - Admin changes status to 'member' in backend
 */
export async function syncMemberStatusToPipeline(params: {
  tenant_id: string;
  participant_id: string;
  source?: string;
}) {
  const { tenant_id, participant_id, source } = params;
  const logPrefix = `[pipelineSync:memberStatus]`;

  try {
    // Find existing pipeline record
    const { data: record, error: findError } = await supabaseAdmin
      .from("pipeline_records")
      .select("id, current_stage, participant_id, visitor_id")
      .eq("tenant_id", tenant_id)
      .or(`visitor_id.eq.${participant_id},participant_id.eq.${participant_id}`)
      .is("archived_at", null)
      .maybeSingle();

    if (findError) {
      console.error(`${logPrefix} Error finding pipeline record:`, findError);
      return { success: false, reason: "find_error", error: findError.message };
    }

    const now = new Date().toISOString();

    if (!record) {
      // No pipeline record exists - create one at active_member stage
      console.log(`${logPrefix} No pipeline record found, creating at active_member stage`);

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

      const { data: newRecord, error: insertError } = await supabaseAdmin
        .from("pipeline_records")
        .insert({
          tenant_id,
          participant_id: participant_id,
          visitor_id: participant_id,
          full_name: participant.full_name_th,
          phone: participant.phone,
          email: participant.email,
          line_id: participant.line_id,
          current_stage: "active_member",
          stage_entered_at: now,
          source: source || "member_conversion",
          source_details: "Converted to member",
          meetings_attended: 0
        })
        .select("id")
        .single();

      if (insertError) {
        console.error(`${logPrefix} Error creating pipeline record:`, insertError);
        return { success: false, reason: "insert_failed", error: insertError.message };
      }

      // Create transition record
      await supabaseAdmin
        .from("pipeline_transitions")
        .insert({
          pipeline_record_id: newRecord.id,
          to_stage: "active_member",
          is_automatic: true,
          change_reason: `Auto-created from member conversion (${source || 'manual'})`
        });

      console.log(`${logPrefix} Created new pipeline record at active_member:`, newRecord.id);
      return { success: true, action: "created", record_id: newRecord.id };
    }

    // Record exists - check if we should move to active_member
    if (record.current_stage === 'active_member' || record.current_stage === 'onboarding') {
      console.log(`${logPrefix} Already at ${record.current_stage}, skipping`);
      return { success: true, action: "no_change", record_id: record.id, current_stage: record.current_stage };
    }

    // Move to active_member stage
    const updateData: any = {
      current_stage: "active_member",
      stage_entered_at: now,
      participant_id: participant_id, // Link to participant
      updated_at: now
    };

    const { error: updateError } = await supabaseAdmin
      .from("pipeline_records")
      .update(updateData)
      .eq("id", record.id);

    if (updateError) {
      console.error(`${logPrefix} Error updating pipeline record:`, updateError);
      return { success: false, reason: "update_failed", error: updateError.message };
    }

    // Create transition record
    await supabaseAdmin
      .from("pipeline_transitions")
      .insert({
        pipeline_record_id: record.id,
        from_stage: record.current_stage,
        to_stage: "active_member",
        is_automatic: true,
        change_reason: `Auto-moved from member conversion (${source || 'manual'})`
      });

    console.log(`${logPrefix} Moved record from ${record.current_stage} to active_member`);
    return { 
      success: true, 
      action: "moved",
      record_id: record.id,
      from_stage: record.current_stage,
      to_stage: "active_member"
    };

  } catch (error: any) {
    console.error(`${logPrefix} Unexpected error:`, error);
    return { success: false, reason: "exception", error: error.message };
  }
}
