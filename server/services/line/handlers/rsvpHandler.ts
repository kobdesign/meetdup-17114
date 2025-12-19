import { supabaseAdmin } from "../../../utils/supabaseClient";
import { LineClient } from "../lineClient";
import { createRsvpConfirmationFlex } from "../templates/eventNotificationTemplate";
import { generateSubstituteToken } from "../../../utils/profileToken";
import { getLineCredentials } from "../credentials";

interface ConversationState {
  step: "awaiting_leave_reason";
  action: "rsvp_leave";
  meetingId: string;
  expiresAt: number;
}

const leaveConversationStates = new Map<string, ConversationState>();
const CONVERSATION_TIMEOUT = 5 * 60 * 1000;

export function getLeaveConversationState(tenantId: string, lineUserId: string): ConversationState | undefined {
  const stateKey = `${tenantId}:${lineUserId}`;
  const state = leaveConversationStates.get(stateKey);
  
  if (state && Date.now() > state.expiresAt) {
    leaveConversationStates.delete(stateKey);
    return undefined;
  }
  
  return state;
}

export function clearLeaveConversationState(tenantId: string, lineUserId: string): void {
  const stateKey = `${tenantId}:${lineUserId}`;
  leaveConversationStates.delete(stateKey);
}

export async function handleRsvpConfirm(
  event: any,
  meetingId: string,
  tenantId: string,
  accessToken: string,
  logPrefix: string
): Promise<void> {
  const lineUserId = event.source.userId;
  if (!lineUserId) return;

  const lineClient = new LineClient(accessToken);

  try {
    const { data: participant, error: participantError } = await supabaseAdmin
      .from("participants")
      .select("participant_id, full_name_th")
      .eq("line_user_id", lineUserId)
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (participantError || !participant) {
      console.error(`${logPrefix} Participant not found for RSVP`);
      await lineClient.replyMessage(event.replyToken, {
        type: "text",
        text: "ไม่พบข้อมูลของคุณในระบบ กรุณาติดต่อผู้ดูแล"
      });
      return;
    }

    const { data: meeting } = await supabaseAdmin
      .from("meetings")
      .select("meeting_date, theme")
      .eq("meeting_id", meetingId)
      .single();

    if (!meeting) {
      await lineClient.replyMessage(event.replyToken, {
        type: "text",
        text: "ไม่พบข้อมูล Meeting นี้"
      });
      return;
    }

    const { error: upsertError } = await supabaseAdmin
      .from("meeting_rsvp")
      .upsert({
        tenant_id: tenantId,
        meeting_id: meetingId,
        participant_id: participant.participant_id,
        rsvp_status: "confirmed",
        responded_at: new Date().toISOString(),
        responded_via: "line"
      }, { onConflict: "meeting_id,participant_id" });

    if (upsertError) {
      console.error(`${logPrefix} RSVP upsert error:`, upsertError);
      await lineClient.replyMessage(event.replyToken, {
        type: "text",
        text: "เกิดข้อผิดพลาด กรุณาลองใหม่"
      });
      return;
    }

    console.log(`${logPrefix} RSVP confirmed for participant: ${participant.participant_id}`);

    const confirmFlex = createRsvpConfirmationFlex({
      action: 'confirmed',
      meetingDate: meeting.meeting_date,
      theme: meeting.theme,
      memberName: participant.full_name_th
    });

    await lineClient.replyMessage(event.replyToken, confirmFlex);

  } catch (error) {
    console.error(`${logPrefix} RSVP confirm error:`, error);
    await lineClient.replyMessage(event.replyToken, {
      type: "text",
      text: "เกิดข้อผิดพลาด กรุณาลองใหม่"
    });
  }
}

