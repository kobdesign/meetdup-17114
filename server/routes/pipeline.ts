import { Router, Request, Response } from "express";
import { supabaseAdmin } from "../utils/supabaseClient";

const router = Router();

// Get all pipeline stages
router.get("/stages", async (req: Request, res: Response) => {
  try {
    const { data: stages, error } = await supabaseAdmin
      .from("pipeline_stages")
      .select("*")
      .eq("is_active", true)
      .order("stage_order", { ascending: true });

    if (error) throw error;

    // Get sub-statuses for each stage
    const { data: subStatuses, error: subError } = await supabaseAdmin
      .from("pipeline_sub_statuses")
      .select("*")
      .eq("is_active", true)
      .order("display_order", { ascending: true });

    if (subError) throw subError;

    // Merge sub-statuses into stages
    const stagesWithSubStatuses = stages?.map(stage => ({
      ...stage,
      sub_statuses: subStatuses?.filter(sub => sub.stage_key === stage.stage_key) || []
    }));

    res.json(stagesWithSubStatuses);
  } catch (error: any) {
    console.error("Error fetching pipeline stages:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get pipeline records for a tenant (Kanban board data)
router.get("/records/:tenantId", async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const { stage, search } = req.query;

    let query = supabaseAdmin
      .from("pipeline_records")
      .select(`
        *,
        pipeline_stages!inner (
          stage_name,
          stage_name_th,
          stage_group,
          color,
          icon
        )
      `)
      .eq("tenant_id", tenantId)
      .is("archived_at", null)
      .order("stage_entered_at", { ascending: false });

    if (stage && stage !== "all") {
      query = query.eq("current_stage", stage);
    }

    if (search) {
      query = query.or(`full_name.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%`);
    }

    const { data: records, error } = await query;

    if (error) throw error;

    res.json(records || []);
  } catch (error: any) {
    console.error("Error fetching pipeline records:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get pipeline records grouped by stage (for Kanban)
router.get("/kanban/:tenantId", async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;

    // Get all active stages
    const { data: stages, error: stagesError } = await supabaseAdmin
      .from("pipeline_stages")
      .select("*")
      .eq("is_active", true)
      .eq("is_terminal", false)
      .order("stage_order", { ascending: true });

    if (stagesError) throw stagesError;

    // Get all active records
    const { data: records, error: recordsError } = await supabaseAdmin
      .from("pipeline_records")
      .select("*")
      .eq("tenant_id", tenantId)
      .is("archived_at", null)
      .order("stage_entered_at", { ascending: false });

    if (recordsError) throw recordsError;

    // Get sub-statuses
    const { data: subStatuses, error: subError } = await supabaseAdmin
      .from("pipeline_sub_statuses")
      .select("*")
      .eq("is_active", true)
      .order("display_order", { ascending: true });

    if (subError) throw subError;

    // Group records by stage
    const kanbanData = stages?.map(stage => ({
      ...stage,
      sub_statuses: subStatuses?.filter(sub => sub.stage_key === stage.stage_key) || [],
      records: records?.filter(record => record.current_stage === stage.stage_key) || [],
      count: records?.filter(record => record.current_stage === stage.stage_key).length || 0
    }));

    res.json(kanbanData);
  } catch (error: any) {
    console.error("Error fetching kanban data:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get single pipeline record with history
router.get("/record/:recordId", async (req: Request, res: Response) => {
  try {
    const { recordId } = req.params;

    const { data: record, error } = await supabaseAdmin
      .from("pipeline_records")
      .select("*")
      .eq("id", recordId)
      .single();

    if (error) throw error;

    // Get transition history
    const { data: transitions, error: transError } = await supabaseAdmin
      .from("pipeline_transitions")
      .select("*")
      .eq("pipeline_record_id", recordId)
      .order("transitioned_at", { ascending: false });

    if (transError) throw transError;

    // Get tasks
    const { data: tasks, error: tasksError } = await supabaseAdmin
      .from("pipeline_tasks")
      .select("*")
      .eq("pipeline_record_id", recordId)
      .order("due_date", { ascending: true });

    if (tasksError) throw tasksError;

    res.json({
      ...record,
      transitions: transitions || [],
      tasks: tasks || []
    });
  } catch (error: any) {
    console.error("Error fetching pipeline record:", error);
    res.status(500).json({ error: error.message });
  }
});

// Create new pipeline record
router.post("/records", async (req: Request, res: Response) => {
  try {
    const {
      tenant_id,
      full_name,
      phone,
      email,
      line_id,
      source,
      source_details,
      owner_user_id,
      referrer_participant_id,
      notes,
      tags,
      current_stage = "lead_capture"
    } = req.body;

    const { data: record, error } = await supabaseAdmin
      .from("pipeline_records")
      .insert({
        tenant_id,
        full_name,
        phone,
        email,
        line_id,
        source,
        source_details,
        owner_user_id,
        referrer_participant_id,
        notes,
        tags,
        current_stage,
        stage_entered_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    // Create initial transition record
    await supabaseAdmin
      .from("pipeline_transitions")
      .insert({
        pipeline_record_id: record.id,
        to_stage: current_stage,
        is_automatic: false,
        change_reason: "Initial creation"
      });

    res.status(201).json(record);
  } catch (error: any) {
    console.error("Error creating pipeline record:", error);
    res.status(500).json({ error: error.message });
  }
});

// Update pipeline record
router.patch("/records/:recordId", async (req: Request, res: Response) => {
  try {
    const { recordId } = req.params;
    const updates = req.body;

    // Remove fields that shouldn't be updated directly
    delete updates.id;
    delete updates.created_at;
    
    updates.updated_at = new Date().toISOString();

    const { data: record, error } = await supabaseAdmin
      .from("pipeline_records")
      .update(updates)
      .eq("id", recordId)
      .select()
      .single();

    if (error) throw error;

    res.json(record);
  } catch (error: any) {
    console.error("Error updating pipeline record:", error);
    res.status(500).json({ error: error.message });
  }
});

// Move record to different stage (with transition logging)
router.post("/records/:recordId/move", async (req: Request, res: Response) => {
  try {
    const { recordId } = req.params;
    const { to_stage, to_sub_status, changed_by_user_id, change_reason, is_automatic = false } = req.body;

    // Get current record
    const { data: currentRecord, error: fetchError } = await supabaseAdmin
      .from("pipeline_records")
      .select("current_stage, current_sub_status, stage_entered_at")
      .eq("id", recordId)
      .single();

    if (fetchError) throw fetchError;

    // Calculate time in previous stage
    const stageEnteredAt = new Date(currentRecord.stage_entered_at);
    const now = new Date();
    const timeInStage = now.getTime() - stageEnteredAt.getTime();
    const intervalMs = timeInStage;

    // Update record
    const { data: updatedRecord, error: updateError } = await supabaseAdmin
      .from("pipeline_records")
      .update({
        current_stage: to_stage,
        current_sub_status: to_sub_status || null,
        stage_entered_at: now.toISOString(),
        updated_at: now.toISOString()
      })
      .eq("id", recordId)
      .select()
      .single();

    if (updateError) throw updateError;

    // Create transition record
    const { error: transitionError } = await supabaseAdmin
      .from("pipeline_transitions")
      .insert({
        pipeline_record_id: recordId,
        from_stage: currentRecord.current_stage,
        from_sub_status: currentRecord.current_sub_status,
        to_stage,
        to_sub_status,
        changed_by_user_id,
        change_reason,
        is_automatic,
        time_in_previous_stage: `${Math.floor(intervalMs / 1000)} seconds`
      });

    if (transitionError) throw transitionError;

    res.json(updatedRecord);
  } catch (error: any) {
    console.error("Error moving pipeline record:", error);
    res.status(500).json({ error: error.message });
  }
});

// Archive record
router.post("/records/:recordId/archive", async (req: Request, res: Response) => {
  try {
    const { recordId } = req.params;
    const { archive_reason, sub_status, changed_by_user_id } = req.body;

    // Get current record
    const { data: currentRecord, error: fetchError } = await supabaseAdmin
      .from("pipeline_records")
      .select("current_stage, current_sub_status, stage_entered_at")
      .eq("id", recordId)
      .single();

    if (fetchError) throw fetchError;

    const now = new Date();

    // Update record
    const { data: record, error } = await supabaseAdmin
      .from("pipeline_records")
      .update({
        current_stage: "archived",
        current_sub_status: sub_status || "declined",
        archived_at: now.toISOString(),
        archive_reason,
        updated_at: now.toISOString()
      })
      .eq("id", recordId)
      .select()
      .single();

    if (error) throw error;

    // Create transition record
    await supabaseAdmin
      .from("pipeline_transitions")
      .insert({
        pipeline_record_id: recordId,
        from_stage: currentRecord.current_stage,
        from_sub_status: currentRecord.current_sub_status,
        to_stage: "archived",
        to_sub_status: sub_status || "declined",
        changed_by_user_id,
        change_reason: archive_reason,
        is_automatic: false
      });

    res.json(record);
  } catch (error: any) {
    console.error("Error archiving pipeline record:", error);
    res.status(500).json({ error: error.message });
  }
});

// Create task for pipeline record
router.post("/tasks", async (req: Request, res: Response) => {
  try {
    const {
      pipeline_record_id,
      tenant_id,
      task_type,
      title,
      description,
      due_date,
      due_time,
      assigned_to_user_id
    } = req.body;

    const { data: task, error } = await supabaseAdmin
      .from("pipeline_tasks")
      .insert({
        pipeline_record_id,
        tenant_id,
        task_type,
        title,
        description,
        due_date,
        due_time,
        assigned_to_user_id,
        status: "pending"
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json(task);
  } catch (error: any) {
    console.error("Error creating pipeline task:", error);
    res.status(500).json({ error: error.message });
  }
});

// Complete task
router.post("/tasks/:taskId/complete", async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    const { completed_by_user_id } = req.body;

    const { data: task, error } = await supabaseAdmin
      .from("pipeline_tasks")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        completed_by_user_id,
        updated_at: new Date().toISOString()
      })
      .eq("id", taskId)
      .select()
      .single();

    if (error) throw error;

    res.json(task);
  } catch (error: any) {
    console.error("Error completing pipeline task:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get pipeline stats for dashboard
router.get("/stats/:tenantId", async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;

    // Get counts by stage
    const { data: records, error } = await supabaseAdmin
      .from("pipeline_records")
      .select("current_stage, current_sub_status")
      .eq("tenant_id", tenantId)
      .is("archived_at", null);

    if (error) throw error;

    // Calculate stats
    const stageCounts: Record<string, number> = {};
    records?.forEach(record => {
      stageCounts[record.current_stage] = (stageCounts[record.current_stage] || 0) + 1;
    });

    // Get stages for group info
    const { data: stages, error: stagesError } = await supabaseAdmin
      .from("pipeline_stages")
      .select("stage_key, stage_group")
      .eq("is_active", true);

    if (stagesError) throw stagesError;

    // Group by pipeline section
    const groupCounts: Record<string, number> = {
      lead_intake: 0,
      engagement: 0,
      conversion: 0,
      onboarding: 0,
      retention: 0
    };

    stages?.forEach(stage => {
      groupCounts[stage.stage_group] += stageCounts[stage.stage_key] || 0;
    });

    res.json({
      total: records?.length || 0,
      by_stage: stageCounts,
      by_group: groupCounts
    });
  } catch (error: any) {
    console.error("Error fetching pipeline stats:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
