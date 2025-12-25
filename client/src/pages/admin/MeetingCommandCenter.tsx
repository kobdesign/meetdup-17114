import { useEffect, useState, useMemo, useCallback } from "react";
import AdminLayout from "@/components/layout/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  Calendar, 
  Users, 
  Search, 
  CheckCircle, 
  Clock,
  Loader2,
  UserCheck,
  DollarSign,
  UserX,
  RefreshCw,
  Filter,
  Eye,
  Building,
  Camera,
  XCircle,
  QrCode
} from "lucide-react";
import { useTenantContext } from "@/contexts/TenantContext";
import SelectTenantPrompt from "@/components/SelectTenantPrompt";
import { apiRequest } from "@/lib/queryClient";
import { IDetectedBarcode, Scanner } from "@yudiel/react-qr-scanner";

type FilterType = "all" | "members" | "visitors" | "not_checked_in" | "unpaid";

interface Participant {
  participant_id: string;
  full_name_th: string;
  nickname_th?: string;
  status: string;
  phone?: string;
  company?: string;
  photo_url?: string;
  referred_by_name?: string;
}

interface CheckinRecord {
  checkin_id: string;
  participant_id: string;
  checkin_time: string;
  is_late: boolean;
}

interface VisitorFee {
  fee_id: string;
  participant_id: string;
  amount_due: number;
  status: string;
}

interface ParticipantWithStatus extends Participant {
  is_checked_in: boolean;
  is_late: boolean;
  checkin_time?: string;
  fee_status?: string;
  fee_id?: string;
  amount_due?: number;
}

