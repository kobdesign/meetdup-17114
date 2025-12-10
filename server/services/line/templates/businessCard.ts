/**
 * LINE Flex Message Template for Professional Business Card
 * Clean, corporate design with organized actions
 */

import { sanitizeUrl, sanitizePhone, sanitizeEmail, sanitizeLineId } from "../urlValidator";

export interface BusinessCardData {
  participant_id: string;
  tenant_id: string;
  full_name_th: string;
  nickname_th?: string | null;
  position?: string | null;
  company?: string | null;
  tagline?: string | null;
  photo_url?: string | null;
  company_logo_url?: string | null;
  email?: string | null;
  phone?: string | null;
  website_url?: string | null;
  facebook_url?: string | null;
  instagram_url?: string | null;
  linkedin_url?: string | null;
  business_address?: string | null;
  line_user_id?: string | null;
  line_id?: string | null;
  tags?: string[] | null;
  onepage_url?: string | null;
}

const COLORS = {
  primary: "#1E3A5F",
  primaryLight: "#2D5A8A",
  accent: "#D4AF37",
  accentLight: "#E8C547",
  textDark: "#1F2937",
  textMedium: "#4B5563",
  textLight: "#6B7280",
  bgWhite: "#FFFFFF",
  bgLight: "#F8FAFC",
  bgMuted: "#F1F5F9",
  separator: "#E2E8F0",
};

export interface BusinessCardOptions {
  shareEnabled?: boolean;
  shareServiceUrl?: string;
}

export interface ViewMoreOptions {
  currentPage?: number;
  hasNextPage?: boolean;
  type?: 'search' | 'category';
  categoryCode?: string;
  categoryName?: string;
}

/**
 * Create a "View More" bubble for carousel when there are more results
 * Links to LIFF Cards page with search term or category pre-filled
 * Optionally shows "Next Page" button for pagination
 */
export function createViewMoreBubble(
  remainingCount: number, 
  totalCount: number,
  searchTerm: string,
  tenantId: string,
  baseUrl: string,
  options?: ViewMoreOptions
): any {
  const currentPage = options?.currentPage ?? 1;
  const hasNextPage = options?.hasNextPage ?? false;
  const searchType = options?.type ?? 'search';
  
  // Build LIFF URL based on type
  const liffCardsUrl = searchType === 'category' && options?.categoryCode
    ? `${baseUrl}/liff/cards?category=${encodeURIComponent(options.categoryCode)}&tenantId=${tenantId}`
    : `${baseUrl}/liff/cards?search=${encodeURIComponent(searchTerm)}&tenantId=${tenantId}`;
  
  const footerButtons: any[] = [];
  
  // "Next Page" button (postback) - only show if there are more pages
  if (hasNextPage) {
    const nextPage = currentPage + 1;
    if (searchType === 'category' && options?.categoryCode) {
      footerButtons.push({
        type: "button",
        action: {
          type: "postback",
          label: `หน้าถัดไป (${nextPage})`,
          data: `category_page:${nextPage}:${options.categoryCode}`
        },
        style: "link",
        height: "sm"
      });
    } else {
      const encodedSearchTerm = encodeURIComponent(searchTerm);
      footerButtons.push({
        type: "button",
        action: {
          type: "postback",
          label: `หน้าถัดไป (${nextPage})`,
          data: `business_card_page:${nextPage}:${encodedSearchTerm}`
        },
        style: "link",
        height: "sm"
      });
    }
  }
  
  // "View All at Website" button
  footerButtons.push({
    type: "button",
    action: {
      type: "uri",
      label: "ดูทั้งหมดที่ Website",
      uri: liffCardsUrl
    },
    style: "primary",
    height: "sm",
    color: COLORS.primary
  });
  
  // Context text based on type
  const contextText = searchType === 'category' && options?.categoryName
    ? `หมวด: "${options.categoryName}"`
    : `คำค้นหา: "${searchTerm}"`;
  
  return {
    type: "bubble",
    size: "kilo",
    body: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "text",
          text: `พบอีก ${remainingCount} คน`,
          weight: "bold",
          size: "lg",
          color: COLORS.primary,
          align: "center"
        },
        {
          type: "text",
          text: `รวมทั้งหมด ${totalCount} คน`,
          size: "sm",
          color: COLORS.textMedium,
          align: "center",
          margin: "sm"
        },
        {
          type: "text",
          text: contextText,
          size: "xs",
          color: COLORS.textLight,
          align: "center",
          margin: "md",
          wrap: true
        }
      ],
      paddingAll: "20px",
      backgroundColor: COLORS.bgLight,
      justifyContent: "center"
    },
    footer: {
      type: "box",
      layout: "vertical",
      contents: footerButtons,
      spacing: "sm",
      paddingAll: "12px",
      backgroundColor: COLORS.bgWhite
    }
  };
}

