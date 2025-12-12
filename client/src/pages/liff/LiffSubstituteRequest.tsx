import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, UserPlus, Calendar, CheckCircle, XCircle, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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

interface TokenPayload {
  participant_id: string;
  tenant_id: string;
  meeting_id: string;
  participant_name?: string;
}

export default function LiffSubstituteRequest() {
  const location = useLocation();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [upcomingMeeting, setUpcomingMeeting] = useState<Meeting | null>(null);
  const [existingRequest, setExistingRequest] = useState<SubstituteRequest | null>(null);
  const [tokenPayload, setTokenPayload] = useState<TokenPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const [substituteName, setSubstituteName] = useState("");
  const [substitutePhone, setSubstitutePhone] = useState("");
  const [substituteEmail, setSubstituteEmail] = useState("");

  const searchParams = new URLSearchParams(location.search);
  const urlToken = searchParams.get("token");

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (!urlToken) {
          setError("ลิงก์ไม่ถูกต้อง กรุณาขอลิงก์ใหม่");
          setLoading(false);
          return;
        }

        // Verify token and get participant/meeting info
        const verifyRes = await fetch(`/api/public/verify-substitute-token?token=${urlToken}`);
        const verifyData = await verifyRes.json();
        
        if (!verifyData.valid) {
          setError(verifyData.error || "ลิงก์หมดอายุหรือไม่ถูกต้อง กรุณาขอลิงก์ใหม่");
          setLoading(false);
          return;
        }

        setTokenPayload(verifyData);

        // Get meeting info
        if (verifyData.meeting) {
          setUpcomingMeeting(verifyData.meeting);
        }

        // Check existing request
        if (verifyData.existing_request) {
          setExistingRequest(verifyData.existing_request);
          setSubstituteName(verifyData.existing_request.substitute_name);
          setSubstitutePhone(verifyData.existing_request.substitute_phone);
        }

      } catch (err: any) {
        console.error("Error fetching data:", err);
        setError("เกิดข้อผิดพลาดในการโหลดข้อมูล");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [urlToken]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!upcomingMeeting || !urlToken) {
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
      const res = await fetch("/api/palms/substitute-request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Substitute-Token": urlToken
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
    if (!existingRequest || !urlToken) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/palms/substitute-request/${existingRequest.request_id}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "X-Substitute-Token": urlToken
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
    // Try to close LIFF window if available
    try {
      const liff = (window as any).liff;
      if (liff?.isInClient?.()) {
        liff.closeWindow();
        return;
      }
    } catch {}
    window.history.back();
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

  if (loading) {
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

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-primary text-primary-foreground p-4">
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={handleClose}
            className="text-primary-foreground hover:bg-primary/80"
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold">แจ้งส่งตัวแทน</h1>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {upcomingMeeting && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Meeting ที่กำลังจะมาถึง
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-medium" data-testid="text-meeting-date">
                {formatDate(upcomingMeeting.meeting_date)}
              </p>
              {upcomingMeeting.theme && (
                <p className="text-sm text-muted-foreground">{upcomingMeeting.theme}</p>
              )}
            </CardContent>
          </Card>
        )}

        {tokenPayload?.participant_name && (
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">สมาชิก</p>
              <p className="font-medium">{tokenPayload.participant_name}</p>
            </CardContent>
          </Card>
        )}

        {existingRequest ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                ลงทะเบียนตัวแทนแล้ว
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">ชื่อตัวแทน</p>
                <p className="font-medium" data-testid="text-substitute-name">{existingRequest.substitute_name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">เบอร์โทร</p>
                <p className="font-medium" data-testid="text-substitute-phone">{existingRequest.substitute_phone}</p>
              </div>
              <Button
                variant="destructive"
                onClick={handleCancel}
                disabled={submitting}
                className="w-full"
                data-testid="button-cancel"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                ยกเลิกการส่งตัวแทน
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5" />
                ข้อมูลตัวแทน
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="substituteName">ชื่อ-นามสกุล ตัวแทน *</Label>
                  <Input
                    id="substituteName"
                    value={substituteName}
                    onChange={(e) => setSubstituteName(e.target.value)}
                    placeholder="กรอกชื่อตัวแทน"
                    required
                    data-testid="input-substitute-name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="substitutePhone">เบอร์โทรตัวแทน *</Label>
                  <Input
                    id="substitutePhone"
                    type="tel"
                    value={substitutePhone}
                    onChange={(e) => setSubstitutePhone(e.target.value)}
                    placeholder="08XXXXXXXX"
                    required
                    data-testid="input-substitute-phone"
                  />
                  <p className="text-xs text-muted-foreground">
                    ใช้สำหรับตรวจสอบตัวแทนเมื่อมา Check-in
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="substituteEmail">อีเมลตัวแทน (ไม่บังคับ)</Label>
                  <Input
                    id="substituteEmail"
                    type="email"
                    value={substituteEmail}
                    onChange={(e) => setSubstituteEmail(e.target.value)}
                    placeholder="email@example.com"
                    data-testid="input-substitute-email"
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={submitting || !substituteName.trim() || !substitutePhone.trim()}
                  data-testid="button-submit"
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  บันทึกข้อมูลตัวแทน
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
