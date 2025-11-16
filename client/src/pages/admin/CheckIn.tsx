import { useEffect, useState } from "react";
import AdminLayout from "@/components/layout/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { QrCode, Calendar, Users, Download, Copy, ExternalLink, Info } from "lucide-react";
import QRCode from "react-qr-code";
import { useTenantContext } from "@/contexts/TenantContext";
import SelectTenantPrompt from "@/components/SelectTenantPrompt";

export default function CheckIn() {
  const { effectiveTenantId, isSuperAdmin } = useTenantContext();
  const [loading, setLoading] = useState(true);
  const [meetings, setMeetings] = useState<any[]>([]);
  const [selectedMeetingId, setSelectedMeetingId] = useState<string>("");
  const [checkins, setCheckins] = useState<any[]>([]);

  useEffect(() => {
    if (effectiveTenantId) {
      loadMeetings();
    }
  }, [effectiveTenantId]);

  useEffect(() => {
    if (selectedMeetingId) {
      loadCheckins();
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

      const todayMeeting = data?.find(
        m => m.meeting_date === today.toISOString().split("T")[0]
      );
      if (todayMeeting) {
        setSelectedMeetingId(todayMeeting.meeting_id);
      } else if (data && data.length > 0) {
        setSelectedMeetingId(data[0].meeting_id);
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
            full_name,
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
                        <p className="text-2xl font-bold">{checkins.length}</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">รายชื่อผู้เช็คอินล่าสุด</h4>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {checkins.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          ยังไม่มีการเช็คอิน
                        </p>
                      ) : (
                        checkins.slice(0, 10).map((checkin) => (
                          <div
                            key={checkin.checkin_id}
                            className="flex items-center justify-between p-3 border rounded-lg text-sm"
                          >
                            <div>
                              <div className="font-medium">
                                {checkin.participant?.full_name || "ไม่ระบุชื่อ"}
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
                        ))
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
