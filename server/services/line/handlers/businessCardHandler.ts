import { supabaseAdmin } from "../../../utils/supabaseClient";
import { createBusinessCardFlexMessage, BusinessCardData } from "../templates/businessCard";

/**
 * Handle "view_card" postback action
 * Fetches and displays a member's business card via LINE
 */
export async function handleViewCard(
  event: any,
  tenantId: string,
  accessToken: string,
  params: URLSearchParams
): Promise<void> {
  const logPrefix = `[BusinessCard]`;
  const participantId = params.get("participant_id");
  const lineUserId = event.source.userId;

  console.log(`${logPrefix} View card request`, { participantId, lineUserId, tenantId });

  try {
    // If no participant_id provided, show the user's own card
    let targetParticipantId = participantId;

    if (!targetParticipantId && lineUserId) {
      // Find participant by LINE user ID
      const { data: participant, error } = await supabaseAdmin
        .from("participants")
        .select("participant_id")
        .eq("line_user_id", lineUserId)
        .eq("tenant_id", tenantId)
        .single();

      if (error || !participant) {
        console.error(`${logPrefix} Participant not found for LINE user:`, lineUserId);
        await replyMessage(event.replyToken, {
          type: "text",
          text: "ไม่พบข้อมูลของคุณในระบบ กรุณาลงทะเบียนก่อน"
        }, accessToken);
        return;
      }

      targetParticipantId = participant.participant_id;
    }

    if (!targetParticipantId) {
      await replyMessage(event.replyToken, {
        type: "text",
        text: "ไม่พบข้อมูลนามบัตร"
      }, accessToken);
      return;
    }

    // Fetch business card data
    const { data: cardData, error: cardError } = await supabaseAdmin
      .from("participants")
      .select(`
        participant_id,
        tenant_id,
        full_name,
        position,
        company,
        tagline,
        photo_url,
        email,
        phone,
        website_url,
        facebook_url,
        instagram_url,
        business_address,
        line_user_id
      `)
      .eq("participant_id", targetParticipantId)
      .eq("tenant_id", tenantId)
      .in("status", ["member", "visitor"])
      .single();

    if (cardError || !cardData) {
      console.error(`${logPrefix} Failed to fetch card data:`, cardError);
      await replyMessage(event.replyToken, {
        type: "text",
        text: "ไม่พบข้อมูลนามบัตร"
      }, accessToken);
      return;
    }

    // Get base URL from environment
    const baseUrl = process.env.REPLIT_DEV_DOMAIN 
      ? `https://${process.env.REPLIT_DEV_DOMAIN}`
      : "http://localhost:5000";

    // Create and send Flex Message
    const flexMessage = createBusinessCardFlexMessage(cardData as BusinessCardData, baseUrl);

    await replyMessage(event.replyToken, flexMessage, accessToken);

    console.log(`${logPrefix} Business card sent successfully for ${cardData.full_name}`);

  } catch (error: any) {
    console.error(`${logPrefix} Error handling view card:`, error);
    await replyMessage(event.replyToken, {
      type: "text",
      text: "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง"
    }, accessToken);
  }
}

/**
 * Handle member search by name
 * Example: "หาสมาชิก สมชาย", "ค้นหาสมาชิก จอห์น"
 */
export async function handleMemberSearch(
  event: any,
  tenantId: string,
  accessToken: string,
  searchTerm: string
): Promise<void> {
  const logPrefix = `[MemberSearch]`;
  
  console.log(`${logPrefix} Searching for: "${searchTerm}" in tenant: ${tenantId}`);

  try {
    // Search by full_name containing the search term (case-insensitive)
    const { data: members, error } = await supabaseAdmin
      .from("participants")
      .select(`
        participant_id,
        full_name,
        position,
        company,
        status
      `)
      .eq("tenant_id", tenantId)
      .in("status", ["member", "visitor", "prospect"])
      .ilike("full_name", `%${searchTerm}%`)
      .limit(10);

    if (error) {
      console.error(`${logPrefix} Search error:`, error);
      await replyMessage(event.replyToken, {
        type: "text",
        text: "เกิดข้อผิดพลาดในการค้นหา กรุณาลองใหม่อีกครั้ง"
      }, accessToken);
      return;
    }

    if (!members || members.length === 0) {
      await replyMessage(event.replyToken, {
        type: "text",
        text: `ไม่พบสมาชิกที่ชื่อ "${searchTerm}"\n\nลองค้นหาด้วยชื่อหรือนามสกุลอื่น`
      }, accessToken);
      return;
    }

    // Create quick reply buttons for each member found
    const quickReplyItems = members.slice(0, 5).map((member: any) => {
      const subtitle = [member.position, member.company].filter(Boolean).join(" • ");
      return {
        type: "action",
        action: {
          type: "postback",
          label: member.full_name.substring(0, 20),
          displayText: `ดูนามบัตร ${member.full_name}`,
          data: `action=view_card&participant_id=${member.participant_id}`
        }
      };
    });

    const resultText = `พบ ${members.length} คน:\n\n${members.map((m: any, i: number) => {
      const subtitle = [m.position, m.company].filter(Boolean).join(" • ");
      return `${i + 1}. ${m.full_name}${subtitle ? `\n   ${subtitle}` : ""}`;
    }).join("\n\n")}`;

    await replyMessage(event.replyToken, {
      type: "text",
      text: resultText,
      quickReply: {
        items: quickReplyItems
      }
    }, accessToken);

    console.log(`${logPrefix} Found ${members.length} members`);

  } catch (error: any) {
    console.error(`${logPrefix} Error searching members:`, error);
    await replyMessage(event.replyToken, {
      type: "text",
      text: "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง"
    }, accessToken);
  }
}

