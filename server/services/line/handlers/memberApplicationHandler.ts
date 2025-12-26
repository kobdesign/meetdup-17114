import { supabaseAdmin } from "../../../utils/supabaseClient";
import { LineClient } from "../lineClient";
import { 
  approveMember, 
  rejectMember, 
  notifyAdminsNewApplication,
  sendApprovalNotificationToApplicant,
  sendRejectionNotificationToApplicant,
  broadcastToAdmins,
  getAdminLineUserIds
} from "../../memberApprovalService";

interface MemberApplicationResult {
  success: boolean;
  error?: string;
}

export async function handleApplyMember(
  event: any,
  participantId: string,
  tenantId: string,
  accessToken: string,
  logPrefix: string
): Promise<MemberApplicationResult> {
  const userId = event.source.userId;
  if (!userId) {
    console.error(`${logPrefix} No userId in event`);
    return { success: false, error: "No user ID" };
  }

  const lineClient = new LineClient(accessToken);

  try {
    const { data: participant, error: participantError } = await supabaseAdmin
      .from("participants")
      .select("participant_id, full_name_th, nickname_th, phone, company, status, tenant_id, line_user_id, user_id")
      .eq("participant_id", participantId)
      .eq("tenant_id", tenantId)
      .single();

    if (participantError || !participant) {
      console.error(`${logPrefix} Participant not found:`, participantError);
      await lineClient.replyMessage(event.replyToken, {
        type: "text",
        text: "ไม่พบข้อมูลของคุณในระบบ กรุณาติดต่อผู้ดูแลระบบ"
      });
      return { success: false, error: "Participant not found" };
    }

    if (participant.line_user_id !== userId) {
      console.warn(`${logPrefix} Security: LINE user ${userId} attempted to apply as participant ${participantId} (owned by ${participant.line_user_id})`);
      await lineClient.replyMessage(event.replyToken, {
        type: "text",
        text: "ไม่สามารถดำเนินการได้ กรุณาติดต่อผู้ดูแลระบบ"
      });
      return { success: false, error: "Identity mismatch" };
    }

    if (participant.status === "member") {
      await lineClient.replyMessage(event.replyToken, {
        type: "text",
        text: "คุณเป็นสมาชิกอยู่แล้ว!"
      });
      return { success: true };
    }

    const { data: existingRequest } = await supabaseAdmin
      .from("chapter_join_requests")
      .select("request_id, status")
      .eq("participant_id", participantId)
      .eq("tenant_id", tenantId)
      .eq("status", "pending")
      .maybeSingle();

    if (existingRequest) {
      await lineClient.replyMessage(event.replyToken, {
        type: "text",
        text: "คุณมีคำขอสมัครสมาชิกที่รออนุมัติอยู่แล้ว\n\nกรุณารอการอนุมัติจากผู้ดูแลระบบ"
      });
      return { success: true };
    }

    const { data: tenant, error: tenantError } = await supabaseAdmin
      .from("tenants")
      .select("tenant_name")
      .eq("tenant_id", tenantId)
      .single();

    if (tenantError || !tenant) {
      console.error(`${logPrefix} Tenant not found:`, tenantError);
      return { success: false, error: "Tenant not found" };
    }

    const { error: insertError } = await supabaseAdmin
      .from("chapter_join_requests")
      .insert({
        tenant_id: tenantId,
        participant_id: participantId,
        user_id: participant.user_id || null,
        status: "pending",
        message: `สมัครผ่าน LINE: ${participant.full_name_th}`
      });

    if (insertError) {
      console.error(`${logPrefix} Error creating join request:`, insertError);
      await lineClient.replyMessage(event.replyToken, {
        type: "text",
        text: "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง"
      });
      return { success: false, error: "Failed to create request" };
    }

    console.log(`${logPrefix} Created join request for participant ${participantId}`);

    await lineClient.replyMessage(event.replyToken, {
      type: "text",
      text: `ส่งคำขอสมัครสมาชิกแล้ว!\n\nชื่อ: ${participant.full_name_th}\n\nกรุณารอการอนุมัติจากผู้ดูแลระบบ`
    });

    await notifyAdminsNewApplication(
      tenantId,
      {
        participant_id: participantId,
        full_name_th: participant.full_name_th,
        nickname_th: participant.nickname_th,
        phone: participant.phone,
        company: participant.company
      },
      tenant.tenant_name
    );

    return { success: true };

  } catch (error: any) {
    console.error(`${logPrefix} Error in handleApplyMember:`, error);
    return { success: false, error: error.message };
  }
}

export async function handleSkipApply(
  event: any,
  accessToken: string,
  logPrefix: string
): Promise<void> {
  const lineClient = new LineClient(accessToken);
  
  await lineClient.replyMessage(event.replyToken, {
    type: "text",
    text: "ไม่เป็นไร! เมื่อพร้อมสมัครสมาชิก สามารถพิมพ์ 'สมัครสมาชิก' ได้เลย"
  });
}

