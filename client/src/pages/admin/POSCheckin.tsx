import { useEffect, useState, useRef, useCallback } from "react";
import AdminLayout from "@/components/layout/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  QrCode, 
  Calendar, 
  Users, 
  Search, 
  Camera, 
  CheckCircle, 
  User, 
  Phone, 
  Building,
  XCircle,
  Loader2,
  ArrowLeft,
  ScanLine,
  AlertCircle
} from "lucide-react";
import { useTenantContext } from "@/contexts/TenantContext";
import SelectTenantPrompt from "@/components/SelectTenantPrompt";
import { IDetectedBarcode, Scanner } from "@yudiel/react-qr-scanner";

type CheckinMode = "idle" | "scanning" | "search" | "confirm" | "success" | "error";

interface ParticipantInfo {
  participant_id: string;
  tenant_id: string;
  full_name_th: string;
  nickname_th?: string;
  status: string;
  phone?: string;
  email?: string;
  company?: string;
  position?: string;
  photo_url?: string;
  already_checked_in?: boolean;
}

export default function POSCheckin() {
  const { effectiveTenantId, isSuperAdmin } = useTenantContext();
  const [loading, setLoading] = useState(true);
  const [meetings, setMeetings] = useState<any[]>([]);
  const [selectedMeetingId, setSelectedMeetingId] = useState<string>("");
  const [checkins, setCheckins] = useState<any[]>([]);
  const [mode, setMode] = useState<CheckinMode>("idle");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ParticipantInfo[]>([]);
  const [selectedParticipant, setSelectedParticipant] = useState<ParticipantInfo | null>(null);
  const [checkingIn, setCheckingIn] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [scanError, setScanError] = useState<string>("");
  const [validatingQr, setValidatingQr] = useState(false);

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
            full_name_th,
            company,
            status,
            photo_url
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

  const handleQrScan = useCallback(async (detectedCodes: IDetectedBarcode[]) => {
    if (detectedCodes.length === 0 || validatingQr) return;
    
    const qrData = detectedCodes[0].rawValue;
    if (!qrData) return;
    
    console.log("[POS] QR scanned:", qrData.substring(0, 50) + "...");
    
    setValidatingQr(true);
    setScanError("");
    
    try {
      // Use atomic pos-checkin endpoint (validates + checks in in one call)
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
        setScanError(`${data.participant?.full_name_th || "ผู้เข้าร่วม"} เช็คอินแล้ว`);
        setMode("error");
        return;
      }
      
      if (!response.ok || !data.success) {
        setScanError(data.error || "QR Code ไม่ถูกต้อง");
        setMode("error");
        return;
      }
      
      // Check-in successful
      setSelectedParticipant(data.participant);
      toast.success(data.message || `เช็คอินสำเร็จ: ${data.participant?.full_name_th}`);
      setMode("success");
      loadCheckins();
      
      setTimeout(() => {
        resetToIdle();
      }, 2000);
      
    } catch (error) {
      setScanError("เกิดข้อผิดพลาดในการเช็คอิน");
      setMode("error");
    } finally {
      setValidatingQr(false);
    }
  }, [selectedMeetingId, effectiveTenantId, validatingQr]);

  const handleSearch = async () => {
    if (!searchQuery.trim() || !effectiveTenantId) return;
    
    setSearchLoading(true);
    try {
      const params = new URLSearchParams({
        query: searchQuery.trim(),
        tenant_id: effectiveTenantId,
        ...(selectedMeetingId && { meeting_id: selectedMeetingId })
      });
      
      const response = await fetch(`/api/participants/pos-search?${params}`);
      const data = await response.json();
      
      if (data.success) {
        setSearchResults(data.participants);
        setMode("search");
      } else {
        toast.error(data.error || "ค้นหาไม่สำเร็จ");
      }
    } catch (error) {
      toast.error("เกิดข้อผิดพลาดในการค้นหา");
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSelectParticipant = (participant: ParticipantInfo) => {
    setSelectedParticipant(participant);
    setMode("confirm");
  };

  const handleConfirmCheckIn = async () => {
    if (!selectedParticipant || !selectedMeetingId || !effectiveTenantId) return;
    
    setCheckingIn(true);
    try {
      // Get current session for auth header
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error("กรุณาเข้าสู่ระบบใหม่");
        return;
      }
      
      // Use secured pos-manual-checkin endpoint with auth + tenant verification
      const response = await fetch("/api/participants/pos-manual-checkin", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          meeting_id: selectedMeetingId,
          participant_id: selectedParticipant.participant_id,
          expected_tenant_id: effectiveTenantId
        })
      });
      
      const data = await response.json();
      
      if (data.already_checked_in) {
        toast.error("ผู้เข้าร่วมนี้เช็คอินแล้ว");
        resetToIdle();
        return;
      }
      
      if (data.success) {
        toast.success(`เช็คอินสำเร็จ: ${selectedParticipant.full_name_th}`);
        setMode("success");
        loadCheckins();
        
        setTimeout(() => {
          resetToIdle();
        }, 2000);
      } else {
        toast.error(data.message || "เช็คอินไม่สำเร็จ");
      }
    } catch (error) {
      toast.error("เกิดข้อผิดพลาดในการเช็คอิน");
    } finally {
      setCheckingIn(false);
    }
  };

  const resetToIdle = () => {
    setMode("idle");
    setSearchQuery("");
    setSearchResults([]);
    setSelectedParticipant(null);
    setScanError("");
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      prospect: { label: "ผู้มุ่งหวัง", variant: "outline" },
      visitor: { label: "ผู้เยี่ยมชม", variant: "secondary" },
      member: { label: "สมาชิก", variant: "default" },
      alumni: { label: "ศิษย์เก่า", variant: "secondary" },
    };
    const config = variants[status] || { label: status, variant: "outline" };
    return <Badge variant={config.variant}>{config.label}</Badge>;
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

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">POS Check-In</h1>
          <p className="text-muted-foreground">ระบบเช็คอิน ณ จุดลงทะเบียน</p>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">เลือกการประชุม</CardTitle>
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
          </CardContent>
        </Card>

        {selectedMeetingId && (
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle>เช็คอิน</CardTitle>
                <CardDescription>
                  สแกน QR Code หรือค้นหาด้วยชื่อ/เบอร์โทร
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {mode === "idle" && (
                  <div className="space-y-4">
                    <div className="flex gap-2">
                      <Button 
                        variant="default" 
                        className="flex-1"
                        onClick={() => setMode("scanning")}
                        data-testid="button-scan-qr"
                      >
                        <Camera className="h-4 w-4 mr-2" />
                        สแกน QR Code
                      </Button>
                    </div>
                    
                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t" />
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-background px-2 text-muted-foreground">หรือ</span>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Input
                        placeholder="ค้นหาด้วยชื่อหรือเบอร์โทร"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                        data-testid="input-search"
                      />
                      <Button 
                        onClick={handleSearch} 
                        disabled={searchLoading || !searchQuery.trim()}
                        data-testid="button-search"
                      >
                        {searchLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Search className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                )}

                {mode === "scanning" && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Button variant="ghost" size="icon" onClick={resetToIdle} data-testid="button-back">
                        <ArrowLeft className="h-4 w-4" />
                      </Button>
                      <span className="text-sm font-medium flex items-center gap-2">
                        <ScanLine className="h-4 w-4 animate-pulse" />
                        กำลังสแกน QR Code...
                      </span>
                      <div className="w-9" />
                    </div>
                    
                    <div className="aspect-square max-w-[300px] mx-auto rounded-lg overflow-hidden border-2 border-primary">
                      <Scanner
                        onScan={handleQrScan}
                        onError={(error) => {
                          console.error("[POS] Scanner error:", error);
                          setScanError("ไม่สามารถเข้าถึงกล้องได้");
                        }}
                        constraints={{
                          facingMode: "environment"
                        }}
                        styles={{
                          container: { width: "100%", height: "100%" }
                        }}
                      />
                    </div>
                    
                    {validatingQr && (
                      <div className="text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        กำลังตรวจสอบ...
                      </div>
                    )}
                    
                    <p className="text-xs text-center text-muted-foreground">
                      ส่อง QR Code ที่สมาชิกได้รับจาก LINE Bot
                    </p>
                  </div>
                )}

                {mode === "error" && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="icon" onClick={resetToIdle} data-testid="button-back">
                        <ArrowLeft className="h-4 w-4" />
                      </Button>
                      <span className="font-medium text-destructive">เกิดข้อผิดพลาด</span>
                    </div>
                    
                    <div className="text-center py-8 space-y-4">
                      <div className="flex justify-center">
                        <div className="p-4 bg-destructive/10 rounded-full">
                          <AlertCircle className="h-12 w-12 text-destructive" />
                        </div>
                      </div>
                      <p className="text-muted-foreground">{scanError}</p>
                      <Button onClick={resetToIdle}>ลองใหม่</Button>
                    </div>
                  </div>
                )}

                {mode === "search" && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="icon" onClick={resetToIdle} data-testid="button-back">
                        <ArrowLeft className="h-4 w-4" />
                      </Button>
                      <span className="text-sm text-muted-foreground">
                        พบ {searchResults.length} รายการ
                      </span>
                    </div>
                    
                    {searchResults.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <XCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
                        <p>ไม่พบข้อมูล</p>
                        <Button variant="outline" className="mt-4" onClick={resetToIdle}>
                          ค้นหาใหม่
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-[400px] overflow-y-auto">
                        {searchResults.map((p) => (
                          <div
                            key={p.participant_id}
                            className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                              p.already_checked_in 
                                ? "bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800" 
                                : "hover-elevate"
                            }`}
                            onClick={() => !p.already_checked_in && handleSelectParticipant(p)}
                            data-testid={`card-participant-${p.participant_id}`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-3 min-w-0">
                                {p.photo_url ? (
                                  <img 
                                    src={p.photo_url} 
                                    alt={p.full_name_th}
                                    className="h-10 w-10 rounded-full object-cover flex-shrink-0"
                                  />
                                ) : (
                                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                                    <User className="h-5 w-5 text-muted-foreground" />
                                  </div>
                                )}
                                <div className="min-w-0">
                                  <div className="font-medium truncate">{p.full_name_th}</div>
                                  {p.company && (
                                    <div className="text-xs text-muted-foreground truncate">{p.company}</div>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                {p.already_checked_in ? (
                                  <Badge variant="outline" className="bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300">
                                    <CheckCircle className="h-3 w-3 mr-1" />
                                    เช็คอินแล้ว
                                  </Badge>
                                ) : (
                                  getStatusBadge(p.status)
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {mode === "confirm" && selectedParticipant && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="icon" onClick={resetToIdle} data-testid="button-back-confirm">
                        <ArrowLeft className="h-4 w-4" />
                      </Button>
                      <span className="font-medium">ยืนยันการเช็คอิน</span>
                    </div>
                    
                    <div className="p-6 border rounded-lg text-center space-y-4">
                      {selectedParticipant.photo_url ? (
                        <img 
                          src={selectedParticipant.photo_url} 
                          alt={selectedParticipant.full_name_th}
                          className="h-20 w-20 rounded-full object-cover mx-auto"
                        />
                      ) : (
                        <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center mx-auto">
                          <User className="h-10 w-10 text-muted-foreground" />
                        </div>
                      )}
                      
                      <div>
                        <h3 className="text-xl font-bold">{selectedParticipant.full_name_th}</h3>
                        {selectedParticipant.nickname_th && (
                          <p className="text-sm text-muted-foreground">({selectedParticipant.nickname_th})</p>
                        )}
                      </div>
                      
                      <div className="flex justify-center">{getStatusBadge(selectedParticipant.status)}</div>
                      
                      <div className="text-sm text-muted-foreground space-y-1">
                        {selectedParticipant.company && (
                          <div className="flex items-center justify-center gap-1">
                            <Building className="h-3 w-3" />
                            {selectedParticipant.company}
                          </div>
                        )}
                        {selectedParticipant.phone && (
                          <div className="flex items-center justify-center gap-1">
                            <Phone className="h-3 w-3" />
                            {selectedParticipant.phone}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        className="flex-1"
                        onClick={resetToIdle}
                        disabled={checkingIn}
                        data-testid="button-cancel"
                      >
                        ยกเลิก
                      </Button>
                      <Button 
                        className="flex-1"
                        onClick={handleConfirmCheckIn}
                        disabled={checkingIn}
                        data-testid="button-confirm-checkin"
                      >
                        {checkingIn ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            กำลังเช็คอิน...
                          </>
                        ) : (
                          <>
                            <CheckCircle className="h-4 w-4 mr-2" />
                            ยืนยันเช็คอิน
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                )}

                {mode === "success" && (
                  <div className="text-center py-8 space-y-4">
                    <div className="flex justify-center">
                      <div className="p-4 bg-green-100 dark:bg-green-900 rounded-full">
                        <CheckCircle className="h-16 w-16 text-green-600 dark:text-green-400" />
                      </div>
                    </div>
                    <h3 className="text-xl font-bold">เช็คอินสำเร็จ!</h3>
                    {selectedParticipant && (
                      <p className="text-muted-foreground">{selectedParticipant.full_name_th}</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle>สถิติการเช็คอิน</CardTitle>
                <CardDescription>
                  {selectedMeeting
                    ? `การประชุมวันที่ ${new Date(selectedMeeting.meeting_date).toLocaleDateString("th-TH")}`
                    : "เลือกการประชุมเพื่อดูข้อมูล"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <Users className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">เช็คอินแล้ว</p>
                        <p className="text-2xl font-bold" data-testid="text-checkin-count">{checkins.length}</p>
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
                            className="flex items-center justify-between gap-2 p-3 border rounded-lg text-sm"
                            data-testid={`row-checkin-${checkin.checkin_id}`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              {checkin.participant?.photo_url ? (
                                <img 
                                  src={checkin.participant.photo_url} 
                                  alt=""
                                  className="h-8 w-8 rounded-full object-cover flex-shrink-0"
                                />
                              ) : (
                                <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                                  <User className="h-4 w-4 text-muted-foreground" />
                                </div>
                              )}
                              <div className="min-w-0">
                                <div className="font-medium truncate">
                                  {checkin.participant?.full_name_th || "ไม่ระบุชื่อ"}
                                </div>
                                {checkin.participant?.company && (
                                  <div className="text-xs text-muted-foreground truncate">
                                    {checkin.participant.company}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="text-xs text-muted-foreground flex-shrink-0">
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
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
