import { supabaseAdmin } from "../../../utils/supabaseClient";
import { LineClient } from "../lineClient";
import { getLineCredentials } from "../credentials";

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
        text: "⚠️ ไม่พบข้อมูลของคุณในระบบ กรุณาติดต่อผู้ดูแลระบบ"
      });
      return { success: false, error: "Participant not found" };
    }

    // Security: Verify the LINE user matches the participant's linked account
    if (participant.line_user_id !== userId) {
      console.warn(`${logPrefix} Security: LINE user ${userId} attempted to apply as participant ${participantId} (owned by ${participant.line_user_id})`);
      await lineClient.replyMessage(event.replyToken, {
        type: "text",
        text: "⚠️ ไม่สามารถดำเนินการได้ กรุณาติดต่อผู้ดูแลระบบ"
      });
      return { success: false, error: "Identity mismatch" };
    }

    if (participant.status === "member") {
      await lineClient.replyMessage(event.replyToken, {
        type: "text",
        text: "✅ คุณเป็นสมาชิกอยู่แล้ว!"
      });
      return { success: true };
    }

    // Check if there's already a pending request for this participant
    const { data: existingRequest, error: existingError } = await supabaseAdmin
      .from("chapter_join_requests")
      .select("request_id, status")
      .eq("participant_id", participantId)
      .eq("tenant_id", tenantId)
      .eq("status", "pending")
      .maybeSingle();

    if (existingRequest) {
      await lineClient.replyMessage(event.replyToken, {
        type: "text",
        text: "📋 คุณมีคำขอสมัครสมาชิกที่รออนุมัติอยู่แล้ว\n\nกรุณารอการอนุมัติจากผู้ดูแลระบบ"
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

    // Create join request record in database
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
        text: "⚠️ เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง"
      });
      return { success: false, error: "Failed to create request" };
    }

    console.log(`${logPrefix} Created join request for participant ${participantId}`);

    // Notify admins via LINE (without approve/reject buttons - they use web UI)
    const { data: admins, error: adminsError } = await supabaseAdmin
      .from("user_roles")
      .select(`
        user_id,
        participants!inner (
          line_user_id,
          full_name_th
        )
      `)
      .eq("tenant_id", tenantId)
      .eq("role", "chapter_admin");

    if (adminsError) {
      console.error(`${logPrefix} Error fetching admins:`, adminsError);
    }

    const adminLineUserIds: string[] = [];
    if (admins) {
      for (const admin of admins) {
        const participants = admin.participants as any;
        if (Array.isArray(participants)) {
          for (const p of participants) {
            if (p.line_user_id) {
              adminLineUserIds.push(p.line_user_id);
            }
          }
        } else if (participants?.line_user_id) {
          adminLineUserIds.push(participants.line_user_id);
        }
      }
    }

    console.log(`${logPrefix} Found ${adminLineUserIds.length} admin LINE users to notify`);

    // Reply to applicant
    await lineClient.replyMessage(event.replyToken, {
      type: "text",
      text: `📨 ส่งคำขอสมัครสมาชิกแล้ว!\n\nชื่อ: ${participant.full_name_th}\n\nกรุณารอการอนุมัติจากผู้ดูแลระบบ`
    });

    // Send notification to admins with approve/reject buttons
    if (adminLineUserIds.length > 0) {
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
                text: tenant.tenant_name,
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
                  data: `action=approve_member&participant_id=${participantId}&tenant_id=${tenantId}`
                }
              },
              {
                type: "button",
                style: "secondary",
                action: {
                  type: "postback",
                  label: "ปฏิเสธ",
                  data: `action=reject_member&participant_id=${participantId}&tenant_id=${tenantId}`
                }
              }
            ]
          }
        }
      };

      for (const adminLineUserId of adminLineUserIds) {
        try {
          await lineClient.pushMessage(adminLineUserId, adminFlexMessage);
          console.log(`${logPrefix} Sent member application notification to admin: ${adminLineUserId}`);
        } catch (pushError) {
          console.error(`${logPrefix} Failed to notify admin ${adminLineUserId}:`, pushError);
        }
      }
    } else {
      console.log(`${logPrefix} No admin LINE users found to notify`);
    }

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
    text: "👍 ไม่เป็นไร! เมื่อพร้อมสมัครสมาชิก สามารถพิมพ์ 'สมัครสมาชิก' ได้เลย"
  });
}