export interface BuildCarouselOptions {
  baseUrl: string;
  tenantId: string;
  shareEnabled: boolean;
  shareServiceUrl?: string;
  searchTerm?: string;
  categoryCode?: string;
  categoryName?: string;
  currentPage?: number;
  hasMoreInDb?: boolean;
}

/**
 * Shared function to build carousel with medium cards and pagination
 * Used by both handleCardSearch and handleCategorySelection
 */
export function buildPaginatedCarousel(
  members: BusinessCardData[],
  options: BuildCarouselOptions
): { message: any; displayedCount: number } {
  const maxBubbles = 7;
  const totalCount = members.length;
  const needsViewMore = totalCount >= maxBubbles || options.hasMoreInDb;
  
  const cardsToShow = needsViewMore ? Math.min(maxBubbles - 1, totalCount) : totalCount;
  const displayMembers = members.slice(0, cardsToShow);
  
  const carouselContents: any[] = displayMembers.map(m => 
    createMediumBusinessCardBubble(m, options.baseUrl, { 
      shareEnabled: options.shareEnabled, 
      shareServiceUrl: options.shareServiceUrl 
    })
  );
  
  if (needsViewMore) {
    const remainingCount = totalCount - cardsToShow;
    const hasNextPage = (options.hasMoreInDb ?? false) || totalCount > cardsToShow;
    
    const viewMoreOptions: ViewMoreOptions = {
      currentPage: options.currentPage ?? 1,
      hasNextPage,
      type: options.categoryCode ? 'category' : 'search',
      categoryCode: options.categoryCode,
      categoryName: options.categoryName
    };
    
    carouselContents.push(
      createViewMoreBubble(
        remainingCount, 
        totalCount, 
        options.searchTerm || options.categoryName || '',
        options.tenantId, 
        options.baseUrl, 
        viewMoreOptions
      )
    );
  }
  
  const contextLabel = options.categoryName 
    ? `หมวด "${options.categoryName}"`
    : `"${options.searchTerm}"`;
  
  const altText = needsViewMore 
    ? `พบ ${totalCount} รายการ (แสดง ${cardsToShow} รายการแรก)`
    : `พบ ${totalCount} รายการใน${contextLabel}`;
  
  return {
    message: {
      type: "flex" as const,
      altText,
      contents: {
        type: "carousel" as const,
        contents: carouselContents
      }
    },
    displayedCount: cardsToShow
  };
}

/**
 * Create a medium business card for carousel search results
 * Shows: photo, name, nickname, position, company, tagline, phone, email, LINE + action buttons
 * Excludes: tags, Profile button, company logo
 * Size: ~5-6KB per bubble
 */
