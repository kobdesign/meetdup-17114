import { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle, Calendar, MapPin, ArrowLeft, User, Phone, Mail, Building } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type CheckInStep = "phone_input" | "confirm" | "success";

export default function CheckInScanner() {
  const { meetingId } = useParams<{ meetingId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<CheckInStep>("phone_input");
  const [meeting, setMeeting] = useState<any>(null);
  const [phone, setPhone] = useState("");
  const [participant, setParticipant] = useState<any>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);

  // Check if we should skip to success (e.g., after auto-check-in registration)
  useEffect(() => {
    if (location.state?.skipToSuccess) {
      console.log("🎉 Skip to success state detected");
      setStep("success");
      
      // Clear the state to prevent re-triggering on reload
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state]);

  useEffect(() => {
    loadMeeting();
  }, [meetingId]);

  const loadMeeting = async () => {
    try {
      if (!meetingId) return;

      const { data, error } = await supabase
        .from("meetings")
        .select(`
          *,
          tenants:tenant_id (
            tenant_id,
            tenant_name,
            subdomain
          )
        `)
        .eq("meeting_id", meetingId)
        .single();

      if (error) throw error;
      setMeeting(data);
    } catch (error: any) {
      toast.error("ไม่พบข้อมูลการประชุม");
    } finally {
      setLoading(false);
    }
  };

  const handlePhoneLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLookupLoading(true);

    try {
      // Validate phone format (10 digits)
      const cleanPhone = phone.replace(/\D/g, "");
      if (cleanPhone.length !== 10) {
        toast.error("กรุณากรอกเบอร์โทรศัพท์ 10 หลัก");
        return;
      }

      console.log("🔍 Looking up participant by phone:", cleanPhone);

      // Call lookup API
      const response = await fetch(
        `/api/participants/lookup-by-phone?phone=${encodeURIComponent(cleanPhone)}&meeting_id=${meetingId}`
      );

      const data = await response.json();

      if (!response.ok) {
        console.error("❌ Lookup failed:", data);
        toast.error(data.message || "เกิดข้อผิดพลาดในการค้นหา");
        return;
      }

      if (data.found && data.participant) {
        // Found participant - show confirmation
        console.log("✅ Participant found:", data.participant);
        setParticipant(data.participant);
        setStep("confirm");
      } else {
        // Not found - redirect to registration with auto_checkin
        console.log("⚠️ Participant not found, redirecting to registration");
        toast.info("ไม่พบข้อมูล กรุณาลงทะเบียน");
        
        // Redirect to register page with auto_checkin flag
        navigate(`/register?meeting_id=${meetingId}&phone=${cleanPhone}&auto_checkin=true`);
      }
    } catch (error: any) {
      console.error("❌ Unexpected error during lookup:", error);
      toast.error("เกิดข้อผิดพลาดในการค้นหา กรุณาลองใหม่อีกครั้ง");
    } finally {
      setLookupLoading(false);
    }
  };

  const handleConfirmCheckIn = async () => {
    if (!participant) return;
    
    setCheckingIn(true);

    try {
      const payload = {
        meeting_id: meetingId,
        participant_id: participant.participant_id,
      };

      console.log("🚀 Starting check-in with participant_id:", participant.participant_id);

      const response = await fetch("/api/participants/check-in", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      console.log("✅ API response:", { status: response.status, data });

      if (!response.ok) {
        console.error("❌ Check-in failed:", data);
        
        if (response.status === 404) {
          toast.error("ไม่พบข้อมูลการประชุมหรือผู้เข้าร่วม");
        } else if (response.status === 400) {
          toast.error(data.message || "กรุณาตรวจสอบข้อมูล");
        } else {
          toast.error(data.message || "เกิดข้อผิดพลาดในการเช็คอิน กรุณาลองใหม่อีกครั้ง");
        }
        return;
      }

      if (data.already_checked_in) {
        console.log("⚠️ Already checked in");
        toast.error("คุณได้เช็คอินการประชุมนี้แล้ว");
        setStep("success");
        return;
      }

      if (!data.success) {
        console.error("❌ Check-in failed:", data.error);
        toast.error(data.message || "เกิดข้อผิดพลาดในการเช็คอิน กรุณาลองใหม่อีกครั้ง");
        return;
      }

      // Success!
      console.log("🎉 Check-in successful!");
      toast.success("เช็คอินสำเร็จ! ยินดีต้อนรับเข้าสู่การประชุม");
      setStep("success");
    } catch (error: any) {
      console.error("❌ Unexpected error during check-in:", error);
      toast.error("เกิดข้อผิดพลาดในการเช็คอิน กรุณาลองใหม่อีกครั้ง");
    } finally {
      setCheckingIn(false);
    }
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg text-muted-foreground">กำลังโหลด...</div>
        </div>
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold">ไม่พบข้อมูลการประชุม</h1>
          <p className="text-muted-foreground">กรุณาตรวจสอบ QR code และลองอีกครั้ง</p>
        </div>
      </div>
    );
  }

  // Success screen
  if (step === "success") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-4">
            <div className="flex justify-center">
              <div className="p-4 bg-green-100 dark:bg-green-900 rounded-full">
                <CheckCircle className="h-16 w-16 text-green-600 dark:text-green-400" />
              </div>
            </div>
            <h1 className="text-2xl font-bold">เช็คอินสำเร็จ!</h1>
            <p className="text-muted-foreground">
              ยินดีต้อนรับเข้าสู่การประชุม<br />
              {meeting.tenants?.tenant_name}
            </p>
            {participant && (
              <div className="text-sm text-muted-foreground">
                <p>{participant.full_name_th || participant.full_name}</p>
                {getStatusBadge(participant.status)}
              </div>
            )}
            <Button
              onClick={() => navigate(`/chapter/${meeting.tenants?.subdomain}`)}
              variant="outline"
              className="mt-4"
              data-testid="button-back-to-chapter"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              กลับหน้า Chapter
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Confirm screen - show participant info
  if (step === "confirm" && participant) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>ยืนยันการเช็คอิน</CardTitle>
            <CardDescription>
              {meeting.tenants?.tenant_name}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Meeting Info */}
            <div className="p-4 bg-muted rounded-lg space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>
                  {new Date(meeting.meeting_date).toLocaleDateString("th-TH", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </span>
              </div>
              {meeting.theme && (
                <p className="text-sm">หัวข้อ: {meeting.theme}</p>
              )}
              {meeting.venue && (
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span>{meeting.venue}</span>
                </div>
              )}
            </div>

            {/* Participant Info */}
            <div className="p-4 border rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">ข้อมูลผู้เข้าร่วม</h3>
                {getStatusBadge(participant.status)}
              </div>
              
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span>{participant.full_name_th || participant.full_name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>{participant.phone}</span>
                </div>
                {participant.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs">{participant.email}</span>
                  </div>
                )}
                {participant.company && (
                  <div className="flex items-center gap-2">
                    <Building className="h-4 w-4 text-muted-foreground" />
                    <span>{participant.company}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2">
              <Button 
                onClick={handleConfirmCheckIn}
                className="w-full" 
                disabled={checkingIn}
                data-testid="button-confirm-checkin"
              >
                {checkingIn ? "กำลังเช็คอิน..." : "ยืนยันการเช็คอิน"}
              </Button>
              <Button
                onClick={() => {
                  setStep("phone_input");
                  setParticipant(null);
                }}
                variant="outline"
                className="w-full"
                disabled={checkingIn}
                data-testid="button-back"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                กลับไปกรอกเบอร์ใหม่
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Phone input screen
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle>Check-In เข้าประชุม</CardTitle>
          <CardDescription>
            {meeting.tenants?.tenant_name}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Meeting Info */}
          <div className="p-4 bg-muted rounded-lg space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span>
                {new Date(meeting.meeting_date).toLocaleDateString("th-TH", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </span>
            </div>
            {meeting.theme && (
              <p className="text-sm">หัวข้อ: {meeting.theme}</p>
            )}
            {meeting.venue && (
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span>{meeting.venue}</span>
              </div>
            )}
          </div>

          {/* Phone Input Form */}
          <form onSubmit={handlePhoneLookup} className="space-y-4">
            <div>
              <Label htmlFor="phone">เบอร์โทรศัพท์ *</Label>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                placeholder="08X-XXX-XXXX (10 หลัก)"
                maxLength={10}
                pattern="[0-9]{10}"
                data-testid="input-phone"
              />
              <p className="text-xs text-muted-foreground mt-1">
                กรอกเบอร์โทรศัพท์ 10 หลักเพื่อเช็คอิน
              </p>
            </div>

            <Button 
              type="submit" 
              className="w-full" 
              disabled={lookupLoading}
              data-testid="button-lookup"
            >
              {lookupLoading ? "กำลังค้นหา..." : "ถัดไป"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
