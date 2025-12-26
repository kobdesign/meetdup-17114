import { supabaseAdmin } from "../utils/supabaseClient";
import { getLineCredentials } from "./line/credentials";
import { LineClient } from "./line/lineClient";

export interface ApprovalResult {
  success: boolean;
  alreadyProcessed?: boolean;
  error?: string;
  participant?: {
    participant_id: string;
    full_name_th: string;
    nickname_th: string | null;
    line_user_id: string | null;
  };
}

export interface ApprovalOptions {
  participantId: string;
  tenantId: string;
  approvedBy?: string;
}

export async function getAdminLineUserIds(tenantId: string): Promise<string[]> {
  const { data: adminRoles, error: rolesError } = await supabaseAdmin
    .from("user_roles")
    .select("user_id")
    .eq("tenant_id", tenantId)
    .eq("role", "chapter_admin");

  if (rolesError || !adminRoles?.length) {
    console.log(`[MemberApproval] No admin roles found for tenant ${tenantId}`);
    return [];
  }

  const adminUserIds = adminRoles.map(r => r.user_id).filter(Boolean);
  
  if (adminUserIds.length === 0) {
    console.log(`[MemberApproval] No valid admin user IDs for tenant ${tenantId}`);
    return [];
  }

  const { data: adminParticipants, error: participantsError } = await supabaseAdmin
    .from("participants")
    .select("line_user_id")
    .eq("tenant_id", tenantId)
    .in("user_id", adminUserIds)
    .not("line_user_id", "is", null);

  if (participantsError || !adminParticipants?.length) {
    console.log(`[MemberApproval] No admin participants with LINE found for tenant ${tenantId}`);
    return [];
  }

  return adminParticipants
    .map(p => p.line_user_id)
    .filter((id): id is string => !!id);
}

export async function notifyAdminsNewApplication(
  tenantId: string,
  participant: {
    participant_id: string;
    full_name_th: string;
    nickname_th?: string | null;
    phone?: string | null;
    company?: string | null;
  },
  tenantName: string
): Promise<void> {
  const adminLineUserIds = await getAdminLineUserIds(tenantId);
  
  if (adminLineUserIds.length === 0) {
    console.log(`[MemberApproval] No admin LINE users to notify for tenant ${tenantId}`);
    return;
  }

  const credentials = await getLineCredentials(tenantId);
  if (!credentials?.channelAccessToken) {
    console.log(`[MemberApproval] No LINE credentials for tenant ${tenantId}`);
    return;
  }

  const lineClient = new LineClient(credentials.channelAccessToken);

  const adminFlexMessage = {
    type: "flex" as const,
    altText: `คำขอสมัครสมาชิกใหม่: ${participant.full_name_th}`,
    contents: {
      type: "bubble",
      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: "#1DB446",
        paddingAll: "md",
        contents: [
          {
            type: "text",
            text: "คำขอสมัครสมาชิกใหม่",
            color: "#FFFFFF",
            weight: "bold",
            size: "md"
          }
        ]
      },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        contents: [
          {
            type: "text",
            text: participant.full_name_th,
            weight: "bold",
            size: "lg"
          },
          {
            type: "box",
            layout: "vertical",
            spacing: "sm",
            contents: [
              ...(participant.nickname_th ? [{
                type: "text" as const,
                text: `ชื่อเล่น: ${participant.nickname_th}`,
                size: "sm" as const,
                color: "#666666"
              }] : []),
              ...(participant.phone ? [{
                type: "text" as const,
                text: `เบอร์โทร: ${participant.phone}`,
                size: "sm" as const,
                color: "#666666"
              }] : []),
              ...(participant.company ? [{
                type: "text" as const,
                text: `บริษัท: ${participant.company}`,
                size: "sm" as const,
                color: "#666666"
              }] : [])
            ]
          },
          {
            type: "text",
            text: tenantName,
            size: "xs",
            color: "#AAAAAA",
            margin: "md"
          }
        ]
      },
      footer: {
        type: "box",
        layout: "horizontal",
        spacing: "md",
        contents: [
          {
            type: "button",
            style: "primary",
            color: "#1DB446",
            action: {
              type: "postback",
              label: "อนุมัติ",
              data: `action=approve_member&participant_id=${participant.participant_id}&tenant_id=${tenantId}`
            }
          },
          {
            type: "button",
            style: "secondary",
            action: {
              type: "postback",
              label: "ปฏิเสธ",
              data: `action=reject_member&participant_id=${participant.participant_id}&tenant_id=${tenantId}`
            }
          }
        ]
      }
    }
  };

  console.log(`[MemberApproval] Notifying ${adminLineUserIds.length} admins about new application`);

  for (const adminLineUserId of adminLineUserIds) {
    try {
      await lineClient.pushMessage(adminLineUserId, adminFlexMessage);
      console.log(`[MemberApproval] Sent notification to admin: ${adminLineUserId}`);
    } catch (pushError) {
      console.error(`[MemberApproval] Failed to notify admin ${adminLineUserId}:`, pushError);
    }
  }
}

