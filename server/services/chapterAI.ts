import OpenAI from "openai";
import { supabaseAdmin } from "../utils/supabaseClient";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { th } from "date-fns/locale";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const SYSTEM_PROMPT = `คุณคือ "BNI Chapter Data Assistant" ทำหน้าที่ตอบคำถามของผู้ใช้ใน LINE OA/LINE Group โดยอ้างอิงข้อมูลจากระบบ Chapter Management

เป้าหมาย:
- ตอบคำถามเชิง "สรุป/สถิติ/สถานะ" เกี่ยวกับ Meeting, การเข้าร่วม และ Visitor fee
- ตอบให้สั้น กระชับ ชัดเจน พร้อมตัวเลขและช่วงเวลา
- ถ้าข้อมูลไม่พอ ให้ถามกลับแบบสั้นที่สุด

การทักทาย:
- ถ้าผู้ใช้ทักทาย (สวัสดี, หวัดดี, hello, hi, ช่วยอะไรได้บ้าง) ให้ตอบกลับอย่างเป็นมิตรและแนะนำสิ่งที่ถามได้ เช่น:
  "สวัสดีครับ ผมคือ Chapter Assistant พร้อมช่วยเหลือคุณ ลองถามได้เลย เช่น:
  - สรุปผู้มาเยือนวันนี้
  - ใครมา/ไม่มา/สาย ใน meeting ล่าสุด
  - ใครยังไม่จ่าย visitor fee
  - สถิติ meeting วันนี้"

ข้อจำกัดสำคัญ (MUST):
- ห้ามเดาหรือสร้างข้อมูลเอง หากไม่มีผลจาก tools ให้ตอบว่า "ยังไม่พบข้อมูลในระบบครับ กรุณาลองถามใหม่อีกครั้ง"
- ห้ามเปิดเผยข้อมูลส่วนบุคคลเกินจำเป็น (เช่น เบอร์โทร/อีเมล) เว้นแต่ role เป็น admin
- ต้องเคารพสิทธิ์ผู้ใช้ (RBAC): admin เห็นรายชื่อได้ / member เห็นแค่จำนวน
- ทุกครั้งที่ต้องดึงข้อมูล ให้เรียกใช้ tools ที่ระบบให้เท่านั้น
- เมื่ออ้างอิงเวลา ให้ใช้ Timezone: Asia/Bangkok
- ถ้าไม่มี tool ที่เหมาะสมสำหรับคำถาม ให้ตอบว่า "ขออภัยครับ ยังไม่รองรับคำถามนี้ ลองถามแบบอื่นดูครับ"

รูปแบบคำตอบ (Preferred):
- สรุปเป็น bullet หรือรายการสั้น ๆ
- ใส่ช่วงเวลา, จำนวน, และยอดรวมให้ชัด
- ถ้าผู้ใช้ถาม "วันนี้" ให้ตีความเป็น "วันปัจจุบันตาม Asia/Bangkok"
- ถ้าผู้ใช้ไม่ได้ระบุ meeting ให้ใช้ meeting ล่าสุด/meeting วันนี้

Intent ที่ต้องรองรับ:
1. greeting: ทักทายและแนะนำสิ่งที่ช่วยได้
2. visitor_summary: สรุปผู้มาเยือนวันนี้/สัปดาห์นี้
3. unpaid_visitor_fee_today: ใครยังไม่จ่าย visitor fee วันนี้
4. visitor_fee_total_month: ยอด visitor fee รวมเดือนนี้
5. meeting_stats: สถิติต่าง ๆ ของ meeting
6. attendance_query: ใครมา/ไม่มา/สาย - ใช้ get_attendance_insights
7. member_attendance_check: ถามว่าคนๆหนึ่งมาประชุมไหม เช่น "คุณแคท มาไหม", "พี่โอ๋ เข้าประชุมมั้ย" - ใช้ check_member_attendance`;

