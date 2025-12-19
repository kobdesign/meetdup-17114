interface EventNotificationParams {
  meetingId: string;
  meetingDate: string;
  meetingTime: string;
  theme: string;
  venue: string;
  chapterName: string;
  memberName: string;
  notificationType: '7_days' | '1_day' | '2_hours' | 'manual';
  confirmedCount?: number;
  totalMembers?: number;
}

export function createEventNotificationFlex(params: EventNotificationParams): any {
  const {
    meetingId,
    meetingDate,
    meetingTime,
    theme,
    venue,
    chapterName,
    memberName,
    notificationType,
    confirmedCount = 0,
    totalMembers = 0
  } = params;

  const dateObj = new Date(meetingDate);
  const formattedDate = dateObj.toLocaleDateString('th-TH', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const getNotificationTitle = () => {
    switch (notificationType) {
      case '7_days':
        return 'Meeting สัปดาห์หน้า';
      case '1_day':
        return 'Meeting พรุ่งนี้';
      case '2_hours':
        return 'Meeting เริ่มเร็วๆ นี้';
      case 'manual':
        return 'แจ้งเตือน Meeting';
      default:
        return 'แจ้งเตือน Meeting';
    }
  };

  const getCountdownBadge = () => {
    switch (notificationType) {
      case '2_hours':
        return 'อีก 2 ชม.';
      case '1_day':
        return 'พรุ่งนี้';
      case '7_days':
        return 'อีก 7 วัน';
      case 'manual':
        return '';
      default:
        return '';
    }
  };

  const getUrgencyColors = () => {
    switch (notificationType) {
      case '2_hours':
        return { primary: '#E74C3C', secondary: '#C0392B', badge: '#FADBD8' };
      case '1_day':
        return { primary: '#F39C12', secondary: '#D68910', badge: '#FCF3CF' };
      case '7_days':
        return { primary: '#27AE60', secondary: '#1E8449', badge: '#D5F5E3' };
      case 'manual':
        return { primary: '#8E44AD', secondary: '#6C3483', badge: '#E8DAEF' };
      default:
        return { primary: '#27AE60', secondary: '#1E8449', badge: '#D5F5E3' };
    }
  };

  const colors = getUrgencyColors();
  const countdownBadge = getCountdownBadge();
  const progressPercent = totalMembers > 0 ? Math.round((confirmedCount / totalMembers) * 100) : 0;

  const createProgressBar = () => {
    if (totalMembers === 0) return [];
    
    return [{
      type: "box",
      layout: "vertical",
      margin: "lg",
      contents: [
        {
          type: "box",
          layout: "horizontal",
          contents: [
            {
              type: "text",
              text: "ยืนยันเข้าร่วมแล้ว",
              size: "xs",
              color: "#888888",
              flex: 1
            },
            {
              type: "text",
              text: `${confirmedCount}/${totalMembers} คน`,
              size: "xs",
              color: colors.primary,
              align: "end",
              weight: "bold"
            }
          ]
        },
        {
          type: "box",
          layout: "vertical",
          margin: "sm",
          height: "8px",
          backgroundColor: "#E8E8E8",
          cornerRadius: "4px",
          contents: [
            {
              type: "box",
              layout: "vertical",
              height: "8px",
              width: `${Math.min(progressPercent, 100)}%`,
              backgroundColor: colors.primary,
              cornerRadius: "4px",
              contents: []
            }
          ]
        }
      ]
    }];
  };

  return {
    type: "flex",
    altText: `${getNotificationTitle()} - ${theme}`,
    contents: {
      type: "bubble",
      size: "mega",
      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: colors.primary,
        paddingAll: "20px",
        contents: [
          {
            type: "box",
            layout: "horizontal",
            contents: [
              {
                type: "box",
                layout: "vertical",
                flex: 1,
                contents: [
                  {
                    type: "text",
                    text: getNotificationTitle(),
                    color: "#FFFFFF",
                    size: "xl",
                    weight: "bold"
                  },
                  {
                    type: "text",
                    text: chapterName,
                    color: "#FFFFFF",
                    size: "sm",
                    margin: "sm",
                    opacity: 0.8
                  }
                ]
              },
              ...(countdownBadge ? [{
                type: "box",
                layout: "vertical",
                backgroundColor: colors.badge,
                cornerRadius: "md",
                paddingAll: "8px",
                justifyContent: "center",
                contents: [
                  {
                    type: "text",
                    text: countdownBadge,
                    color: colors.secondary,
                    size: "sm",
                    weight: "bold",
                    align: "center"
                  }
                ]
              }] : [])
            ]
          }
        ]
      },
      body: {
        type: "box",
        layout: "vertical",
        paddingAll: "20px",
        spacing: "md",
        contents: [
          {
            type: "text",
            text: `สวัสดีครับ คุณ${memberName}`,
            size: "md",
            weight: "bold",
            color: "#333333"
          },
          {
            type: "separator",
            margin: "lg",
            color: "#EEEEEE"
          },
          {
            type: "box",
            layout: "vertical",
            spacing: "md",
            margin: "lg",
            contents: [
              {
                type: "box",
                layout: "horizontal",
                spacing: "md",
                contents: [
                  {
                    type: "box",
                    layout: "vertical",
                    width: "24px",
                    height: "24px",
                    backgroundColor: "#F0F4F8",
                    cornerRadius: "12px",
                    justifyContent: "center",
                    alignItems: "center",
                    contents: [
                      {
                        type: "text",
                        text: "T",
                        size: "xxs",
                        color: colors.primary,
                        weight: "bold"
                      }
                    ]
                  },
                  {
                    type: "box",
                    layout: "vertical",
                    flex: 1,
                    contents: [
                      {
                        type: "text",
                        text: "หัวข้อ",
                        color: "#888888",
                        size: "xs"
                      },
                      {
                        type: "text",
                        text: theme || "ประชุมประจำสัปดาห์",
                        size: "sm",
                        weight: "bold",
                        wrap: true,
                        margin: "xs"
                      }
                    ]
                  }
                ]
              },
              {
                type: "box",
                layout: "horizontal",
                spacing: "md",
                contents: [
                  {
                    type: "box",
                    layout: "vertical",
                    width: "24px",
                    height: "24px",
                    backgroundColor: "#F0F4F8",
                    cornerRadius: "12px",
                    justifyContent: "center",
                    alignItems: "center",
                    contents: [
                      {
                        type: "text",
                        text: "D",
                        size: "xxs",
                        color: colors.primary,
                        weight: "bold"
                      }
                    ]
                  },
                  {
                    type: "box",
                    layout: "vertical",
                    flex: 1,
                    contents: [
                      {
                        type: "text",
                        text: "วันที่",
                        color: "#888888",
                        size: "xs"
                      },
                      {
                        type: "text",
                        text: formattedDate,
                        size: "sm",
                        weight: "bold",
                        wrap: true,
                        margin: "xs"
                      }
                    ]
                  }
                ]
              },
              {
                type: "box",
                layout: "horizontal",
                spacing: "md",
                contents: [
                  {
                    type: "box",
                    layout: "vertical",
                    width: "24px",
                    height: "24px",
                    backgroundColor: "#F0F4F8",
                    cornerRadius: "12px",
                    justifyContent: "center",
                    alignItems: "center",
                    contents: [
                      {
                        type: "text",
                        text: "C",
                        size: "xxs",
                        color: colors.primary,
                        weight: "bold"
                      }
                    ]
                  },
                  {
                    type: "box",
                    layout: "vertical",
                    flex: 1,
                    contents: [
                      {
                        type: "text",
                        text: "เวลา",
                        color: "#888888",
                        size: "xs"
                      },
                      {
                        type: "text",
                        text: meetingTime || "ตามกำหนด",
                        size: "sm",
                        weight: "bold",
                        margin: "xs"
                      }
                    ]
                  }
                ]
              },
              {
                type: "box",
                layout: "horizontal",
                spacing: "md",
                contents: [
                  {
                    type: "box",
                    layout: "vertical",
                    width: "24px",
                    height: "24px",
                    backgroundColor: "#F0F4F8",
                    cornerRadius: "12px",
                    justifyContent: "center",
                    alignItems: "center",
                    contents: [
                      {
                        type: "text",
                        text: "P",
                        size: "xxs",
                        color: colors.primary,
                        weight: "bold"
                      }
                    ]
                  },
                  {
                    type: "box",
                    layout: "vertical",
                    flex: 1,
                    contents: [
                      {
                        type: "text",
                        text: "สถานที่",
                        color: "#888888",
                        size: "xs"
                      },
                      {
                        type: "text",
                        text: venue || "TBA",
                        size: "sm",
                        weight: "bold",
                        wrap: true,
                        margin: "xs"
                      }
                    ]
                  }
                ]
              }
            ]
          },
          ...createProgressBar()
        ]
      },
      footer: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        paddingAll: "20px",
        backgroundColor: "#FAFAFA",
        contents: [
          {
            type: "button",
            style: "primary",
            color: colors.primary,
            height: "md",
            action: {
              type: "postback",
              label: "ยืนยันเข้าร่วม",
              data: `action=rsvp_confirm&meeting_id=${meetingId}`,
              displayText: "ยืนยันเข้าร่วม Meeting"
            }
          },
          {
            type: "box",
            layout: "horizontal",
            spacing: "sm",
            margin: "md",
            contents: [
              {
                type: "button",
                style: "secondary",
                height: "sm",
                action: {
                  type: "postback",
                  label: "หาตัวแทน",
                  data: `action=rsvp_substitute&meeting_id=${meetingId}`,
                  displayText: "ขอหาตัวแทน"
                },
                flex: 1
              },
              {
                type: "button",
                style: "secondary",
                height: "sm",
                action: {
                  type: "postback",
                  label: "ขอลา",
                  data: `action=rsvp_leave&meeting_id=${meetingId}`,
                  displayText: "ขอลา"
                },
                flex: 1
              }
            ]
          }
        ]
      }
    }
  };
}

