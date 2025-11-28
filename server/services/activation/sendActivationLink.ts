import { supabaseAdmin } from "../../utils/supabaseClient";
import { LineClient } from "../line/lineClient";
import { getLineCredentials } from "../line/credentials";
import { getProductionBaseUrl } from "../../utils/getProductionUrl";
import crypto from "crypto";

export interface SendActivationLinkParams {
  participantId: string;
  tenantId: string;
  lineUserId: string;
  fullName: string;
  logPrefix?: string;
}

export interface SendActivationLinkResult {
  success: boolean;
  error?: string;
  token?: string;
  activationUrl?: string;
}

export async function sendActivationLink(params: SendActivationLinkParams): Promise<SendActivationLinkResult> {
  const { participantId, tenantId, lineUserId, fullName, logPrefix = "[sendActivationLink]" } = params;

  try {
    const { error: revokeError } = await supabaseAdmin
      .from("activation_tokens")
      .update({ used_at: new Date().toISOString() })
      .eq("participant_id", participantId)
      .is("used_at", null);

    if (revokeError) {
      console.warn(`${logPrefix} Failed to revoke old tokens:`, revokeError);
    }

    const token = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const { error: tokenError } = await supabaseAdmin
      .from("activation_tokens")
      .insert({
        token,
        participant_id: participantId,
        tenant_id: tenantId,
        expires_at: expiresAt.toISOString()
      });

    if (tokenError) {
      console.error(`${logPrefix} Failed to create token:`, tokenError);
      return { success: false, error: "Failed to generate activation token" };
    }

    const credentials = await getLineCredentials(tenantId);
    if (!credentials) {
      return { success: false, error: "LINE channel not configured for this tenant" };
    }

    const { data: tenantData } = await supabaseAdmin
      .from("tenants")
      .select("tenant_name")
      .eq("tenant_id", tenantId)
      .single();

    if (!tenantData) {
      return { success: false, error: "Tenant not found" };
    }

    const baseUrl = getProductionBaseUrl();
    const activationUrl = `${baseUrl}/activate/${token}`;

    const lineClient = new LineClient(credentials.channelAccessToken);
    
    const flexMessage = {
      type: "flex" as const,
      altText: `ลงทะเบียนบัญชีสำหรับ ${tenantData.tenant_name}`,
      contents: {
        type: "bubble",
        body: {
          type: "box",
          layout: "vertical",
          contents: [
            {
              type: "text",
              text: "เชิญลงทะเบียน",
              weight: "bold",
              size: "xl",
              color: "#1DB446"
            },
            {
              type: "text",
              text: tenantData.tenant_name,
              size: "sm",
              color: "#999999",
              margin: "md"
            },
            {
              type: "separator",
              margin: "xxl"
            },
            {
              type: "box",
              layout: "vertical",
              margin: "xxl",
              spacing: "sm",
              contents: [
                {
                  type: "text",
                  text: `สวัสดี คุณ${fullName}`,
                  size: "md",
                  wrap: true
                },
                {
                  type: "text",
                  text: "กรุณากดปุ่มด้านล่างเพื่อลงทะเบียนบัญชีผู้ใช้ของคุณ",
                  size: "sm",
                  color: "#666666",
                  margin: "md",
                  wrap: true
                },
                {
                  type: "text",
                  text: "ลิงก์นี้จะหมดอายุใน 7 วัน",
                  size: "xs",
                  color: "#999999",
                  margin: "md"
                }
              ]
            }
          ]
        },
        footer: {
          type: "box",
          layout: "vertical",
          spacing: "sm",
          contents: [
            {
              type: "button",
              style: "primary",
              height: "sm",
              action: {
                type: "uri",
                label: "ลงทะเบียนเลย",
                uri: activationUrl
              }
            },
            {
              type: "box",
              layout: "vertical",
              contents: [],
              margin: "sm"
            }
          ]
        }
      }
    };

    await lineClient.pushMessage(lineUserId, flexMessage);

    console.log(`${logPrefix} Successfully sent activation link`, {
      participant_id: participantId,
      line_user_id: lineUserId,
      activation_url: activationUrl
    });

    return {
      success: true,
      token,
      activationUrl
    };
  } catch (error: any) {
    console.error(`${logPrefix} Error:`, error);
    return {
      success: false,
      error: error.message || "Internal server error"
    };
  }
}