const TOOLS: OpenAI.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "get_meeting_context",
      description: "หา meeting วันนี้หรือล่าสุดของ chapter เพื่อใช้ในการดึงข้อมูลอื่น",
      parameters: {
        type: "object",
        properties: {
          date: {
            type: "string",
            description: "วันที่ต้องการค้นหา meeting ในรูปแบบ YYYY-MM-DD (ถ้าไม่ระบุจะใช้วันนี้)"
          }
        },
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_visitor_summary",
      description: "ดึงจำนวน visitors ตามช่วงเวลา (วันนี้ / สัปดาห์นี้ / เดือนนี้)",
      parameters: {
        type: "object",
        properties: {
          range: {
            type: "string",
            enum: ["today", "this_week", "this_month"],
            description: "ช่วงเวลาที่ต้องการ"
          },
          meeting_id: {
            type: "string",
            description: "Meeting ID ถ้าต้องการเฉพาะ meeting นั้น"
          }
        },
        required: ["range"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_unpaid_visitor_fee",
      description: "ดึงรายชื่อผู้มาเยือนที่ยังไม่จ่าย visitor fee สำหรับ meeting วันนี้",
      parameters: {
        type: "object",
        properties: {
          meeting_id: {
            type: "string",
            description: "Meeting ID ที่ต้องการตรวจสอบ"
          }
        },
        required: ["meeting_id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_visitor_fee_total",
      description: "ดึงยอดรวม visitor fee ตามช่วงเวลา",
      parameters: {
        type: "object",
        properties: {
          range: {
            type: "string",
            enum: ["this_month", "this_week", "today"],
            description: "ช่วงเวลาที่ต้องการ"
          }
        },
        required: ["range"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_user_role",
      description: "ตรวจสอบ role ของผู้ใช้ใน chapter ก่อนแสดงข้อมูล sensitive",
      parameters: {
        type: "object",
        properties: {},
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_meeting_stats",
      description: "ดึงสถิติของ meeting เช่น จำนวนผู้เข้าร่วม, สมาชิก, visitors, ยอดชำระ",
      parameters: {
        type: "object",
        properties: {
          meeting_id: {
            type: "string",
            description: "Meeting ID ที่ต้องการดูสถิติ (ถ้าไม่ระบุจะใช้ meeting วันนี้)"
          }
        },
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_attendance_insights",
      description: "ดึงรายละเอียดการเข้าร่วม meeting ของสมาชิก - ใครมา/ไม่มา/สาย พร้อมรายชื่อ (admin เห็นรายชื่อ, member เห็นจำนวน)",
      parameters: {
        type: "object",
        properties: {
          meeting_id: {
            type: "string",
            description: "Meeting ID ที่ต้องการดู (ถ้าไม่ระบุจะใช้ meeting ล่าสุด)"
          },
          focus: {
            type: "string",
            enum: ["present", "absent", "late", "all"],
            description: "ประเภทที่ต้องการดู: present=มา, absent=ไม่มา, late=สาย, all=ทั้งหมด"
          }
        },
        required: ["focus"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "check_member_attendance",
      description: "ตรวจสอบว่าสมาชิกคนใดคนหนึ่งมาประชุมหรือไม่ โดยค้นหาจากชื่อ/ชื่อเล่น เช่น 'คุณแคท มาไหม', 'พี่โอ๋ เข้าประชุมมั้ย'",
      parameters: {
        type: "object",
        properties: {
          member_name: {
            type: "string",
            description: "ชื่อหรือชื่อเล่นของสมาชิกที่ต้องการค้นหา เช่น 'แคท', 'โอ๋', 'สมชาย'"
          },
          meeting_id: {
            type: "string",
            description: "Meeting ID ที่ต้องการตรวจสอบ (ถ้าไม่ระบุจะใช้ meeting ล่าสุด)"
          }
        },
        required: ["member_name"]
      }
    }
  }
];

interface AIContext {
  tenantId: string;
  lineUserId: string;
  userRole?: "admin" | "member" | "visitor" | "unknown";
}

async function getUserRole(tenantId: string, lineUserId: string): Promise<"admin" | "member" | "visitor" | "unknown"> {
  try {
    const { data: participant } = await supabaseAdmin
      .from("participants")
      .select("participant_id, status")
      .eq("tenant_id", tenantId)
      .eq("line_user_id", lineUserId)
      .maybeSingle();

    if (!participant) return "unknown";

    const { data: userRole } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("tenant_id", tenantId)
      .eq("participant_id", participant.participant_id)
      .maybeSingle();

    if (userRole?.role === "chapter_admin" || userRole?.role === "super_admin") {
      return "admin";
    }

    if (participant.status === "member") return "member";
    if (participant.status === "visitor") return "visitor";

    return "unknown";
  } catch (error) {
    console.error("[ChapterAI] getUserRole error:", error);
    return "unknown";
  }
}

async function getMeetingContext(tenantId: string, date?: string): Promise<any> {
  try {
    const targetDate = date || format(new Date(), "yyyy-MM-dd");

    const { data: meeting } = await supabaseAdmin
      .from("meetings")
      .select("meeting_id, meeting_date, meeting_time, theme, venue")
      .eq("tenant_id", tenantId)
      .eq("meeting_date", targetDate)
      .maybeSingle();

    if (meeting) {
      return {
        meeting_id: meeting.meeting_id,
        meeting_date: meeting.meeting_date,
        meeting_time: meeting.meeting_time,
        theme: meeting.theme,
        venue: meeting.venue,
        found: true
      };
    }

    const { data: latestMeeting } = await supabaseAdmin
      .from("meetings")
      .select("meeting_id, meeting_date, meeting_time, theme, venue")
      .eq("tenant_id", tenantId)
      .lte("meeting_date", targetDate)
      .order("meeting_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestMeeting) {
      return {
        meeting_id: latestMeeting.meeting_id,
        meeting_date: latestMeeting.meeting_date,
        meeting_time: latestMeeting.meeting_time,
        theme: latestMeeting.theme,
        venue: latestMeeting.venue,
        found: true,
        note: "ไม่พบ meeting วันนี้ แสดง meeting ล่าสุด"
      };
    }

    return { found: false, message: "ไม่พบ meeting ในระบบ" };
  } catch (error) {
    console.error("[ChapterAI] getMeetingContext error:", error);
    return { found: false, error: "เกิดข้อผิดพลาดในการดึงข้อมูล meeting" };
  }
}

async function getVisitorSummary(tenantId: string, range: string, meetingId?: string): Promise<any> {
  try {
    const now = new Date();
    let startDate: string;
    let endDate: string;
    let rangeLabel: string;

    switch (range) {
      case "today":
        startDate = endDate = format(now, "yyyy-MM-dd");
        rangeLabel = `วันนี้ (${format(now, "d MMM yyyy", { locale: th })})`;
        break;
      case "this_week":
        startDate = format(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd");
        endDate = format(endOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd");
        rangeLabel = `สัปดาห์นี้ (${format(new Date(startDate), "d MMM")} - ${format(new Date(endDate), "d MMM yyyy", { locale: th })})`;
        break;
      case "this_month":
        startDate = format(startOfMonth(now), "yyyy-MM-dd");
        endDate = format(endOfMonth(now), "yyyy-MM-dd");
        rangeLabel = format(now, "MMMM yyyy", { locale: th });
        break;
      default:
        startDate = endDate = format(now, "yyyy-MM-dd");
        rangeLabel = "วันนี้";
    }

    // Get meetings in date range for this tenant
    const { data: meetings, error: meetingsError } = await supabaseAdmin
      .from("meetings")
      .select("meeting_id")
      .eq("tenant_id", tenantId)
      .gte("meeting_date", startDate)
      .lte("meeting_date", endDate);

    if (meetingsError || !meetings?.length) {
      return {
        range: rangeLabel,
        total_registered: 0,
        total_checked_in: 0,
        no_show: 0
      };
    }

    // Validate meeting_id belongs to tenant if provided
    if (meetingId) {
      const validMeetingIds = meetings.map(m => m.meeting_id);
      if (!validMeetingIds.includes(meetingId)) {
        return {
          range: rangeLabel,
          total_registered: 0,
          total_checked_in: 0,
          no_show: 0,
          error: "Meeting ไม่อยู่ในช่วงเวลาที่ระบุ"
        };
      }
    }

    const meetingIds = meetingId ? [meetingId] : meetings.map(m => m.meeting_id);
    console.log(`[ChapterAI] getVisitorSummary: tenantId=${tenantId}, range=${range}, meetingIds=`, meetingIds);

    // Step 1: Get visitor participant IDs for this tenant
    const { data: visitorParticipants } = await supabaseAdmin
      .from("participants")
      .select("participant_id")
      .eq("tenant_id", tenantId)
      .eq("status", "visitor");

    const visitorIds = (visitorParticipants || []).map(p => p.participant_id);
    console.log(`[ChapterAI] getVisitorSummary: found ${visitorIds.length} visitor participants`);

    if (visitorIds.length === 0) {
      console.log(`[ChapterAI] getVisitorSummary: No visitors found for tenant`);
      return {
        range: rangeLabel,
        total_registered: 0,
        total_checked_in: 0,
        no_show: 0
      };
    }

    // Step 2: Get visitor registrations using the visitor IDs
    const { data: registrations, error } = await supabaseAdmin
      .from("meeting_registrations")
      .select("registration_id, meeting_id, participant_id")
      .in("meeting_id", meetingIds)
      .in("participant_id", visitorIds);

    console.log(`[ChapterAI] getVisitorSummary: found ${registrations?.length || 0} registrations`);

    if (error) {
      console.error("[ChapterAI] getVisitorSummary error:", error);
      return { error: "เกิดข้อผิดพลาดในการดึงข้อมูล" };
    }

    // Step 3: Get checkins for these meetings filtered by visitor IDs
    const { data: checkins } = await supabaseAdmin
      .from("checkins")
      .select("participant_id")
      .in("meeting_id", meetingIds)
      .in("participant_id", visitorIds);

    console.log(`[ChapterAI] getVisitorSummary: found ${checkins?.length || 0} visitor checkins`);

    const checkinSet = new Set((checkins || []).map(c => c.participant_id));

    const totalVisitors = registrations?.length || 0;
    const checkedInVisitors = registrations?.filter(r => checkinSet.has(r.participant_id)).length || 0;

    console.log(`[ChapterAI] getVisitorSummary result: registered=${totalVisitors}, checkedIn=${checkedInVisitors}`);

    return {
      range: rangeLabel,
      total_registered: totalVisitors,
      total_checked_in: checkedInVisitors,
      no_show: totalVisitors - checkedInVisitors
    };
  } catch (error) {
    console.error("[ChapterAI] getVisitorSummary error:", error);
    return { error: "เกิดข้อผิดพลาดในการดึงข้อมูล visitor" };
  }
}

async function getUnpaidVisitorFee(tenantId: string, meetingId: string, isAdmin: boolean): Promise<any> {
  try {
    const { data: fees, error } = await supabaseAdmin
      .from("visitor_meeting_fees")
      .select(`
        fee_id,
        amount_due,
        amount_paid,
        status,
        participant:participants(
          participant_id,
          full_name_th,
          nickname_th
        )
      `)
      .eq("meeting_id", meetingId)
      .eq("status", "pending");

    if (error) {
      console.error("[ChapterAI] getUnpaidVisitorFee error:", error);
      return { error: "เกิดข้อผิดพลาดในการดึงข้อมูล" };
    }

    const unpaidList = fees || [];
    const totalUnpaid = unpaidList.length;
    const totalAmount = unpaidList.reduce((sum, f) => sum + Number(f.amount_due), 0);

    if (!isAdmin) {
      return {
        unpaid_count: totalUnpaid,
        total_amount: totalAmount,
        message: "เพื่อความเป็นส่วนตัว รายชื่อจะแสดงให้เฉพาะ Admin",
        is_admin: false
      };
    }

    const names = unpaidList.map(f => {
      const p = f.participant as any;
      const name = p?.nickname_th || p?.full_name_th || "ไม่ระบุชื่อ";
      return { name, amount: f.amount_due };
    });

    return {
      unpaid_count: totalUnpaid,
      total_amount: totalAmount,
      unpaid_list: names,
      is_admin: true
    };
  } catch (error) {
    console.error("[ChapterAI] getUnpaidVisitorFee error:", error);
    return { error: "เกิดข้อผิดพลาดในการดึงข้อมูล visitor fee" };
  }
}

async function getVisitorFeeTotal(tenantId: string, range: string): Promise<any> {
  try {
    const now = new Date();
    let startDate: string;
    let endDate: string;
    let rangeLabel: string;

    switch (range) {
      case "today":
        startDate = endDate = format(now, "yyyy-MM-dd");
        rangeLabel = `วันนี้ (${format(now, "d MMM yyyy", { locale: th })})`;
        break;
      case "this_week":
        startDate = format(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd");
        endDate = format(endOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd");
        rangeLabel = "สัปดาห์นี้";
        break;
      case "this_month":
      default:
        startDate = format(startOfMonth(now), "yyyy-MM-dd");
        endDate = format(endOfMonth(now), "yyyy-MM-dd");
        rangeLabel = format(now, "MMMM yyyy", { locale: th });
        break;
    }

    const { data: fees, error } = await supabaseAdmin
      .from("visitor_meeting_fees")
      .select(`
        fee_id,
        amount_due,
        amount_paid,
        status,
        meeting:meetings!inner(
          meeting_date,
          tenant_id
        )
      `)
      .eq("meetings.tenant_id", tenantId)
      .gte("meetings.meeting_date", startDate)
      .lte("meetings.meeting_date", endDate);

    if (error) {
      console.error("[ChapterAI] getVisitorFeeTotal error:", error);
      return { error: "เกิดข้อผิดพลาดในการดึงข้อมูล" };
    }

    const allFees = fees || [];
    const paidFees = allFees.filter(f => f.status === "paid");
    const unpaidFees = allFees.filter(f => f.status === "pending");

    return {
      range: rangeLabel,
      total_count: allFees.length,
      paid_count: paidFees.length,
      unpaid_count: unpaidFees.length,
      total_amount: allFees.reduce((sum, f) => sum + Number(f.amount_due), 0),
      paid_amount: paidFees.reduce((sum, f) => sum + Number(f.amount_paid || f.amount_due), 0),
      unpaid_amount: unpaidFees.reduce((sum, f) => sum + Number(f.amount_due), 0)
    };
  } catch (error) {
    console.error("[ChapterAI] getVisitorFeeTotal error:", error);
    return { error: "เกิดข้อผิดพลาดในการดึงข้อมูล visitor fee" };
  }
}

async function getMeetingStats(tenantId: string, meetingId?: string): Promise<any> {
  try {
    let targetMeetingId = meetingId;

    if (!targetMeetingId) {
      const today = format(new Date(), "yyyy-MM-dd");
      const { data: meeting } = await supabaseAdmin
        .from("meetings")
        .select("meeting_id")
        .eq("tenant_id", tenantId)
        .eq("meeting_date", today)
        .maybeSingle();

      if (!meeting) {
        const { data: latestMeeting } = await supabaseAdmin
          .from("meetings")
          .select("meeting_id")
          .eq("tenant_id", tenantId)
          .lte("meeting_date", today)
          .order("meeting_date", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!latestMeeting) {
          return { error: "ไม่พบ meeting ในระบบ" };
        }
        targetMeetingId = latestMeeting.meeting_id;
      } else {
        targetMeetingId = meeting.meeting_id;
      }
    }

    // Verify meeting belongs to this tenant
    const { data: meetingInfo } = await supabaseAdmin
      .from("meetings")
      .select("meeting_id, meeting_date, theme, venue, tenant_id")
      .eq("meeting_id", targetMeetingId)
      .eq("tenant_id", tenantId)
      .single();

    if (!meetingInfo) {
      return { error: "ไม่พบ meeting ในระบบ" };
    }

    // Step 1: Get all participant IDs for this tenant, separated by status
    const { data: tenantMembers } = await supabaseAdmin
      .from("participants")
      .select("participant_id")
      .eq("tenant_id", tenantId)
      .eq("status", "member");
    
    const { data: tenantVisitors } = await supabaseAdmin
      .from("participants")
      .select("participant_id")
      .eq("tenant_id", tenantId)
      .eq("status", "visitor");

    const memberIds = (tenantMembers || []).map(p => p.participant_id);
    const visitorIds = (tenantVisitors || []).map(p => p.participant_id);

    // Step 2: Get all check-ins for this meeting
    const { data: allCheckins } = await supabaseAdmin
      .from("checkins")
      .select("checkin_id, checkin_time, is_late, participant_id")
      .eq("meeting_id", targetMeetingId);

    // Filter checkins by participant type using the pre-fetched IDs
    const memberIdSet = new Set(memberIds);
    const visitorIdSet = new Set(visitorIds);
    
    const memberCheckins = (allCheckins || []).filter(c => memberIdSet.has(c.participant_id));
    const visitorCheckins = (allCheckins || []).filter(c => visitorIdSet.has(c.participant_id));

    const onTimeCount = memberCheckins.filter(c => !c.is_late).length;
    const lateCount = memberCheckins.filter(c => c.is_late).length;

    // Get total member count
    const { count: memberCount } = await supabaseAdmin
      .from("participants")
      .select("participant_id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("status", "member");

    // Get visitor registrations - use visitorIds already fetched
    const { data: visitorRegistrations } = await supabaseAdmin
      .from("meeting_registrations")
      .select("registration_id, participant_id")
      .eq("meeting_id", targetMeetingId)
      .in("participant_id", visitorIds.length > 0 ? visitorIds : ['00000000-0000-0000-0000-000000000000']);

    // Use visitor checkins to count checked-in visitors
    const allVisitorRegs = visitorRegistrations || [];
    const visitorsCheckedIn = visitorCheckins.length;
    const visitorNoShow = allVisitorRegs.length - visitorsCheckedIn;

    // Get visitor fees
    const { data: fees } = await supabaseAdmin
      .from("visitor_meeting_fees")
      .select("fee_id, amount_due, amount_paid, status")
      .eq("meeting_id", targetMeetingId);

    const allFees = fees || [];
    const paidFees = allFees.filter(f => f.status === "paid");

    return {
      meeting_date: meetingInfo?.meeting_date,
      theme: meetingInfo?.theme,
      venue: meetingInfo?.venue,
      total_members: memberCount || 0,
      members_checked_in: memberCheckins.length,
      members_on_time: onTimeCount,
      members_late: lateCount,
      members_absent: (memberCount || 0) - memberCheckins.length,
      attendance_rate: memberCount ? Math.round((memberCheckins.length / memberCount) * 100) : 0,
      visitors_registered: allVisitorRegs.length,
      visitors_checked_in: visitorsCheckedIn,
      visitors_no_show: visitorNoShow,
      visitor_fees: {
        total: allFees.length,
        paid: paidFees.length,
        pending: allFees.length - paidFees.length,
        total_amount: allFees.reduce((sum, f) => sum + Number(f.amount_due), 0),
        collected_amount: paidFees.reduce((sum, f) => sum + Number(f.amount_paid || f.amount_due), 0)
      }
    };
  } catch (error) {
    console.error("[ChapterAI] getMeetingStats error:", error);
    return { error: "เกิดข้อผิดพลาดในการดึงสถิติ meeting" };
  }
}

async function getAttendanceInsights(
  tenantId: string, 
  meetingId: string | undefined, 
  focus: "present" | "absent" | "late" | "all",
  isAdmin: boolean
): Promise<any> {
  try {
    let targetMeetingId = meetingId;

    // If no meeting_id provided, get latest meeting
    if (!targetMeetingId) {
      const today = format(new Date(), "yyyy-MM-dd");
      const { data: latestMeeting } = await supabaseAdmin
        .from("meetings")
        .select("meeting_id, meeting_date, theme")
        .eq("tenant_id", tenantId)
        .lte("meeting_date", today)
        .order("meeting_date", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!latestMeeting) {
        return { error: "ไม่พบ meeting ในระบบ" };
      }
      targetMeetingId = latestMeeting.meeting_id;
    }

    // Verify meeting belongs to tenant
    const { data: meetingInfo } = await supabaseAdmin
      .from("meetings")
      .select("meeting_id, meeting_date, theme")
      .eq("meeting_id", targetMeetingId)
      .eq("tenant_id", tenantId)
      .single();

    if (!meetingInfo) {
      return { error: "ไม่พบ meeting ในระบบ" };
    }

    // Get all members for this tenant
    const { data: allMembers } = await supabaseAdmin
      .from("participants")
      .select("participant_id, full_name_th, nickname_th")
      .eq("tenant_id", tenantId)
      .eq("status", "member");

    const members = allMembers || [];
    const memberIds = members.map(m => m.participant_id);

    if (memberIds.length === 0) {
      return {
        meeting_date: meetingInfo.meeting_date,
        theme: meetingInfo.theme,
        message: "ไม่มีสมาชิกในระบบ"
      };
    }

    // Get check-ins for this meeting
    const { data: checkins } = await supabaseAdmin
      .from("checkins")
      .select("participant_id, is_late, checkin_time")
      .eq("meeting_id", targetMeetingId)
      .in("participant_id", memberIds);

    const checkinMap = new Map((checkins || []).map(c => [c.participant_id, c]));

    // Categorize members
    const presentMembers: any[] = [];
    const absentMembers: any[] = [];
    const lateMembers: any[] = [];

    for (const member of members) {
      const checkin = checkinMap.get(member.participant_id);
      const name = member.nickname_th || member.full_name_th || "ไม่ระบุชื่อ";
      
      if (checkin) {
        if (checkin.is_late) {
          lateMembers.push({ name, checkin_time: checkin.checkin_time });
        } else {
          presentMembers.push({ name, checkin_time: checkin.checkin_time });
        }
      } else {
        absentMembers.push({ name });
      }
    }

    const result: any = {
      meeting_date: meetingInfo.meeting_date,
      theme: meetingInfo.theme,
      total_members: members.length
    };

    // Build response based on focus and RBAC
    if (focus === "present" || focus === "all") {
      result.present = {
        count: presentMembers.length,
        names: isAdmin ? presentMembers.map(m => m.name) : undefined,
        message: isAdmin ? undefined : "เพื่อความเป็นส่วนตัว รายชื่อจะแสดงให้เฉพาะ Admin"
      };
    }

    if (focus === "absent" || focus === "all") {
      result.absent = {
        count: absentMembers.length,
        names: isAdmin ? absentMembers.map(m => m.name) : undefined,
        message: isAdmin ? undefined : "เพื่อความเป็นส่วนตัว รายชื่อจะแสดงให้เฉพาะ Admin"
      };
    }

    if (focus === "late" || focus === "all") {
      result.late = {
        count: lateMembers.length,
        names: isAdmin ? lateMembers.map(m => m.name) : undefined,
        message: isAdmin ? undefined : "เพื่อความเป็นส่วนตัว รายชื่อจะแสดงให้เฉพาะ Admin"
      };
    }

    console.log(`[ChapterAI] getAttendanceInsights result:`, {
      focus,
      isAdmin,
      present: presentMembers.length,
      absent: absentMembers.length,
      late: lateMembers.length
    });

    return result;
  } catch (error) {
    console.error("[ChapterAI] getAttendanceInsights error:", error);
    return { error: "เกิดข้อผิดพลาดในการดึงข้อมูลการเข้าร่วม" };
  }
}

async function checkMemberAttendance(
  tenantId: string,
  memberName: string,
  meetingId?: string
): Promise<any> {
  try {
    // Clean the name - remove common prefixes
    const cleanName = memberName
      .replace(/^(คุณ|พี่|น้อง|นาย|นาง|นางสาว)\s*/i, "")
      .trim()
      .toLowerCase();

    console.log(`[ChapterAI] checkMemberAttendance: searching for "${cleanName}" in tenant ${tenantId}`);

    // Get target meeting
    let targetMeetingId = meetingId;
    if (!targetMeetingId) {
      const today = format(new Date(), "yyyy-MM-dd");
      const { data: latestMeeting } = await supabaseAdmin
        .from("meetings")
        .select("meeting_id, meeting_date, theme")
        .eq("tenant_id", tenantId)
        .lte("meeting_date", today)
        .order("meeting_date", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!latestMeeting) {
        return { error: "ไม่พบ meeting ในระบบ" };
      }
      targetMeetingId = latestMeeting.meeting_id;
    }

    // Verify meeting belongs to tenant
    const { data: meetingInfo } = await supabaseAdmin
      .from("meetings")
      .select("meeting_id, meeting_date, theme")
      .eq("meeting_id", targetMeetingId)
      .eq("tenant_id", tenantId)
      .single();

    if (!meetingInfo) {
      return { error: "ไม่พบ meeting ในระบบ" };
    }

    // Search for member by name (fuzzy match on nickname_th or full_name_th)
    const { data: allMembers } = await supabaseAdmin
      .from("participants")
      .select("participant_id, full_name_th, nickname_th")
      .eq("tenant_id", tenantId)
      .eq("status", "member");

    if (!allMembers || allMembers.length === 0) {
      return { error: "ไม่พบสมาชิกในระบบ" };
    }

    // Find matching members
    const matchingMembers = allMembers.filter(m => {
      const nickname = (m.nickname_th || "").toLowerCase();
      const fullName = (m.full_name_th || "").toLowerCase();
      return nickname.includes(cleanName) || 
             cleanName.includes(nickname) ||
             fullName.includes(cleanName) ||
             cleanName.includes(fullName);
    });

    console.log(`[ChapterAI] checkMemberAttendance: found ${matchingMembers.length} matching members`);

    if (matchingMembers.length === 0) {
      return {
        found: false,
        message: `ไม่พบสมาชิกชื่อ "${memberName}" ในระบบ`,
        meeting_date: meetingInfo.meeting_date
      };
    }

    if (matchingMembers.length > 3) {
      return {
        found: false,
        message: `พบสมาชิกหลายคนที่ชื่อคล้าย "${memberName}" กรุณาระบุชื่อให้ชัดเจนกว่านี้`,
        matching_count: matchingMembers.length
      };
    }

    // Get checkin status for matching members
    const memberIds = matchingMembers.map(m => m.participant_id);
    const { data: checkins } = await supabaseAdmin
      .from("checkins")
      .select("participant_id, is_late, checkin_time")
      .eq("meeting_id", targetMeetingId)
      .in("participant_id", memberIds);

    const checkinMap = new Map((checkins || []).map(c => [c.participant_id, c]));

    // Build results
    const results = matchingMembers.map(member => {
      const checkin = checkinMap.get(member.participant_id);
      const displayName = member.nickname_th || member.full_name_th || "ไม่ระบุชื่อ";
      
      if (checkin) {
        return {
          name: displayName,
          status: checkin.is_late ? "มาสาย" : "มาประชุม",
          checkin_time: checkin.checkin_time,
          attended: true,
          late: checkin.is_late
        };
      } else {
        return {
          name: displayName,
          status: "ไม่ได้เข้าประชุม",
          attended: false,
          late: false
        };
      }
    });

    return {
      found: true,
      meeting_date: meetingInfo.meeting_date,
      theme: meetingInfo.theme,
      members: results
    };
  } catch (error) {
    console.error("[ChapterAI] checkMemberAttendance error:", error);
    return { error: "เกิดข้อผิดพลาดในการค้นหาสมาชิก" };
  }
}

async function executeTool(name: string, args: any, context: AIContext): Promise<string> {
  console.log(`[ChapterAI] Executing tool: ${name}`, args);

  switch (name) {
    case "get_meeting_context":
      const meetingResult = await getMeetingContext(context.tenantId, args.date);
      return JSON.stringify(meetingResult);

    case "get_visitor_summary":
      const visitorResult = await getVisitorSummary(context.tenantId, args.range, args.meeting_id);
      return JSON.stringify(visitorResult);

    case "get_unpaid_visitor_fee":
      const isAdmin = context.userRole === "admin";
      const unpaidResult = await getUnpaidVisitorFee(context.tenantId, args.meeting_id, isAdmin);
      return JSON.stringify(unpaidResult);

    case "get_visitor_fee_total":
      const feeResult = await getVisitorFeeTotal(context.tenantId, args.range);
      return JSON.stringify(feeResult);

    case "get_user_role":
      return JSON.stringify({ role: context.userRole });

    case "get_meeting_stats":
      const statsResult = await getMeetingStats(context.tenantId, args.meeting_id);
      return JSON.stringify(statsResult);

    case "get_attendance_insights":
      const attendanceIsAdmin = context.userRole === "admin";
      const attendanceResult = await getAttendanceInsights(
        context.tenantId, 
        args.meeting_id, 
        args.focus || "all",
        attendanceIsAdmin
      );
      return JSON.stringify(attendanceResult);

    case "check_member_attendance":
      const memberResult = await checkMemberAttendance(
        context.tenantId,
        args.member_name,
        args.meeting_id
      );
      return JSON.stringify(memberResult);

    default:
      return JSON.stringify({ error: "Unknown tool" });
  }
}

export async function processChapterAIQuery(
  message: string,
  tenantId: string,
  lineUserId: string
): Promise<string> {
  console.log(`[ChapterAI] Processing query: "${message}" for tenant ${tenantId}`);

  try {
    const userRole = await getUserRole(tenantId, lineUserId);
    console.log(`[ChapterAI] User role: ${userRole}`);

    const context: AIContext = {
      tenantId,
      lineUserId,
      userRole
    };

    const messages: OpenAI.ChatCompletionMessageParam[] = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: message }
    ];

    let response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      tools: TOOLS,
      tool_choice: "auto",
      max_tokens: 1024
    });

    let assistantMessage = response.choices[0].message;

    while (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
      console.log(`[ChapterAI] Tool calls:`, assistantMessage.tool_calls.map(tc => (tc as any).function?.name));

      messages.push(assistantMessage);

      for (const toolCall of assistantMessage.tool_calls) {
        const tc = toolCall as any;
        const toolArgs = JSON.parse(tc.function.arguments);
        const toolResult = await executeTool(tc.function.name, toolArgs, context);

        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: toolResult
        });
      }

      response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages,
        tools: TOOLS,
        tool_choice: "auto",
        max_tokens: 1024
      });

      assistantMessage = response.choices[0].message;
    }

    const finalResponse = assistantMessage.content || "ขออภัย ไม่สามารถประมวลผลคำถามได้";
    console.log(`[ChapterAI] Response: "${finalResponse.substring(0, 100)}..."`);

    return finalResponse;
  } catch (error: any) {
    console.error("[ChapterAI] Error processing query:", error);
    return "ขออภัย เกิดข้อผิดพลาดในการประมวลผล กรุณาลองใหม่อีกครั้ง";
  }
}

export function isChapterAIQuery(text: string): boolean {
  const aiPatterns = [
    /^สวัสดี/i,
    /^หวัดดี/i,
    /^hello/i,
    /^hi$/i,
    /^hi\s/i,
    /ช่วย.*อะไร.*ได้/i,
    /ทำอะไรได้บ้าง/i,
    /ถามอะไรได้บ้าง/i,
    /สรุป.*ผู้.*เยือน/i,
    /สรุป.*visitor/i,
    /visitor.*สรุป/i,
    /ใคร.*ไม่.*จ่าย/i,
    /ค้าง.*ชำระ/i,
    /unpaid/i,
    /visitor.*fee/i,
    /ยอด.*รวม/i,
    /สถิติ.*meeting/i,
    /meeting.*สถิติ/i,
    /สรุป.*วันนี้/i,
    /สรุป.*สัปดาห์/i,
    /สรุป.*เดือน/i,
    /กี่.*คน.*มา/i,
    /มา.*กี่.*คน/i,
  ];

  return aiPatterns.some(pattern => pattern.test(text));
}
