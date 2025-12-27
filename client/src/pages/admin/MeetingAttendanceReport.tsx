import { useEffect, useState } from "react";
import AdminLayout from "@/components/layout/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  Calendar, 
  Users, 
  CheckCircle, 
  Clock,
  UserMinus,
  UserPlus,
  Download,
  Loader2,
  FileSpreadsheet,
  TrendingUp,
  TrendingDown,
  ArrowLeft,
  Lock,
  LockOpen,
  LockKeyhole,
  Unlock,
  Phone,
  MessageCircle,
  UserCheck,
  Eye,
  Repeat,
  UserX,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useTenantContext } from "@/contexts/TenantContext";
import SelectTenantPrompt from "@/components/SelectTenantPrompt";
import * as XLSX from "xlsx";
import { useNavigate } from "react-router-dom";

interface MemberReport {
  participant_id: string;
  full_name_th: string;
  nickname_th: string | null;
  phone: string | null;
  photo_url: string | null;
  company_name: string | null;
  position: string | null;
  attendance_status: "on_time" | "late" | "substitute" | "absent" | "pending";
  status_label: string;
  checkin_time: string | null;
  substitute_name: string | null;
  substitute_phone: string | null;
}

interface AttendanceSummary {
  total_members: number;
  on_time: number;
  late: number;
  substitute: number;
  absent: number;
  pending: number;
  attendance_rate: number;
  meeting_has_passed: boolean;
}

interface AttendanceReportData {
  meeting: {
    meeting_id: string;
    meeting_date: string;
    theme: string | null;
    ontime_closed_at: string | null;
    meeting_closed_at: string | null;
  };
  summary: AttendanceSummary;
  members: MemberReport[];
}

interface VisitorReport {
  participant_id: string;
  full_name_th: string;
  nickname_th: string | null;
  phone: string | null;
  company: string | null;
  line_user_id: string | null;
  photo_url: string | null;
  registered_at: string | null;
  checked_in: boolean;
  checkin_time: string | null;
  is_late: boolean;
  referred_by_name: string | null;
  referred_by_nickname: string | null;
  current_status: string;
  is_converted_member: boolean;
}

interface VisitorStats {
  total_registered: number;
  checked_in: number;
  no_show: number;
  no_show_rate: number;
  repeat_visitors: number;
  referred_visitors: number;
  recent_conversions: number;
  previous_avg: number;
  trend_delta: number;
}

interface RepeatVisitor {
  participant_id: string;
  full_name_th: string;
  nickname_th: string | null;
  company: string | null;
  photo_url: string | null;
  previous_visits: number;
  last_visit_date: string | null;
}

