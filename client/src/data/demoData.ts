export interface DemoMember {
  id: string;
  fullNameTh: string;
  fullNameEn: string;
  nicknameTh: string;
  businessCategory: string;
  company: string;
  phone: string;
  email: string;
  profileImage?: string;
  status: "active" | "inactive";
}

export interface DemoVisitor {
  id: string;
  fullNameTh: string;
  fullNameEn: string;
  phone: string;
  email: string;
  company: string;
  invitedBy: string;
  visitDate: string;
  status: "registered" | "checked_in" | "no_show";
  feePaid: boolean;
  feeAmount: number;
}

export interface DemoMeeting {
  id: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  status: "upcoming" | "completed" | "cancelled";
  stats: {
    totalMembers: number;
    onTime: number;
    late: number;
    absent: number;
    substitute: number;
    visitors: number;
    visitorsCheckedIn: number;
  };
}

export interface DemoAttendance {
  id: string;
  meetingId: string;
  memberId: string;
  status: "on_time" | "late" | "absent" | "substitute";
  checkInTime?: string;
}

export interface DemoChapter {
  id: string;
  name: string;
  nameTh: string;
  region: string;
  memberCount: number;
  createdAt: string;
}

export const demoChapter: DemoChapter = {
  id: "demo-chapter-001",
  name: "BNI Success Demo",
  nameTh: "BNI ซัคเซส เดโม",
  region: "กรุงเทพมหานคร",
  memberCount: 12,
  createdAt: "2024-01-15",
};

export const demoMembers: DemoMember[] = [
  {
    id: "m1",
    fullNameTh: "สมชาย วงศ์ประเสริฐ",
    fullNameEn: "Somchai Wongprasert",
    nicknameTh: "ชาย",
    businessCategory: "อสังหาริมทรัพย์",
    company: "บ้านดี พร็อพเพอร์ตี้",
    phone: "081-234-5678",
    email: "somchai@example.com",
    status: "active",
  },
  {
    id: "m2",
    fullNameTh: "สุภาพร ศรีสุข",
    fullNameEn: "Supaporn Srisuk",
    nicknameTh: "พร",
    businessCategory: "ประกันภัย",
    company: "ไทยประกันชีวิต",
    phone: "089-876-5432",
    email: "supaporn@example.com",
    status: "active",
  },
  {
    id: "m3",
    fullNameTh: "วิชัย รุ่งเรือง",
    fullNameEn: "Wichai Rungruang",
    nicknameTh: "ชัย",
    businessCategory: "การเงิน",
    company: "ธนาคารกรุงเทพ",
    phone: "082-111-2222",
    email: "wichai@example.com",
    status: "active",
  },
  {
    id: "m4",
    fullNameTh: "นภา จันทร์เพ็ญ",
    fullNameEn: "Napa Chanpen",
    nicknameTh: "นภา",
    businessCategory: "บัญชี",
    company: "สำนักงานบัญชีนภา",
    phone: "083-333-4444",
    email: "napa@example.com",
    status: "active",
  },
  {
    id: "m5",
    fullNameTh: "ธนกร มั่นคง",
    fullNameEn: "Thanakorn Munkong",
    nicknameTh: "กร",
    businessCategory: "ก่อสร้าง",
    company: "มั่นคง คอนสตรัคชั่น",
    phone: "084-555-6666",
    email: "thanakorn@example.com",
    status: "active",
  },
  {
    id: "m6",
    fullNameTh: "รัตนา พงษ์ไพบูลย์",
    fullNameEn: "Rattana Pongpaiboon",
    nicknameTh: "นา",
    businessCategory: "การตลาด",
    company: "ครีเอทีฟ มาร์เก็ตติ้ง",
    phone: "085-777-8888",
    email: "rattana@example.com",
    status: "active",
  },
  {
    id: "m7",
    fullNameTh: "อนุชา ทองดี",
    fullNameEn: "Anucha Thongdee",
    nicknameTh: "ชา",
    businessCategory: "ไอที",
    company: "เทค โซลูชั่นส์",
    phone: "086-999-0000",
    email: "anucha@example.com",
    status: "active",
  },
  {
    id: "m8",
    fullNameTh: "พิมพ์ใจ สว่างวงศ์",
    fullNameEn: "Pimjai Sawangwong",
    nicknameTh: "พิม",
    businessCategory: "สุขภาพ",
    company: "คลินิกสุขภาพดี",
    phone: "087-111-2233",
    email: "pimjai@example.com",
    status: "active",
  },
  {
    id: "m9",
    fullNameTh: "กิตติ แสงทอง",
    fullNameEn: "Kitti Saengthong",
    nicknameTh: "ติ",
    businessCategory: "การศึกษา",
    company: "สถาบันกวดวิชา",
    phone: "088-444-5566",
    email: "kitti@example.com",
    status: "active",
  },
  {
    id: "m10",
    fullNameTh: "ดวงใจ เจริญสุข",
    fullNameEn: "Duangjai Charoensuk",
    nicknameTh: "ใจ",
    businessCategory: "อาหาร",
    company: "ครัวคุณใจ",
    phone: "089-777-8899",
    email: "duangjai@example.com",
    status: "active",
  },
  {
    id: "m11",
    fullNameTh: "ประเสริฐ วิไลลักษณ์",
    fullNameEn: "Prasert Wilailak",
    nicknameTh: "เสริฐ",
    businessCategory: "กฎหมาย",
    company: "สำนักกฎหมายประเสริฐ",
    phone: "081-222-3344",
    email: "prasert@example.com",
    status: "active",
  },
  {
    id: "m12",
    fullNameTh: "มณีรัตน์ โชติกุล",
    fullNameEn: "Maneerat Chotikul",
    nicknameTh: "มณี",
    businessCategory: "เครื่องประดับ",
    company: "มณีรัตน์ จิวเวลรี่",
    phone: "082-555-6677",
    email: "maneerat@example.com",
    status: "active",
  },
];