async function verifyAdminRole(lineUserId: string, tenantId: string): Promise<boolean> {
  // Find participant by LINE user ID
  const { data: adminParticipant, error: participantError } = await supabaseAdmin
    .from("participants")
    .select("user_id")
    .eq("line_user_id", lineUserId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (participantError || !adminParticipant?.user_id) {
    return false;
  }

  // Check if user has admin role
  const { data: role, error: roleError } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", adminParticipant.user_id)
    .eq("tenant_id", tenantId)
    .eq("role", "chapter_admin")
    .maybeSingle();

  return !roleError && !!role;
}

async function getAdminLineUserIds(tenantId: string): Promise<string[]> {
  const { data: admins } = await supabaseAdmin
    .from("user_roles")
    .select(`
      user_id,
      participants!inner (
        line_user_id,
        full_name_th
      )
    `)
    .eq("tenant_id", tenantId)
    .eq("role", "chapter_admin");

  const adminLineUserIds: string[] = [];
  if (admins) {
    for (const admin of admins) {
      const participants = admin.participants as any;
      if (Array.isArray(participants)) {
        for (const p of participants) {
          if (p.line_user_id) {
            adminLineUserIds.push(p.line_user_id);
          }
        }
      } else if (participants?.line_user_id) {
        adminLineUserIds.push(participants.line_user_id);
      }
    }
  }
  return adminLineUserIds;
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
    // Security: Verify caller is a chapter admin
    const isAdmin = await verifyAdminRole(adminLineUserId, tenantId);
    if (!isAdmin) {
      console.warn(`${logPrefix} Security: Non-admin LINE user ${adminLineUserId} attempted to approve member ${participantId}`);
      await lineClient.replyMessage(event.replyToken, {
        type: "text",
        text: "คุณไม่มีสิทธิ์ดำเนินการนี้"
      });
      return { success: false, error: "Not authorized" };
    }

    // Race condition protection: Check and update chapter_join_requests atomically
    const { data: pendingRequest, error: requestError } = await supabaseAdmin
      .from("chapter_join_requests")
      .select("request_id, status")
      .eq("participant_id", participantId)
      .eq("tenant_id", tenantId)
      .eq("status", "pending")
      .maybeSingle();

    if (requestError) {
      console.error(`${logPrefix} Error checking join request:`, requestError);
    }

    if (!pendingRequest) {
      // Already processed by another admin
      await lineClient.replyMessage(event.replyToken, {
        type: "text",
        text: "คำขอนี้ได้รับการดำเนินการแล้ว"
      });
      return { success: true };
    }

    // Update request status to approved
    await supabaseAdmin
      .from("chapter_join_requests")
      .update({ 
        status: "approved",
        reviewed_at: new Date().toISOString()
      })
      .eq("request_id", pendingRequest.request_id);

    const { data: participant, error: participantError } = await supabaseAdmin
      .from("participants")
      .select("participant_id, full_name_th, nickname_th, line_user_id, status, tenant_id")
      .eq("participant_id", participantId)
      .eq("tenant_id", tenantId)
      .single();

    if (participantError || !participant) {
      console.error(`${logPrefix} Participant not found:`, participantError);
      await lineClient.replyMessage(event.replyToken, {
        type: "text",
        text: "ไม่พบข้อมูลผู้สมัครในระบบ"
      });
      return { success: false, error: "Participant not found" };
    }

    if (participant.status === "member") {
      await lineClient.replyMessage(event.replyToken, {
        type: "text",
        text: `${participant.full_name_th} เป็นสมาชิกอยู่แล้ว`
      });
      return { success: true };
    }

    const { error: updateError } = await supabaseAdmin
      .from("participants")
      .update({ 
        status: "member",
        joined_date: new Date().toISOString().split('T')[0]
      })
      .eq("participant_id", participantId)
      .eq("tenant_id", tenantId);

    if (updateError) {
      console.error(`${logPrefix} Error updating participant status:`, updateError);
      await lineClient.replyMessage(event.replyToken, {
        type: "text",
        text: "เกิดข้อผิดพลาดในการอนุมัติ กรุณาลองใหม่"
      });
      return { success: false, error: "Update failed" };
    }

    console.log(`${logPrefix} Successfully approved member: ${participantId}`);

    // Get admin name and tenant info
    const adminName = await getAdminName(adminLineUserId, tenantId);
    const { data: tenant } = await supabaseAdmin
      .from("tenants")
      .select("tenant_name")
      .eq("tenant_id", tenantId)
      .single();

    const applicantName = participant.nickname_th || participant.full_name_th;

    // Reply to the approving admin
    await lineClient.replyMessage(event.replyToken, {
      type: "text",
      text: `อนุมัติแล้ว!\n\n${applicantName} เป็นสมาชิกเรียบร้อย`
    });

    // Broadcast to all admins
    const adminLineUserIds = await getAdminLineUserIds(tenantId);
    const broadcastMessage = {
      type: "text" as const,
      text: `${adminName} อนุมัติ ${applicantName} เป็นสมาชิกแล้ว`
    };

    for (const adminId of adminLineUserIds) {
      if (adminId !== adminLineUserId) {
        try {
          await lineClient.pushMessage(adminId, broadcastMessage);
        } catch (pushError) {
          console.error(`${logPrefix} Failed to notify admin ${adminId}:`, pushError);
        }
      }
    }

    // Send welcome message to new member
    if (participant.line_user_id) {
      try {
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
                  text: tenant?.tenant_name || "Chapter",
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

        await lineClient.pushMessage(participant.line_user_id, welcomeMessage);
        console.log(`${logPrefix} Sent welcome message to new member: ${participant.line_user_id}`);
      } catch (pushError) {
        console.error(`${logPrefix} Failed to send welcome message:`, pushError);
      }
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
    // Security: Verify caller is a chapter admin
    const isAdmin = await verifyAdminRole(adminLineUserId, tenantId);
    if (!isAdmin) {
      console.warn(`${logPrefix} Security: Non-admin LINE user ${adminLineUserId} attempted to reject member ${participantId}`);
      await lineClient.replyMessage(event.replyToken, {
        type: "text",
        text: "คุณไม่มีสิทธิ์ดำเนินการนี้"
      });
      return { success: false, error: "Not authorized" };
    }

    // Race condition protection: Check and update chapter_join_requests atomically
    const { data: pendingRequest, error: requestError } = await supabaseAdmin
      .from("chapter_join_requests")
      .select("request_id, status")
      .eq("participant_id", participantId)
      .eq("tenant_id", tenantId)
      .eq("status", "pending")
      .maybeSingle();

    if (requestError) {
      console.error(`${logPrefix} Error checking join request:`, requestError);
    }

    if (!pendingRequest) {
      // Already processed by another admin
      await lineClient.replyMessage(event.replyToken, {
        type: "text",
        text: "คำขอนี้ได้รับการดำเนินการแล้ว"
      });
      return { success: true };
    }

    // Update request status to rejected
    await supabaseAdmin
      .from("chapter_join_requests")
      .update({ 
        status: "rejected",
        reviewed_at: new Date().toISOString()
      })
      .eq("request_id", pendingRequest.request_id);

    const { data: participant, error: participantError } = await supabaseAdmin
      .from("participants")
      .select("participant_id, full_name_th, nickname_th, line_user_id")
      .eq("participant_id", participantId)
      .eq("tenant_id", tenantId)
      .single();

    if (participantError || !participant) {
      await lineClient.replyMessage(event.replyToken, {
        type: "text",
        text: "ไม่พบข้อมูลผู้สมัครในระบบ"
      });
      return { success: false, error: "Participant not found" };
    }

    const applicantName = participant.nickname_th || participant.full_name_th;
    const adminName = await getAdminName(adminLineUserId, tenantId);

    console.log(`${logPrefix} Rejected member application: ${participantId}`);

    // Reply to the rejecting admin
    await lineClient.replyMessage(event.replyToken, {
      type: "text",
      text: `ปฏิเสธคำขอของ ${applicantName} แล้ว`
    });

    // Broadcast to all admins
    const adminLineUserIds = await getAdminLineUserIds(tenantId);
    const broadcastMessage = {
      type: "text" as const,
      text: `${adminName} ปฏิเสธคำขอสมาชิกของ ${applicantName}`
    };

    for (const adminId of adminLineUserIds) {
      if (adminId !== adminLineUserId) {
        try {
          await lineClient.pushMessage(adminId, broadcastMessage);
        } catch (pushError) {
          console.error(`${logPrefix} Failed to notify admin ${adminId}:`, pushError);
        }
      }
    }

    // Notify the rejected applicant
    if (participant.line_user_id) {
      try {
        await lineClient.pushMessage(participant.line_user_id, {
          type: "text",
          text: "ขออภัย คำขอสมัครสมาชิกของคุณไม่ผ่านการพิจารณา\n\nหากมีข้อสงสัย กรุณาติดต่อผู้ดูแลระบบ"
        });
      } catch (pushError) {
        console.error(`${logPrefix} Failed to notify rejected member:`, pushError);
      }
    }

    return { success: true };

  } catch (error: any) {
    console.error(`${logPrefix} Error in handleRejectMember:`, error);
    return { success: false, error: error.message };
  }
}
