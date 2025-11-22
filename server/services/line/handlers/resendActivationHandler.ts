import { supabaseAdmin } from "../../../utils/supabaseClient";
import { LineClient } from "../lineClient";

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
    .select("participant_id, tenant_id, full_name, status, user_id, line_user_id")
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
    console.log(`${logPrefix} No participant found with this LINE User ID`);
    await lineClient.replyMessage(event.replyToken, {
      type: "text",
      text: "❌ คุณยังไม่ได้เชื่อมโยง LINE\n\n" +
            "กรุณาพิมพ์ \"ลงทะเบียน\" เพื่อเชื่อมโยงบัญชี LINE ของคุณก่อนนะครับ"
    });
    return;
  }

  if (participant.user_id) {
    console.log(`${logPrefix} Participant already has account, no activation needed`);
    await lineClient.replyMessage(event.replyToken, {
      type: "text",
      text: `✅ คุณลงทะเบียนเรียบร้อยแล้ว!\n\n` +
            `ชื่อ: ${participant.full_name}\n` +
            `สถานะ: ${getStatusLabel(participant.status)}\n\n` +
            `ไม่ต้องทำซ้ำนะครับ 😊`
    });
    return;
  }

  console.log(`${logPrefix} Participant has no account, sending activation link`);
  
  await lineClient.replyMessage(event.replyToken, {
    type: "text",
    text: `📤 กำลังส่งลิงก์ลงทะเบียนให้คุณ...\n\nชื่อ: ${participant.full_name}`
  });

  try {
    const baseUrl = process.env.REPLIT_DEV_DOMAIN 
      ? `https://${process.env.REPLIT_DEV_DOMAIN}` 
      : "http://localhost:5000";
    const internalSecret = process.env.INTERNAL_API_SECRET;
    
    if (!internalSecret) {
      console.error(`${logPrefix} Missing INTERNAL_API_SECRET env var`);
      throw new Error("Missing INTERNAL_API_SECRET");
    }

    const response = await fetch(`${baseUrl}/api/participants/send-activation-auto`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "x-internal-secret": internalSecret
      },
      body: JSON.stringify({
        participant_id: participant.participant_id,
        tenant_id: tenantId,
        line_user_id: userId,
        full_name: participant.full_name
      })
    });

    const responseData = await response.json();
    
    if (!response.ok) {
      console.error(`${logPrefix} Failed to send activation link:`, responseData);
      
      await lineClient.pushMessage(userId, {
        type: "text",
        text: "⚠️ เกิดข้อผิดพลาดในการส่งลิงก์ลงทะเบียน\n\nกรุณาติดต่อผู้ดูแลระบบ"
      });
    } else {
      console.log(`${logPrefix} Successfully sent activation link`);
    }
  } catch (err) {
    console.error(`${logPrefix} Error calling activation API:`, err);
    await lineClient.pushMessage(userId, {
      type: "text",
      text: "⚠️ เกิดข้อผิดพลาดในการส่งลิงก์ลงทะเบียน\n\nกรุณาติดต่อผู้ดูแลระบบ"
    });
  }
}
