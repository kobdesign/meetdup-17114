import { supabaseAdmin } from "../../../utils/supabaseClient";
import { createBusinessCardFlexMessage, createMediumBusinessCardBubble, createViewMoreBubble, buildPaginatedCarousel, BusinessCardData } from "../templates/businessCard";
import { getLiffId, getShareEnabled, getShareServiceUrl } from "../../../utils/liffConfig";
import { logLineWebhookError, logLineReplyError } from "../../../utils/errorLogger";

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
        full_name_th,
        nickname_th,
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

    // Get share button setting and service URL
    const shareEnabled = await getShareEnabled();
    const shareServiceUrl = await getShareServiceUrl();

    // Create and send Flex Message
    const flexMessage = createBusinessCardFlexMessage(cardData as BusinessCardData, baseUrl, { shareEnabled, shareServiceUrl });

    await replyMessage(event.replyToken, flexMessage, accessToken);

    console.log(`${logPrefix} Business card sent successfully for ${cardData.full_name_th}`);

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
    // Search by full_name_th containing the search term (case-insensitive)
    const { data: members, error } = await supabaseAdmin
      .from("participants")
      .select(`
        participant_id,
        full_name_th,
        position,
        company,
        status
      `)
      .eq("tenant_id", tenantId)
      .in("status", ["member", "visitor", "prospect"])
      .ilike("full_name_th", `%${searchTerm}%`)
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
          label: member.full_name_th.substring(0, 20),
          displayText: `ดูนามบัตร ${member.full_name_th}`,
          data: `action=view_card&participant_id=${member.participant_id}`
        }
      };
    });

    const resultText = `พบ ${members.length} คน:\n\n${members.map((m: any, i: number) => {
      const subtitle = [m.position, m.company].filter(Boolean).join(" • ");
      return `${i + 1}. ${m.full_name_th}${subtitle ? `\n   ${subtitle}` : ""}`;
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
  const startTime = Date.now();
  
  console.log(`${logPrefix} ========== SEARCH START ==========`);
  console.log(`${logPrefix} Timestamp: ${new Date().toISOString()}`);
  console.log(`${logPrefix} Tenant ID: ${tenantId}`);
  console.log(`${logPrefix} Search term: "${searchTerm}"`);
  console.log(`${logPrefix} Reply token: ${event.replyToken?.substring(0, 20)}...`);
  console.log(`${logPrefix} User ID: ${event.source?.userId || 'unknown'}`);
  console.log(`${logPrefix} Access token length: ${accessToken?.length || 0}`);
  
  // If no search term, prompt for keyword
  if (!searchTerm || searchTerm.trim() === "") {
    console.log(`${logPrefix} Empty search term, sending prompt`);
    await replyMessage(event.replyToken, {
      type: "text",
      text: `🔍 ค้นหานามบัตร\n\nกรุณาพิมพ์คำค้นหา เช่น:\n• ชื่อ-นามสกุล\n• ชื่อเล่น\n• ชื่อบริษัท\n• เบอร์โทร\n• คำค้นหาอื่นๆ\n\nตัวอย่าง: "กบ" หรือ "Microsoft" หรือ "081"`
    }, accessToken, tenantId);
    return;
  }
  
  console.log(`${logPrefix} Searching for: "${searchTerm}" in tenant: ${tenantId}`);

  try {
    // Use shared search service for consistency with LIFF search
    const { searchParticipants } = await import("../../search/participantSearch");
    
    const searchResult = await searchParticipants({
      tenantId,
      searchTerm,
      limit: 10,
      tagScanLimit: 50,
      enableCategoryMatching: true,
      logPrefix
    });

    if (searchResult.emptyQuery) {
      await replyMessage(event.replyToken, {
        type: "text",
        text: `🔍 กรุณาพิมพ์คำค้นหา เช่น: "กบ" หรือ "Microsoft"`
      }, accessToken, tenantId);
      return;
    }

    let participants = searchResult.participants;
    const allQueriesTimedOut = searchResult.executedQueries > 0 && 
      searchResult.timedOutQueries.length >= searchResult.executedQueries;
    const error = participants.length === 0 && allQueriesTimedOut
      ? { message: "Search timeout" }
      : null;

    console.log(`${logPrefix} Comprehensive search results:`, { 
      count: participants?.length || 0,
      searchTerm,
      error: error ? JSON.stringify(error) : null 
    });

    if (error) {
      console.error(`${logPrefix} Search error:`, error);
      const elapsed = Date.now() - startTime;
      console.log(`${logPrefix} Sending error reply after ${elapsed}ms`);
      await replyMessage(event.replyToken, {
        type: "text",
        text: "⚠️ เกิดข้อผิดพลาดในการค้นหา กรุณาลองใหม่อีกครั้ง"
      }, accessToken, tenantId);
      return;
    }

    if (!participants || participants.length === 0) {
      const elapsed = Date.now() - startTime;
      console.log(`${logPrefix} No results found, sending not-found reply after ${elapsed}ms`);
      await replyMessage(event.replyToken, {
        type: "text",
        text: `❌ ไม่พบข้อมูลที่ตรงกับ "${searchTerm}"\n\n💡 ลองค้นหาด้วย:\n• ชื่อหรือชื่อเล่นอื่น\n• ชื่อบริษัท\n• เบอร์โทรศัพท์\n• คำสำคัญที่เกี่ยวข้อง`
      }, accessToken, tenantId);
      return;
    }

    console.log(`${logPrefix} Found ${participants.length} participants, preparing reply...`);
    
    const baseUrl = getBaseUrl();
    console.log(`${logPrefix} Base URL: ${baseUrl}`);

    // Get tenant info for branding
    const { data: tenantInfo } = await supabaseAdmin
      .from("tenants")
      .select("tenant_name, logo_url")
      .eq("tenant_id", tenantId)
      .single();
    
    console.log(`${logPrefix} Tenant info: ${tenantInfo?.tenant_name || 'unknown'}`);

    // Add tenant info to participants
    const participantsWithTenant = participants.map(p => ({
      ...p,
      tenants: tenantInfo
    }));

    // Get share button setting and service URL
    const shareEnabled = await getShareEnabled();
    const shareServiceUrl = await getShareServiceUrl();
    console.log(`${logPrefix} Share settings: enabled=${shareEnabled}, serviceUrl=${shareServiceUrl?.substring(0, 30)}...`);

    // If only one result, send single Business Card Flex Message
    if (participantsWithTenant.length === 1) {
      console.log(`${logPrefix} Creating single card flex message...`);
      const flexMessage = createBusinessCardFlexMessage(participantsWithTenant[0] as BusinessCardData, baseUrl, { shareEnabled, shareServiceUrl });
      const elapsed = Date.now() - startTime;
      console.log(`${logPrefix} Sending single card reply after ${elapsed}ms`);
      await replyMessage(event.replyToken, flexMessage, accessToken, tenantId);
      console.log(`${logPrefix} ========== SEARCH END (single card sent) ==========`);
      return;
    }

    // Multiple results - use shared pagination function
    const { message: carouselMessage, displayedCount } = buildPaginatedCarousel(participantsWithTenant as BusinessCardData[], {
      baseUrl,
      tenantId,
      shareEnabled,
      shareServiceUrl,
      searchTerm,
      currentPage: 1,
      hasMoreInDb: searchResult.hasMore,
      totalFound: searchResult.totalFound
    });
    
    console.log(`${logPrefix} Creating carousel: ${displayedCount} cards (total: ${participantsWithTenant.length}, hasMore: ${searchResult.hasMore})`);
    
    const messageSize = JSON.stringify(carouselMessage).length;
    console.log(`${logPrefix} Carousel message size: ${messageSize} bytes (limit: 50KB)`);
    
    // If still too large, fallback to text list with link
    if (messageSize > 45000) { // 45KB safety margin
      console.log(`${logPrefix} Message too large (${messageSize}), falling back to text list`);
      const liffCardsUrl = `${baseUrl}/liff/cards?search=${encodeURIComponent(searchTerm)}&tenantId=${tenantId}`;
      const totalCount = participantsWithTenant.length;
      const previewCount = Math.min(5, totalCount);
      const textList = participantsWithTenant.slice(0, previewCount).map((p: any, i: number) => {
        const subtitle = [p.position, p.company].filter(Boolean).join(" | ");
        return `${i + 1}. ${p.full_name_th}${p.nickname_th ? ` (${p.nickname_th})` : ""}\n   ${subtitle || ""}`;
      }).join("\n\n");
      
      const moreText = totalCount > previewCount 
        ? `\n\n(แสดง ${previewCount} จาก ${totalCount} คน)\n\nดูทั้งหมด: ${liffCardsUrl}`
        : "";
      
      await replyMessage(event.replyToken, {
        type: "text",
        text: `พบ ${totalCount} คน:\n\n${textList}${moreText}`
      }, accessToken, tenantId);
      console.log(`${logPrefix} ========== SEARCH END (text fallback sent) ==========`);
      return;
    }

    const elapsed = Date.now() - startTime;
    console.log(`${logPrefix} Sending carousel reply after ${elapsed}ms`);
    
    await replyMessage(event.replyToken, carouselMessage, accessToken, tenantId);

    console.log(`${logPrefix} ========== SEARCH END (${displayedCount} cards sent) ==========`);

  } catch (error: any) {
    const elapsed = Date.now() - startTime;
    console.error(`${logPrefix} ========== SEARCH ERROR after ${elapsed}ms ==========`);
    console.error(`${logPrefix} Error type: ${error?.name || 'unknown'}`);
    console.error(`${logPrefix} Error message: ${error?.message || 'unknown'}`);
    console.error(`${logPrefix} Error stack: ${error?.stack || 'no stack'}`);
    
    try {
      await replyMessage(event.replyToken, {
        type: "text",
        text: "⚠️ เกิดข้อผิดพลาดในการค้นหา กรุณาลองใหม่อีกครั้ง"
      }, accessToken, tenantId);
      console.log(`${logPrefix} Error reply sent successfully`);
    } catch (replyError: any) {
      console.error(`${logPrefix} Failed to send error reply: ${replyError?.message || replyError}`);
    }
  }
}

/**
 * Handle business_card_page postback for pagination
 * Shows the next page of search results
 */
export async function handleBusinessCardPagePostback(
  event: any,
  tenantId: string,
  accessToken: string,
  page: number,
  searchTerm: string,
  logPrefix: string
): Promise<void> {
  const startTime = Date.now();
  console.log(`${logPrefix} ========== PAGE ${page} SEARCH START ==========`);
  console.log(`${logPrefix} Search term: "${searchTerm}", Page: ${page}`);

  try {
    const { searchParticipants } = await import("../../search/participantSearch");
    
    const maxBubblesPerPage = 6; // 6 cards per page (leaving room for navigation)
    const offset = (page - 1) * maxBubblesPerPage;
    
    const searchResult = await searchParticipants({
      tenantId,
      searchTerm,
      limit: maxBubblesPerPage, // Search service handles sentinel internally
      offset,
      statusFilter: ["member", "visitor"],
      enableCategoryMatching: true,
      tagScanLimit: 50,
      queryTimeoutMs: 5000,
      logPrefix: `${logPrefix}[Search]`
    });

    if (searchResult.emptyQuery) {
      await replyMessage(event.replyToken, {
        type: "text",
        text: "กรุณาระบุคำค้นหา"
      }, accessToken, tenantId);
      return;
    }

    const participants = searchResult.participants;
    const hasNextPage = searchResult.hasMore;

    if (participants.length === 0) {
      await replyMessage(event.replyToken, {
        type: "text",
        text: `ไม่พบข้อมูลเพิ่มเติมสำหรับ "${searchTerm}"`
      }, accessToken, tenantId);
      return;
    }

    // Get base URL
    const baseUrl = getBaseUrl();

    // Get tenant info
    const { data: tenantInfo } = await supabaseAdmin
      .from("tenants")
      .select("tenant_name, logo_url")
      .eq("tenant_id", tenantId)
      .single();

    const participantsWithTenant = participants.map(p => ({
      ...p,
      tenants: tenantInfo
    }));

    const shareEnabled = await getShareEnabled();
    const shareServiceUrl = await getShareServiceUrl();

    // Create carousel contents
    const carouselContents: any[] = participantsWithTenant.map(p => 
      createMediumBusinessCardBubble(p as BusinessCardData, baseUrl, { shareEnabled, shareServiceUrl })
    );

    // Add "View More" bubble with navigation if there are more results
    if (hasNextPage) {
      const totalFound = searchResult.totalFound;
      const displayedSoFar = offset + participants.length;
      const remainingEstimate = Math.max(0, totalFound - displayedSoFar);
      
      carouselContents.push(
        createViewMoreBubble(remainingEstimate, totalFound, searchTerm, tenantId, baseUrl, {
          currentPage: page,
          hasNextPage: true
        })
      );
    }

    const altText = `หน้า ${page}: พบ ${participants.length} รายการ "${searchTerm}"`;

    const carouselMessage = {
      type: "flex" as const,
      altText,
      contents: {
        type: "carousel" as const,
        contents: carouselContents
      }
    };

    const messageSize = JSON.stringify(carouselMessage).length;
    console.log(`${logPrefix} Carousel message size: ${messageSize} bytes`);

    const elapsed = Date.now() - startTime;
    console.log(`${logPrefix} Sending page ${page} carousel after ${elapsed}ms`);

    await replyMessage(event.replyToken, carouselMessage, accessToken, tenantId);

    console.log(`${logPrefix} ========== PAGE ${page} SEARCH END ==========`);

  } catch (error: any) {
    const elapsed = Date.now() - startTime;
    console.error(`${logPrefix} ========== PAGE ${page} SEARCH ERROR after ${elapsed}ms ==========`);
    console.error(`${logPrefix} Error type: ${error?.name || 'unknown'}`);
    console.error(`${logPrefix} Error message: ${error?.message || 'unknown'}`);
    console.error(`${logPrefix} Error stack: ${error?.stack || 'no stack'}`);
    
    try {
      await replyMessage(event.replyToken, {
        type: "text",
        text: "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง"
      }, accessToken, tenantId);
      console.log(`${logPrefix} Error reply sent successfully`);
    } catch (replyError: any) {
      console.error(`${logPrefix} Failed to send error reply: ${replyError?.message || replyError}`);
    }
  }
}

/**
 * Handle category_page postback for pagination
 * Shows the next page of category search results
 */
export async function handleCategoryPagePostback(
  event: any,
  tenantId: string,
  accessToken: string,
  page: number,
  categoryCode: string,
  logPrefix: string
): Promise<void> {
  const startTime = Date.now();
  console.log(`${logPrefix} ========== CATEGORY PAGE ${page} START ==========`);
  console.log(`${logPrefix} Category code: "${categoryCode}", Page: ${page}`);

  try {
    const maxBubblesPerPage = 6;
    const offset = (page - 1) * maxBubblesPerPage;
    
    // Get category name
    const { data: category } = await supabaseAdmin
      .from("business_categories")
      .select("name_th")
      .eq("category_code", categoryCode)
      .single();
    
    const categoryName = category?.name_th || `หมวดหมู่ ${categoryCode}`;
    
    // Get total count
    const { count: totalCount } = await supabaseAdmin
      .from("participants")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("status", "member")
      .eq("business_type_code", categoryCode);
    
    const totalFound = totalCount ?? 0;
    
    // Get members for this page
    const { data: members, error: searchError } = await supabaseAdmin
      .from("participants")
      .select(`
        participant_id,
        tenant_id,
        full_name_th,
        nickname_th,
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
        tags,
        onepage_url
      `)
      .eq("tenant_id", tenantId)
      .eq("status", "member")
      .eq("business_type_code", categoryCode)
      .order("full_name_th", { ascending: true })
      .range(offset, offset + maxBubblesPerPage - 1);
    
    if (searchError) {
      console.error(`${logPrefix} Search error:`, searchError);
      throw new Error("Database search error");
    }
    
    if (!members || members.length === 0) {
      await replyMessage(event.replyToken, {
        type: "text",
        text: `ไม่พบข้อมูลเพิ่มเติมในหมวด "${categoryName}"`
      }, accessToken);
      return;
    }
    
    const baseUrl = getBaseUrl();
    
    // Get tenant info
    const { data: tenantInfo } = await supabaseAdmin
      .from("tenants")
      .select("tenant_name, logo_url")
      .eq("tenant_id", tenantId)
      .single();
    
    const membersWithTenant = members.map(m => ({
      ...m,
      tenants: tenantInfo
    }));
    
    const shareEnabled = await getShareEnabled();
    const shareServiceUrl = await getShareServiceUrl();
    
    // Create carousel contents
    const carouselContents: any[] = membersWithTenant.map(m => 
      createMediumBusinessCardBubble(m as BusinessCardData, baseUrl, { shareEnabled, shareServiceUrl })
    );
    
    // Check if there are more pages
    const displayedSoFar = offset + members.length;
    const hasNextPage = displayedSoFar < totalFound;
    
    if (hasNextPage) {
      const remainingCount = totalFound - displayedSoFar;
      carouselContents.push(
        createViewMoreBubble(remainingCount, totalFound, categoryName, tenantId, baseUrl, {
          currentPage: page,
          hasNextPage: true,
          type: 'category',
          categoryCode,
          categoryName
        })
      );
    }
    
    const altText = `หน้า ${page}: พบ ${members.length} รายการในหมวด "${categoryName}"`;
    
    const carouselMessage = {
      type: "flex" as const,
      altText,
      contents: {
        type: "carousel" as const,
        contents: carouselContents
      }
    };
    
    const messageSize = JSON.stringify(carouselMessage).length;
    console.log(`${logPrefix} Carousel message size: ${messageSize} bytes`);
    
    const elapsed = Date.now() - startTime;
    console.log(`${logPrefix} Sending category page ${page} carousel after ${elapsed}ms`);
    
    await replyMessage(event.replyToken, carouselMessage, accessToken, tenantId);
    
    console.log(`${logPrefix} ========== CATEGORY PAGE ${page} END ==========`);
    
  } catch (error: any) {
    const elapsed = Date.now() - startTime;
    console.error(`${logPrefix} ========== CATEGORY PAGE ${page} ERROR after ${elapsed}ms ==========`);
    console.error(`${logPrefix} Error message: ${error?.message || 'unknown'}`);
    
    try {
      await replyMessage(event.replyToken, {
        type: "text",
        text: "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง"
      }, accessToken, tenantId);
    } catch (replyError: any) {
      console.error(`${logPrefix} Failed to send error reply: ${replyError?.message || replyError}`);
    }
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
      .select("participant_id, full_name_th")
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

    console.log(`${logPrefix} Generated profile edit URL for ${participant.full_name_th}`);

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
              text: `สวัสดีคุณ ${participant.full_name_th} กรุณากดปุ่มด้านล่างเพื่อแก้ไขข้อมูลของคุณ`,
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

    console.log(`${logPrefix} Sent profile edit link to ${participant.full_name_th}`);

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
 * Handle category search command - send LIFF link to categories page
 * Opens full categories page in LIFF with search capability
 */
export async function handleCategorySearch(
  event: any,
  tenantId: string,
  accessToken: string,
  logPrefix: string
): Promise<void> {
  try {
    console.log(`${logPrefix} Fetching categories summary for LIFF link`);
    
    // Get categories with member counts for this tenant
    const { data: categoriesWithCounts, error: catError } = await supabaseAdmin
      .from("participants")
      .select("business_type_code")
      .eq("tenant_id", tenantId)
      .eq("status", "member")
      .not("business_type_code", "is", null);
    
    if (catError) {
      console.error(`${logPrefix} Error fetching categories:`, catError);
      throw new Error("Failed to fetch categories");
    }
    
    // Count members per category
    const categoryCounts: Record<string, number> = {};
    for (const p of categoriesWithCounts || []) {
      if (p.business_type_code) {
        categoryCounts[p.business_type_code] = (categoryCounts[p.business_type_code] || 0) + 1;
      }
    }
    
    const categoryCodesWithMembers = Object.keys(categoryCounts);
    const totalCategories = categoryCodesWithMembers.length;
    const totalMembers = Object.values(categoryCounts).reduce((sum, count) => sum + count, 0);
    
    if (totalCategories === 0) {
      await replyMessage(event.replyToken, {
        type: "text",
        text: "ยังไม่มีสมาชิกที่ลงทะเบียนประเภทธุรกิจ"
      }, accessToken);
      return;
    }
    
    // Get tenant info for branding
    const { data: tenantInfo } = await supabaseAdmin
      .from("tenants")
      .select("tenant_name, logo_url, primary_color")
      .eq("tenant_id", tenantId)
      .single();
    
    const baseUrl = getBaseUrl();
    const liffUrl = `${baseUrl}/liff/search/category?tenant=${tenantId}`;
    
    // Validate primary_color is a valid hex color for LINE Flex Message
    // Falls back to default blue if not a valid hex format
    const rawColor = tenantInfo?.primary_color || "";
    const isValidHexColor = /^#[0-9A-Fa-f]{6}$/.test(rawColor);
    const primaryColor = isValidHexColor ? rawColor : "#2563EB";
    
    // Build Flex Message with LIFF link
    const flexMessage = {
      type: "flex",
      altText: `ประเภทธุรกิจ - ${totalCategories} หมวดหมู่`,
      contents: {
        type: "bubble",
        size: "kilo",
        header: {
          type: "box",
          layout: "vertical",
          contents: [
            {
              type: "text",
              text: "ค้นหาตามประเภทธุรกิจ",
              weight: "bold",
              size: "lg",
              color: "#FFFFFF"
            }
          ],
          backgroundColor: primaryColor,
          paddingAll: "16px"
        },
        body: {
          type: "box",
          layout: "vertical",
          contents: [
            {
              type: "box",
              layout: "horizontal",
              contents: [
                {
                  type: "box",
                  layout: "vertical",
                  contents: [
                    {
                      type: "text",
                      text: String(totalCategories),
                      size: "xxl",
                      weight: "bold",
                      color: primaryColor,
                      align: "center"
                    },
                    {
                      type: "text",
                      text: "หมวดหมู่",
                      size: "xs",
                      color: "#888888",
                      align: "center"
                    }
                  ],
                  flex: 1
                },
                {
                  type: "separator",
                  margin: "md"
                },
                {
                  type: "box",
                  layout: "vertical",
                  contents: [
                    {
                      type: "text",
                      text: String(totalMembers),
                      size: "xxl",
                      weight: "bold",
                      color: primaryColor,
                      align: "center"
                    },
                    {
                      type: "text",
                      text: "สมาชิก",
                      size: "xs",
                      color: "#888888",
                      align: "center"
                    }
                  ],
                  flex: 1
                }
              ],
              paddingAll: "12px"
            },
            {
              type: "text",
              text: "กดปุ่มด้านล่างเพื่อดูหมวดหมู่ทั้งหมด และค้นหาสมาชิกตามประเภทธุรกิจ",
              size: "sm",
              color: "#666666",
              wrap: true,
              margin: "lg"
            }
          ],
          paddingAll: "16px"
        },
        footer: {
          type: "box",
          layout: "vertical",
          contents: [
            {
              type: "button",
              action: {
                type: "uri",
                label: "ดูประเภทธุรกิจทั้งหมด",
                uri: liffUrl
              },
              style: "primary",
              color: primaryColor
            }
          ],
          paddingAll: "12px"
        }
      }
    };
    
    await replyMessage(event.replyToken, flexMessage, accessToken);
    console.log(`${logPrefix} Sent LIFF categories link: ${totalCategories} categories, ${totalMembers} members`);
    
  } catch (error: any) {
    console.error(`${logPrefix} Error handling category search:`, error);
    await replyMessage(event.replyToken, {
      type: "text",
      text: "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง"
    }, accessToken);
  }
}

/**
 * Handle category selection postback - push business cards to user
 */
export async function handleCategorySelection(
  event: any,
  tenantId: string,
  accessToken: string,
  categoryCode: string,
  logPrefix: string
): Promise<void> {
  try {
    const lineUserId = event.source.userId;
    console.log(`${logPrefix} Category selection:`, { categoryCode, lineUserId });
    
    // Get category name
    const { data: category } = await supabaseAdmin
      .from("business_categories")
      .select("name_th")
      .eq("category_code", categoryCode)
      .single();
    
    const categoryName = category?.name_th || `หมวดหมู่ ${categoryCode}`;
    
    // First, get total count for the category
    const { count: totalCount } = await supabaseAdmin
      .from("participants")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("status", "member")
      .eq("business_type_code", categoryCode);
    
    const totalFound = totalCount ?? 0;
    
    // Search for members by category with limit
    const { data: members, error: searchError } = await supabaseAdmin
      .from("participants")
      .select(`
        participant_id,
        tenant_id,
        full_name_th,
        nickname_th,
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
        tags,
        onepage_url
      `)
      .eq("tenant_id", tenantId)
      .eq("status", "member")
      .eq("business_type_code", categoryCode)
      .order("full_name_th", { ascending: true })
      .limit(12);
    
    if (searchError) {
      console.error(`${logPrefix} Search error:`, searchError);
      throw new Error("Database search error");
    }
    
    if (!members || members.length === 0) {
      await replyMessage(event.replyToken, {
        type: "text",
        text: `ไม่พบสมาชิกในหมวดหมู่ "${categoryName}"`
      }, accessToken);
      return;
    }
    
    // Get tenant info for branding
    const { data: tenantInfo } = await supabaseAdmin
      .from("tenants")
      .select("tenant_name, logo_url")
      .eq("tenant_id", tenantId)
      .single();
    
    // Add tenant info to members for flex message
    const membersWithTenant = members.map(m => ({
      ...m,
      tenants: tenantInfo
    }));
    
    const baseUrl = getBaseUrl();
    const shareEnabled = await getShareEnabled();
    const shareServiceUrl = await getShareServiceUrl();
    
    // Build flex message using shared pagination function
    if (membersWithTenant.length === 1) {
      const bubble = createMediumBusinessCardBubble(membersWithTenant[0] as BusinessCardData, baseUrl, { shareEnabled, shareServiceUrl });
      await replyMessage(event.replyToken, {
        type: "flex",
        altText: `นามบัตร ${membersWithTenant[0].full_name_th || 'สมาชิก'}`,
        contents: bubble
      }, accessToken);
    } else {
      const hasMoreInDb = totalFound > membersWithTenant.length;
      const { message, displayedCount } = buildPaginatedCarousel(membersWithTenant as BusinessCardData[], {
        baseUrl,
        tenantId,
        shareEnabled,
        shareServiceUrl,
        categoryCode,
        categoryName,
        currentPage: 1,
        hasMoreInDb,
        totalFound
      });
      
      await replyMessage(event.replyToken, message, accessToken);
      console.log(`${logPrefix} Sent ${displayedCount}/${members.length} business cards for category ${categoryCode}`);
      return;
    }
    
    console.log(`${logPrefix} Sent 1/${members.length} business cards for category ${categoryCode}`);
    
  } catch (error: any) {
    console.error(`${logPrefix} Error handling category selection:`, error);
    await replyMessage(event.replyToken, {
      type: "text",
      text: "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง"
    }, accessToken);
  }
}

/**
 * Send LINE reply message with enhanced error logging
 */
export async function replyMessage(
  replyToken: string,
  message: any,
  accessToken: string,
  tenantId?: string
): Promise<void> {
  const logPrefix = "[LineReply]";
  
  try {
    const body = JSON.stringify({
      replyToken,
      messages: [message]
    });
    
    console.log(`${logPrefix} Sending message type: ${message?.type || 'unknown'}`);
    
    const response = await fetch("https://api.line.me/v2/bot/message/reply", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessToken}`
      },
      body
    });

    if (!response.ok) {
      const errorText = await response.text();
      const errorMessage = `LINE API error (${response.status}): ${errorText}`;
      console.error(`${logPrefix} ${errorMessage}`);
      console.error(`${logPrefix} Message body size: ${body.length} bytes`);
      console.error(`${logPrefix} Message type: ${message?.type}, altText: ${message?.altText?.substring(0, 50)}`);
      
      // Log to database for production debugging
      if (tenantId) {
        await logLineReplyError(tenantId, replyToken, message?.type || 'unknown', new Error(errorMessage));
      }
      
      throw new Error(errorMessage);
    }
    
    console.log(`${logPrefix} Message sent successfully`);
  } catch (error: any) {
    console.error(`${logPrefix} Failed to send message:`, error?.message || error);
    throw error;
  }
}