export async function approveMember(options: ApprovalOptions): Promise<ApprovalResult> {
  const { participantId, tenantId, approvedBy } = options;
  const logPrefix = `[MemberApproval][Approve]`;

  try {
    const { data: participant, error: participantError } = await supabaseAdmin
      .from("participants")
      .select("participant_id, full_name_th, nickname_th, line_user_id, status, user_id, joined_date")
      .eq("participant_id", participantId)
      .eq("tenant_id", tenantId)
      .single();

    if (participantError || !participant) {
      console.error(`${logPrefix} Participant not found:`, participantError);
      return { success: false, error: "Participant not found" };
    }

    if (participant.status === "member") {
      return { 
        success: true, 
        alreadyProcessed: true,
        participant: {
          participant_id: participant.participant_id,
          full_name_th: participant.full_name_th,
          nickname_th: participant.nickname_th,
          line_user_id: participant.line_user_id
        }
      };
    }

    const { data: updatedRequest, error: requestError } = await supabaseAdmin
      .from("chapter_join_requests")
      .update({ 
        status: "approved",
        ...(approvedBy ? { approved_by: approvedBy, approved_at: new Date().toISOString() } : {})
      })
      .eq("participant_id", participantId)
      .eq("tenant_id", tenantId)
      .eq("status", "pending")
      .select("request_id")
      .maybeSingle();

    if (requestError) {
      console.error(`${logPrefix} Error updating join request:`, requestError);
      return { success: false, error: "Database error" };
    }

    if (!updatedRequest) {
      return { success: true, alreadyProcessed: true, participant: {
        participant_id: participant.participant_id,
        full_name_th: participant.full_name_th,
        nickname_th: participant.nickname_th,
        line_user_id: participant.line_user_id
      }};
    }

    const updateData: { status: string; joined_date?: string } = { status: "member" };
    
    if (!participant.joined_date) {
      updateData.joined_date = new Date().toISOString().split('T')[0];
    }

    const { error: updateError } = await supabaseAdmin
      .from("participants")
      .update(updateData)
      .eq("participant_id", participantId)
      .eq("tenant_id", tenantId);

    if (updateError) {
      console.error(`${logPrefix} Error updating participant status:`, updateError);
      await supabaseAdmin
        .from("chapter_join_requests")
        .update({ status: "pending", approved_by: null, approved_at: null })
        .eq("request_id", updatedRequest.request_id);
      
      return { success: false, error: "Update failed" };
    }

    if (participant.user_id) {
      const { error: roleError } = await supabaseAdmin
        .from("user_roles")
        .upsert({
          user_id: participant.user_id,
          tenant_id: tenantId,
          role: "member",
        }, { onConflict: "user_id,tenant_id" });

      if (roleError) {
        console.error(`${logPrefix} Error upserting member role:`, roleError);
      }
    }

    console.log(`${logPrefix} Successfully approved member: ${participantId}`);

    return { 
      success: true, 
      participant: {
        participant_id: participant.participant_id,
        full_name_th: participant.full_name_th,
        nickname_th: participant.nickname_th,
        line_user_id: participant.line_user_id
      }
    };

  } catch (error: any) {
    console.error(`${logPrefix} Error:`, error);
    return { success: false, error: error.message };
  }
}

