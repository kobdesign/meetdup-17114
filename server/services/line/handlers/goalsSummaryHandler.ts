import { LineClient } from "../lineClient";
import { supabaseAdmin } from "../../../utils/supabaseClient";
import { getChapterAdminsWithLine } from "../../goals/achievementNotification";
import { buildProgressSummaryFlexMessage, getActiveGoalsForTenant } from "../../goals/progressSummary";

async function checkIsAdmin(tenantId: string, lineUserId: string): Promise<boolean> {
  const adminsWithLine = await getChapterAdminsWithLine(tenantId);
  if (adminsWithLine.some(admin => admin.line_user_id === lineUserId)) {
    return true;
  }
  
  const { data: participant } = await supabaseAdmin
    .from("participants")
    .select("participant_id, user_id")
    .eq("tenant_id", tenantId)
    .eq("line_user_id", lineUserId)
    .single();
  
  if (!participant?.user_id) return false;
  
  const { data: userRole } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", participant.user_id)
    .eq("tenant_id", tenantId)
    .in("role", ["chapter_admin", "super_admin"])
    .single();
  
  return !!userRole;
}

export async function handleGoalsSummaryRequest(
  event: any,
  tenantId: string,
  accessToken: string,
  logPrefix: string
): Promise<void> {
  const lineClient = new LineClient(accessToken);
  const userId = event.source.userId;
  const replyToken = event.replyToken;

  if (!userId) {
    console.log(`${logPrefix} No userId found for goals summary request`);
    return;
  }

  try {
    const isAdmin = await checkIsAdmin(tenantId, userId);

    if (!isAdmin) {
      await lineClient.replyMessage(replyToken, {
        type: "text",
        text: "คำสั่งนี้สำหรับ Admin เท่านั้น"
      });
      console.log(`${logPrefix} Non-admin user requested goals summary: ${userId}`);
      return;
    }

    const { data: tenant } = await supabaseAdmin
      .from("tenants")
      .select("tenant_name")
      .eq("tenant_id", tenantId)
      .single();

    const chapterName = tenant?.tenant_name || "Chapter";

    const goals = await getActiveGoalsForTenant(tenantId);
    console.log(`${logPrefix} Found ${goals.length} active goals for summary`);

    if (goals.length === 0) {
      await lineClient.replyMessage(replyToken, {
        type: "text",
        text: "ไม่มีเป้าหมายที่กำลังดำเนินการอยู่ในขณะนี้\n\nสามารถสร้างเป้าหมายใหม่ได้ที่ Admin Panel"
      });
      return;
    }

    const reportDate = new Date().toISOString().split('T')[0];
    const flexMessage = buildProgressSummaryFlexMessage(goals, chapterName, reportDate);

    await lineClient.replyMessage(replyToken, flexMessage);
    console.log(`${logPrefix} Sent goals summary to admin: ${userId}`);

  } catch (error: any) {
    console.error(`${logPrefix} Error handling goals summary:`, error);
    try {
      await lineClient.replyMessage(replyToken, {
        type: "text",
        text: "เกิดข้อผิดพลาดในการดึงข้อมูลเป้าหมาย กรุณาลองใหม่อีกครั้ง"
      });
    } catch (replyError) {
      console.error(`${logPrefix} Failed to send error reply:`, replyError);
    }
  }
}