export function createRsvpConfirmationFlex(params: {
  action: 'confirmed' | 'substitute' | 'leave';
  meetingDate: string;
  theme: string;
  memberName: string;
  substituteInfo?: { name: string; phone: string };
  leaveReason?: string;
}): any {
  const { action, meetingDate, theme, memberName, substituteInfo, leaveReason } = params;

  const dateObj = new Date(meetingDate);
  const formattedDate = dateObj.toLocaleDateString('th-TH', {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  });

  const getContent = () => {
    switch (action) {
      case 'confirmed':
        return {
          icon: 'O',
          iconBg: '#27AE60',
          title: 'ยืนยันเข้าร่วมแล้ว',
          color: '#27AE60',
          message: `ขอบคุณที่ยืนยันเข้าร่วม Meeting\nวันที่ ${formattedDate}`,
          footer: 'แล้วพบกันนะครับ'
        };
      case 'substitute':
        return {
          icon: 'S',
          iconBg: '#F39C12',
          title: 'บันทึกตัวแทนแล้ว',
          color: '#F39C12',
          message: substituteInfo 
            ? `ชื่อตัวแทน: ${substituteInfo.name}\nเบอร์โทร: ${substituteInfo.phone}`
            : 'กำลังเปิดหน้าลงทะเบียนตัวแทน...',
          footer: substituteInfo ? 'ระบบได้บันทึกข้อมูลแล้ว' : ''
        };
      case 'leave':
        return {
          icon: 'L',
          iconBg: '#E74C3C',
          title: 'บันทึกการลาแล้ว',
          color: '#E74C3C',
          message: `Meeting วันที่ ${formattedDate}\n${leaveReason ? `เหตุผล: ${leaveReason}` : ''}`,
          footer: 'ได้แจ้งผู้ดูแลแล้ว'
        };
    }
  };

  const content = getContent();

  return {
    type: "flex",
    altText: content.title,
    contents: {
      type: "bubble",
      size: "kilo",
      body: {
        type: "box",
        layout: "vertical",
        paddingAll: "24px",
        contents: [
          {
            type: "box",
            layout: "vertical",
            alignItems: "center",
            contents: [
              {
                type: "box",
                layout: "vertical",
                width: "56px",
                height: "56px",
                backgroundColor: content.iconBg,
                cornerRadius: "28px",
                justifyContent: "center",
                alignItems: "center",
                contents: [
                  {
                    type: "text",
                    text: content.icon,
                    color: "#FFFFFF",
                    size: "xl",
                    weight: "bold"
                  }
                ]
              },
              {
                type: "text",
                text: content.title,
                size: "lg",
                weight: "bold",
                color: content.color,
                margin: "lg",
                align: "center"
              }
            ]
          },
          {
            type: "separator",
            margin: "xl",
            color: "#EEEEEE"
          },
          {
            type: "box",
            layout: "vertical",
            margin: "xl",
            contents: [
              {
                type: "text",
                text: content.message,
                size: "sm",
                color: "#555555",
                wrap: true,
                align: "center"
              },
              ...(content.footer ? [{
                type: "text",
                text: content.footer,
                size: "xs",
                color: "#888888",
                margin: "lg",
                align: "center"
              }] : [])
            ]
          }
        ]
      }
    }
  };
}