export async function rejectMember(options: ApprovalOptions): Promise<ApprovalResult> {
  const { participantId, tenantId, approvedBy } = options;
  const logPrefix = `[MemberApproval][Reject]`;

  try {
    const { data: participant, error: participantError } = await supabaseAdmin
      .from("participants")
      .select("participant_id, full_name_th, nickname_th, line_user_id")
      .eq("participant_id", participantId)
      .eq("tenant_id", tenantId)
      .single();

    if (participantError || !participant) {
      return { success: false, error: "Participant not found" };
    }

    const { data: updatedRequest, error: requestError } = await supabaseAdmin
      .from("chapter_join_requests")
      .update({ 
        status: "rejected",
        ...(approvedBy ? { approved_by: approvedBy, approved_at: new Date().toISOString() } : {})
      })
      .eq("participant_id", participantId)
      .eq("tenant_id", tenantId)
      .eq("status", "pending")
      .select("request_id")
      .maybeSingle();

    if (requestError) {
      console.error(`${logPrefix} Error updating join request:`, requestError);
      return { success: false, error: "Database error" };
    }

    if (!updatedRequest) {
      return { 
        success: true, 
        alreadyProcessed: true,
        participant: {
          participant_id: participant.participant_id,
          full_name_th: participant.full_name_th,
          nickname_th: participant.nickname_th,
          line_user_id: participant.line_user_id
        }
      };
    }

    console.log(`${logPrefix} Successfully rejected member: ${participantId}`);

    return { 
      success: true, 
      participant: {
        participant_id: participant.participant_id,
        full_name_th: participant.full_name_th,
        nickname_th: participant.nickname_th,
        line_user_id: participant.line_user_id
      }
    };

  } catch (error: any) {
    console.error(`${logPrefix} Error:`, error);
    return { success: false, error: error.message };
  }
}

export async function sendApprovalNotificationToApplicant(
  tenantId: string,
  lineUserId: string,
  tenantName: string
): Promise<void> {
  const credentials = await getLineCredentials(tenantId);
  if (!credentials?.channelAccessToken) return;

  const lineClient = new LineClient(credentials.channelAccessToken);

  const welcomeMessage = {
    type: "flex" as const,
    altText: "ยินดีต้อนรับเข้าเป็นสมาชิก!",
    contents: {
      type: "bubble",
      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        contents: [
          {
            type: "text",
            text: "ยินดีต้อนรับ!",
            weight: "bold",
            size: "xl",
            color: "#1DB446",
            align: "center"
          },
          {
            type: "separator",
            margin: "lg"
          },
          {
            type: "text",
            text: "คุณได้รับการอนุมัติเป็นสมาชิกแล้ว",
            size: "md",
            align: "center",
            margin: "lg"
          },
          {
            type: "text",
            text: tenantName,
            size: "lg",
            weight: "bold",
            align: "center",
            margin: "sm"
          },
          {
            type: "separator",
            margin: "lg"
          },
          {
            type: "text",
            text: "ตอนนี้คุณสามารถ:",
            size: "sm",
            margin: "lg",
            color: "#666666"
          },
          {
            type: "box",
            layout: "vertical",
            margin: "sm",
            spacing: "xs",
            contents: [
              {
                type: "text",
                text: "• เช็คอินเข้าประชุม",
                size: "sm",
                color: "#666666"
              },
              {
                type: "text",
                text: "• ส่งตัวแทนเข้าประชุม",
                size: "sm",
                color: "#666666"
              },
              {
                type: "text",
                text: "• รับการแจ้งเตือนต่างๆ",
                size: "sm",
                color: "#666666"
              }
            ]
          }
        ]
      }
    }
  };

  try {
    await lineClient.pushMessage(lineUserId, welcomeMessage);
    console.log(`[MemberApproval] Sent welcome message to: ${lineUserId}`);
  } catch (error) {
    console.error(`[MemberApproval] Failed to send welcome message:`, error);
  }
}

export async function sendRejectionNotificationToApplicant(
  tenantId: string,
  lineUserId: string
): Promise<void> {
  const credentials = await getLineCredentials(tenantId);
  if (!credentials?.channelAccessToken) return;

  const lineClient = new LineClient(credentials.channelAccessToken);

  try {
    await lineClient.pushMessage(lineUserId, {
      type: "text",
      text: "ขออภัย คำขอสมัครสมาชิกของคุณไม่ได้รับการอนุมัติ\n\nหากมีข้อสงสัย กรุณาติดต่อผู้ดูแลระบบ"
    });
    console.log(`[MemberApproval] Sent rejection message to: ${lineUserId}`);
  } catch (error) {
    console.error(`[MemberApproval] Failed to send rejection message:`, error);
  }
}

export async function broadcastToAdmins(
  tenantId: string,
  message: string,
  excludeLineUserId?: string
): Promise<void> {
  const adminLineUserIds = await getAdminLineUserIds(tenantId);
  
  if (adminLineUserIds.length === 0) return;

  const credentials = await getLineCredentials(tenantId);
  if (!credentials?.channelAccessToken) return;

  const lineClient = new LineClient(credentials.channelAccessToken);

  for (const adminId of adminLineUserIds) {
    if (adminId === excludeLineUserId) continue;
    
    try {
      await lineClient.pushMessage(adminId, {
        type: "text",
        text: message
      });
    } catch (error) {
      console.error(`[MemberApproval] Failed to broadcast to admin ${adminId}:`, error);
    }
  }
}
