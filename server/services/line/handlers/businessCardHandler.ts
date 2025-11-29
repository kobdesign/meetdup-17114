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
        nickname,
        position,
        company,
        tagline,
        photo_url,
        company_logo_url,
        email,
        phone,
        website_url,
        facebook_url,
        instagram_url,
        linkedin_url,
        business_address,
        line_user_id,
        line_id,
        tags,
        onepage_url
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

    // Get base URL from environment (prioritize deployment URL)
    const baseUrl = getBaseUrl();

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
 * Searches across: full_name, nickname, phone, company, notes, tags
 */
export async function handleCardSearch(
  event: any,
  tenantId: string,
  accessToken: string,
  searchTerm: string
): Promise<void> {
  const logPrefix = `[CardSearch]`;
  
  // If no search term, prompt for keyword
  if (!searchTerm || searchTerm.trim() === "") {
    await replyMessage(event.replyToken, {
      type: "text",
      text: `🔍 ค้นหานามบัตร\n\nกรุณาพิมพ์คำค้นหา เช่น:\n• ชื่อ-นามสกุล\n• ชื่อเล่น\n• ชื่อบริษัท\n• เบอร์โทร\n• คำค้นหาอื่นๆ\n\nตัวอย่าง: "กบ" หรือ "Microsoft" หรือ "081"`
    }, accessToken);
    return;
  }
  
  console.log(`${logPrefix} Searching for: "${searchTerm}" in tenant: ${tenantId}`);

  try {
    // Build comprehensive search query
    // Search across: full_name, nickname, phone, company, notes, and tags array
    const selectFields = `
      participant_id,
      tenant_id,
      full_name,
      nickname,
      position,
      company,
      tagline,
      photo_url,
      company_logo_url,
      email,
      phone,
      website_url,
      facebook_url,
      instagram_url,
      linkedin_url,
      line_id,
      business_address,
      notes,
      tags,
      status
    `;

    // Sanitize search term: escape % and _ for ILIKE, remove SQL-dangerous chars
    const sanitizedTerm = searchTerm
      .replace(/%/g, '\\%')
      .replace(/_/g, '\\_')
      .replace(/['";]/g, ''); // Remove quotes and semicolons

    // Search across text fields using ILIKE
    // For tags, we can't use .cs with user input, so we search each text field separately
    const { data: participants, error } = await supabaseAdmin
      .from("participants")
      .select(selectFields)
      .eq("tenant_id", tenantId)
      .in("status", ["member", "visitor"])
      .or(`full_name.ilike.%${sanitizedTerm}%,nickname.ilike.%${sanitizedTerm}%,phone.ilike.%${sanitizedTerm}%,company.ilike.%${sanitizedTerm}%,notes.ilike.%${sanitizedTerm}%`)
      .limit(10);

    // Additionally search in tags array (if query succeeds without tags)
    if (!error && participants && participants.length < 10) {
      // Search for participants with matching tags
      const { data: tagMatches } = await supabaseAdmin
        .from("participants")
        .select(selectFields)
        .eq("tenant_id", tenantId)
        .in("status", ["member", "visitor"])
        .contains("tags", [sanitizedTerm])
        .limit(10);

      // Merge and deduplicate results
      if (tagMatches && tagMatches.length > 0) {
        const participantIds = new Set(participants.map(p => p.participant_id));
        for (const tagMatch of tagMatches) {
          if (!participantIds.has(tagMatch.participant_id)) {
            participants.push(tagMatch);
            participantIds.add(tagMatch.participant_id);
          }
        }
      }
    }

    console.log(`${logPrefix} Comprehensive search results:`, { 
      count: participants?.length || 0,
      searchTerm,
      error: error ? JSON.stringify(error) : null 
    });

    if (error) {
      console.error(`${logPrefix} Search error:`, error);
      await replyMessage(event.replyToken, {
        type: "text",
        text: "⚠️ เกิดข้อผิดพลาดในการค้นหา กรุณาลองใหม่อีกครั้ง"
      }, accessToken);
      return;
    }

    if (!participants || participants.length === 0) {
      await replyMessage(event.replyToken, {
        type: "text",
        text: `❌ ไม่พบข้อมูลที่ตรงกับ "${searchTerm}"\n\n💡 ลองค้นหาด้วย:\n• ชื่อหรือชื่อเล่นอื่น\n• ชื่อบริษัท\n• เบอร์โทรศัพท์\n• คำสำคัญที่เกี่ยวข้อง`
      }, accessToken);
      return;
    }

    const baseUrl = getBaseUrl();

    // Get tenant info for branding
    const { data: tenantInfo } = await supabaseAdmin
      .from("tenants")
      .select("tenant_name, logo_url")
      .eq("tenant_id", tenantId)
      .single();

    // Add tenant info to participants
    const participantsWithTenant = participants.map(p => ({
      ...p,
      tenants: tenantInfo
    }));

    // If only one result, send single Business Card Flex Message
    if (participantsWithTenant.length === 1) {
      const flexMessage = createBusinessCardFlexMessage(participantsWithTenant[0] as BusinessCardData, baseUrl);
      await replyMessage(event.replyToken, flexMessage, accessToken);
      console.log(`${logPrefix} Sent single card for ${participantsWithTenant[0].full_name}`);
      return;
    }

    // Multiple results - send Carousel of Flex Messages (LINE limits to 12 bubbles max)
    const maxBubbles = 12;
    const limitedParticipants = participantsWithTenant.slice(0, maxBubbles);
    const carouselContents = limitedParticipants.map(p => {
      const flexMessage = createBusinessCardFlexMessage(p as BusinessCardData, baseUrl);
      return flexMessage.contents;
    });

    const totalCount = participantsWithTenant.length;
    const altText = totalCount > maxBubbles 
      ? `พบ ${totalCount} รายการ (แสดง ${maxBubbles} รายการแรก)`
      : `พบ ${totalCount} รายการที่ตรงกับ "${searchTerm}"`;

    await replyMessage(event.replyToken, {
      type: "flex",
      altText,
      contents: {
        type: "carousel",
        contents: carouselContents
      }
    }, accessToken);

    console.log(`${logPrefix} Sent carousel with ${limitedParticipants.length}/${totalCount} cards`);

  } catch (error: any) {
    console.error(`${logPrefix} Error searching cards:`, error);
    await replyMessage(event.replyToken, {
      type: "text",
      text: "⚠️ เกิดข้อผิดพลาดในการค้นหา กรุณาลองใหม่อีกครั้ง"
    }, accessToken);
  }
}

/**
 * Handle "edit_profile" postback action
 * Generates a profile edit token and sends a Magic Link to the user
 */
export async function handleEditProfileRequest(
  event: any,
  tenantId: string,
  accessToken: string
): Promise<void> {
  const logPrefix = `[EditProfile]`;
  const lineUserId = event.source.userId;

  console.log(`${logPrefix} Edit profile request from: ${lineUserId}`);

  try {
    // Find participant by LINE user ID
    const { data: participant, error } = await supabaseAdmin
      .from("participants")
      .select("participant_id, full_name")
      .eq("line_user_id", lineUserId)
      .eq("tenant_id", tenantId)
      .single();

    if (error || !participant) {
      console.error(`${logPrefix} Participant not found for LINE user:`, lineUserId);
      await replyMessage(event.replyToken, {
        type: "text",
        text: "ไม่พบข้อมูลของคุณในระบบ กรุณาลงทะเบียนก่อน หรือเชื่อมต่อเบอร์โทรศัพท์ด้วยคำสั่ง \"เชื่อมเบอร์\""
      }, accessToken);
      return;
    }

    // Generate profile token
    const { generateProfileToken } = await import("../../../utils/profileToken");
    const token = generateProfileToken(participant.participant_id, tenantId);

    // Get base URL (prioritize deployment URL)
    const baseUrl = getBaseUrl();

    const profileUrl = `${baseUrl}/participant-profile/edit?token=${token}`;

    console.log(`${logPrefix} Generated profile edit URL for ${participant.full_name}`);

    // Send message with link
    await replyMessage(event.replyToken, {
      type: "flex",
      altText: "แก้ไขข้อมูลของคุณ",
      contents: {
        type: "bubble",
        size: "kilo",
        body: {
          type: "box",
          layout: "vertical",
          contents: [
            {
              type: "text",
              text: "แก้ไขข้อมูลส่วนตัว",
              weight: "bold",
              size: "lg",
              color: "#1F2937"
            },
            {
              type: "text",
              text: `สวัสดีคุณ ${participant.full_name} กรุณากดปุ่มด้านล่างเพื่อแก้ไขข้อมูลของคุณ`,
              size: "sm",
              color: "#6B7280",
              wrap: true,
              margin: "md"
            },
            {
              type: "text",
              text: "ลิงก์นี้ใช้ได้ 24 ชั่วโมง",
              size: "xs",
              color: "#9CA3AF",
              margin: "md"
            }
          ]
        },
        footer: {
          type: "box",
          layout: "vertical",
          contents: [
            {
              type: "button",
              action: {
                type: "uri",
                label: "แก้ไขข้อมูล",
                uri: profileUrl
              },
              style: "primary",
              height: "md"
            }
          ]
        }
      }
    }, accessToken);

    console.log(`${logPrefix} Sent profile edit link to ${participant.full_name}`);

  } catch (error: any) {
    console.error(`${logPrefix} Error handling edit profile:`, error);
    await replyMessage(event.replyToken, {
      type: "text",
      text: "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง"
    }, accessToken);
  }
}

import { getProductionBaseUrl } from "../../../utils/getProductionUrl";

/**
 * Get base URL for LIFF pages
 * Uses shared utility for consistent production URL handling
 */
function getBaseUrl(): string {
  return getProductionBaseUrl();
}

/**
 * Handle category search command - redirect directly to LIFF category search page
 */
export async function handleCategorySearch(
  event: any,
  tenantId: string,
  accessToken: string,
  logPrefix: string
): Promise<void> {
  try {
    const baseUrl = getBaseUrl();
    
    // Direct URL to category search LIFF page
    const categoryUrl = `${baseUrl}/liff/search/category?tenant=${tenantId}`;
    
    console.log(`${logPrefix} Sending direct category search link`);
    
    // Simple Flex with single button for direct access
    const flexMessage = {
      type: "flex",
      altText: "ค้นหาตามประเภทธุรกิจ",
      contents: {
        type: "bubble",
        size: "kilo",
        body: {
          type: "box",
          layout: "vertical",
          contents: [
            {
              type: "text",
              text: "ค้นหาสมาชิก",
              weight: "bold",
              size: "lg",
              color: "#1DB446"
            },
            {
              type: "text",
              text: "กดปุ่มด้านล่างเพื่อค้นหาตามประเภทธุรกิจ",
              size: "sm",
              color: "#666666",
              margin: "md",
              wrap: true
            }
          ]
        },
        footer: {
          type: "box",
          layout: "vertical",
          contents: [
            {
              type: "button",
              action: {
                type: "uri",
                label: "เปิดหน้าค้นหา",
                uri: categoryUrl
              },
              style: "primary",
              color: "#1DB446"
            }
          ]
        }
      }
    };
    
    await replyMessage(event.replyToken, flexMessage, accessToken);
    console.log(`${logPrefix} Category search link sent successfully`);
    
  } catch (error: any) {
    console.error(`${logPrefix} Error handling category search:`, error);
    await replyMessage(event.replyToken, {
      type: "text",
      text: "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง"
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