/**
 * Handle card search command
 * Example: "card กบ", "card abhisak", "นามบัตร john"
 */
export async function handleCardSearch(
  event: any,
  tenantId: string,
  accessToken: string,
  searchTerm: string
): Promise<void> {
  const logPrefix = `[CardSearch]`;
  
  console.log(`${logPrefix} Searching for: "${searchTerm}" in tenant: ${tenantId}`);

  try {
    // Search by full_name
    const { data: byFullName, error: error1 } = await supabaseAdmin
      .from("participants")
      .select(`
        participant_id,
        full_name,
        nickname,
        position,
        company,
        tagline,
        photo_url,
        email,
        phone,
        website_url,
        facebook_url,
        instagram_url,
        business_address,
        status,
        tenants!participants_tenant_id_fkey (tenant_name, logo_url)
      `)
      .eq("tenant_id", tenantId)
      .ilike("full_name", `%${searchTerm}%`)
      .limit(10);

    console.log(`${logPrefix} Search by full_name:`, { 
      count: byFullName?.length || 0, 
      error: error1 ? JSON.stringify(error1) : null 
    });

    // Search by nickname
    const { data: byNickname, error: error2 } = await supabaseAdmin
      .from("participants")
      .select(`
        participant_id,
        full_name,
        nickname,
        position,
        company,
        tagline,
        photo_url,
        email,
        phone,
        website_url,
        facebook_url,
        instagram_url,
        business_address,
        status,
        tenants!participants_tenant_id_fkey (tenant_name, logo_url)
      `)
      .eq("tenant_id", tenantId)
      .ilike("nickname", `%${searchTerm}%`)
      .limit(10);

    console.log(`${logPrefix} Search by nickname:`, { 
      count: byNickname?.length || 0, 
      error: error2 ? JSON.stringify(error2) : null 
    });

    // Combine and deduplicate results
    const allResults = [...(byFullName || []), ...(byNickname || [])];
    const uniqueMap = new Map();
    for (const p of allResults) {
      if (!uniqueMap.has(p.participant_id)) {
        uniqueMap.set(p.participant_id, p);
      }
    }
    const participants = Array.from(uniqueMap.values()).slice(0, 10);

    if (participants.length === 0) {
      await replyMessage(event.replyToken, {
        type: "text",
        text: `❌ ไม่พบข้อมูลที่ตรงกับ "${searchTerm}"\n\nลองค้นหาด้วยชื่อหรือชื่อเล่นอื่น`
      }, accessToken);
      return;
    }

    const baseUrl = process.env.REPLIT_DEV_DOMAIN 
      ? `https://${process.env.REPLIT_DEV_DOMAIN}`
      : "http://localhost:5000";

    // If only one result, send single Business Card
    if (participants.length === 1) {
      const flexMessage = createBusinessCardFlexMessage(participants[0] as BusinessCardData, baseUrl);
      await replyMessage(event.replyToken, flexMessage, accessToken);
      console.log(`${logPrefix} Sent single card for ${participants[0].full_name}`);
      return;
    }

    // Multiple results - send Carousel
    const carouselContents = participants.map(p => {
      const flexMessage = createBusinessCardFlexMessage(p as BusinessCardData, baseUrl);
      return flexMessage.contents;
    });

    await replyMessage(event.replyToken, {
      type: "flex",
      altText: `พบ ${participants.length} รายการที่ตรงกับ "${searchTerm}"`,
      contents: {
        type: "carousel",
        contents: carouselContents
      }
    }, accessToken);

    console.log(`${logPrefix} Sent carousel with ${participants.length} cards`);

  } catch (error: any) {
    console.error(`${logPrefix} Error searching cards:`, error);
    await replyMessage(event.replyToken, {
      type: "text",
      text: "⚠️ เกิดข้อผิดพลาดในการค้นหา กรุณาลองใหม่อีกครั้ง"
    }, accessToken);
  }
}

/**
 * Send LINE reply message
 */
async function replyMessage(
  replyToken: string,
  message: any,
  accessToken: string
): Promise<void> {
  const response = await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${accessToken}`
    },
    body: JSON.stringify({
      replyToken,
      messages: [message]
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`LINE API error: ${error}`);
  }
}
