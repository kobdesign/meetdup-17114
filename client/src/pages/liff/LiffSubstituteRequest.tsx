import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, UserPlus, Calendar, CheckCircle, XCircle, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLiff } from "@/hooks/useLiff";

interface Meeting {
  meeting_id: string;
  meeting_date: string;
  theme?: string;
}

interface SubstituteRequest {
  request_id: string;
  meeting_id: string;
  substitute_name: string;
  substitute_phone: string;
  status: string;
  meeting?: Meeting;
}

export default function LiffSubstituteRequest() {
  const location = useLocation();
  const { toast } = useToast();
  const { isLiffReady, isInLiff, isLoggedIn, profile, closeWindow, login } = useLiff();
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [upcomingMeeting, setUpcomingMeeting] = useState<Meeting | null>(null);
  const [existingRequest, setExistingRequest] = useState<SubstituteRequest | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [participantId, setParticipantId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const [substituteName, setSubstituteName] = useState("");
  const [substitutePhone, setSubstitutePhone] = useState("");
  const [substituteEmail, setSubstituteEmail] = useState("");

  const searchParams = new URLSearchParams(location.search);
  const urlTenantId = searchParams.get("tenant");
  const urlMeetingId = searchParams.get("meeting");

  useEffect(() => {
    if (!isLiffReady) return;

    const fetchData = async () => {
      try {
        if (!urlTenantId) {
          setError("Missing tenant parameter");
          setLoading(false);
          return;
        }
        setTenantId(urlTenantId);

        // If user is logged in via LIFF, get their participant info
        if (isLoggedIn && profile?.userId) {
          const participantRes = await fetch(
            `/api/public/participant-by-line?line_user_id=${profile.userId}&tenant_id=${urlTenantId}`
          );
          const participantData = await participantRes.json();
          
          if (participantData.participant) {
            setParticipantId(participantData.participant.participant_id);
          } else {
            setError("ไม่พบข้อมูลของคุณในระบบ กรุณาลงทะเบียนก่อน");
            setLoading(false);
            return;
          }
        }

        // Get upcoming meeting
        const meetingRes = await fetch(`/api/public/next-meeting?tenant_id=${urlTenantId}`);
        const meetingData = await meetingRes.json();
        
        if (meetingData.meeting) {
          setUpcomingMeeting(meetingData.meeting);
          
          // Check if there's an existing request for this meeting
          if (participantId) {
            const reqRes = await fetch(
              `/api/palms/my-substitute-requests?tenant_id=${urlTenantId}`,
              { headers: { "Authorization": `Bearer ${await getAccessToken()}` } }
            );
            const reqData = await reqRes.json();
            
            if (reqData.requests) {
              const existing = reqData.requests.find(
                (r: SubstituteRequest) => r.meeting_id === meetingData.meeting.meeting_id && r.status === "pending"
              );
              if (existing) {
                setExistingRequest(existing);
                setSubstituteName(existing.substitute_name);
                setSubstitutePhone(existing.substitute_phone);
              }
            }
          }
        } else {
          setError("ไม่พบ Meeting ที่กำลังจะมาถึง");
        }

      } catch (err: any) {
        console.error("Error fetching data:", err);
        setError("เกิดข้อผิดพลาดในการโหลดข้อมูล");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [isLiffReady, isLoggedIn, profile, urlTenantId, participantId]);

  const getAccessToken = async (): Promise<string> => {
    try {
      const liff = (await import("@line/liff")).default;
      return liff.getAccessToken() || "";
    } catch {
      return "";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!upcomingMeeting) {
      toast({ variant: "destructive", title: "ไม่พบ Meeting" });
      return;
    }

    if (!substituteName.trim() || !substitutePhone.trim()) {
      toast({ variant: "destructive", title: "กรุณากรอกชื่อและเบอร์โทรตัวแทน" });
      return;
    }

    // Validate phone
    const cleanPhone = substitutePhone.replace(/\D/g, "");
    if (cleanPhone.length < 9 || cleanPhone.length > 10) {
      toast({ variant: "destructive", title: "เบอร์โทรไม่ถูกต้อง" });
      return;
    }

    setSubmitting(true);
    try {
      const token = await getAccessToken();
      
      const res = await fetch("/api/palms/substitute-request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          meeting_id: upcomingMeeting.meeting_id,
          substitute_name: substituteName.trim(),
          substitute_phone: cleanPhone,
          substitute_email: substituteEmail.trim() || null
        })
      });

      const data = await res.json();

      if (data.success) {
        setExistingRequest(data.request);
        toast({
          title: "บันทึกสำเร็จ",
          description: `${substituteName} จะมาแทนคุณใน Meeting`
        });
      } else {
        toast({
          variant: "destructive",
          title: "เกิดข้อผิดพลาด",
          description: data.error || "ไม่สามารถบันทึกได้"
        });
      }
    } catch (err: any) {
      console.error("Submit error:", err);
      toast({
        variant: "destructive",
        title: "เกิดข้อผิดพลาด",
        description: "ไม่สามารถบันทึกได้ กรุณาลองใหม่"
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async () => {
    if (!existingRequest) return;

    setSubmitting(true);
    try {
      const token = await getAccessToken();
      
      const res = await fetch(`/api/palms/substitute-request/${existingRequest.request_id}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ reason: "ยกเลิกโดยสมาชิก" })
      });

      const data = await res.json();

      if (data.success) {
        setExistingRequest(null);
        setSubstituteName("");
        setSubstitutePhone("");
        setSubstituteEmail("");
        toast({
          title: "ยกเลิกสำเร็จ",
          description: "ยกเลิกการส่งตัวแทนแล้ว"
        });
      } else {
        toast({
          variant: "destructive",
          title: "เกิดข้อผิดพลาด",
          description: data.error || "ไม่สามารถยกเลิกได้"
        });
      }
    } catch (err: any) {
      console.error("Cancel error:", err);
      toast({
        variant: "destructive",
        title: "เกิดข้อผิดพลาด"
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (isInLiff) {
      closeWindow();
    } else {
      window.history.back();
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("th-TH", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric"
    });
  };

  if (!isLiffReady || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" data-testid="loading-spinner" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background p-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <XCircle className="h-12 w-12 mx-auto text-destructive" />
              <p className="text-muted-foreground" data-testid="text-error">{error}</p>
              <Button onClick={handleClose} variant="outline" data-testid="button-close">
                ปิด
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-background p-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <UserPlus className="h-12 w-12 mx-auto text-primary" />
              <h2 className="text-lg font-semibold">กรุณาเข้าสู่ระบบ</h2>
              <p className="text-muted-foreground">เพื่อแจ้งส่งตัวแทนเข้าประชุม</p>
              <Button onClick={login} data-testid="button-login">
                เข้าสู่ระบบด้วย LINE
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-50 bg-background border-b p-3 flex items-center gap-3">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={handleClose}
          data-testid="button-back"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="font-semibold">แจ้งส่งตัวแทน</h1>
      </div>

      <div className="p-4 space-y-4">
        {upcomingMeeting && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Meeting ที่กำลังจะมาถึง
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-medium" data-testid="text-meeting-date">
                {formatDate(upcomingMeeting.meeting_date)}
              </p>
              {upcomingMeeting.theme && (
                <p className="text-sm text-muted-foreground" data-testid="text-meeting-theme">
                  {upcomingMeeting.theme}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {existingRequest && existingRequest.status === "pending" ? (
          <Card className="border-primary">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2 text-primary">
                <CheckCircle className="h-4 w-4" />
                แจ้งส่งตัวแทนแล้ว
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-muted-foreground">ชื่อตัวแทน</p>
                <p className="font-medium" data-testid="text-sub-name">{existingRequest.substitute_name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">เบอร์โทร</p>
                <p className="font-medium" data-testid="text-sub-phone">{existingRequest.substitute_phone}</p>
              </div>
              <Button 
                variant="outline" 
                className="w-full" 
                onClick={handleCancel}
                disabled={submitting}
                data-testid="button-cancel-request"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <XCircle className="h-4 w-4 mr-2" />
                )}
                ยกเลิกการส่งตัวแทน
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">ข้อมูลตัวแทน</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="substituteName">ชื่อ-นามสกุล ตัวแทน *</Label>
                  <Input
                    id="substituteName"
                    placeholder="กรอกชื่อตัวแทน"
                    value={substituteName}
                    onChange={(e) => setSubstituteName(e.target.value)}
                    required
                    data-testid="input-sub-name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="substitutePhone">เบอร์โทรศัพท์ *</Label>
                  <Input
                    id="substitutePhone"
                    type="tel"
                    placeholder="08X-XXX-XXXX"
                    value={substitutePhone}
                    onChange={(e) => setSubstitutePhone(e.target.value)}
                    required
                    data-testid="input-sub-phone"
                  />
                  <p className="text-xs text-muted-foreground">
                    ตัวแทนจะใช้เบอร์นี้ในการ Scan เช็คอิน
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="substituteEmail">อีเมล (ถ้ามี)</Label>
                  <Input
                    id="substituteEmail"
                    type="email"
                    placeholder="email@example.com"
                    value={substituteEmail}
                    onChange={(e) => setSubstituteEmail(e.target.value)}
                    data-testid="input-sub-email"
                  />
                </div>

                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={submitting}
                  data-testid="button-submit"
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <UserPlus className="h-4 w-4 mr-2" />
                  )}
                  {existingRequest ? "อัปเดตข้อมูลตัวแทน" : "ยืนยันส่งตัวแทน"}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        <p className="text-xs text-center text-muted-foreground px-4">
          ตัวแทนของคุณสามารถเช็คอินได้โดยใช้เบอร์โทรที่ระบุไว้
          ระบบจะบันทึกสถานะของคุณเป็น S (Substitute)
        </p>
      </div>
    </div>
  );
}