export function createMediumBusinessCardBubble(data: BusinessCardData, baseUrl: string, options?: BusinessCardOptions): any {
  const shareEnabled = options?.shareEnabled ?? true;
  const phoneUri = sanitizePhone(data.phone);
  const emailUri = sanitizeEmail(data.email);
  const onepageUrl = sanitizeUrl(data.onepage_url);
  
  // External Share Service URL
  const rawShareServiceUrl = options?.shareServiceUrl || "https://line-share-flex-api.lovable.app";
  const shareServiceUrl = rawShareServiceUrl.replace(/\/+$/, "");
  const flexJsonUrl = `${baseUrl}/api/public/share-flex/${data.participant_id}?tenantId=${data.tenant_id}&format=raw`;
  const shareUrl = `${shareServiceUrl}/share?messages=${encodeURIComponent(flexJsonUrl)}`;

  // Hero section with photo
  const heroContents: any[] = [];

  if (data.photo_url) {
    heroContents.push({
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "image",
          url: data.photo_url,
          size: "full",
          aspectRatio: "1:1",
          aspectMode: "cover"
        }
      ],
      width: "60px",
      height: "60px",
      cornerRadius: "30px",
      borderWidth: "2px",
      borderColor: COLORS.accent
    });
  } else {
    const initials = data.full_name_th
      .split(" ")
      .map(n => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

    heroContents.push({
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "text",
          text: initials,
          size: "lg",
          weight: "bold",
          color: COLORS.bgWhite,
          align: "center",
          gravity: "center"
        }
      ],
      width: "60px",
      height: "60px",
      cornerRadius: "30px",
      backgroundColor: COLORS.primaryLight,
      borderWidth: "2px",
      borderColor: COLORS.accent,
      justifyContent: "center",
      alignItems: "center"
    });
  }

  // Name section
  const nameSection: any[] = [
    {
      type: "text",
      text: data.full_name_th,
      weight: "bold",
      size: "md",
      color: COLORS.textDark,
      wrap: true,
      maxLines: 2
    }
  ];

  if (data.nickname_th) {
    nameSection.push({
      type: "text",
      text: `"${data.nickname_th}"`,
      size: "sm",
      color: COLORS.accent,
      weight: "bold",
      margin: "xs"
    });
  }

  // Position and company (no logo)
  if (data.position || data.company) {
    const posCompany = [data.position, data.company].filter(Boolean).join(" | ");
    nameSection.push({
      type: "text",
      text: posCompany,
      size: "xs",
      color: COLORS.textMedium,
      margin: "xs",
      wrap: true,
      maxLines: 2
    });
  }

  // Body contents - tagline
  const bodyContents: any[] = [];

  if (data.tagline) {
    bodyContents.push({
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "text",
          text: `"${data.tagline.length > 80 ? data.tagline.substring(0, 80) + "..." : data.tagline}"`,
          size: "xs",
          color: COLORS.textMedium,
          wrap: true,
          maxLines: 3,
          style: "italic"
        }
      ],
      backgroundColor: COLORS.bgMuted,
      paddingAll: "10px",
      cornerRadius: "6px"
    });
  }

  // Contact info with badge style (like Full Card)
  const contactItems: any[] = [];

  if (data.phone) {
    contactItems.push({
      type: "box",
      layout: "horizontal",
      contents: [
        {
          type: "box",
          layout: "vertical",
          contents: [
            {
              type: "text",
              text: "TEL",
              size: "xxs",
              color: COLORS.bgWhite,
              align: "center"
            }
          ],
          backgroundColor: COLORS.primary,
          width: "32px",
          height: "16px",
          cornerRadius: "3px",
          justifyContent: "center",
          alignItems: "center"
        },
        {
          type: "text",
          text: data.phone,
          size: "xs",
          color: COLORS.textDark,
          margin: "sm",
          flex: 1
        }
      ],
      alignItems: "center"
    });
  }

  if (data.email) {
    contactItems.push({
      type: "box",
      layout: "horizontal",
      contents: [
        {
          type: "box",
          layout: "vertical",
          contents: [
            {
              type: "text",
              text: "EMAIL",
              size: "xxs",
              color: COLORS.bgWhite,
              align: "center"
            }
          ],
          backgroundColor: COLORS.primary,
          width: "32px",
          height: "16px",
          cornerRadius: "3px",
          justifyContent: "center",
          alignItems: "center"
        },
        {
          type: "text",
          text: data.email,
          size: "xxs",
          color: COLORS.textDark,
          margin: "sm",
          flex: 1,
          wrap: true,
          maxLines: 1
        }
      ],
      alignItems: "center"
    });
  }

  if (data.line_id) {
    contactItems.push({
      type: "box",
      layout: "horizontal",
      contents: [
        {
          type: "box",
          layout: "vertical",
          contents: [
            {
              type: "text",
              text: "LINE",
              size: "xxs",
              color: COLORS.bgWhite,
              align: "center"
            }
          ],
          backgroundColor: "#06C755",
          width: "32px",
          height: "16px",
          cornerRadius: "3px",
          justifyContent: "center",
          alignItems: "center"
        },
        {
          type: "text",
          text: `@${data.line_id}`,
          size: "xs",
          color: "#06C755",
          margin: "sm",
          flex: 1
        }
      ],
      alignItems: "center"
    });
  }

  if (contactItems.length > 0) {
    bodyContents.push({
      type: "box",
      layout: "vertical",
      contents: contactItems,
      spacing: "sm",
      margin: bodyContents.length > 0 ? "md" : "none"
    });
  }

  // Footer with action buttons
  const primaryActions: any[] = [];

  if (phoneUri) {
    primaryActions.push({
      type: "button",
      action: {
        type: "uri",
        label: "โทร",
        uri: phoneUri
      },
      style: "primary",
      height: "sm",
      color: COLORS.primary
    });
  }

  // Use sanitizeLineId to safely create LINE profile URL
  const lineProfileUrl = sanitizeLineId(data.line_id);
  if (lineProfileUrl) {
    primaryActions.push({
      type: "button",
      action: {
        type: "uri",
        label: "LINE",
        uri: lineProfileUrl
      },
      style: "primary",
      height: "sm",
      color: "#06C755"
    });
  }

  const footerContents: any[] = [];

  if (primaryActions.length > 0) {
    footerContents.push({
      type: "box",
      layout: "horizontal",
      contents: primaryActions.slice(0, 3), // Max 3 buttons in a row
      spacing: "sm"
    });
  }

  // Secondary actions row: OnePage + Share
  const secondaryActions: any[] = [];

  // OnePage button (if available)
  if (onepageUrl) {
    secondaryActions.push({
      type: "button",
      action: {
        type: "uri",
        label: "One Page",
        uri: onepageUrl
      },
      style: "secondary",
      height: "sm"
    });
  }

  // Share button (if enabled)
  if (shareEnabled) {
    secondaryActions.push({
      type: "button",
      action: {
        type: "uri",
        label: "แชร์",
        uri: shareUrl
      },
      style: "secondary",
      height: "sm"
    });
  }

  if (secondaryActions.length > 0) {
    footerContents.push({
      type: "box",
      layout: "horizontal",
      contents: secondaryActions,
      spacing: "sm",
      margin: primaryActions.length > 0 ? "sm" : "none"
    });
  }

  const bubble: any = {
    type: "bubble",
    size: "kilo",
    header: {
      type: "box",
      layout: "horizontal",
      contents: [
        {
          type: "box",
          layout: "vertical",
          contents: heroContents,
          flex: 0
        },
        {
          type: "box",
          layout: "vertical",
          contents: nameSection,
          flex: 1,
          margin: "md"
        }
      ],
      paddingAll: "14px",
      backgroundColor: COLORS.bgWhite,
      alignItems: "center"
    },
    styles: {
      header: { separator: false },
      body: { separator: false }
    }
  };

  if (bodyContents.length > 0) {
    bubble.body = {
      type: "box",
      layout: "vertical",
      contents: bodyContents,
      paddingAll: "12px",
      paddingTop: "0px",
      backgroundColor: COLORS.bgWhite
    };
  }

  if (footerContents.length > 0) {
    bubble.footer = {
      type: "box",
      layout: "vertical",
      contents: footerContents,
      spacing: "none",
      paddingAll: "12px",
      backgroundColor: COLORS.bgLight
    };
    bubble.styles.footer = {
      separator: true,
      separatorColor: COLORS.separator
    };
  }

  return bubble;
}