export const demoVisitors: DemoVisitor[] = [
  {
    id: "v1",
    fullNameTh: "จิรายุ สมบูรณ์",
    fullNameEn: "Jirayu Somboon",
    phone: "091-111-2222",
    email: "jirayu@example.com",
    company: "สตาร์ทอัพ ABC",
    invitedBy: "สมชาย วงศ์ประเสริฐ",
    visitDate: "2024-12-20",
    status: "checked_in",
    feePaid: true,
    feeAmount: 500,
  },
  {
    id: "v2",
    fullNameTh: "ปิยะ ใจดี",
    fullNameEn: "Piya Jaidee",
    phone: "092-333-4444",
    email: "piya@example.com",
    company: "ร้านกาแฟปิยะ",
    invitedBy: "สุภาพร ศรีสุข",
    visitDate: "2024-12-20",
    status: "checked_in",
    feePaid: true,
    feeAmount: 500,
  },
  {
    id: "v3",
    fullNameTh: "ณัฐพล วงศ์สกุล",
    fullNameEn: "Nattapon Wongsakul",
    phone: "093-555-6666",
    email: "nattapon@example.com",
    company: "วงศ์สกุล ออโต้",
    invitedBy: "วิชัย รุ่งเรือง",
    visitDate: "2024-12-20",
    status: "registered",
    feePaid: false,
    feeAmount: 500,
  },
  {
    id: "v4",
    fullNameTh: "กมลชนก ภูผา",
    fullNameEn: "Kamonchanok Pupa",
    phone: "094-777-8888",
    email: "kamonchanok@example.com",
    company: "ภูผา ทราเวล",
    invitedBy: "นภา จันทร์เพ็ญ",
    visitDate: "2024-12-13",
    status: "checked_in",
    feePaid: true,
    feeAmount: 500,
  },
  {
    id: "v5",
    fullNameTh: "ศิริพร แก้วมณี",
    fullNameEn: "Siriporn Kaewmanee",
    phone: "095-999-0000",
    email: "siriporn@example.com",
    company: "แก้วมณี สปา",
    invitedBy: "ธนกร มั่นคง",
    visitDate: "2024-12-13",
    status: "no_show",
    feePaid: false,
    feeAmount: 500,
  },
  {
    id: "v6",
    fullNameTh: "อรรถพล สายชล",
    fullNameEn: "Attapon Saichon",
    phone: "096-111-2233",
    email: "attapon@example.com",
    company: "สายชล โลจิสติกส์",
    invitedBy: "รัตนา พงษ์ไพบูลย์",
    visitDate: "2024-12-06",
    status: "checked_in",
    feePaid: true,
    feeAmount: 500,
  },
];

