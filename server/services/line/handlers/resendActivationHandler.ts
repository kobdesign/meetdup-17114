import { supabaseAdmin } from "../../../utils/supabaseClient";
import { LineClient } from "../lineClient";
import { startPhoneLinkingFlow } from "./phoneLinkingHandler";
import { sendActivationLink } from "../../activation/sendActivationLink";

function getStatusLabel(status: string): string {
  const statusMap: Record<string, string> = {
    prospect: "ผู้สนใจ",
    visitor: "ผู้เยี่ยมชม",
    member: "สมาชิก",
    alumni: "ศิษย์เก่า",
    declined: "ปฏิเสธ"
  };
  return statusMap[status] || status;
}

export async function handleResendActivation(
  event: any,
  tenantId: string,
  accessToken: string,
  logPrefix: string
): Promise<void> {
  const userId = event.source.userId;
  if (!userId) {
    console.error(`${logPrefix} No userId in event`);
    return;
  }

  const lineClient = new LineClient(accessToken);

  console.log(`${logPrefix} Looking up participant with LINE User ID: ${userId}`);

  const { data: participant, error } = await supabaseAdmin
    .from("participants")
    .select("participant_id, tenant_id, full_name_th, status, user_id, line_user_id")
    .eq("tenant_id", tenantId)
    .eq("line_user_id", userId)
    .maybeSingle();

  if (error) {
    console.error(`${logPrefix} Database error:`, error);
    await lineClient.replyMessage(event.replyToken, {
      type: "text",
      text: "⚠️ เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง"
    });
    return;
  }

  if (!participant) {
    console.log(`${logPrefix} No participant found with this LINE User ID - auto-starting phone linking flow`);
    // Auto-redirect to phone linking instead of showing message and waiting
    await startPhoneLinkingFlow(event, tenantId, accessToken, logPrefix);
    return;
  }

  if (participant.user_id) {
    console.log(`${logPrefix} Participant already has account, no activation needed`);
    await lineClient.replyMessage(event.replyToken, {
      type: "text",
      text: `✅ คุณลงทะเบียนเรียบร้อยแล้ว!\n\n` +
            `ชื่อ: ${participant.full_name_th}\n` +
            `สถานะ: ${getStatusLabel(participant.status)}\n\n` +
            `ไม่ต้องทำซ้ำนะครับ 😊`
    });
    return;
  }

  console.log(`${logPrefix} Participant has no account, sending activation link`);
  
  await lineClient.replyMessage(event.replyToken, {
    type: "text",
    text: `📤 กำลังส่งลิงก์ลงทะเบียนให้คุณ...\n\nชื่อ: ${participant.full_name_th}`
  });

  const result = await sendActivationLink({
    participantId: participant.participant_id,
    tenantId: tenantId,
    lineUserId: userId,
    fullName: participant.full_name_th,
    logPrefix
  });

  if (!result.success) {
    console.error(`${logPrefix} Failed to send activation link:`, result.error);
    await lineClient.pushMessage(userId, {
      type: "text",
      text: "⚠️ เกิดข้อผิดพลาดในการส่งลิงก์ลงทะเบียน\n\nกรุณาติดต่อผู้ดูแลระบบ"
    });
  } else {
    console.log(`${logPrefix} Successfully sent activation link`);
  }
}