export async function handleRsvpSubstitute(
  event: any,
  meetingId: string,
  tenantId: string,
  accessToken: string,
  logPrefix: string
): Promise<void> {
  const lineUserId = event.source.userId;
  if (!lineUserId) return;

  const lineClient = new LineClient(accessToken);

  try {
    const { data: participant } = await supabaseAdmin
      .from("participants")
      .select("participant_id, full_name_th")
      .eq("line_user_id", lineUserId)
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (!participant) {
      await lineClient.replyMessage(event.replyToken, {
        type: "text",
        text: "ไม่พบข้อมูลของคุณในระบบ กรุณาติดต่อผู้ดูแล"
      });
      return;
    }

    const token = generateSubstituteToken(
      participant.participant_id,
      tenantId,
      meetingId
    );

    const baseUrl = process.env.REPLIT_DOMAINS 
      ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}`
      : process.env.APP_URL || 'https://meetdup.replit.app';

    const substituteUrl = `${baseUrl}/liff/substitute?token=${encodeURIComponent(token)}`;

    const { error: upsertError } = await supabaseAdmin
      .from("meeting_rsvp")
      .upsert({
        tenant_id: tenantId,
        meeting_id: meetingId,
        participant_id: participant.participant_id,
        rsvp_status: "declined",
        responded_at: new Date().toISOString(),
        responded_via: "line"
      }, { onConflict: "meeting_id,participant_id" });

    if (upsertError) {
      console.error(`${logPrefix} RSVP upsert error for substitute:`, upsertError);
    }

    console.log(`${logPrefix} RSVP substitute requested for participant: ${participant.participant_id}`);

    await lineClient.replyMessage(event.replyToken, {
      type: "flex",
      altText: "ลงทะเบียนตัวแทน",
      contents: {
        type: "bubble",
        size: "kilo",
        header: {
          type: "box",
          layout: "vertical",
          backgroundColor: "#FFB347",
          paddingAll: "12px",
          contents: [
            {
              type: "text",
              text: "ลงทะเบียนตัวแทน",
              color: "#FFFFFF",
              size: "md",
              weight: "bold",
              align: "center"
            }
          ]
        },
        body: {
          type: "box",
          layout: "vertical",
          paddingAll: "15px",
          contents: [
            {
              type: "text",
              text: "กรุณากรอกข้อมูลตัวแทนของคุณ",
              size: "sm",
              wrap: true,
              align: "center"
            }
          ]
        },
        footer: {
          type: "box",
          layout: "vertical",
          paddingAll: "12px",
          contents: [
            {
              type: "button",
              style: "primary",
              color: "#FFB347",
              action: {
                type: "uri",
                label: "กรอกข้อมูลตัวแทน",
                uri: substituteUrl
              }
            }
          ]
        }
      }
    });

  } catch (error) {
    console.error(`${logPrefix} RSVP substitute error:`, error);
    await lineClient.replyMessage(event.replyToken, {
      type: "text",
      text: "เกิดข้อผิดพลาด กรุณาลองใหม่"
    });
  }
}

export async function handleRsvpLeave(
  event: any,
  meetingId: string,
  tenantId: string,
  accessToken: string,
  logPrefix: string
): Promise<void> {
  const lineUserId = event.source.userId;
  if (!lineUserId) return;

  const lineClient = new LineClient(accessToken);

  try {
    const { data: participant } = await supabaseAdmin
      .from("participants")
      .select("participant_id, full_name_th")
      .eq("line_user_id", lineUserId)
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (!participant) {
      await lineClient.replyMessage(event.replyToken, {
        type: "text",
        text: "ไม่พบข้อมูลของคุณในระบบ กรุณาติดต่อผู้ดูแล"
      });
      return;
    }

    const stateKey = `${tenantId}:${lineUserId}`;
    leaveConversationStates.set(stateKey, {
      step: "awaiting_leave_reason",
      action: "rsvp_leave",
      meetingId,
      expiresAt: Date.now() + CONVERSATION_TIMEOUT
    });

    console.log(`${logPrefix} Starting leave flow for participant: ${participant.participant_id}`);

    await lineClient.replyMessage(event.replyToken, {
      type: "text",
      text: `กรุณาเลือกหรือพิมพ์เหตุผลในการลา\n\n(หมดเวลาใน 5 นาที)`,
      quickReply: {
        items: [
          {
            type: "action",
            action: {
              type: "message",
              label: "ติดประชุมงาน",
              text: "ติดประชุมงาน"
            }
          },
          {
            type: "action",
            action: {
              type: "message",
              label: "ธุระส่วนตัว",
              text: "ธุระส่วนตัว"
            }
          },
          {
            type: "action",
            action: {
              type: "message",
              label: "ไม่สบาย",
              text: "ไม่สบาย"
            }
          },
          {
            type: "action",
            action: {
              type: "message",
              label: "ติดงานด่วน",
              text: "ติดงานด่วน"
            }
          },
          {
            type: "action",
            action: {
              type: "message",
              label: "เดินทางต่างจังหวัด",
              text: "เดินทางต่างจังหวัด"
            }
          }
        ]
      }
    });

  } catch (error) {
    console.error(`${logPrefix} RSVP leave error:`, error);
    await lineClient.replyMessage(event.replyToken, {
      type: "text",
      text: "เกิดข้อผิดพลาด กรุณาลองใหม่"
    });
  }
}

export async function handleLeaveReason(
  event: any,
  reason: string,
  tenantId: string,
  accessToken: string,
  logPrefix: string
): Promise<boolean> {
  const lineUserId = event.source.userId;
  if (!lineUserId) return false;

  const lineClient = new LineClient(accessToken);
  const state = getLeaveConversationState(tenantId, lineUserId);

  if (!state) {
    return false;
  }

  try {
    const { data: participant } = await supabaseAdmin
      .from("participants")
      .select("participant_id, full_name_th")
      .eq("line_user_id", lineUserId)
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (!participant) {
      await lineClient.replyMessage(event.replyToken, {
        type: "text",
        text: "ไม่พบข้อมูลของคุณในระบบ"
      });
      clearLeaveConversationState(tenantId, lineUserId);
      return true;
    }

    const { data: meeting } = await supabaseAdmin
      .from("meetings")
      .select("meeting_date, theme")
      .eq("meeting_id", state.meetingId)
      .single();

    const { error: upsertError } = await supabaseAdmin
      .from("meeting_rsvp")
      .upsert({
        tenant_id: tenantId,
        meeting_id: state.meetingId,
        participant_id: participant.participant_id,
        rsvp_status: "leave",
        leave_reason: reason.trim(),
        responded_at: new Date().toISOString(),
        responded_via: "line"
      }, { onConflict: "meeting_id,participant_id" });

    if (upsertError) {
      console.error(`${logPrefix} Leave upsert error:`, upsertError);
      await lineClient.replyMessage(event.replyToken, {
        type: "text",
        text: "เกิดข้อผิดพลาด กรุณาลองใหม่"
      });
      return true;
    }

    clearLeaveConversationState(tenantId, lineUserId);

    console.log(`${logPrefix} Leave recorded for participant: ${participant.participant_id}, reason: ${reason}`);

    const confirmFlex = createRsvpConfirmationFlex({
      action: 'leave',
      meetingDate: meeting?.meeting_date || '',
      theme: meeting?.theme || '',
      memberName: participant.full_name_th,
      leaveReason: reason.trim()
    });

    await lineClient.replyMessage(event.replyToken, confirmFlex);

    await notifyAdminsAboutLeave(tenantId, participant, state.meetingId, reason, meeting, logPrefix);

    return true;

  } catch (error) {
    console.error(`${logPrefix} Leave reason error:`, error);
    await lineClient.replyMessage(event.replyToken, {
      type: "text",
      text: "เกิดข้อผิดพลาด กรุณาลองใหม่"
    });
    return true;
  }
}

async function notifyAdminsAboutLeave(
  tenantId: string,
  participant: { participant_id: string; full_name_th: string },
  meetingId: string,
  reason: string,
  meeting: { meeting_date: string; theme: string } | null,
  logPrefix: string
): Promise<void> {
  try {
    const { data: admins } = await supabaseAdmin
      .from("user_roles")
      .select(`
        user_id,
        participant:participants!user_roles_participant_id_fkey(line_user_id, full_name_th)
      `)
      .eq("tenant_id", tenantId)
      .in("role", ["chapter_admin", "super_admin"]);

    if (!admins || admins.length === 0) return;

    const lineCredentials = await getLineCredentials(tenantId);
    if (!lineCredentials) {
      console.error(`${logPrefix} LINE credentials not found for tenant`);
      return;
    }

    const lineClient = new LineClient(lineCredentials.channelAccessToken);

    const dateStr = meeting?.meeting_date 
      ? new Date(meeting.meeting_date).toLocaleDateString('th-TH', { 
          weekday: 'short', month: 'short', day: 'numeric' 
        })
      : 'N/A';

    const message = {
      type: "text" as const,
      text: `แจ้งลา Meeting\n\nสมาชิก: ${participant.full_name_th}\nวันที่: ${dateStr}\nเหตุผล: ${reason}`
    };

    for (const admin of admins) {
      const adminLineId = (admin.participant as any)?.line_user_id;
      if (adminLineId) {
        try {
          await lineClient.pushMessage(adminLineId, message);
          console.log(`${logPrefix} Notified admin: ${adminLineId}`);
        } catch (pushError) {
          console.error(`${logPrefix} Failed to notify admin:`, pushError);
        }
      }
    }

  } catch (error) {
    console.error(`${logPrefix} Error notifying admins:`, error);
  }
}