export const demoMeetings: DemoMeeting[] = [
  {
    id: "meet1",
    title: "ประชุมประจำสัปดาห์ #52",
    date: "2024-12-27",
    startTime: "07:00",
    endTime: "09:00",
    location: "โรงแรม XYZ ห้องประชุม A",
    status: "upcoming",
    stats: {
      totalMembers: 12,
      onTime: 0,
      late: 0,
      absent: 0,
      substitute: 0,
      visitors: 2,
      visitorsCheckedIn: 0,
    },
  },
  {
    id: "meet2",
    title: "ประชุมประจำสัปดาห์ #51",
    date: "2024-12-20",
    startTime: "07:00",
    endTime: "09:00",
    location: "โรงแรม XYZ ห้องประชุม A",
    status: "completed",
    stats: {
      totalMembers: 12,
      onTime: 10,
      late: 1,
      absent: 0,
      substitute: 1,
      visitors: 3,
      visitorsCheckedIn: 2,
    },
  },
  {
    id: "meet3",
    title: "ประชุมประจำสัปดาห์ #50",
    date: "2024-12-13",
    startTime: "07:00",
    endTime: "09:00",
    location: "โรงแรม XYZ ห้องประชุม A",
    status: "completed",
    stats: {
      totalMembers: 12,
      onTime: 11,
      late: 0,
      absent: 1,
      substitute: 0,
      visitors: 2,
      visitorsCheckedIn: 1,
    },
  },
];

export const demoAttendance: DemoAttendance[] = [
  { id: "a1", meetingId: "meet2", memberId: "m1", status: "on_time", checkInTime: "06:55" },
  { id: "a2", meetingId: "meet2", memberId: "m2", status: "on_time", checkInTime: "06:50" },
  { id: "a3", meetingId: "meet2", memberId: "m3", status: "on_time", checkInTime: "06:58" },
  { id: "a4", meetingId: "meet2", memberId: "m4", status: "on_time", checkInTime: "06:52" },
  { id: "a5", meetingId: "meet2", memberId: "m5", status: "late", checkInTime: "07:08" },
  { id: "a6", meetingId: "meet2", memberId: "m6", status: "on_time", checkInTime: "06:45" },
  { id: "a7", meetingId: "meet2", memberId: "m7", status: "on_time", checkInTime: "06:56" },
  { id: "a8", meetingId: "meet2", memberId: "m8", status: "on_time", checkInTime: "06:59" },
  { id: "a9", meetingId: "meet2", memberId: "m9", status: "substitute", checkInTime: "06:53" },
  { id: "a10", meetingId: "meet2", memberId: "m10", status: "on_time", checkInTime: "06:48" },
  { id: "a11", meetingId: "meet2", memberId: "m11", status: "on_time", checkInTime: "06:57" },
  { id: "a12", meetingId: "meet2", memberId: "m12", status: "on_time", checkInTime: "06:54" },
];

export const demoStats = {
  totalMembers: 12,
  activeMembers: 12,
  totalMeetings: 51,
  averageAttendance: 98,
  onTimeRate: 92,
  visitorConversion: 40,
  totalVisitorsThisMonth: 6,
  totalVisitorsCheckedIn: 4,
  totalReferrals: 156,
  monthlyGrowth: 8,
};

export const demoAIResponses: Record<string, string> = {
  "มีใครมาสายบ้าง": `จากการประชุมล่าสุด (20 ธ.ค. 2567):
- ธนกร มั่นคง เข้าประชุม 07:08 น. (สาย 8 นาที)

สรุป: มีสมาชิกมาสาย 1 คน จาก 12 คน (On-time rate: 92%)`,
  
  "สรุป visitor เดือนนี้": `สรุป Visitor ประจำเดือน ธ.ค. 2567:
- ลงทะเบียน: 6 คน
- เข้าร่วมจริง: 4 คน  
- ไม่มา: 1 คน
- รอเข้าร่วม: 1 คน

ค่าธรรมเนียมที่เก็บได้: 2,000 บาท
ยังไม่ได้จ่าย: 500 บาท (1 คน)`,

  "ใครไม่จ่ายค่า visitor": `ผู้เยี่ยมชมที่ยังไม่ชำระค่าธรรมเนียม:
1. ณัฐพล วงศ์สกุล - 500 บาท (นัดมา 20 ธ.ค.)
   ผู้เชิญ: วิชัย รุ่งเรือง

รวมยอดค้างชำระ: 500 บาท`,

  "สถิติการประชุม": `สถิติภาพรวม BNI Success Demo:
- จำนวนสมาชิก: 12 คน
- On-time Rate: 98%
- Visitor Conversion: 40%
- ประชุมทั้งหมด: 51 ครั้ง

เดือนนี้:
- Visitors: 6 คน
- Check-in: 4 คน
- No-show: 1 คน`,

  "default": `ขอโทษครับ ผมเข้าใจคำถามของคุณ แต่ในโหมด Demo นี้ผมสามารถตอบคำถามตัวอย่างได้เท่านั้น

ลองถามคำถามเหล่านี้ดูครับ:
- "มีใครมาสายบ้าง"
- "สรุป visitor เดือนนี้"
- "ใครไม่จ่ายค่า visitor"
- "สถิติการประชุม"`,
};