async function verifyAdminRole(lineUserId: string, tenantId: string): Promise<boolean> {
  const { data: adminParticipant, error: participantError } = await supabaseAdmin
    .from("participants")
    .select("user_id")
    .eq("line_user_id", lineUserId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (participantError || !adminParticipant?.user_id) {
    return false;
  }

  const { data: role, error: roleError } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", adminParticipant.user_id)
    .eq("tenant_id", tenantId)
    .eq("role", "chapter_admin")
    .maybeSingle();

  return !roleError && !!role;
}

async function getAdminName(lineUserId: string, tenantId: string): Promise<string> {
  const { data: admin } = await supabaseAdmin
    .from("participants")
    .select("full_name_th, nickname_th")
    .eq("line_user_id", lineUserId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  
  return admin?.nickname_th || admin?.full_name_th || "Admin";
}

export async function handleApproveMember(
  event: any,
  participantId: string,
  tenantId: string,
  accessToken: string,
  logPrefix: string
): Promise<MemberApplicationResult> {
  const adminLineUserId = event.source.userId;
  if (!adminLineUserId) {
    console.error(`${logPrefix} No admin userId in event`);
    return { success: false, error: "No admin user ID" };
  }

  const lineClient = new LineClient(accessToken);

  try {
    const isAdmin = await verifyAdminRole(adminLineUserId, tenantId);
    if (!isAdmin) {
      console.warn(`${logPrefix} Security: Non-admin LINE user ${adminLineUserId} attempted to approve member ${participantId}`);
      await lineClient.replyMessage(event.replyToken, {
        type: "text",
        text: "คุณไม่มีสิทธิ์ดำเนินการนี้"
      });
      return { success: false, error: "Not authorized" };
    }

    const result = await approveMember({
      participantId,
      tenantId
    });

    if (!result.success) {
      await lineClient.replyMessage(event.replyToken, {
        type: "text",
        text: result.error === "Participant not found" 
          ? "ไม่พบข้อมูลผู้สมัครในระบบ"
          : "เกิดข้อผิดพลาด กรุณาลองใหม่"
      });
      return result;
    }

    if (result.alreadyProcessed) {
      await lineClient.replyMessage(event.replyToken, {
        type: "text",
        text: result.participant?.full_name_th 
          ? `${result.participant.full_name_th} เป็นสมาชิกอยู่แล้ว หรือคำขอนี้ได้รับการดำเนินการแล้ว`
          : "คำขอนี้ได้รับการดำเนินการแล้ว"
      });
      return { success: true };
    }

    const adminName = await getAdminName(adminLineUserId, tenantId);
    const applicantName = result.participant?.nickname_th || result.participant?.full_name_th || "ผู้สมัคร";

    await lineClient.replyMessage(event.replyToken, {
      type: "text",
      text: `อนุมัติแล้ว!\n\n${applicantName} เป็นสมาชิกเรียบร้อย`
    });

    await broadcastToAdmins(
      tenantId,
      `${adminName} อนุมัติ ${applicantName} เป็นสมาชิกแล้ว`,
      adminLineUserId
    );

    if (result.participant?.line_user_id) {
      const { data: tenant } = await supabaseAdmin
        .from("tenants")
        .select("tenant_name")
        .eq("tenant_id", tenantId)
        .single();

      await sendApprovalNotificationToApplicant(
        tenantId,
        result.participant.line_user_id,
        tenant?.tenant_name || "Chapter"
      );
    }

    return { success: true };

  } catch (error: any) {
    console.error(`${logPrefix} Error in handleApproveMember:`, error);
    return { success: false, error: error.message };
  }
}

export async function handleRejectMember(
  event: any,
  participantId: string,
  tenantId: string,
  accessToken: string,
  logPrefix: string
): Promise<MemberApplicationResult> {
  const adminLineUserId = event.source.userId;
  if (!adminLineUserId) {
    console.error(`${logPrefix} No admin userId in event`);
    return { success: false, error: "No admin user ID" };
  }

  const lineClient = new LineClient(accessToken);

  try {
    const isAdmin = await verifyAdminRole(adminLineUserId, tenantId);
    if (!isAdmin) {
      console.warn(`${logPrefix} Security: Non-admin LINE user ${adminLineUserId} attempted to reject member ${participantId}`);
      await lineClient.replyMessage(event.replyToken, {
        type: "text",
        text: "คุณไม่มีสิทธิ์ดำเนินการนี้"
      });
      return { success: false, error: "Not authorized" };
    }

    const result = await rejectMember({
      participantId,
      tenantId
    });

    if (!result.success) {
      await lineClient.replyMessage(event.replyToken, {
        type: "text",
        text: result.error === "Participant not found"
          ? "ไม่พบข้อมูลผู้สมัครในระบบ"
          : "เกิดข้อผิดพลาด กรุณาลองใหม่"
      });
      return result;
    }

    if (result.alreadyProcessed) {
      await lineClient.replyMessage(event.replyToken, {
        type: "text",
        text: "คำขอนี้ได้รับการดำเนินการแล้ว"
      });
      return { success: true };
    }

    const adminName = await getAdminName(adminLineUserId, tenantId);
    const applicantName = result.participant?.nickname_th || result.participant?.full_name_th || "ผู้สมัคร";

    await lineClient.replyMessage(event.replyToken, {
      type: "text",
      text: `ปฏิเสธคำขอของ ${applicantName} เรียบร้อยแล้ว`
    });

    await broadcastToAdmins(
      tenantId,
      `${adminName} ปฏิเสธคำขอสมัครสมาชิกของ ${applicantName}`,
      adminLineUserId
    );

    if (result.participant?.line_user_id) {
      await sendRejectionNotificationToApplicant(tenantId, result.participant.line_user_id);
    }

    return { success: true };

  } catch (error: any) {
    console.error(`${logPrefix} Error in handleRejectMember:`, error);
    return { success: false, error: error.message };
  }
}