export function createBusinessCardFlexMessage(data: BusinessCardData, baseUrl: string, options?: BusinessCardOptions) {
  const shareEnabled = options?.shareEnabled ?? true;
  const phoneUri = sanitizePhone(data.phone);
  const emailUri = sanitizeEmail(data.email);
  const websiteUrl = sanitizeUrl(data.website_url);
  const facebookUrl = sanitizeUrl(data.facebook_url);
  const instagramUrl = sanitizeUrl(data.instagram_url);
  const linkedinUrl = sanitizeUrl(data.linkedin_url);
  const onepageUrl = sanitizeUrl(data.onepage_url);

  const heroContents: any[] = [];

  if (data.photo_url) {
    heroContents.push({
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "image",
          url: data.photo_url,
          size: "full",
          aspectRatio: "1:1",
          aspectMode: "cover"
        }
      ],
      width: "80px",
      height: "80px",
      cornerRadius: "40px",
      borderWidth: "3px",
      borderColor: COLORS.accent,
      offsetTop: "0px",
      offsetStart: "0px",
      position: "relative"
    });
  } else {
    const initials = data.full_name_th
      .split(" ")
      .map(n => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

    heroContents.push({
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "text",
          text: initials,
          size: "xl",
          weight: "bold",
          color: COLORS.bgWhite,
          align: "center",
          gravity: "center"
        }
      ],
      width: "80px",
      height: "80px",
      cornerRadius: "40px",
      backgroundColor: COLORS.primaryLight,
      borderWidth: "3px",
      borderColor: COLORS.accent,
      justifyContent: "center",
      alignItems: "center"
    });
  }

  const nameSection: any[] = [
    {
      type: "text",
      text: data.full_name_th,
      weight: "bold",
      size: "xl",
      color: COLORS.textDark,
      wrap: true
    }
  ];

  if (data.nickname_th) {
    nameSection.push({
      type: "text",
      text: `"${data.nickname_th}"`,
      size: "md",
      color: COLORS.accent,
      weight: "bold",
      margin: "xs"
    });
  }

  if (data.position || data.company) {
    const positionText = data.position || "";
    const companyText = data.company || "";
    
    if (data.position) {
      nameSection.push({
        type: "text",
        text: positionText,
        size: "sm",
        color: COLORS.textMedium,
        margin: "sm",
        wrap: true
      });
    }
    
    if (data.company) {
      if (data.company_logo_url) {
        nameSection.push({
          type: "box",
          layout: "horizontal",
          contents: [
            {
              type: "box",
              layout: "vertical",
              contents: [
                {
                  type: "image",
                  url: data.company_logo_url,
                  size: "full",
                  aspectRatio: "1:1",
                  aspectMode: "cover"
                }
              ],
              width: "24px",
              height: "24px",
              cornerRadius: "4px",
              borderWidth: "1px",
              borderColor: COLORS.separator
            },
            {
              type: "text",
              text: companyText,
              size: "sm",
              color: COLORS.primary,
              weight: "bold",
              margin: "sm",
              wrap: true,
              flex: 1,
              gravity: "center"
            }
          ],
          alignItems: "center",
          margin: "xs"
        });
      } else {
        nameSection.push({
          type: "text",
          text: companyText,
          size: "sm",
          color: COLORS.primary,
          weight: "bold",
          margin: "xs",
          wrap: true
        });
      }
    }
  }

  const bodyContents: any[] = [];

  if (data.tagline) {
    bodyContents.push({
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "text",
          text: `"${data.tagline}"`,
          size: "sm",
          color: COLORS.textMedium,
          wrap: true,
          style: "italic"
        }
      ],
      backgroundColor: COLORS.bgMuted,
      paddingAll: "12px",
      cornerRadius: "8px",
      margin: "lg"
    });
  }

  if (data.tags && data.tags.length > 0) {
    const tagBadges = data.tags.slice(0, 4).map(tag => ({
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "text",
          text: tag,
          size: "xxs",
          color: COLORS.primary,
          align: "center"
        }
      ],
      backgroundColor: COLORS.bgLight,
      paddingAll: "6px",
      paddingStart: "10px",
      paddingEnd: "10px",
      cornerRadius: "12px",
      borderWidth: "1px",
      borderColor: COLORS.separator
    }));

    bodyContents.push({
      type: "box",
      layout: "horizontal",
      contents: tagBadges,
      spacing: "sm",
      margin: "lg"
    });
  }

  const contactItems: any[] = [];

  if (data.phone) {
    contactItems.push({
      type: "box",
      layout: "horizontal",
      contents: [
        {
          type: "box",
          layout: "vertical",
          contents: [
            {
              type: "text",
              text: "TEL",
              size: "xxs",
              color: COLORS.bgWhite,
              align: "center"
            }
          ],
          backgroundColor: COLORS.primary,
          width: "36px",
          height: "18px",
          cornerRadius: "4px",
          justifyContent: "center",
          alignItems: "center"
        },
        {
          type: "text",
          text: data.phone,
          size: "sm",
          color: COLORS.textDark,
          margin: "md",
          flex: 1
        }
      ],
      alignItems: "center"
    });
  }

  if (data.email) {
    contactItems.push({
      type: "box",
      layout: "horizontal",
      contents: [
        {
          type: "box",
          layout: "vertical",
          contents: [
            {
              type: "text",
              text: "EMAIL",
              size: "xxs",
              color: COLORS.bgWhite,
              align: "center"
            }
          ],
          backgroundColor: COLORS.primary,
          width: "36px",
          height: "18px",
          cornerRadius: "4px",
          justifyContent: "center",
          alignItems: "center"
        },
        {
          type: "text",
          text: data.email,
          size: "xs",
          color: COLORS.textDark,
          margin: "md",
          flex: 1,
          wrap: true
        }
      ],
      alignItems: "center",
      margin: "md"
    });
  }

  if (websiteUrl) {
    const displayUrl = data.website_url?.replace(/^https?:\/\//, "").replace(/\/$/, "") || "";
    contactItems.push({
      type: "box",
      layout: "horizontal",
      contents: [
        {
          type: "box",
          layout: "vertical",
          contents: [
            {
              type: "text",
              text: "WEB",
              size: "xxs",
              color: COLORS.bgWhite,
              align: "center"
            }
          ],
          backgroundColor: COLORS.primary,
          width: "36px",
          height: "18px",
          cornerRadius: "4px",
          justifyContent: "center",
          alignItems: "center"
        },
        {
          type: "text",
          text: displayUrl,
          size: "xs",
          color: COLORS.primary,
          margin: "md",
          flex: 1,
          wrap: true,
          action: {
            type: "uri",
            uri: websiteUrl
          }
        }
      ],
      alignItems: "center",
      margin: "md"
    });
  }

  if (data.business_address) {
    contactItems.push({
      type: "box",
      layout: "horizontal",
      contents: [
        {
          type: "box",
          layout: "vertical",
          contents: [
            {
              type: "text",
              text: "ADDR",
              size: "xxs",
              color: COLORS.bgWhite,
              align: "center"
            }
          ],
          backgroundColor: COLORS.primary,
          width: "36px",
          height: "18px",
          cornerRadius: "4px",
          justifyContent: "center",
          alignItems: "center"
        },
        {
          type: "text",
          text: data.business_address,
          size: "xs",
          color: COLORS.textMedium,
          margin: "md",
          flex: 1,
          wrap: true
        }
      ],
      alignItems: "center",
      margin: "md"
    });
  }

  if (contactItems.length > 0) {
    bodyContents.push({
      type: "separator",
      margin: "lg",
      color: COLORS.separator
    });
    bodyContents.push({
      type: "box",
      layout: "vertical",
      contents: contactItems,
      margin: "lg"
    });
  }

  const primaryActions: any[] = [];

  if (phoneUri) {
    primaryActions.push({
      type: "button",
      action: {
        type: "uri",
        label: "โทร",
        uri: phoneUri
      },
      style: "primary",
      color: COLORS.primary,
      height: "sm"
    });
  }

  // Use sanitizeLineId to safely create LINE profile URL
  const safeLineUrl = sanitizeLineId(data.line_id);
  if (safeLineUrl) {
    primaryActions.push({
      type: "button",
      action: {
        type: "uri",
        label: "LINE",
        uri: safeLineUrl
      },
      style: "primary",
      color: "#06C755",
      height: "sm"
    });
  } else if (emailUri) {
    primaryActions.push({
      type: "button",
      action: {
        type: "uri",
        label: "อีเมล",
        uri: emailUri
      },
      style: "primary",
      color: COLORS.primaryLight,
      height: "sm"
    });
  }

  const secondaryActions: any[] = [];

  const publicProfileUrl = `${baseUrl}/p/${data.participant_id}`;
  
  // External Share Service URL - configurable by Super Admin
  // Default: https://line-share-flex-api.lovable.app
  // This service handles LIFF shareTargetPicker without needing our own LIFF implementation
  // Format: {shareServiceUrl}/share?messages={encodedJsonUrl}
  // The JSON URL points to our share-flex endpoint with format=raw for direct JSON response
  const rawShareServiceUrl = options?.shareServiceUrl || "https://line-share-flex-api.lovable.app";
  // Remove trailing slash to prevent double slashes in URL
  const shareServiceUrl = rawShareServiceUrl.replace(/\/+$/, "");
  const flexJsonUrl = `${baseUrl}/api/public/share-flex/${data.participant_id}?tenantId=${data.tenant_id}&format=raw`;
  const shareUrl = `${shareServiceUrl}/share?messages=${encodeURIComponent(flexJsonUrl)}`;

  // Always show One Page button if onepage_url exists (no website fallback)
  if (onepageUrl) {
    secondaryActions.push({
      type: "button",
      action: {
        type: "uri",
        label: "One Page",
        uri: onepageUrl
      },
      style: "secondary",
      height: "sm"
    });
  }

  // Always show Profile Page button
  secondaryActions.push({
    type: "button",
    action: {
      type: "uri",
      label: "Profile",
      uri: publicProfileUrl
    },
    style: "secondary",
    height: "sm"
  });

  const footerContents: any[] = [];

  if (primaryActions.length > 0) {
    footerContents.push({
      type: "box",
      layout: "horizontal",
      contents: primaryActions,
      spacing: "sm"
    });
  }

  if (secondaryActions.length > 0) {
    footerContents.push({
      type: "box",
      layout: "horizontal",
      contents: secondaryActions,
      spacing: "sm",
      margin: primaryActions.length > 0 ? "sm" : "none"
    });
  }

  const extraLinks: any[] = [];

  if (linkedinUrl) {
    extraLinks.push({
      type: "text",
      text: "LinkedIn",
      size: "xs",
      color: "#0A66C2",
      decoration: "underline",
      action: {
        type: "uri",
        uri: linkedinUrl
      }
    });
  }

  if (facebookUrl) {
    extraLinks.push({
      type: "text",
      text: "Facebook",
      size: "xs",
      color: "#1877F2",
      decoration: "underline",
      action: {
        type: "uri",
        uri: facebookUrl
      }
    });
  }

  if (instagramUrl) {
    extraLinks.push({
      type: "text",
      text: "Instagram",
      size: "xs",
      color: "#E4405F",
      decoration: "underline",
      action: {
        type: "uri",
        uri: instagramUrl
      }
    });
  }

  if (extraLinks.length > 0) {
    footerContents.push({
      type: "separator",
      margin: "md",
      color: COLORS.separator
    });
    footerContents.push({
      type: "box",
      layout: "horizontal",
      contents: extraLinks,
      spacing: "lg",
      margin: "md",
      justifyContent: "center"
    });
  }

  // Share button - separate row at bottom for better visibility (only if enabled)
  if (shareEnabled) {
    footerContents.push({
      type: "separator",
      margin: "md",
      color: COLORS.separator
    });
    footerContents.push({
      type: "button",
      action: {
        type: "uri",
        label: "แชร์นามบัตรนี้",
        uri: shareUrl
      },
      style: "secondary",
      height: "sm",
      margin: "md"
    });
  }

  const bubble: any = {
    type: "bubble",
    size: "mega",
    header: {
      type: "box",
      layout: "horizontal",
      contents: [
        {
          type: "box",
          layout: "vertical",
          contents: heroContents,
          flex: 0
        },
        {
          type: "box",
          layout: "vertical",
          contents: nameSection,
          flex: 1,
          margin: "lg"
        }
      ],
      paddingAll: "20px",
      backgroundColor: COLORS.bgWhite,
      alignItems: "center"
    },
    body: {
      type: "box",
      layout: "vertical",
      contents: bodyContents.length > 0 ? bodyContents : [
        {
          type: "box",
          layout: "vertical",
          contents: [],
          height: "8px"
        }
      ],
      paddingAll: "16px",
      paddingTop: bodyContents.length > 0 ? "0px" : "8px",
      paddingBottom: bodyContents.length > 0 ? "16px" : "8px",
      backgroundColor: COLORS.bgWhite
    },
    styles: {
      header: {
        separator: false
      },
      body: {
        separator: false
      }
    }
  };

  if (footerContents.length > 0) {
    bubble.footer = {
      type: "box",
      layout: "vertical",
      contents: footerContents,
      spacing: "none",
      paddingAll: "16px",
      backgroundColor: COLORS.bgLight
    };
    bubble.styles.footer = {
      separator: true,
      separatorColor: COLORS.separator
    };
  }

  return {
    type: "flex",
    altText: `นามบัตร - ${data.full_name_th}`,
    contents: bubble
  };
}
