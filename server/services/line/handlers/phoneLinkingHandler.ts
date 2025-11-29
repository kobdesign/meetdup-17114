import { supabaseAdmin } from "../../../utils/supabaseClient";
import { LineClient } from "../lineClient";
import { sendActivationLink } from "../../activation/sendActivationLink";

interface ConversationState {
  step: "awaiting_phone" | "idle";
  action: "link_line" | null;
  expiresAt: number;
}

const conversationStates = new Map<string, ConversationState>();
const CONVERSATION_TIMEOUT = 5 * 60 * 1000;

function getStatusLabel(status: string): string {
  const statusLabels: { [key: string]: string } = {
    "prospect": "🔵 Prospect",
    "visitor": "🟡 Visitor",
    "member": "🟢 Member",
    "alumni": "⚫ Alumni",
    "declined": "🔴 Declined"
  };
  return statusLabels[status] || status;
}

export async function startPhoneLinkingFlow(
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

  console.log(`${logPrefix} Starting phone linking flow for user: ${userId}`);

  const stateKey = `${tenantId}:${userId}`;
  conversationStates.set(stateKey, {
    step: "awaiting_phone",
    action: "link_line",
    expiresAt: Date.now() + CONVERSATION_TIMEOUT
  });

  const lineClient = new LineClient(accessToken);
  await lineClient.replyMessage(event.replyToken, {
    type: "text",
    text: "🔗 เชื่อมโยง LINE Account\n\n" +
          "กรุณาส่งเบอร์โทรศัพท์ที่คุณลงทะเบียนไว้\n\n" +
          "ตัวอย่าง: 0812345678\n\n" +
          "⏱️ คำสั่งนี้จะหมดอายุใน 5 นาที"
  });
}

export async function handlePhoneLinking(
  event: any,
  phoneText: string,
  tenantId: string,
  accessToken: string,
  logPrefix: string
): Promise<boolean> {
  const userId = event.source.userId;
  if (!userId) {
    console.error(`${logPrefix} No userId in event`);
    return false;
  }

  const lineClient = new LineClient(accessToken);

  const normalizedPhone = phoneText.replace(/\D/g, '');
  
  if (normalizedPhone.length < 9 || normalizedPhone.length > 15) {
    console.log(`${logPrefix} Invalid phone format, keeping conversation state for retry`);
    await lineClient.replyMessage(event.replyToken, {
      type: "text",
      text: "⚠️ เบอร์โทรศัพท์ไม่ถูกต้อง\n\nกรุณาส่งเบอร์โทรศัพท์ใหม่อีกครั้ง"
    });
    
    const stateKey = `${tenantId}:${userId}`;
    conversationStates.set(stateKey, {
      step: "awaiting_phone",
      action: "link_line",
      expiresAt: Date.now() + CONVERSATION_TIMEOUT
    });
    return false;
  }

  console.log(`${logPrefix} Looking up participant with phone: ${normalizedPhone}`);

  const { data: participant, error } = await supabaseAdmin
    .from("participants")
    .select("participant_id, full_name_th, line_user_id, user_id, status")
    .eq("tenant_id", tenantId)
    .eq("phone", normalizedPhone)
    .maybeSingle();

  if (error) {
    console.error(`${logPrefix} Database error:`, error);
    await lineClient.replyMessage(event.replyToken, {
      type: "text",
      text: "⚠️ เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง"
    });
    return false;
  }

  if (!participant) {
    console.log(`${logPrefix} Participant not found, keeping conversation state for retry`);
    await lineClient.replyMessage(event.replyToken, {
      type: "text",
      text: "❌ ไม่พบข้อมูลเบอร์โทรนี้ในระบบ\n\n" +
            "กรุณาตรวจสอบเบอร์และลองใหม่อีกครั้ง หรือติดต่อผู้ดูแลระบบ"
    });
    
    const stateKey = `${tenantId}:${userId}`;
    conversationStates.set(stateKey, {
      step: "awaiting_phone",
      action: "link_line",
      expiresAt: Date.now() + CONVERSATION_TIMEOUT
    });
    return false;
  }

  if (participant.line_user_id) {
    console.log(`${logPrefix} Participant already linked, clearing conversation state`);
    if (participant.line_user_id === userId) {
      await lineClient.replyMessage(event.replyToken, {
        type: "text",
        text: `✅ บัญชี LINE ของคุณเชื่อมโยงแล้ว\n\nชื่อ: ${participant.full_name_th}\nสถานะ: ${getStatusLabel(participant.status)}`
      });
      return true;
    } else {
      await lineClient.replyMessage(event.replyToken, {
        type: "text",
        text: "⚠️ เบอร์โทรนี้เชื่อมโยงกับ LINE account อื่นอยู่แล้ว\n\nกรุณาติดต่อผู้ดูแลระบบ"
      });
      return true;
    }
  }

  const { error: updateError } = await supabaseAdmin
    .from("participants")
    .update({ line_user_id: userId })
    .eq("participant_id", participant.participant_id)
    .eq("tenant_id", tenantId);

  if (updateError) {
    console.error(`${logPrefix} Error linking LINE:`, updateError);
    await lineClient.replyMessage(event.replyToken, {
      type: "text",
      text: "⚠️ ไม่สามารถเชื่อมโยงได้ กรุณาลองใหม่อีกครั้ง"
    });
    return false;
  }

  console.log(`${logPrefix} Successfully linked LINE User ID for participant: ${participant.participant_id}`);

  if (participant.user_id) {
    console.log(`${logPrefix} Participant already has account, sending welcome message`);
    await lineClient.replyMessage(event.replyToken, {
      type: "text",
      text: `✅ เชื่อมโยงสำเร็จ!\n\n` +
            `ชื่อ: ${participant.full_name_th}\n` +
            `สถานะ: ${getStatusLabel(participant.status)}\n\n` +
            `ตอนนี้คุณสามารถใช้งานผ่าน LINE ได้แล้ว 🎉`
    });
    return true;
  } else {
    console.log(`${logPrefix} Participant has no account, auto-sending activation link`);
    
    await lineClient.replyMessage(event.replyToken, {
      type: "text",
      text: `✅ เชื่อมโยงสำเร็จ!\n\nชื่อ: ${participant.full_name_th}\n\nกำลังส่งลิงก์ลงทะเบียนให้คุณ...`
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
      console.log(`${logPrefix} Successfully auto-sent activation link`);
    }
    return true;
  }
}

export function getConversationState(tenantId: string, userId: string): ConversationState | undefined {
  const stateKey = `${tenantId}:${userId}`;
  const state = conversationStates.get(stateKey);
  
  if (state && state.expiresAt > Date.now()) {
    return state;
  }
  
  if (state) {
    conversationStates.delete(stateKey);
  }
  
  return undefined;
}

export function clearConversationState(tenantId: string, userId: string): void {
  const stateKey = `${tenantId}:${userId}`;
  conversationStates.delete(stateKey);
}
