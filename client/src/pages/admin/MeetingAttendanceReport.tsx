import { useEffect, useState } from "react";
import AdminLayout from "@/components/layout/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  ArrowLeft
} from "lucide-react";
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
  attendance_status: "on_time" | "late" | "substitute" | "absent";
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
  attendance_rate: number;
}

interface AttendanceReportData {
  meeting: {
    meeting_id: string;
    meeting_date: string;
    theme: string | null;
    ontime_closed_at: string | null;
  };
  summary: AttendanceSummary;
  members: MemberReport[];
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

  useEffect(() => {
    if (effectiveTenantId) {
      loadMeetings();
    }
  }, [effectiveTenantId]);

  useEffect(() => {
    if (selectedMeetingId) {
      loadAttendanceReport();
    }
  }, [selectedMeetingId]);

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
        // Find the nearest upcoming meeting (or the most recent past one)
        const today = new Date().toISOString().split('T')[0];
        const upcomingMeeting = data.find(m => m.meeting_date >= today);
        if (upcomingMeeting) {
          setSelectedMeetingId(upcomingMeeting.meeting_id);
        } else {
          // No upcoming meeting, use the most recent one
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

      setReportData(data);
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

      const summaryData = [
        { "สรุป": "จำนวนสมาชิกทั้งหมด", "จำนวน": reportData.summary.total_members },
        { "สรุป": "มา (ตรงเวลา)", "จำนวน": reportData.summary.on_time },
        { "สรุป": "มา (สาย)", "จำนวน": reportData.summary.late },
        { "สรุป": "ส่งตัวแทน", "จำนวน": reportData.summary.substitute },
        { "สรุป": "ขาด", "จำนวน": reportData.summary.absent },
        { "สรุป": "อัตราเข้าร่วม", "จำนวน": `${reportData.summary.attendance_rate}%` }
      ];

      const wb = XLSX.utils.book_new();
      
      const wsMembers = XLSX.utils.json_to_sheet(exportData);
      XLSX.utils.book_append_sheet(wb, wsMembers, "รายชื่อ");
      
      const wsSummary = XLSX.utils.json_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, wsSummary, "สรุป");

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
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const filteredMembers = reportData?.members.filter(member => {
    if (statusFilter === "all") return true;
    return member.attendance_status === statusFilter;
  }) || [];

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
            </div>

            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <CardTitle className="text-base">รายชื่อสมาชิก</CardTitle>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[180px]" data-testid="select-status-filter">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">ทั้งหมด ({reportData.members.length})</SelectItem>
                      <SelectItem value="on_time">ตรงเวลา ({reportData.summary.on_time})</SelectItem>
                      <SelectItem value="late">สาย ({reportData.summary.late})</SelectItem>
                      <SelectItem value="substitute">ส่งตัวแทน ({reportData.summary.substitute})</SelectItem>
                      <SelectItem value="absent">ขาด ({reportData.summary.absent})</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
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
            </Card>
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
