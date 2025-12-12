import { useEffect, useState } from "react";
import AdminLayout from "@/components/layout/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { QrCode, Calendar, Users, Download, Copy, ExternalLink, Info, UserCheck, Phone, CheckCircle, Clock, Loader2 } from "lucide-react";
import QRCode from "react-qr-code";
import { useTenantContext } from "@/contexts/TenantContext";
import SelectTenantPrompt from "@/components/SelectTenantPrompt";

interface SubstituteRequest {
  request_id: string;
  substitute_name: string;
  substitute_phone: string;
  substitute_email?: string;
  status: string;
  created_at: string;
  confirmed_at?: string;
  member?: {
    participant_id?: string;
    full_name_th: string;
    nickname_th?: string;
    phone?: string;
    photo_url?: string;
  };
}

export default function CheckIn() {
  const { effectiveTenantId, isSuperAdmin } = useTenantContext();
  const [loading, setLoading] = useState(true);
  const [meetings, setMeetings] = useState<any[]>([]);
  const [selectedMeetingId, setSelectedMeetingId] = useState<string>("");
  const [checkins, setCheckins] = useState<any[]>([]);
  const [pendingSubstitutes, setPendingSubstitutes] = useState<SubstituteRequest[]>([]);
  const [confirmedSubstitutes, setConfirmedSubstitutes] = useState<SubstituteRequest[]>([]);
  const [confirmingSubId, setConfirmingSubId] = useState<string | null>(null);

  useEffect(() => {
    if (effectiveTenantId) {
      loadMeetings();
    }
  }, [effectiveTenantId]);

  useEffect(() => {
    if (selectedMeetingId) {
      loadCheckins();
      loadSubstitutes();
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

      // Find the nearest upcoming meeting (closest to today, including today)
      const todayStr = today.toISOString().split("T")[0];
      const todayMeeting = data?.find(m => m.meeting_date === todayStr);
      
      if (todayMeeting) {
        setSelectedMeetingId(todayMeeting.meeting_id);
      } else if (data && data.length > 0) {
        // Find upcoming meetings (>= today) sorted by date ascending (nearest first)
        const upcomingMeetings = data
          .filter(m => m.meeting_date >= todayStr)
          .sort((a, b) => a.meeting_date.localeCompare(b.meeting_date));
        
        if (upcomingMeetings.length > 0) {
          // Select the nearest upcoming meeting
          setSelectedMeetingId(upcomingMeetings[0].meeting_id);
        } else {
          // No upcoming meetings, select the most recent past meeting
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

  const loadCheckins = async () => {
    try {
      const { data, error } = await supabase
        .from("checkins")
        .select(`
          *,
          participant:participants!fk_checkins_participant (
            full_name_th,
            company,
            status
          )
        `)
        .eq("meeting_id", selectedMeetingId)
        .order("checkin_time", { ascending: false });

      if (error) throw error;
      setCheckins(data || []);
    } catch (error: any) {
      console.error("Error loading checkins:", error);
    }
  };

  const loadSubstitutes = async () => {
    if (!selectedMeetingId) return;
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      
      const response = await fetch(
        `/api/palms/meeting/${selectedMeetingId}/substitute-requests`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );
      
      if (!response.ok) {
        console.error("Failed to load substitutes:", await response.text());
        return;
      }
      
      const data = await response.json();
      
      if (data.success) {
        setPendingSubstitutes(data.pending || []);
        if (data.confirmed && data.confirmed.length > 0) {
          const confirmedWithTime = (data.confirmed || []).map((sub: SubstituteRequest) => ({
            ...sub,
            confirmed_at: sub.confirmed_at || sub.created_at || new Date().toISOString()
          }));
          setConfirmedSubstitutes(confirmedWithTime);
        } else {
          setConfirmedSubstitutes([]);
        }
      }
    } catch (error: any) {
      console.error("Error loading substitutes:", error);
    }
  };

  const handleConfirmSubstitute = async (requestId: string) => {
    setConfirmingSubId(requestId);
    
    const substituteToConfirm = pendingSubstitutes.find(s => s.request_id === requestId);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error("กรุณาเข้าสู่ระบบใหม่");
        return;
      }
      
      const response = await fetch("/api/palms/confirm-substitute", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ request_id: requestId }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        if (substituteToConfirm) {
          const confirmedItem = {
            ...substituteToConfirm,
            status: "confirmed",
            confirmed_at: new Date().toISOString()
          };
          setPendingSubstitutes(prev => prev.filter(s => s.request_id !== requestId));
          setConfirmedSubstitutes(prev => [...prev, confirmedItem]);
        }
        
        toast.success("ยืนยันตัวแทนเรียบร้อย");
        
        // Reload data to ensure sync with server
        loadCheckins();
        loadSubstitutes();
      } else {
        toast.error(data.error || "ไม่สามารถยืนยันตัวแทนได้");
      }
    } catch (error: any) {
      console.error("Error confirming substitute:", error);
      toast.error("เกิดข้อผิดพลาดในการยืนยัน");
    } finally {
      setConfirmingSubId(null);
    }
  };

  const downloadQRCode = () => {
    const svg = document.getElementById("checkin-qr-code");
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();

    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx?.drawImage(img, 0, 0);
      const pngFile = canvas.toDataURL("image/png");

      const downloadLink = document.createElement("a");
      const selectedMeeting = meetings.find(m => m.meeting_id === selectedMeetingId);
      downloadLink.download = `checkin-qr-${selectedMeeting?.meeting_date || "meeting"}.png`;
      downloadLink.href = pngFile;
      downloadLink.click();

      toast.success("ดาวน์โหลด QR Code สำเร็จ");
    };

    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
  };

  const copyCheckinLink = () => {
    if (!checkinUrl) return;
    navigator.clipboard.writeText(checkinUrl);
    toast.success("คัดลอกลิงก์สำเร็จ");
  };

  const openPublicCheckinPage = () => {
    if (!checkinUrl) return;
    window.open(checkinUrl, '_blank');
  };

  if (!effectiveTenantId && isSuperAdmin) {
    return (
      <AdminLayout>
        <SelectTenantPrompt />
      </AdminLayout>
    );
  }

  if (loading) {
    return (
      <AdminLayout>
        <div className="text-center py-8 text-muted-foreground">กำลังโหลด...</div>
      </AdminLayout>
    );
  }

  const selectedMeeting = meetings.find(m => m.meeting_id === selectedMeetingId);
  const checkinUrl = selectedMeetingId 
    ? `${window.location.origin}/checkin/${selectedMeetingId}`
    : "";

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Check-In ด้วย QR Code</h1>
          <p className="text-muted-foreground">สร้าง QR code สำหรับเช็คอินเข้าประชุม</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* QR Code Card */}
          <Card>
            <CardHeader>
              <CardTitle>QR Code สำหรับ Check-In</CardTitle>
              <CardDescription>
                ให้สมาชิกสแกน QR code เพื่อเช็คอินเข้าประชุม
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">เลือกการประชุม</label>
                <Select value={selectedMeetingId} onValueChange={setSelectedMeetingId}>
                  <SelectTrigger>
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
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
                            {new Date(meeting.meeting_date).toLocaleDateString("th-TH", {
                              year: "numeric",
                              month: "long",
                              day: "numeric",
                            })}
                            {meeting.theme && ` - ${meeting.theme}`}
                          </div>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              {selectedMeetingId && (
                <div className="space-y-4">
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      หน้านี้ใช้สร้าง QR และดูสถิติ ให้สมาชิกสแกน QR หรือเปิดลิงก์สาธารณะเพื่อทำเช็คอิน
                    </AlertDescription>
                  </Alert>

                  <div className="flex justify-center p-6 bg-white rounded-lg border">
                    <QRCode
                      id="checkin-qr-code"
                      value={checkinUrl}
                      size={256}
                      level="H"
                    />
                  </div>

                  <div className="space-y-2">
                    <Button onClick={downloadQRCode} className="w-full">
                      <Download className="mr-2 h-4 w-4" />
                      ดาวน์โหลด QR Code
                    </Button>
                    <Button onClick={copyCheckinLink} variant="outline" className="w-full">
                      <Copy className="mr-2 h-4 w-4" />
                      คัดลอกลิงก์เช็คอิน
                    </Button>
                    <Button onClick={openPublicCheckinPage} variant="outline" className="w-full">
                      <ExternalLink className="mr-2 h-4 w-4" />
                      เปิดหน้าสาธารณะสำหรับเช็คอิน
                    </Button>
                    <p className="text-xs text-muted-foreground text-center">
                      พิมพ์และติดไว้ที่จุดเช็คอิน
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Check-in Stats Card */}
          <Card>
            <CardHeader>
              <CardTitle>สถิติการเช็คอิน</CardTitle>
              <CardDescription>
                {selectedMeeting
                  ? `การประชุมวันที่ ${new Date(selectedMeeting.meeting_date).toLocaleDateString("th-TH")}`
                  : "เลือกการประชุมเพื่อดูข้อมูล"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {selectedMeetingId ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <Users className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">เช็คอินแล้ว</p>
                        <p className="text-2xl font-bold">
                          {checkins.length + confirmedSubstitutes.length}
                        </p>
                        {confirmedSubstitutes.length > 0 && (
                          <p className="text-xs text-muted-foreground">
                            (รวม {confirmedSubstitutes.length} ตัวแทน)
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {pendingSubstitutes.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium flex items-center gap-2">
                        <UserCheck className="h-4 w-4 text-orange-500" />
                        ตัวแทนรอยืนยัน ({pendingSubstitutes.length})
                      </h4>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {pendingSubstitutes.map((sub) => (
                          <div
                            key={sub.request_id}
                            className="p-3 border rounded-lg bg-orange-50 dark:bg-orange-950 border-orange-200 dark:border-orange-800"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="space-y-1 min-w-0">
                                <p className="font-medium text-sm truncate">
                                  {sub.substitute_name}
                                </p>
                                <p className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Phone className="h-3 w-3" />
                                  {sub.substitute_phone}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  แทน: {sub.member?.full_name_th}
                                </p>
                              </div>
                              <Button
                                size="sm"
                                onClick={() => handleConfirmSubstitute(sub.request_id)}
                                disabled={confirmingSubId === sub.request_id}
                              >
                                {confirmingSubId === sub.request_id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  "ยืนยัน"
                                )}
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {confirmedSubstitutes.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        ตัวแทนที่เช็คอินแล้ว ({confirmedSubstitutes.length})
                      </h4>
                      <div className="space-y-2 max-h-32 overflow-y-auto">
                        {confirmedSubstitutes.map((sub) => (
                          <div
                            key={sub.request_id}
                            className="p-3 border rounded-lg bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="space-y-1 min-w-0">
                                <p className="font-medium text-sm truncate flex items-center gap-1">
                                  <CheckCircle className="h-3 w-3 text-green-600" />
                                  {sub.substitute_name}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  แทน: {sub.member?.full_name_th}
                                </p>
                              </div>
                              <div className="text-xs text-muted-foreground flex items-center gap-1 flex-shrink-0">
                                <Clock className="h-3 w-3" />
                                {new Date(sub.confirmed_at).toLocaleTimeString("th-TH", {
                                  hour: "2-digit",
                                  minute: "2-digit"
                                })}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">รายชื่อผู้เช็คอินล่าสุด</h4>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {checkins.length === 0 && confirmedSubstitutes.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          ยังไม่มีการเช็คอิน
                        </p>
                      ) : (
                        <>
                          {confirmedSubstitutes.map((sub) => (
                            <div
                              key={`sub-${sub.request_id}`}
                              className="flex items-center justify-between gap-2 p-3 border rounded-lg text-sm bg-purple-50 dark:bg-purple-950 border-purple-200 dark:border-purple-800"
                            >
                              <div>
                                <div className="font-medium flex items-center gap-2">
                                  {sub.substitute_name}
                                  <Badge variant="secondary" className="text-xs bg-purple-200 dark:bg-purple-800 text-purple-700 dark:text-purple-300">
                                    ตัวแทน
                                  </Badge>
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  แทน: {sub.member?.full_name_th}
                                </div>
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {new Date(sub.confirmed_at).toLocaleTimeString("th-TH", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </div>
                            </div>
                          ))}
                          {checkins.slice(0, 10).map((checkin) => (
                            <div
                              key={checkin.checkin_id}
                              className="flex items-center justify-between p-3 border rounded-lg text-sm"
                            >
                              <div>
                                <div className="font-medium">
                                  {checkin.participant?.full_name_th || checkin.participant?.full_name || "ไม่ระบุชื่อ"}
                                </div>
                                {checkin.participant?.company && (
                                  <div className="text-xs text-muted-foreground">
                                    {checkin.participant.company}
                                  </div>
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {new Date(checkin.checkin_time).toLocaleTimeString("th-TH", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </div>
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <QrCode className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>เลือกการประชุมเพื่อสร้าง QR code</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
