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

  const getUrgencyColor = () => {
    switch (notificationType) {
      case '2_hours':
        return '#FF6B6B';
      case '1_day':
        return '#FFB347';
      case '7_days':
        return '#4ECDC4';
      case 'manual':
        return '#6C5CE7';
      default:
        return '#4ECDC4';
    }
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
        backgroundColor: getUrgencyColor(),
        paddingAll: "15px",
        contents: [
          {
            type: "text",
            text: getNotificationTitle(),
            color: "#FFFFFF",
            size: "lg",
            weight: "bold"
          },
          {
            type: "text",
            text: chapterName,
            color: "#FFFFFF",
            size: "sm",
            margin: "xs"
          }
        ]
      },
      body: {
        type: "box",
        layout: "vertical",
        paddingAll: "15px",
        spacing: "md",
        contents: [
          {
            type: "text",
            text: `สวัสดี ${memberName}`,
            size: "md",
            weight: "bold"
          },
          {
            type: "separator",
            margin: "md"
          },
          {
            type: "box",
            layout: "vertical",
            spacing: "sm",
            margin: "md",
            contents: [
              {
                type: "box",
                layout: "horizontal",
                spacing: "sm",
                contents: [
                  {
                    type: "text",
                    text: "หัวข้อ",
                    color: "#888888",
                    size: "sm",
                    flex: 2
                  },
                  {
                    type: "text",
                    text: theme || "ประชุมประจำสัปดาห์",
                    size: "sm",
                    flex: 5,
                    wrap: true
                  }
                ]
              },
              {
                type: "box",
                layout: "horizontal",
                spacing: "sm",
                contents: [
                  {
                    type: "text",
                    text: "วันที่",
                    color: "#888888",
                    size: "sm",
                    flex: 2
                  },
                  {
                    type: "text",
                    text: formattedDate,
                    size: "sm",
                    flex: 5,
                    wrap: true
                  }
                ]
              },
              {
                type: "box",
                layout: "horizontal",
                spacing: "sm",
                contents: [
                  {
                    type: "text",
                    text: "เวลา",
                    color: "#888888",
                    size: "sm",
                    flex: 2
                  },
                  {
                    type: "text",
                    text: meetingTime || "ตามกำหนด",
                    size: "sm",
                    flex: 5
                  }
                ]
              },
              {
                type: "box",
                layout: "horizontal",
                spacing: "sm",
                contents: [
                  {
                    type: "text",
                    text: "สถานที่",
                    color: "#888888",
                    size: "sm",
                    flex: 2
                  },
                  {
                    type: "text",
                    text: venue || "TBA",
                    size: "sm",
                    flex: 5,
                    wrap: true
                  }
                ]
              }
            ]
          },
          ...(totalMembers > 0 ? [{
            type: "box",
            layout: "horizontal",
            margin: "md",
            contents: [
              {
                type: "text",
                text: `ยืนยันแล้ว ${confirmedCount}/${totalMembers} คน`,
                size: "sm",
                color: "#4ECDC4",
                align: "center"
              }
            ]
          }] : [])
        ]
      },
      footer: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        paddingAll: "15px",
        contents: [
          {
            type: "box",
            layout: "horizontal",
            spacing: "sm",
            contents: [
              {
                type: "button",
                style: "primary",
                color: "#4ECDC4",
                height: "sm",
                action: {
                  type: "postback",
                  label: "เข้าร่วม",
                  data: `action=rsvp_confirm&meeting_id=${meetingId}`,
                  displayText: "ยืนยันเข้าร่วม"
                },
                flex: 1
              },
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
              }
            ]
          },
          {
            type: "button",
            style: "secondary",
            height: "sm",
            margin: "sm",
            action: {
              type: "postback",
              label: "ขอลา",
              data: `action=rsvp_leave&meeting_id=${meetingId}`,
              displayText: "ขอลา"
            }
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
          icon: '',
          title: 'ยืนยันเข้าร่วมแล้ว',
          color: '#4ECDC4',
          message: `ขอบคุณที่ยืนยันเข้าร่วม Meeting\nวันที่ ${formattedDate}\n\nแล้วพบกันนะครับ`
        };
      case 'substitute':
        return {
          icon: '',
          title: 'ส่งหาตัวแทนแล้ว',
          color: '#FFB347',
          message: substituteInfo 
            ? `บันทึกตัวแทนสำเร็จ\nชื่อ: ${substituteInfo.name}\nเบอร์: ${substituteInfo.phone}`
            : 'กำลังเปิดหน้าลงทะเบียนตัวแทน...'
        };
      case 'leave':
        return {
          icon: '',
          title: 'บันทึกการลาแล้ว',
          color: '#FF6B6B',
          message: `บันทึกการลาสำหรับ Meeting\nวันที่ ${formattedDate}\n\n${leaveReason ? `เหตุผล: ${leaveReason}` : 'ได้แจ้งผู้ดูแลแล้ว'}`
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
      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: content.color,
        paddingAll: "12px",
        contents: [
          {
            type: "text",
            text: content.title,
            color: "#FFFFFF",
            size: "md",
            weight: "bold",
            align: "center"
          }
        ]
      },
      body: {
        type: "box",
        layout: "vertical",
        paddingAll: "15px",
        contents: [
          {
            type: "text",
            text: content.message,
            size: "sm",
            wrap: true,
            align: "center"
          }
        ]
      }
    }
  };
}
