import { Router, Request, Response } from "express";
import { createClient } from "@supabase/supabase-js";

const router = Router();

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ============================================
// Chapter Dues Config
// ============================================

// GET /api/payments/dues-config/:tenantId
router.get("/dues-config/:tenantId", async (req: Request, res: Response) => {
  const { tenantId } = req.params;

  try {
    const { data, error } = await supabaseAdmin
      .from("chapter_dues_config")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .order("effective_from", { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== "PGRST116") {
      console.error("Error fetching dues config:", error);
      return res.status(500).json({ success: false, error: error.message });
    }

    return res.json({ success: true, data: data || null });
  } catch (err: any) {
    console.error("Error in dues-config:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/payments/dues-config
router.post("/dues-config", async (req: Request, res: Response) => {
  const {
    tenant_id,
    monthly_amount,
    due_day_of_month,
    grace_period_days,
    promptpay_number,
    promptpay_name,
    bank_name,
    bank_account_number,
    bank_account_name,
    reminder_days_before,
  } = req.body;

  try {
    // Deactivate previous configs
    await supabaseAdmin
      .from("chapter_dues_config")
      .update({ is_active: false })
      .eq("tenant_id", tenant_id);

    // Create new config
    const { data, error } = await supabaseAdmin
      .from("chapter_dues_config")
      .insert({
        tenant_id,
        monthly_amount: monthly_amount || 0,
        due_day_of_month: due_day_of_month || 1,
        grace_period_days: grace_period_days || 7,
        promptpay_number,
        promptpay_name,
        bank_name,
        bank_account_number,
        bank_account_name,
        reminder_days_before: reminder_days_before || [3, 0, -7],
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating dues config:", error);
      return res.status(500).json({ success: false, error: error.message });
    }

    return res.json({ success: true, data });
  } catch (err: any) {
    console.error("Error in create dues-config:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================
// Member Dues
// ============================================

// GET /api/payments/member-dues/:tenantId
router.get("/member-dues/:tenantId", async (req: Request, res: Response) => {
  const { tenantId } = req.params;
  const { month, status, participant_id } = req.query;

  try {
    let query = supabaseAdmin
      .from("member_dues")
      .select(`
        *,
        participant:participants!inner(
          participant_id,
          full_name_th,
          nickname_th,
          phone,
          company,
          photo_url,
          status
        )
      `)
      .eq("tenant_id", tenantId)
      .eq("participant.status", "member");

    if (month) {
      query = query.eq("dues_month", month);
    }

    if (status) {
      query = query.eq("status", status);
    }

    if (participant_id) {
      query = query.eq("participant_id", participant_id);
    }

    const { data, error } = await query.order("dues_month", { ascending: false });

    if (error) {
      console.error("Error fetching member dues:", error);
      return res.status(500).json({ success: false, error: error.message });
    }

    return res.json({ success: true, data: data || [] });
  } catch (err: any) {
    console.error("Error in member-dues:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/payments/member-dues-summary/:tenantId
router.get("/member-dues-summary/:tenantId", async (req: Request, res: Response) => {
  const { tenantId } = req.params;

  try {
    // Get all member dues with participant info
    const { data: dues, error } = await supabaseAdmin
      .from("member_dues")
      .select(`
        dues_id,
        participant_id,
        dues_month,
        amount_due,
        amount_paid,
        status,
        due_date,
        participant:participants!inner(
          participant_id,
          full_name_th,
          nickname_th,
          phone,
          company,
          photo_url,
          status
        )
      `)
      .eq("tenant_id", tenantId)
      .eq("participant.status", "member")
      .order("dues_month", { ascending: false });

    if (error) {
      console.error("Error fetching dues summary:", error);
      return res.status(500).json({ success: false, error: error.message });
    }

    // Group by participant
    const memberMap = new Map<string, any>();
    
    for (const due of dues || []) {
      const participant = due.participant as any;
      if (!memberMap.has(due.participant_id)) {
        memberMap.set(due.participant_id, {
          participant_id: due.participant_id,
          full_name_th: participant.full_name_th,
          nickname_th: participant.nickname_th,
          phone: participant.phone,
          company: participant.company,
          photo_url: participant.photo_url,
          dues: [],
          total_due: 0,
          total_paid: 0,
          overdue_months: 0,
        });
      }
      
      const member = memberMap.get(due.participant_id);
      member.dues.push({
        dues_id: due.dues_id,
        dues_month: due.dues_month,
        amount_due: due.amount_due,
        amount_paid: due.amount_paid,
        status: due.status,
        due_date: due.due_date,
      });
      member.total_due += Number(due.amount_due);
      member.total_paid += Number(due.amount_paid);
      if (due.status === "overdue" || due.status === "pending") {
        const dueDate = new Date(due.due_date);
        if (dueDate < new Date()) {
          member.overdue_months++;
        }
      }
    }

    const members = Array.from(memberMap.values());
    
    // Calculate summary
    const summary = {
      total_members: members.length,
      total_due: members.reduce((sum, m) => sum + m.total_due, 0),
      total_paid: members.reduce((sum, m) => sum + m.total_paid, 0),
      total_outstanding: members.reduce((sum, m) => sum + (m.total_due - m.total_paid), 0),
      members_with_overdue: members.filter(m => m.overdue_months > 0).length,
    };

    return res.json({ success: true, data: { members, summary } });
  } catch (err: any) {
    console.error("Error in member-dues-summary:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/payments/member-dues/generate
router.post("/member-dues/generate", async (req: Request, res: Response) => {
  const { tenant_id, dues_month } = req.body;

  try {
    // Get dues config
    const { data: config } = await supabaseAdmin
      .from("chapter_dues_config")
      .select("*")
      .eq("tenant_id", tenant_id)
      .eq("is_active", true)
      .single();

    if (!config) {
      return res.status(400).json({ success: false, error: "No dues config found" });
    }

    // Get all active members
    const { data: members } = await supabaseAdmin
      .from("participants")
      .select("participant_id")
      .eq("tenant_id", tenant_id)
      .eq("status", "member");

    if (!members || members.length === 0) {
      return res.status(400).json({ success: false, error: "No members found" });
    }

    // Calculate due date
    const monthDate = new Date(dues_month);
    const dueDate = new Date(monthDate.getFullYear(), monthDate.getMonth(), config.due_day_of_month);

    // Generate dues records
    const duesRecords = members.map((m) => ({
      tenant_id,
      participant_id: m.participant_id,
      dues_month,
      amount_due: config.monthly_amount,
      due_date: dueDate.toISOString().split("T")[0],
      status: "pending",
    }));

    const { data, error } = await supabaseAdmin
      .from("member_dues")
      .upsert(duesRecords, { onConflict: "participant_id,dues_month" })
      .select();

    if (error) {
      console.error("Error generating dues:", error);
      return res.status(500).json({ success: false, error: error.message });
    }

    return res.json({ success: true, data, count: data?.length || 0 });
  } catch (err: any) {
    console.error("Error in generate dues:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /api/payments/member-dues/:duesId/mark-paid
router.patch("/member-dues/:duesId/mark-paid", async (req: Request, res: Response) => {
  const { duesId } = req.params;
  const { amount_paid, notes } = req.body;

  try {
    const { data: existing } = await supabaseAdmin
      .from("member_dues")
      .select("amount_due")
      .eq("dues_id", duesId)
      .single();

    if (!existing) {
      return res.status(404).json({ success: false, error: "Dues record not found" });
    }

    const newAmountPaid = amount_paid || existing.amount_due;
    const status = newAmountPaid >= existing.amount_due ? "paid" : "partial";

    const { data, error } = await supabaseAdmin
      .from("member_dues")
      .update({
        amount_paid: newAmountPaid,
        status,
        paid_at: new Date().toISOString(),
        notes,
        updated_at: new Date().toISOString(),
      })
      .eq("dues_id", duesId)
      .select()
      .single();

    if (error) {
      console.error("Error marking paid:", error);
      return res.status(500).json({ success: false, error: error.message });
    }

    return res.json({ success: true, data });
  } catch (err: any) {
    console.error("Error in mark-paid:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/payments/member-dues/bulk-mark-paid
router.post("/member-dues/bulk-mark-paid", async (req: Request, res: Response) => {
  const { dues_ids, notes } = req.body;

  try {
    const { data, error } = await supabaseAdmin
      .from("member_dues")
      .update({
        status: "paid",
        paid_at: new Date().toISOString(),
        notes,
        updated_at: new Date().toISOString(),
      })
      .in("dues_id", dues_ids)
      .select();

    if (error) {
      console.error("Error bulk marking paid:", error);
      return res.status(500).json({ success: false, error: error.message });
    }

    // Update amount_paid to match amount_due
    for (const due of data || []) {
      await supabaseAdmin
        .from("member_dues")
        .update({ amount_paid: due.amount_due })
        .eq("dues_id", due.dues_id);
    }

    return res.json({ success: true, count: data?.length || 0 });
  } catch (err: any) {
    console.error("Error in bulk-mark-paid:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================
// Visitor Meeting Fees
// ============================================

// GET /api/payments/visitor-fees/:meetingId
router.get("/visitor-fees/:meetingId", async (req: Request, res: Response) => {
  const { meetingId } = req.params;

  try {
    const { data, error } = await supabaseAdmin
      .from("visitor_meeting_fees")
      .select(`
        *,
        participant:participants(
          participant_id,
          full_name_th,
          nickname_th,
          phone,
          company,
          photo_url
        )
      `)
      .eq("meeting_id", meetingId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error fetching visitor fees:", error);
      return res.status(500).json({ success: false, error: error.message });
    }

    // Calculate summary
    const summary = {
      total: data?.length || 0,
      paid: data?.filter((f) => f.status === "paid").length || 0,
      pending: data?.filter((f) => f.status === "pending").length || 0,
      total_amount: data?.reduce((sum, f) => sum + Number(f.amount_due), 0) || 0,
      paid_amount: data?.reduce((sum, f) => sum + Number(f.amount_paid), 0) || 0,
    };

    return res.json({ success: true, data: data || [], summary });
  } catch (err: any) {
    console.error("Error in visitor-fees:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/payments/visitor-fees/generate
router.post("/visitor-fees/generate", async (req: Request, res: Response) => {
  const { meeting_id } = req.body;

  try {
    // Get meeting info
    const { data: meeting } = await supabaseAdmin
      .from("meetings")
      .select("meeting_id, tenant_id, visitor_fee")
      .eq("meeting_id", meeting_id)
      .single();

    if (!meeting) {
      return res.status(404).json({ success: false, error: "Meeting not found" });
    }

    // Get registered visitors
    const { data: registrations } = await supabaseAdmin
      .from("meeting_registrations")
      .select(`
        participant_id,
        participant:participants!inner(status)
      `)
      .eq("meeting_id", meeting_id)
      .in("participant.status", ["visitor", "prospect"]);

    if (!registrations || registrations.length === 0) {
      return res.json({ success: true, data: [], count: 0 });
    }

    // Generate fee records only for participants who don't have a fee record yet
    const feeRecords = registrations.map((r) => ({
      tenant_id: meeting.tenant_id,
      meeting_id,
      participant_id: r.participant_id,
      amount_due: meeting.visitor_fee || 0,
      status: "pending",
    }));

    // Use ignoreDuplicates to not overwrite existing records (preserves paid status)
    const { data, error } = await supabaseAdmin
      .from("visitor_meeting_fees")
      .upsert(feeRecords, { onConflict: "meeting_id,participant_id", ignoreDuplicates: true })
      .select();

    if (error) {
      console.error("Error generating visitor fees:", error);
      return res.status(500).json({ success: false, error: error.message });
    }

    return res.json({ success: true, data, count: data?.length || 0 });
  } catch (err: any) {
    console.error("Error in generate visitor fees:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /api/payments/visitor-fees/:feeId/mark-paid
router.patch("/visitor-fees/:feeId/mark-paid", async (req: Request, res: Response) => {
  const { feeId } = req.params;
  const { notes } = req.body;

  try {
    const { data: existing } = await supabaseAdmin
      .from("visitor_meeting_fees")
      .select("amount_due")
      .eq("fee_id", feeId)
      .single();

    if (!existing) {
      return res.status(404).json({ success: false, error: "Fee record not found" });
    }

    const { data, error } = await supabaseAdmin
      .from("visitor_meeting_fees")
      .update({
        amount_paid: existing.amount_due,
        status: "paid",
        paid_at: new Date().toISOString(),
        notes,
        updated_at: new Date().toISOString(),
      })
      .eq("fee_id", feeId)
      .select()
      .single();

    if (error) {
      console.error("Error marking visitor fee paid:", error);
      return res.status(500).json({ success: false, error: error.message });
    }

    return res.json({ success: true, data });
  } catch (err: any) {
    console.error("Error in mark visitor fee paid:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/payments/visitor-fees/bulk-mark-paid
router.post("/visitor-fees/bulk-mark-paid", async (req: Request, res: Response) => {
  const { fee_ids, notes } = req.body;

  try {
    // Get all fees to update amount_paid
    const { data: fees } = await supabaseAdmin
      .from("visitor_meeting_fees")
      .select("fee_id, amount_due")
      .in("fee_id", fee_ids);

    if (!fees || fees.length === 0) {
      return res.status(404).json({ success: false, error: "No fees found" });
    }

    // Update each fee
    for (const fee of fees) {
      await supabaseAdmin
        .from("visitor_meeting_fees")
        .update({
          amount_paid: fee.amount_due,
          status: "paid",
          paid_at: new Date().toISOString(),
          notes,
          updated_at: new Date().toISOString(),
        })
        .eq("fee_id", fee.fee_id);
    }

    return res.json({ success: true, count: fees.length });
  } catch (err: any) {
    console.error("Error in bulk mark visitor fees paid:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================
// Payment Submissions (Self-Service)
// ============================================

// GET /api/payments/submissions/:tenantId
router.get("/submissions/:tenantId", async (req: Request, res: Response) => {
  const { tenantId } = req.params;
  const { status, payment_type } = req.query;

  try {
    let query = supabaseAdmin
      .from("payment_submissions")
      .select(`
        *,
        participant:participants(
          participant_id,
          full_name_th,
          nickname_th,
          phone,
          company,
          photo_url
        )
      `)
      .eq("tenant_id", tenantId)
      .order("submitted_at", { ascending: false });

    if (status) {
      query = query.eq("status", status);
    }

    if (payment_type) {
      query = query.eq("payment_type", payment_type);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching submissions:", error);
      return res.status(500).json({ success: false, error: error.message });
    }

    return res.json({ success: true, data: data || [] });
  } catch (err: any) {
    console.error("Error in submissions:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/payments/submissions
router.post("/submissions", async (req: Request, res: Response) => {
  const {
    tenant_id,
    participant_id,
    payment_type,
    reference_id,
    amount,
    slip_url,
    slip_filename,
  } = req.body;

  try {
    const { data, error } = await supabaseAdmin
      .from("payment_submissions")
      .insert({
        tenant_id,
        participant_id,
        payment_type,
        reference_id,
        amount,
        slip_url,
        slip_filename,
        status: "pending",
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating submission:", error);
      return res.status(500).json({ success: false, error: error.message });
    }

    return res.json({ success: true, data });
  } catch (err: any) {
    console.error("Error in create submission:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /api/payments/submissions/:submissionId/approve
router.patch("/submissions/:submissionId/approve", async (req: Request, res: Response) => {
  const { submissionId } = req.params;
  const { reviewed_by } = req.body;

  try {
    // Get submission
    const { data: submission } = await supabaseAdmin
      .from("payment_submissions")
      .select("*")
      .eq("submission_id", submissionId)
      .single();

    if (!submission) {
      return res.status(404).json({ success: false, error: "Submission not found" });
    }

    // Update submission status
    await supabaseAdmin
      .from("payment_submissions")
      .update({
        status: "approved",
        reviewed_at: new Date().toISOString(),
        reviewed_by,
        updated_at: new Date().toISOString(),
      })
      .eq("submission_id", submissionId);

    // Update the corresponding dues/fee record
    if (submission.payment_type === "member_dues") {
      await supabaseAdmin
        .from("member_dues")
        .update({
          amount_paid: submission.amount,
          status: "paid",
          paid_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("dues_id", submission.reference_id);
    } else if (submission.payment_type === "visitor_fee") {
      await supabaseAdmin
        .from("visitor_meeting_fees")
        .update({
          amount_paid: submission.amount,
          status: "paid",
          paid_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("fee_id", submission.reference_id);
    }

    return res.json({ success: true });
  } catch (err: any) {
    console.error("Error in approve submission:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /api/payments/submissions/:submissionId/reject
router.patch("/submissions/:submissionId/reject", async (req: Request, res: Response) => {
  const { submissionId } = req.params;
  const { reviewed_by, rejection_reason } = req.body;

  try {
    const { data, error } = await supabaseAdmin
      .from("payment_submissions")
      .update({
        status: "rejected",
        reviewed_at: new Date().toISOString(),
        reviewed_by,
        rejection_reason,
        updated_at: new Date().toISOString(),
      })
      .eq("submission_id", submissionId)
      .select()
      .single();

    if (error) {
      console.error("Error rejecting submission:", error);
      return res.status(500).json({ success: false, error: error.message });
    }

    return res.json({ success: true, data });
  } catch (err: any) {
    console.error("Error in reject submission:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
