import { LineClient } from "../lineClient";
import { supabaseAdmin } from "../../../utils/supabaseClient";
import { buildProgressSummaryFlexMessage, getActiveGoalsForTenant } from "../../goals/progressSummary";
import { 
  checkCommandAuthorization, 
  getAuthorizationErrorMessage 
} from "../commandAuthorization";

export async function handleGoalsSummaryRequest(
  event: any,
  tenantId: string,
  accessToken: string,
  logPrefix: string
): Promise<void> {
  const lineClient = new LineClient(accessToken);
  const userId = event.source.userId;
  const replyToken = event.replyToken;
  const isGroupChat = event.source.type === 'group' || event.source.type === 'room';

  if (!userId) {
    console.log(`${logPrefix} No userId found for goals summary request`);
    return;
  }

  try {
    const authResult = await checkCommandAuthorization(
      tenantId,
      'goals_summary',
      userId,
      isGroupChat
    );

    if (!authResult.authorized) {
      const errorMessage = getAuthorizationErrorMessage(authResult.reason || 'unauthorized');
      await lineClient.replyMessage(replyToken, {
        type: "text",
        text: errorMessage
      });
      console.log(`${logPrefix} Unauthorized goals summary request: ${userId}, reason: ${authResult.reason}`);
      return;
    }

    console.log(`${logPrefix} Authorized goals summary request from ${authResult.accessLevel}: ${userId}`);

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