export default function MeetingAttendanceReport() {
  const navigate = useNavigate();
  const { effectiveTenantId } = useTenantContext();
  const [loading, setLoading] = useState(true);
  const [meetings, setMeetings] = useState<any[]>([]);
  const [selectedMeetingId, setSelectedMeetingId] = useState<string>("");
  const [reportData, setReportData] = useState<AttendanceReportData | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [closingMeeting, setClosingMeeting] = useState(false);
  const [visitors, setVisitors] = useState<VisitorReport[]>([]);
  const [visitorApiSummary, setVisitorApiSummary] = useState<{ total: number; checked_in: number; not_checked_in: number; converted_members: number } | null>(null);
  const [loadingVisitors, setLoadingVisitors] = useState(false);
  const [visitorStats, setVisitorStats] = useState<VisitorStats | null>(null);
  const [repeatVisitorList, setRepeatVisitorList] = useState<RepeatVisitor[]>([]);
  const [loadingVisitorStats, setLoadingVisitorStats] = useState(false);
  const [repeatVisitorsOpen, setRepeatVisitorsOpen] = useState(false);
  const [membersListOpen, setMembersListOpen] = useState(false);
  const [visitorsListOpen, setVisitorsListOpen] = useState(false);
  const [togglingOntime, setTogglingOntime] = useState(false);
  const [visitorStatusFilter, setVisitorStatusFilter] = useState<string>("all");

  useEffect(() => {
    if (effectiveTenantId) {
      loadMeetings();
    }
  }, [effectiveTenantId]);

  useEffect(() => {
    if (selectedMeetingId) {
      loadAttendanceReport();
      loadVisitors();
      loadVisitorStats();
    }
  }, [selectedMeetingId]);

  const loadVisitors = async () => {
    if (!selectedMeetingId) return;

    setLoadingVisitors(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      const response = await fetch(`/api/palms/meeting/${selectedMeetingId}/registered-visitors`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      const data = await response.json();
      if (data.success) {
        setVisitors(data.visitors || []);
        setVisitorApiSummary(data.summary || null);
      }
    } catch (err: any) {
      console.error("Error loading visitors:", err);
    } finally {
      setLoadingVisitors(false);
    }
  };

  const loadVisitorStats = async () => {
    if (!selectedMeetingId) return;

    setLoadingVisitorStats(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      const response = await fetch(`/api/palms/meeting/${selectedMeetingId}/visitor-stats`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      const data = await response.json();
      if (data.success) {
        setVisitorStats(data.stats);
        setRepeatVisitorList(data.repeat_visitor_list || []);
      }
    } catch (err: any) {
      console.error("Error loading visitor stats:", err);
    } finally {
      setLoadingVisitorStats(false);
    }
  };

  const loadMeetings = async () => {
    if (!effectiveTenantId) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("meetings")
        .select("*")
        .eq("tenant_id", effectiveTenantId)
        .order("meeting_date", { ascending: false })
        .limit(50);

      if (error) throw error;
      setMeetings(data || []);
      
      if (data && data.length > 0) {
        // Find the nearest upcoming meeting (smallest date >= today)
        const today = new Date().toISOString().split('T')[0];
        const upcomingMeetings = data.filter(m => m.meeting_date >= today);
        
        if (upcomingMeetings.length > 0) {
          // Sort ascending by date and pick the first (nearest)
          const nearestMeeting = upcomingMeetings.sort((a, b) => 
            a.meeting_date.localeCompare(b.meeting_date)
          )[0];
          setSelectedMeetingId(nearestMeeting.meeting_id);
        } else {
          // No upcoming meeting, use the most recent past one
          setSelectedMeetingId(data[0].meeting_id);
        }
      }
    } catch (err: any) {
      console.error("Error loading meetings:", err);
      toast.error("ไม่สามารถโหลดรายการ Meeting ได้");
    } finally {
      setLoading(false);
    }
  };

  const loadAttendanceReport = async () => {
    if (!selectedMeetingId) return;

    setLoadingReport(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error("กรุณาเข้าสู่ระบบใหม่");
        return;
      }

      const response = await fetch(`/api/palms/meeting/${selectedMeetingId}/attendance-report`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || "Failed to load report");
      }

      const { meeting, summary, members } = data;
      setReportData({ meeting, summary, members });
    } catch (err: any) {
      console.error("Error loading attendance report:", err);
      toast.error("ไม่สามารถโหลดรายงานได้");
    } finally {
      setLoadingReport(false);
    }
  };

  const handleExportExcel = async () => {
    if (!reportData) return;

    setExporting(true);
    try {
      const meetingDate = new Date(reportData.meeting.meeting_date).toLocaleDateString("th-TH", {
        year: "numeric",
        month: "long",
        day: "numeric"
      });

      const isClosed = !!reportData.meeting.meeting_closed_at;

      // Member export data
      const exportData = reportData.members.map((member, index) => ({
        "ลำดับ": index + 1,
        "ชื่อ-นามสกุล": member.full_name_th,
        "ชื่อเล่น": member.nickname_th || "-",
        "เบอร์โทร": member.phone || "-",
        "บริษัท": member.company_name || "-",
        "ตำแหน่ง": member.position || "-",
        "สถานะ": member.status_label,
        "เวลาเช็คอิน": member.checkin_time 
          ? new Date(member.checkin_time).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })
          : "-",
        "ชื่อตัวแทน": member.substitute_name || "-",
        "เบอร์ตัวแทน": member.substitute_phone || "-"
      }));

      // Member summary
      const summaryData = [
        { "สรุป": "จำนวนสมาชิกทั้งหมด", "จำนวน": reportData.summary.total_members },
        { "สรุป": "มา (ตรงเวลา)", "จำนวน": reportData.summary.on_time },
        { "สรุป": "มา (สาย)", "จำนวน": reportData.summary.late },
        { "สรุป": "ส่งตัวแทน", "จำนวน": reportData.summary.substitute },
        ...(reportData.summary.meeting_has_passed 
          ? [
              { "สรุป": "ขาด", "จำนวน": reportData.summary.absent },
              { "สรุป": "อัตราเข้าร่วม", "จำนวน": `${reportData.summary.attendance_rate}%` }
            ]
          : [
              { "สรุป": "รอเข้าร่วม", "จำนวน": reportData.summary.pending }
            ]
        )
      ];

      // Helper function to get visitor status label
      const getVisitorStatus = (visitor: VisitorReport) => {
        if (visitor.checked_in && visitor.is_late) return "สาย";
        if (visitor.checked_in) return "มา";
        if (!isClosed) return "รอเข้าร่วม";
        return "ขาด";
      };

      // Visitor export data - include converted member status
      const visitorExportData = visitors.map((visitor, index) => ({
        "ลำดับ": index + 1,
        "ชื่อ-นามสกุล": visitor.full_name_th,
        "ชื่อเล่น": visitor.nickname_th || "-",
        "บริษัท": visitor.company || "-",
        "เบอร์โทร": visitor.phone || "-",
        "ผู้แนะนำ": visitor.referred_by_nickname 
          ? `${visitor.referred_by_nickname} (${visitor.referred_by_name})`
          : visitor.referred_by_name || "-",
        "สถานะ": getVisitorStatus(visitor),
        "เวลาเช็คอิน": visitor.checkin_time 
          ? new Date(visitor.checkin_time).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })
          : "-",
        "Converted": visitor.is_converted_member ? "Yes" : "-"
      }));

      // Visitor summary - include converted members count
      const notCheckedIn = visitors.filter(v => !v.checked_in).length;
      const convertedCount = visitors.filter(v => v.is_converted_member).length;
      const visitorSummaryExport = [
        { "สรุป": "จำนวนผู้เยี่ยมชมทั้งหมด", "จำนวน": visitors.length },
        { "สรุป": "มา (ตรงเวลา)", "จำนวน": visitors.filter(v => v.checked_in && !v.is_late).length },
        { "สรุป": "มา (สาย)", "จำนวน": visitors.filter(v => v.checked_in && v.is_late).length },
        ...(isClosed
          ? [{ "สรุป": "ขาด", "จำนวน": notCheckedIn }]
          : [{ "สรุป": "รอเข้าร่วม", "จำนวน": notCheckedIn }]
        ),
        { "สรุป": "Convert เป็นสมาชิก", "จำนวน": convertedCount }
      ];

      const wb = XLSX.utils.book_new();
      
      // Sheet 1: Member list
      const wsMembers = XLSX.utils.json_to_sheet(exportData);
      XLSX.utils.book_append_sheet(wb, wsMembers, "รายชื่อสมาชิก");
      
      // Sheet 2: Member summary
      const wsSummary = XLSX.utils.json_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, wsSummary, "สรุปสมาชิก");

      // Sheet 3: Visitor list (only if there are visitors)
      if (visitors.length > 0) {
        const wsVisitors = XLSX.utils.json_to_sheet(visitorExportData);
        XLSX.utils.book_append_sheet(wb, wsVisitors, "ผู้เยี่ยมชม");
        
        // Sheet 4: Visitor summary
        const wsVisitorSummary = XLSX.utils.json_to_sheet(visitorSummaryExport);
        XLSX.utils.book_append_sheet(wb, wsVisitorSummary, "สรุปผู้เยี่ยมชม");
      }

      const dateStr = reportData.meeting.meeting_date.replace(/-/g, "");
      XLSX.writeFile(wb, `รายงานเข้าร่วม_${dateStr}.xlsx`);
      
      toast.success("ดาวน์โหลดไฟล์ Excel เรียบร้อย");
    } catch (err: any) {
      console.error("Error exporting Excel:", err);
      toast.error("ไม่สามารถส่งออกไฟล์ได้");
    } finally {
      setExporting(false);
    }
  };

  const handleCloseMeeting = async () => {
    if (!selectedMeetingId) return;

    setClosingMeeting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error("กรุณาเข้าสู่ระบบใหม่");
        return;
      }

      const response = await fetch(`/api/palms/meeting/${selectedMeetingId}/close`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json"
        }
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || "Failed to close meeting");
      }

      toast.success("ปิด Meeting เรียบร้อย");
      loadAttendanceReport();
    } catch (err: any) {
      console.error("Error closing meeting:", err);
      toast.error(err.message || "ไม่สามารถปิด Meeting ได้");
    } finally {
      setClosingMeeting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "on_time":
        return <Badge variant="default" className="bg-green-500 hover:bg-green-600">มา (ตรงเวลา)</Badge>;
      case "late":
        return <Badge variant="default" className="bg-yellow-500 hover:bg-yellow-600">มา (สาย)</Badge>;
      case "substitute":
        return <Badge variant="default" className="bg-blue-500 hover:bg-blue-600">ส่งตัวแทน</Badge>;
      case "absent":
        return <Badge variant="destructive">ขาด</Badge>;
      case "pending":
        return <Badge variant="secondary">รอเข้าร่วม</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const selectedMeeting = meetings.find(m => m.meeting_id === selectedMeetingId);
  const isOntimeClosed = !!selectedMeeting?.ontime_closed_at;
  const isMeetingClosed = !!reportData?.meeting.meeting_closed_at;

  const handleToggleOntime = async () => {
    if (!selectedMeetingId) return;
    
    setTogglingOntime(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error("กรุณาเข้าสู่ระบบใหม่");
        return;
      }
      
      const isClosed = selectedMeeting?.ontime_closed_at;
      const endpoint = isClosed 
        ? `/api/palms/meeting/${selectedMeetingId}/reopen-ontime`
        : `/api/palms/meeting/${selectedMeetingId}/close-ontime`;
      
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        toast.success(data.message);
        setMeetings(prev => prev.map(m => 
          m.meeting_id === selectedMeetingId
            ? { ...m, ontime_closed_at: isClosed ? null : new Date().toISOString() }
            : m
        ));
      } else {
        toast.error(data.message || "เกิดข้อผิดพลาด");
      }
    } catch (err) {
      console.error("Error toggling ontime:", err);
      toast.error("ไม่สามารถเปลี่ยนสถานะได้");
    } finally {
      setTogglingOntime(false);
    }
  };

  const filteredMembers = reportData?.members.filter(member => {
    if (statusFilter === "all") return true;
    return member.attendance_status === statusFilter;
  }) || [];

  // Calculate visitor summary stats (pending if meeting not closed, absent if closed)
  // Use API summary for converted_members to ensure consistency with backend
  const notCheckedInVisitors = visitors.filter(v => !v.checked_in).length;
  const convertedMemberCount = visitorApiSummary?.converted_members ?? visitors.filter(v => v.is_converted_member).length;
  const visitorSummary = {
    total: visitorApiSummary?.total ?? visitors.length,
    on_time: visitors.filter(v => v.checked_in && !v.is_late).length,
    late: visitors.filter(v => v.checked_in && v.is_late).length,
    pending: isMeetingClosed ? 0 : notCheckedInVisitors,
    absent: isMeetingClosed ? notCheckedInVisitors : 0,
    converted_members: convertedMemberCount
  };

  const filteredVisitors = visitors.filter(visitor => {
    if (visitorStatusFilter === "all") return true;
    if (visitorStatusFilter === "on_time") return visitor.checked_in && !visitor.is_late;
    if (visitorStatusFilter === "late") return visitor.checked_in && visitor.is_late;
    if (visitorStatusFilter === "pending") return !visitor.checked_in && !isMeetingClosed;
    if (visitorStatusFilter === "absent") return !visitor.checked_in && isMeetingClosed;
    return true;
  });

  const getVisitorStatusBadge = (visitor: VisitorReport) => {
    if (visitor.checked_in && visitor.is_late) {
      return <Badge variant="secondary" className="bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300">สาย</Badge>;
    }
    if (visitor.checked_in) {
      return <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">มา</Badge>;
    }
    if (!isMeetingClosed) {
      return <Badge variant="secondary">รอเข้าร่วม</Badge>;
    }
    return <Badge variant="secondary" className="bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300">ขาด</Badge>;
  };

  if (!effectiveTenantId) {
    return (
      <AdminLayout>
        <SelectTenantPrompt />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="flex flex-col gap-4" data-testid="meeting-attendance-report-page">
        <div className="flex items-center gap-4 flex-wrap">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => navigate("/admin/meetings")}
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-page-title">รายงานเข้าร่วม Meeting</h1>
            <p className="text-muted-foreground text-sm">ดูสถานะการเข้าร่วมของสมาชิกแต่ละคน</p>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">เลือก Meeting</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 flex-wrap">
              <Select 
                value={selectedMeetingId} 
                onValueChange={setSelectedMeetingId}
                disabled={loading}
              >
                <SelectTrigger className="w-full sm:w-[300px]" data-testid="select-meeting">
                  <SelectValue placeholder="เลือก Meeting" />
                </SelectTrigger>
                <SelectContent>
                  {meetings.map((meeting) => (
                    <SelectItem key={meeting.meeting_id} value={meeting.meeting_id}>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        <span>
                          {new Date(meeting.meeting_date).toLocaleDateString("th-TH", {
                            year: "numeric",
                            month: "short",
                            day: "numeric"
                          })}
                        </span>
                        {meeting.theme && (
                          <span className="text-muted-foreground">- {meeting.theme}</span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {reportData && (
                <>
                  {reportData.meeting.meeting_closed_at ? (
                    <Badge variant="secondary" className="gap-1" data-testid="badge-meeting-closed">
                      <Lock className="h-3 w-3" />
                      ปิดแล้ว
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="gap-1" data-testid="badge-meeting-open">
                      <LockOpen className="h-3 w-3" />
                      กำลังดำเนินการ
                    </Badge>
                  )}

                  <Button 
                    onClick={handleExportExcel}
                    disabled={exporting}
                    data-testid="button-export-excel"
                  >
                    {exporting ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <FileSpreadsheet className="h-4 w-4 mr-2" />
                    )}
                    Export Excel
                  </Button>

                  {!reportData.meeting.meeting_closed_at && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button 
                          variant="destructive"
                          disabled={closingMeeting}
                          data-testid="button-close-meeting"
                        >
                          {closingMeeting ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          ) : (
                            <Lock className="h-4 w-4 mr-2" />
                          )}
                          ปิด Meeting
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>ยืนยันปิด Meeting</AlertDialogTitle>
                          <AlertDialogDescription>
                            เมื่อปิด Meeting แล้ว สมาชิกที่ยังไม่ได้เช็คอินจะถูกนับเป็น "ขาด" 
                            และไม่สามารถเช็คอินได้อีก คุณต้องการดำเนินการต่อหรือไม่?
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel data-testid="button-cancel-close">ยกเลิก</AlertDialogCancel>
                          <AlertDialogAction 
                            onClick={handleCloseMeeting}
                            data-testid="button-confirm-close"
                          >
                            ยืนยันปิด Meeting
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {loadingReport ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : reportData ? (
          <>
            {/* Toggle On-time Check-in Button */}
            {!reportData.meeting.meeting_closed_at && (
              <Card className="border-dashed">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-2">
                      <div className={`p-2 rounded-md ${isOntimeClosed ? "bg-orange-500/10" : "bg-green-500/10"}`}>
                        {isOntimeClosed ? (
                          <LockKeyhole className="h-5 w-5 text-orange-500" />
                        ) : (
                          <Unlock className="h-5 w-5 text-green-500" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium">สถานะเช็คอินตรงเวลา</p>
                        <p className="text-xs text-muted-foreground">
                          {isOntimeClosed 
                            ? "ปิดแล้ว - ผู้ที่เช็คอินหลังจากนี้จะถูกบันทึกว่า \"มาสาย\""
                            : "เปิดอยู่ - กดปิดเพื่อเริ่มบันทึกผู้มาสาย"
                          }
                        </p>
                      </div>
                    </div>
                    <Button
                      variant={isOntimeClosed ? "outline" : "destructive"}
                      size="sm"
                      onClick={handleToggleOntime}
                      disabled={togglingOntime}
                      data-testid="button-toggle-ontime"
                    >
                      {togglingOntime ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : isOntimeClosed ? (
                        <Unlock className="h-4 w-4 mr-2" />
                      ) : (
                        <LockKeyhole className="h-4 w-4 mr-2" />
                      )}
                      {isOntimeClosed ? "เปิดรับเช็คอินตรงเวลา" : "ปิดรับเช็คอินตรงเวลา"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <Card data-testid="card-total">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-md bg-muted">
                      <Users className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{reportData.summary.total_members}</p>
                      <p className="text-xs text-muted-foreground">สมาชิกทั้งหมด</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-green-500/30" data-testid="card-on-time">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-md bg-green-500/10">
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-green-600">{reportData.summary.on_time}</p>
                      <p className="text-xs text-muted-foreground">ตรงเวลา</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-yellow-500/30" data-testid="card-late">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-md bg-yellow-500/10">
                      <Clock className="h-5 w-5 text-yellow-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-yellow-600">{reportData.summary.late}</p>
                      <p className="text-xs text-muted-foreground">สาย</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-blue-500/30" data-testid="card-substitute">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-md bg-blue-500/10">
                      <UserPlus className="h-5 w-5 text-blue-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-blue-600">{reportData.summary.substitute}</p>
                      <p className="text-xs text-muted-foreground">ตัวแทน</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {reportData.summary.meeting_has_passed ? (
                <Card className="border-red-500/30" data-testid="card-absent">
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-md bg-red-500/10">
                        <UserMinus className="h-5 w-5 text-red-500" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-red-600">{reportData.summary.absent}</p>
                        <p className="text-xs text-muted-foreground">ขาด</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card className="border-muted-foreground/30" data-testid="card-pending">
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-md bg-muted">
                        <Clock className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-muted-foreground">{reportData.summary.pending}</p>
                        <p className="text-xs text-muted-foreground">รอเข้าร่วม</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {reportData.summary.meeting_has_passed && (
                <Card className="border-primary/30" data-testid="card-rate">
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-md bg-primary/10">
                        <TrendingUp className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{reportData.summary.attendance_rate}%</p>
                        <p className="text-xs text-muted-foreground">เข้าร่วม</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Visitor Insights Card */}
            <Card data-testid="card-visitor-insights">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Eye className="h-5 w-5 text-purple-500" />
                    สถิติผู้เยี่ยมชม
                  </CardTitle>
                  {loadingVisitorStats && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                </div>
              </CardHeader>
              <CardContent>
                {visitorStats ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                      <div className="p-3 rounded-lg border bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800">
                        <div className="flex items-center gap-2 mb-1">
                          <Users className="h-4 w-4 text-purple-500" />
                          <span className="text-xs text-muted-foreground">ลงทะเบียน</span>
                        </div>
                        <div className="flex items-baseline gap-2">
                          <span className="text-2xl font-bold text-purple-600">{visitorStats.total_registered}</span>
                          {visitorStats.trend_delta !== 0 && (
                            <Badge 
                              variant="outline" 
                              className={visitorStats.trend_delta > 0 
                                ? "text-green-600 border-green-300" 
                                : "text-red-600 border-red-300"
                              }
                            >
                              {visitorStats.trend_delta > 0 ? (
                                <TrendingUp className="h-3 w-3 mr-1" />
                              ) : (
                                <TrendingDown className="h-3 w-3 mr-1" />
                              )}
                              {visitorStats.trend_delta > 0 ? "+" : ""}{visitorStats.trend_delta}%
                            </Badge>
                          )}
                        </div>
                        {visitorStats.previous_avg > 0 && (
                          <p className="text-xs text-muted-foreground mt-1">
                            เฉลี่ย 4 ครั้งก่อน: {visitorStats.previous_avg}
                          </p>
                        )}
                      </div>

                      <div className="p-3 rounded-lg border bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800">
                        <div className="flex items-center gap-2 mb-1">
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          <span className="text-xs text-muted-foreground">เช็คอิน</span>
                        </div>
                        <span className="text-2xl font-bold text-green-600">{visitorStats.checked_in}</span>
                        <p className="text-xs text-muted-foreground mt-1">
                          จาก {visitorStats.total_registered} ที่ลงทะเบียน
                        </p>
                      </div>

                      <div className="p-3 rounded-lg border bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800">
                        <div className="flex items-center gap-2 mb-1">
                          <UserX className="h-4 w-4 text-red-500" />
                          <span className="text-xs text-muted-foreground">No-show</span>
                        </div>
                        <div className="flex items-baseline gap-2">
                          <span className="text-2xl font-bold text-red-600">{visitorStats.no_show}</span>
                          {visitorStats.total_registered > 0 && (
                            <span className="text-sm text-red-500">({visitorStats.no_show_rate}%)</span>
                          )}
                        </div>
                      </div>

                      <div className="p-3 rounded-lg border bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
                        <div className="flex items-center gap-2 mb-1">
                          <Repeat className="h-4 w-4 text-amber-500" />
                          <span className="text-xs text-muted-foreground">มาซ้ำ</span>
                        </div>
                        <span className="text-2xl font-bold text-amber-600">{visitorStats.repeat_visitors}</span>
                        <p className="text-xs text-muted-foreground mt-1">
                          เคยมาประชุมก่อน
                        </p>
                      </div>

                      <div className="p-3 rounded-lg border bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
                        <div className="flex items-center gap-2 mb-1">
                          <UserCheck className="h-4 w-4 text-blue-500" />
                          <span className="text-xs text-muted-foreground">Conversion</span>
                        </div>
                        <span className="text-2xl font-bold text-blue-600">{visitorStats.recent_conversions}</span>
                        <p className="text-xs text-muted-foreground mt-1">
                          สมาชิกใหม่ 90 วัน
                        </p>
                      </div>
                    </div>

                    {repeatVisitorList.length > 0 && (
                      <Collapsible open={repeatVisitorsOpen} onOpenChange={setRepeatVisitorsOpen}>
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" className="w-full justify-between" data-testid="button-toggle-repeat-visitors">
                            <span className="flex items-center gap-2">
                              <Repeat className="h-4 w-4 text-amber-500" />
                              ผู้เยี่ยมชมที่มาซ้ำ ({repeatVisitorList.length})
                            </span>
                            {repeatVisitorsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="pt-2">
                          <div className="space-y-2 max-h-48 overflow-y-auto">
                            {repeatVisitorList.map((visitor) => (
                              <div 
                                key={visitor.participant_id}
                                className="flex items-center gap-3 p-2 rounded-lg border bg-muted/50"
                                data-testid={`row-repeat-visitor-${visitor.participant_id}`}
                              >
                                <Avatar className="h-8 w-8">
                                  <AvatarImage src={visitor.photo_url || undefined} />
                                  <AvatarFallback>{visitor.full_name_th?.charAt(0) || "?"}</AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1 flex-wrap">
                                    <p className="font-medium text-sm truncate">{visitor.full_name_th}</p>
                                    {visitor.nickname_th && (
                                      <span className="text-xs text-muted-foreground">({visitor.nickname_th})</span>
                                    )}
                                  </div>
                                  {visitor.company && (
                                    <p className="text-xs text-muted-foreground truncate">{visitor.company}</p>
                                  )}
                                </div>
                                <Badge variant="secondary" className="shrink-0">
                                  {visitor.last_visit_date 
                                    ? new Date(visitor.last_visit_date).toLocaleDateString("th-TH", { day: "numeric", month: "short" })
                                    : `${visitor.previous_visits} ครั้ง`
                                  }
                                </Badge>
                              </div>
                            ))}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-6 text-muted-foreground">
                    {loadingVisitorStats ? "กำลังโหลด..." : "ไม่มีข้อมูลผู้เยี่ยมชม"}
                  </div>
                )}
              </CardContent>
            </Card>

            <Collapsible open={membersListOpen} onOpenChange={setMembersListOpen}>
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" className="gap-2 p-0 h-auto hover:bg-transparent" data-testid="button-toggle-members">
                        <CardTitle className="text-base">รายชื่อสมาชิก ({reportData.members.length})</CardTitle>
                        <ChevronDown className={`h-4 w-4 transition-transform ${membersListOpen ? "" : "-rotate-90"}`} />
                      </Button>
                    </CollapsibleTrigger>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-[180px]" data-testid="select-status-filter">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">ทั้งหมด ({reportData.members.length})</SelectItem>
                        <SelectItem value="on_time">ตรงเวลา ({reportData.summary.on_time})</SelectItem>
                        <SelectItem value="late">สาย ({reportData.summary.late})</SelectItem>
                        <SelectItem value="substitute">ส่งตัวแทน ({reportData.summary.substitute})</SelectItem>
                        {reportData.summary.meeting_has_passed ? (
                          <SelectItem value="absent">ขาด ({reportData.summary.absent})</SelectItem>
                        ) : (
                          <SelectItem value="pending">รอเข้าร่วม ({reportData.summary.pending})</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </CardHeader>
                <CollapsibleContent>
                  <CardContent className="pt-0">
                    <div className="space-y-2">
                      {filteredMembers.length === 0 ? (
                        <p className="text-center text-muted-foreground py-8">ไม่พบข้อมูล</p>
                      ) : (
                        filteredMembers.map((member) => (
                          <div 
                            key={member.participant_id}
                            className="flex items-center gap-3 p-3 rounded-lg border"
                            data-testid={`row-member-${member.participant_id}`}
                          >
                            <Avatar className="h-10 w-10">
                              <AvatarImage src={member.photo_url || undefined} />
                              <AvatarFallback>
                                {member.full_name_th?.charAt(0) || "?"}
                              </AvatarFallback>
                            </Avatar>
                            
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-medium truncate">{member.full_name_th}</p>
                                {member.nickname_th && (
                                  <span className="text-sm text-muted-foreground">({member.nickname_th})</span>
                                )}
                              </div>
                              <div className="text-sm text-muted-foreground truncate">
                                {member.company_name || member.position || member.phone || "-"}
                              </div>
                              {member.attendance_status === "substitute" && member.substitute_name && (
                                <div className="text-sm text-blue-600 mt-1">
                                  ตัวแทน: {member.substitute_name} ({member.substitute_phone})
                                </div>
                              )}
                              {member.checkin_time && (
                                <div className="text-sm text-muted-foreground">
                                  เช็คอิน: {new Date(member.checkin_time).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}
                                </div>
                              )}
                            </div>
                            
                            <div className="shrink-0">
                              {getStatusBadge(member.attendance_status)}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>

            {/* Visitor Section - Show all registered visitors with status */}
            <Collapsible open={visitorsListOpen} onOpenChange={setVisitorsListOpen}>
              <Card data-testid="card-visitors">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex flex-col gap-1">
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" className="gap-2 p-0 h-auto hover:bg-transparent justify-start" data-testid="button-toggle-visitors">
                          <CardTitle className="text-base">รายชื่อผู้เยี่ยมชม ({visitors.length})</CardTitle>
                          <ChevronDown className={`h-4 w-4 transition-transform ${visitorsListOpen ? "" : "-rotate-90"}`} />
                        </Button>
                      </CollapsibleTrigger>
                      {convertedMemberCount > 0 && (
                        <CardDescription className="flex items-center gap-1" data-testid="text-converted-members">
                          <UserCheck className="h-3 w-3 text-emerald-600" />
                          <span>{convertedMemberCount} คน convert เป็นสมาชิกแล้ว</span>
                        </CardDescription>
                      )}
                    </div>
                    <Select value={visitorStatusFilter} onValueChange={setVisitorStatusFilter}>
                      <SelectTrigger className="w-[180px]" data-testid="select-visitor-status-filter">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">ทั้งหมด ({visitorSummary.total})</SelectItem>
                        <SelectItem value="on_time">ตรงเวลา ({visitorSummary.on_time})</SelectItem>
                        <SelectItem value="late">สาย ({visitorSummary.late})</SelectItem>
                        {!isMeetingClosed && (
                          <SelectItem value="pending">รอเข้าร่วม ({visitorSummary.pending})</SelectItem>
                        )}
                        {isMeetingClosed && (
                          <SelectItem value="absent">ขาด ({visitorSummary.absent})</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </CardHeader>
                <CollapsibleContent>
                  <CardContent className="pt-0">
                    {loadingVisitors ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : filteredVisitors.length === 0 ? (
                      <p className="text-center text-muted-foreground py-8">ไม่พบข้อมูล</p>
                    ) : (
                      <div className="space-y-2">
                        {filteredVisitors.map((visitor) => (
                          <div 
                            key={visitor.participant_id}
                            className="flex items-center gap-3 p-3 rounded-lg border"
                            data-testid={`row-visitor-${visitor.participant_id}`}
                          >
                            <Avatar className="h-10 w-10">
                              <AvatarImage src={visitor.photo_url || undefined} />
                              <AvatarFallback>
                                {visitor.full_name_th?.charAt(0) || "?"}
                              </AvatarFallback>
                            </Avatar>
                            
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-medium truncate">{visitor.full_name_th}</p>
                                {visitor.nickname_th && (
                                  <span className="text-sm text-muted-foreground">({visitor.nickname_th})</span>
                                )}
                              </div>
                              <div className="text-sm text-muted-foreground space-y-0.5">
                                {visitor.company && (
                                  <div className="truncate">{visitor.company}</div>
                                )}
                                {visitor.phone && (
                                  <div>{visitor.phone}</div>
                                )}
                                {visitor.referred_by_nickname || visitor.referred_by_name ? (
                                  <div className="truncate">
                                    <span className="text-xs">ผู้แนะนำ: </span>
                                    {visitor.referred_by_nickname 
                                      ? `${visitor.referred_by_nickname} (${visitor.referred_by_name})`
                                      : visitor.referred_by_name
                                    }
                                  </div>
                                ) : null}
                              </div>
                              {visitor.checkin_time && (
                                <div className="text-sm text-muted-foreground">
                                  เช็คอิน: {new Date(visitor.checkin_time).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}
                                </div>
                              )}
                            </div>
                            
                            <div className="flex items-center gap-2 shrink-0">
                              {visitor.is_converted_member && (
                                <Badge 
                                  variant="secondary" 
                                  className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300"
                                  data-testid={`badge-converted-member-${visitor.participant_id}`}
                                >
                                  <UserCheck className="h-3 w-3 mr-1" />
                                  Converted
                                </Badge>
                              )}
                              {visitor.phone && (
                                <Button
                                  variant="outline"
                                  size="icon"
                                  asChild
                                  data-testid={`button-call-visitor-${visitor.participant_id}`}
                                >
                                  <a href={`tel:${visitor.phone}`}>
                                    <Phone className="h-4 w-4" />
                                  </a>
                                </Button>
                              )}
                              {visitor.line_user_id && (
                                <Button
                                  variant="outline"
                                  size="icon"
                                  asChild
                                  data-testid={`button-line-visitor-${visitor.participant_id}`}
                                >
                                  <a 
                                    href={`https://line.me/R/oaMessage/@${visitor.line_user_id}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    <MessageCircle className="h-4 w-4" />
                                  </a>
                                </Button>
                              )}
                              {getVisitorStatusBadge(visitor)}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          </>
        ) : meetings.length === 0 ? (
          <Card>
            <CardContent className="py-12">
              <p className="text-center text-muted-foreground">ยังไม่มี Meeting</p>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </AdminLayout>
  );
}