export default function MeetingCommandCenter() {
  const { effectiveTenantId, isSuperAdmin } = useTenantContext();
  const [loading, setLoading] = useState(true);
  const [meetings, setMeetings] = useState<any[]>([]);
  const [selectedMeetingId, setSelectedMeetingId] = useState<string>("");
  const [participants, setParticipants] = useState<ParticipantWithStatus[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<"manual" | "qr">("manual");
  const [scannerActive, setScannerActive] = useState(false);
  const [validatingQr, setValidatingQr] = useState(false);
  const [scanResult, setScanResult] = useState<{success: boolean; message: string; name?: string} | null>(null);

  const selectedMeeting = meetings.find(m => m.meeting_id === selectedMeetingId);

  useEffect(() => {
    if (effectiveTenantId) {
      loadMeetings();
    }
  }, [effectiveTenantId]);

  useEffect(() => {
    if (selectedMeetingId) {
      loadParticipantsWithStatus();
    }
  }, [selectedMeetingId]);

  const loadMeetings = async () => {
    if (!effectiveTenantId) {
      setLoading(false);
      return;
    }

    try {
      const today = new Date();
      const sevenDaysAgo = new Date(today);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const thirtyDaysLater = new Date(today);
      thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30);

      const { data, error } = await supabase
        .from("meetings")
        .select("*")
        .eq("tenant_id", effectiveTenantId)
        .gte("meeting_date", sevenDaysAgo.toISOString().split("T")[0])
        .lte("meeting_date", thirtyDaysLater.toISOString().split("T")[0])
        .order("meeting_date", { ascending: false });

      if (error) throw error;
      setMeetings(data || []);

      const todayStr = today.toISOString().split("T")[0];
      const todayMeeting = data?.find(m => m.meeting_date === todayStr);
      
      if (todayMeeting) {
        setSelectedMeetingId(todayMeeting.meeting_id);
      } else if (data && data.length > 0) {
        const upcomingMeetings = data
          .filter(m => m.meeting_date >= todayStr)
          .sort((a, b) => a.meeting_date.localeCompare(b.meeting_date));
        
        if (upcomingMeetings.length > 0) {
          setSelectedMeetingId(upcomingMeetings[0].meeting_id);
        } else {
          const pastMeetings = data
            .filter(m => m.meeting_date < todayStr)
            .sort((a, b) => b.meeting_date.localeCompare(a.meeting_date));
          if (pastMeetings.length > 0) {
            setSelectedMeetingId(pastMeetings[0].meeting_id);
          }
        }
      }
    } catch (error: any) {
      toast.error("เกิดข้อผิดพลาดในการโหลดข้อมูล");
    } finally {
      setLoading(false);
    }
  };

  const loadParticipantsWithStatus = async () => {
    if (!selectedMeetingId || !effectiveTenantId) return;

    setRefreshing(true);
    try {
      const { data: registrations, error: regError } = await supabase
        .from("meeting_registrations")
        .select(`
          participant_id,
          participant:participants!inner(
            participant_id,
            full_name_th,
            nickname_th,
            status,
            phone,
            company,
            photo_url
          )
        `)
        .eq("meeting_id", selectedMeetingId);

      if (regError) throw regError;

      const { data: members, error: memberError } = await supabase
        .from("participants")
        .select("participant_id, full_name_th, nickname_th, status, phone, company, photo_url")
        .eq("tenant_id", effectiveTenantId)
        .eq("status", "member");

      if (memberError) throw memberError;

      const { data: checkins, error: checkinError } = await supabase
        .from("checkins")
        .select("checkin_id, participant_id, checkin_time, is_late")
        .eq("meeting_id", selectedMeetingId);

      if (checkinError) throw checkinError;

      const { data: { session } } = await supabase.auth.getSession();
      let visitorFees: VisitorFee[] = [];
      if (session?.access_token) {
        try {
          const feesResponse = await fetch(`/api/payments/visitor-fees/${selectedMeetingId}`, {
            headers: { "Authorization": `Bearer ${session.access_token}` }
          });
          const feesData = await feesResponse.json();
          if (feesData.success) {
            visitorFees = feesData.data || [];
          }
        } catch (e) {
          console.error("Failed to load visitor fees:", e);
        }
      }

      const checkinMap = new Map<string, CheckinRecord>();
      (checkins || []).forEach((c: any) => checkinMap.set(c.participant_id, c));

      const feeMap = new Map<string, VisitorFee>();
      visitorFees.forEach(f => feeMap.set(f.participant_id, f));

      const registeredVisitors = (registrations || [])
        .map((r: any) => r.participant)
        .filter((p: any) => p && (p.status === "visitor" || p.status === "prospect"));

      const allParticipants = [...(members || []), ...registeredVisitors];
      const uniqueParticipants = Array.from(
        new Map(allParticipants.map(p => [p.participant_id, p])).values()
      );

      const participantsWithStatus: ParticipantWithStatus[] = uniqueParticipants.map(p => {
        const checkin = checkinMap.get(p.participant_id);
        const fee = feeMap.get(p.participant_id);
        return {
          ...p,
          is_checked_in: !!checkin,
          is_late: checkin?.is_late || false,
          checkin_time: checkin?.checkin_time,
          fee_status: fee?.status,
          fee_id: fee?.fee_id,
          amount_due: fee?.amount_due
        };
      });

      participantsWithStatus.sort((a, b) => {
        if (a.status === "member" && b.status !== "member") return -1;
        if (a.status !== "member" && b.status === "member") return 1;
        return (a.full_name_th || "").localeCompare(b.full_name_th || "");
      });

      setParticipants(participantsWithStatus);
      setSelectedIds([]);
    } catch (error: any) {
      console.error("Error loading participants:", error);
      toast.error("เกิดข้อผิดพลาดในการโหลดข้อมูล");
    } finally {
      setRefreshing(false);
    }
  };

  const stats = useMemo(() => {
    const members = participants.filter(p => p.status === "member");
    const visitors = participants.filter(p => p.status === "visitor" || p.status === "prospect");
    const membersCheckedIn = members.filter(p => p.is_checked_in);
    const visitorsCheckedIn = visitors.filter(p => p.is_checked_in);
    const late = participants.filter(p => p.is_late);
    const unpaidVisitors = visitors.filter(p => p.fee_status === "pending");
    const paidVisitors = visitors.filter(p => p.fee_status === "paid");
    const totalFees = visitors.reduce((sum, p) => sum + (p.amount_due || 0), 0);
    const paidFees = paidVisitors.reduce((sum, p) => sum + (p.amount_due || 0), 0);

    return {
      totalMembers: members.length,
      membersCheckedIn: membersCheckedIn.length,
      totalVisitors: visitors.length,
      visitorsCheckedIn: visitorsCheckedIn.length,
      late: late.length,
      unpaidVisitors: unpaidVisitors.length,
      paidVisitors: paidVisitors.length,
      totalFees,
      paidFees,
      outstandingFees: totalFees - paidFees
    };
  }, [participants]);

  const filteredParticipants = useMemo(() => {
    let result = participants;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(p => 
        p.full_name_th?.toLowerCase().includes(q) ||
        p.nickname_th?.toLowerCase().includes(q) ||
        p.phone?.includes(q) ||
        p.company?.toLowerCase().includes(q)
      );
    }

    switch (filter) {
      case "members":
        result = result.filter(p => p.status === "member");
        break;
      case "visitors":
        result = result.filter(p => p.status === "visitor" || p.status === "prospect");
        break;
      case "not_checked_in":
        result = result.filter(p => !p.is_checked_in);
        break;
      case "unpaid":
        result = result.filter(p => p.fee_status === "pending");
        break;
    }

    return result;
  }, [participants, searchQuery, filter]);

  const handleCheckin = async (participantId: string, isLate: boolean = false) => {
    if (!selectedMeetingId) return;
    setActionLoading(participantId);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error("กรุณาเข้าสู่ระบบใหม่");
        return;
      }

      const requestBody = {
        meeting_id: selectedMeetingId,
        participant_id: participantId,
        is_late: isLate,
        expected_tenant_id: effectiveTenantId
      };
      console.log("[handleCheckin] Request:", requestBody);

      const response = await fetch("/api/pos-manual-checkin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`
        },
        body: JSON.stringify(requestBody)
      });

      const data = await response.json();
      console.log("[handleCheckin] Response:", data);
      
      if (data.success) {
        toast.success(isLate ? "บันทึกการมาสายสำเร็จ" : "เช็คอินสำเร็จ");
        setParticipants(prev => prev.map(p => 
          p.participant_id === participantId 
            ? { ...p, is_checked_in: true, is_late: isLate, checkin_time: new Date().toISOString() }
            : p
        ));
      } else {
        console.log("[handleCheckin] Error from API:", data.error);
        toast.error(data.error || "เกิดข้อผิดพลาด");
      }
    } catch (error) {
      console.error("[handleCheckin] Exception:", error);
      toast.error("เกิดข้อผิดพลาดในการเช็คอิน");
    } finally {
      setActionLoading(null);
    }
  };

  const handleMarkPaid = async (feeId: string, participantId: string) => {
    setActionLoading(participantId);

    try {
      const response = await apiRequest(`/api/payments/visitor-fees/${feeId}/mark-paid`, "PATCH", {});
      if (response.success) {
        toast.success("บันทึกการชำระเงินสำเร็จ");
        setParticipants(prev => prev.map(p => 
          p.participant_id === participantId 
            ? { ...p, fee_status: "paid" }
            : p
        ));
      } else {
        toast.error("เกิดข้อผิดพลาด");
      }
    } catch (error) {
      toast.error("เกิดข้อผิดพลาดในการบันทึก");
    } finally {
      setActionLoading(null);
    }
  };

  const handleBulkCheckin = async (isLate: boolean = false) => {
    if (selectedIds.length === 0) return;
    
    for (const id of selectedIds) {
      const p = participants.find(p => p.participant_id === id);
      if (p && !p.is_checked_in) {
        await handleCheckin(id, isLate);
      }
    }
    setSelectedIds([]);
  };

  const handleBulkMarkPaid = async () => {
    const unpaidSelected = selectedIds
      .map(id => participants.find(p => p.participant_id === id))
      .filter(p => p && p.fee_id && p.fee_status === "pending");

    if (unpaidSelected.length === 0) return;

    try {
      const feeIds = unpaidSelected.map(p => p!.fee_id!);
      const response = await apiRequest("/api/payments/visitor-fees/bulk-mark-paid", "POST", { fee_ids: feeIds });
      if (response.success) {
        toast.success(`บันทึกการชำระเงิน ${unpaidSelected.length} รายการ`);
        await loadParticipantsWithStatus();
      }
    } catch (error) {
      toast.error("เกิดข้อผิดพลาด");
    }
    setSelectedIds([]);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const selectAllFiltered = () => {
    setSelectedIds(filteredParticipants.map(p => p.participant_id));
  };

  const getInitials = (name: string) => {
    return name?.charAt(0) || "?";
  };

  const handleQrScan = useCallback(async (detectedCodes: IDetectedBarcode[]) => {
    if (detectedCodes.length === 0 || validatingQr) return;
    
    const qrData = detectedCodes[0].rawValue;
    if (!qrData) return;
    
    setValidatingQr(true);
    setScanResult(null);
    
    try {
      const response = await fetch("/api/participants/pos-checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          qr_token: qrData,
          meeting_id: selectedMeetingId,
          expected_tenant_id: effectiveTenantId
        })
      });
      
      const data = await response.json();
      
      if (data.already_checked_in) {
        setScanResult({ success: false, message: `${data.participant?.full_name_th || "ผู้เข้าร่วม"} เช็คอินแล้ว`, name: data.participant?.full_name_th });
        return;
      }
      
      if (!response.ok || !data.success) {
        setScanResult({ success: false, message: data.error || "QR Code ไม่ถูกต้อง" });
        return;
      }
      
      setScanResult({ success: true, message: `เช็คอินสำเร็จ: ${data.participant?.full_name_th}`, name: data.participant?.full_name_th });
      toast.success(data.message || `เช็คอินสำเร็จ`);
      loadParticipantsWithStatus();
      
      setTimeout(() => setScanResult(null), 3000);
      
    } catch (error) {
      setScanResult({ success: false, message: "เกิดข้อผิดพลาดในการเช็คอิน" });
    } finally {
      setValidatingQr(false);
    }
  }, [selectedMeetingId, effectiveTenantId, validatingQr]);

  if (!effectiveTenantId && isSuperAdmin) {
    return (
      <AdminLayout>
        <SelectTenantPrompt />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              เลือกการประชุม
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={selectedMeetingId} onValueChange={setSelectedMeetingId}>
              <SelectTrigger data-testid="select-meeting">
                <SelectValue placeholder="เลือกการประชุม" />
              </SelectTrigger>
              <SelectContent>
                {meetings.length === 0 ? (
                  <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                    ไม่มีข้อมูลการประชุม
                  </div>
                ) : (
                  meetings.map((meeting) => (
                    <SelectItem key={meeting.meeting_id} value={meeting.meeting_id}>
                      {new Date(meeting.meeting_date).toLocaleDateString("th-TH", {
                        weekday: "short",
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                      {meeting.theme && ` - ${meeting.theme}`}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {selectedMeetingId && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card className="bg-blue-50 dark:bg-blue-950/30">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-blue-600" />
                    <span className="text-sm text-muted-foreground">สมาชิก</span>
                  </div>
                  <p className="text-2xl font-bold text-blue-600 mt-1">
                    {stats.membersCheckedIn}/{stats.totalMembers}
                  </p>
                  <p className="text-xs text-muted-foreground">เช็คอินแล้ว</p>
                </CardContent>
              </Card>

              <Card className="bg-purple-50 dark:bg-purple-950/30">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <Eye className="h-4 w-4 text-purple-600" />
                    <span className="text-sm text-muted-foreground">Visitor</span>
                  </div>
                  <p className="text-2xl font-bold text-purple-600 mt-1">
                    {stats.visitorsCheckedIn}/{stats.totalVisitors}
                  </p>
                  <p className="text-xs text-muted-foreground">เช็คอินแล้ว</p>
                </CardContent>
              </Card>

              <Card className="bg-orange-50 dark:bg-orange-950/30">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-orange-600" />
                    <span className="text-sm text-muted-foreground">มาสาย</span>
                  </div>
                  <p className="text-2xl font-bold text-orange-600 mt-1">{stats.late}</p>
                  <p className="text-xs text-muted-foreground">คน</p>
                </CardContent>
              </Card>

              <Card className="bg-green-50 dark:bg-green-950/30">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-green-600" />
                    <span className="text-sm text-muted-foreground">ค่าลงทะเบียน</span>
                  </div>
                  <p className="text-2xl font-bold text-green-600 mt-1">
                    {stats.paidFees.toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    / {stats.totalFees.toLocaleString()} บาท
                  </p>
                </CardContent>
              </Card>
            </div>

            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "manual" | "qr")} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="manual" className="gap-2" data-testid="tab-manual">
                  <Search className="h-4 w-4" />
                  ค้นหา
                </TabsTrigger>
                <TabsTrigger value="qr" className="gap-2" data-testid="tab-qr">
                  <QrCode className="h-4 w-4" />
                  QR Scanner
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="qr" className="mt-4">
                <Card>
                  <CardContent className="p-6">
                    <div className="flex flex-col items-center gap-4">
                      {!scannerActive ? (
                        <>
                          <div className="text-center">
                            <Camera className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                            <p className="text-muted-foreground mb-4">เปิดกล้องเพื่อสแกน QR Code เช็คอิน</p>
                          </div>
                          <Button onClick={() => setScannerActive(true)} data-testid="button-start-scanner">
                            <Camera className="h-4 w-4 mr-2" />
                            เปิดกล้อง
                          </Button>
                        </>
                      ) : (
                        <>
                          <div className="w-full max-w-sm aspect-square rounded-lg overflow-hidden relative">
                            <Scanner
                              onScan={handleQrScan}
                              paused={validatingQr}
                              components={{
                                finder: true,
                              }}
                              styles={{
                                container: { width: "100%", height: "100%" },
                              }}
                            />
                            {validatingQr && (
                              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                <Loader2 className="h-8 w-8 animate-spin text-white" />
                              </div>
                            )}
                          </div>
                          
                          {scanResult && (
                            <div className={`p-4 rounded-lg w-full max-w-sm text-center ${
                              scanResult.success 
                                ? "bg-green-100 dark:bg-green-950 text-green-800 dark:text-green-200" 
                                : "bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-200"
                            }`}>
                              {scanResult.success ? (
                                <CheckCircle className="h-6 w-6 mx-auto mb-2" />
                              ) : (
                                <XCircle className="h-6 w-6 mx-auto mb-2" />
                              )}
                              <p className="font-medium">{scanResult.message}</p>
                            </div>
                          )}
                          
                          <Button variant="outline" onClick={() => { setScannerActive(false); setScanResult(null); }} data-testid="button-stop-scanner">
                            ปิดกล้อง
                          </Button>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="manual" className="mt-4">
                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="ค้นหาชื่อ เบอร์โทร บริษัท..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-9"
                          data-testid="input-search"
                        />
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Select value={filter} onValueChange={(v) => setFilter(v as FilterType)}>
                          <SelectTrigger className="w-[160px]" data-testid="select-filter">
                            <Filter className="h-4 w-4 mr-2" />
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">ทั้งหมด</SelectItem>
                            <SelectItem value="members">สมาชิก</SelectItem>
                            <SelectItem value="visitors">Visitor</SelectItem>
                            <SelectItem value="not_checked_in">ยังไม่เช็คอิน</SelectItem>
                            <SelectItem value="unpaid">ค้างชำระ</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button variant="outline" size="icon" onClick={loadParticipantsWithStatus} disabled={refreshing} data-testid="button-refresh">
                          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                {selectedIds.length > 0 && (
                  <div className="flex items-center gap-2 mb-4 p-3 bg-muted rounded-lg flex-wrap">
                    <span className="text-sm">เลือก {selectedIds.length} รายการ</span>
                    <Button size="sm" onClick={() => handleBulkCheckin(false)} data-testid="button-bulk-checkin">
                      <CheckCircle className="h-4 w-4 mr-1" />
                      เช็คอิน
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleBulkCheckin(true)} data-testid="button-bulk-late">
                      <Clock className="h-4 w-4 mr-1" />
                      มาสาย
                    </Button>
                    <Button size="sm" variant="secondary" onClick={handleBulkMarkPaid} data-testid="button-bulk-paid">
                      <DollarSign className="h-4 w-4 mr-1" />
                      จ่ายแล้ว
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setSelectedIds([])} data-testid="button-clear-selection">
                      ยกเลิก
                    </Button>
                  </div>
                )}

                {filteredParticipants.length > 0 && selectedIds.length === 0 && (
                  <div className="mb-3">
                    <Button variant="ghost" size="sm" onClick={selectAllFiltered} data-testid="button-select-all">
                      เลือกทั้งหมด ({filteredParticipants.length})
                    </Button>
                  </div>
                )}

                {loading || refreshing ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredParticipants.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <UserX className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>ไม่พบข้อมูล</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[600px] overflow-y-auto">
                    {filteredParticipants.map((p) => (
                      <div
                        key={p.participant_id}
                        className={`flex items-center gap-3 p-3 border rounded-lg transition-colors ${
                          p.is_checked_in 
                            ? p.is_late 
                              ? "bg-orange-50/50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800"
                              : "bg-green-50/50 dark:bg-green-950/20 border-green-200 dark:border-green-800"
                            : "hover:bg-accent"
                        }`}
                        data-testid={`participant-${p.participant_id}`}
                      >
                        <Checkbox
                          checked={selectedIds.includes(p.participant_id)}
                          onCheckedChange={() => toggleSelect(p.participant_id)}
                          data-testid={`checkbox-${p.participant_id}`}
                        />
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={p.photo_url || undefined} />
                          <AvatarFallback className={
                            p.status === "member" ? "bg-blue-500 text-white" : "bg-purple-500 text-white"
                          }>
                            {getInitials(p.full_name_th)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium truncate">
                              {p.nickname_th || p.full_name_th?.split(" ")[0]}
                            </span>
                            <Badge variant={p.status === "member" ? "default" : "secondary"} className="text-xs">
                              {p.status === "member" ? "สมาชิก" : "Visitor"}
                            </Badge>
                            {p.is_checked_in && (
                              <Badge variant={p.is_late ? "outline" : "default"} className={`text-xs ${p.is_late ? "border-orange-500 text-orange-600" : "bg-green-600"}`}>
                                {p.is_late ? "มาสาย" : "เช็คอินแล้ว"}
                              </Badge>
                            )}
                            {p.fee_status && (
                              <Badge variant={p.fee_status === "paid" ? "default" : "secondary"} className={`text-xs ${p.fee_status === "paid" ? "bg-green-600" : "bg-orange-500"}`}>
                                {p.fee_status === "paid" ? "จ่ายแล้ว" : `ค้าง ${p.amount_due?.toLocaleString()}`}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                            {p.company && (
                              <span className="flex items-center gap-1">
                                <Building className="h-3 w-3" />
                                {p.company}
                              </span>
                            )}
                            {p.phone && <span>{p.phone}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          {!p.is_checked_in && (
                            <>
                              <Button
                                size="sm"
                                onClick={() => handleCheckin(p.participant_id, false)}
                                disabled={actionLoading === p.participant_id}
                                data-testid={`button-checkin-${p.participant_id}`}
                              >
                                {actionLoading === p.participant_id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <CheckCircle className="h-4 w-4" />
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleCheckin(p.participant_id, true)}
                                disabled={actionLoading === p.participant_id}
                                data-testid={`button-late-${p.participant_id}`}
                              >
                                <Clock className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          {p.fee_status === "pending" && p.fee_id && (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => handleMarkPaid(p.fee_id!, p.participant_id)}
                              disabled={actionLoading === p.participant_id}
                              data-testid={`button-paid-${p.participant_id}`}
                            >
                              <DollarSign className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
