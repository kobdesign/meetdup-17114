/**
 * LINE Flex Message Template for Activation Success
 * Celebratory design to welcome new members
 * Follows LINE Flex Message specification
 */

export interface ActivationSuccessData {
  participant_id: string;
  full_name: string;
  nickname?: string | null;
  chapter_name: string;
  status: string;
  profile_token: string; // JWT token for profile editing
}

const COLORS = {
  success: "#22C55E",
  primary: "#1E3A5F",
  textDark: "#1F2937",
  textMedium: "#4B5563",
  textLight: "#6B7280",
  bgWhite: "#FFFFFF",
  separator: "#E2E8F0",
};

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    member: "สมาชิก",
    visitor: "ผู้เยี่ยมชม",
    prospect: "ผู้สนใจ",
    alumni: "อดีตสมาชิก",
    declined: "ไม่สนใจ",
  };
  return labels[status] || status;
}

export function createActivationSuccessFlexMessage(data: ActivationSuccessData, baseUrl: string) {
  // Use profile edit URL with token instead of public profile view
  const profileEditUrl = `${baseUrl}/participant-profile/edit?token=${data.profile_token}`;
  const displayName = data.nickname ? `${data.full_name} (${data.nickname})` : data.full_name;

  const bubble = {
    type: "bubble",
    size: "kilo",
    body: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "text",
          text: "ลงทะเบียนสำเร็จ!",
          weight: "bold",
          size: "xl",
          color: COLORS.success,
          align: "center"
        },
        {
          type: "text",
          text: "ยินดีต้อนรับสู่",
          size: "sm",
          color: COLORS.textMedium,
          align: "center",
          margin: "lg"
        },
        {
          type: "text",
          text: data.chapter_name,
          size: "lg",
          weight: "bold",
          color: COLORS.primary,
          align: "center",
          margin: "sm",
          wrap: true
        },
        {
          type: "separator",
          margin: "lg",
          color: COLORS.separator
        },
        {
          type: "box",
          layout: "baseline",
          contents: [
            {
              type: "text",
              text: "ชื่อ",
              size: "sm",
              color: COLORS.textLight,
              flex: 1
            },
            {
              type: "text",
              text: displayName,
              size: "sm",
              color: COLORS.textDark,
              weight: "bold",
              flex: 2,
              align: "end",
              wrap: true
            }
          ],
          margin: "lg"
        },
        {
          type: "box",
          layout: "baseline",
          contents: [
            {
              type: "text",
              text: "สถานะ",
              size: "sm",
              color: COLORS.textLight,
              flex: 1
            },
            {
              type: "text",
              text: getStatusLabel(data.status),
              size: "sm",
              color: COLORS.success,
              weight: "bold",
              flex: 2,
              align: "end"
            }
          ],
          margin: "md"
        },
        {
          type: "separator",
          margin: "lg",
          color: COLORS.separator
        },
        {
          type: "button",
          action: {
            type: "uri",
            label: "แก้ไขโปรไฟล์",
            uri: profileEditUrl
          },
          style: "primary",
          margin: "lg"
        }
      ],
      paddingAll: "20px"
    }
  };

  return {
    type: "flex",
    altText: `ลงทะเบียนสำเร็จ - ยินดีต้อนรับ ${data.full_name}`,
    contents: bubble
  };
}
