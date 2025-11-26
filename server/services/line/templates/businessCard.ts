/**
 * LINE Flex Message Template for Business Card
 * Corporate-style design with action buttons
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
  email?: string | null;
  phone?: string | null;
  website_url?: string | null;
  facebook_url?: string | null;
  instagram_url?: string | null;
  business_address?: string | null;
  line_user_id?: string | null;
  tags?: string[] | null;
  onepage_url?: string | null;
}

export function createBusinessCardFlexMessage(data: BusinessCardData, baseUrl: string) {
  // Build action buttons based on available data
  const actions: any[] = [];

  // Phone call action
  const phoneUri = sanitizePhone(data.phone);
  if (phoneUri) {
    actions.push({
      type: "button",
      action: {
        type: "uri",
        label: "📞 โทร",
        uri: phoneUri
      },
      style: "primary",
      height: "sm"
    });
  }

  // Email action
  const emailUri = sanitizeEmail(data.email);
  if (emailUri) {
    actions.push({
      type: "button",
      action: {
        type: "uri",
        label: "📧 อีเมล",
        uri: emailUri
      },
      style: "link",
      height: "sm"
    });
  }

  // Website action
  const websiteUrl = sanitizeUrl(data.website_url);
  if (websiteUrl) {
    actions.push({
      type: "button",
      action: {
        type: "uri",
        label: "🌐 เว็บไซต์",
        uri: websiteUrl
      },
      style: "link",
      height: "sm"
    });
  }

  // LINE chat action (LINE user IDs are safe, already validated by LINE)
  if (data.line_user_id) {
    actions.push({
      type: "button",
      action: {
        type: "uri",
        label: "💬 แชท LINE",
        uri: `https://line.me/R/ti/p/${data.line_user_id}`
      },
      style: "link",
      height: "sm"
    });
  }

  // vCard download action (baseUrl already validated)
  actions.push({
    type: "button",
    action: {
      type: "uri",
      label: "📲 บันทึกเบอร์",
      uri: `${baseUrl}/api/participants/${data.participant_id}/vcard?tenant_id=${data.tenant_id}`
    },
    style: "link",
    height: "sm"
  });

  // One Page action (if available)
  const onepageUrl = sanitizeUrl(data.onepage_url);
  if (onepageUrl) {
    actions.push({
      type: "button",
      action: {
        type: "uri",
        label: "📄 One Page",
        uri: onepageUrl
      },
      style: "link",
      height: "sm"
    });
  }

  // Share action
  actions.push({
    type: "button",
    action: {
      type: "uri",
      label: "🔗 แชร์นามบัตร",
      uri: `https://line.me/R/share?text=${encodeURIComponent(`นามบัตรของ ${data.full_name}\n${baseUrl}/api/participants/${data.participant_id}/business-card?tenant_id=${data.tenant_id}`)}`
    },
    style: "link",
    height: "sm"
  });

  // Build social media footer buttons
  const footerContents: any[] = [];
  
  const facebookUrl = sanitizeUrl(data.facebook_url);
  if (facebookUrl) {
    footerContents.push({
      type: "button",
      action: {
        type: "uri",
        label: "Facebook",
        uri: facebookUrl
      },
      style: "link",
      height: "sm"
    });
  }

  const instagramUrl = sanitizeUrl(data.instagram_url);
  if (instagramUrl) {
    footerContents.push({
      type: "button",
      action: {
        type: "uri",
        label: "Instagram",
        uri: instagramUrl
      },
      style: "link",
      height: "sm"
    });
  }

  // Build body contents
  const bodyContents: any[] = [
    {
      type: "text",
      text: data.full_name,
      weight: "bold",
      size: "xl",
      color: "#1F2937",
      wrap: true
    }
  ];

  if (data.position || data.company) {
    const subtitle = [data.position, data.company].filter(Boolean).join(" • ");
    bodyContents.push({
      type: "text",
      text: subtitle,
      size: "sm",
      color: "#6B7280",
      margin: "md",
      wrap: true
    });
  }

  if (data.tagline) {
    bodyContents.push({
      type: "separator",
      margin: "lg"
    });
    bodyContents.push({
      type: "text",
      text: data.tagline,
      size: "sm",
      color: "#374151",
      margin: "md",
      wrap: true,
      style: "italic"
    });
  }

  // Display tags if available
  if (data.tags && data.tags.length > 0) {
    bodyContents.push({
      type: "separator",
      margin: "lg"
    });
    bodyContents.push({
      type: "box",
      layout: "horizontal",
      margin: "md",
      contents: [
        {
          type: "text",
          text: "🏷️",
          flex: 0,
          size: "sm"
        },
        {
          type: "text",
          text: data.tags.slice(0, 5).join(", "),
          size: "xs",
          color: "#6B7280",
          wrap: true,
          flex: 1,
          margin: "sm"
        }
      ]
    });
  }

  if (data.business_address) {
    bodyContents.push({
      type: "separator",
      margin: "lg"
    });
    bodyContents.push({
      type: "box",
      layout: "horizontal",
      margin: "md",
      contents: [
        {
          type: "text",
          text: "📍",
          flex: 0,
          size: "sm"
        },
        {
          type: "text",
          text: data.business_address,
          size: "xs",
          color: "#6B7280",
          wrap: true,
          flex: 1,
          margin: "sm"
        }
      ]
    });
  }

  // Contact info
  const contactInfo: any[] = [];
  
  if (data.phone) {
    contactInfo.push({
      type: "box",
      layout: "horizontal",
      margin: "md",
      contents: [
        {
          type: "text",
          text: "☎️",
          flex: 0,
          size: "sm"
        },
        {
          type: "text",
          text: data.phone,
          size: "sm",
          color: "#374151",
          flex: 1,
          margin: "sm"
        }
      ]
    });
  }

  if (data.email) {
    contactInfo.push({
      type: "box",
      layout: "horizontal",
      margin: "md",
      contents: [
        {
          type: "text",
          text: "✉️",
          flex: 0,
          size: "sm"
        },
        {
          type: "text",
          text: data.email,
          size: "sm",
          color: "#374151",
          flex: 1,
          margin: "sm"
        }
      ]
    });
  }

  if (contactInfo.length > 0) {
    bodyContents.push({
      type: "separator",
      margin: "lg"
    });
    bodyContents.push(...contactInfo);
  }

  return {
    type: "flex",
    altText: `นามบัตร - ${data.full_name}`,
    contents: {
      type: "bubble",
      size: "mega",
      header: data.photo_url ? {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "image",
            url: data.photo_url,
            size: "full",
            aspectRatio: "20:13",
            aspectMode: "cover"
          }
        ],
        paddingAll: "0px"
      } : undefined,
      body: {
        type: "box",
        layout: "vertical",
        contents: bodyContents
      },
      footer: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          ...actions,
          ...(footerContents.length > 0 ? [
            {
              type: "separator",
              margin: "md"
            },
            {
              type: "box",
              layout: "horizontal",
              spacing: "sm",
              margin: "md",
              contents: footerContents
            }
          ] : [])
        ],
        flex: 0
      },
      styles: {
        header: {
          backgroundColor: "#F3F4F6"
        },
        body: {
          backgroundColor: "#FFFFFF"
        },
        footer: {
          backgroundColor: "#F9FAFB",
          separator: true
        }
      }
    }
  };
}
