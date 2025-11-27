/**
 * LINE Flex Message Template for Professional Business Card
 * Clean, corporate design with organized actions
 */

import { sanitizeUrl, sanitizePhone, sanitizeEmail } from "../urlValidator";

export interface BusinessCardData {
  participant_id: string;
  tenant_id: string;
  full_name: string;
  nickname?: string | null;
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

export function createBusinessCardFlexMessage(data: BusinessCardData, baseUrl: string) {
  const phoneUri = sanitizePhone(data.phone);
  const emailUri = sanitizeEmail(data.email);
  const websiteUrl = sanitizeUrl(data.website_url);
  const facebookUrl = sanitizeUrl(data.facebook_url);
  const instagramUrl = sanitizeUrl(data.instagram_url);
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
    const initials = data.full_name
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
      text: data.full_name,
      weight: "bold",
      size: "xl",
      color: COLORS.textDark,
      wrap: true
    }
  ];

  if (data.nickname) {
    nameSection.push({
      type: "text",
      text: `"${data.nickname}"`,
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

  if (data.line_id) {
    const lineProfileUrl = `https://line.me/R/ti/p/~${encodeURIComponent(data.line_id)}`;
    primaryActions.push({
      type: "button",
      action: {
        type: "uri",
        label: "LINE",
        uri: lineProfileUrl
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

  if (onepageUrl) {
    secondaryActions.push({
      type: "button",
      action: {
        type: "uri",
        label: "ดู One Page",
        uri: onepageUrl
      },
      style: "secondary",
      height: "sm"
    });
  } else if (websiteUrl) {
    secondaryActions.push({
      type: "button",
      action: {
        type: "uri",
        label: "ดูเว็บไซต์",
        uri: websiteUrl
      },
      style: "secondary",
      height: "sm"
    });
  }

  secondaryActions.push({
    type: "button",
    action: {
      type: "uri",
      label: "Profile Page",
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
    altText: `นามบัตร - ${data.full_name}`,
    contents: bubble
  };
}
