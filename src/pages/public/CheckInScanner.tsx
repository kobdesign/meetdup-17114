import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle, Calendar, MapPin, ArrowLeft } from "lucide-react";

export default function CheckInScanner() {
  const { meetingId } = useParams<{ meetingId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [meeting, setMeeting] = useState<any>(null);
  const [checkedIn, setCheckedIn] = useState(false);
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    phone: "",
  });

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
            name,
            slug
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

  const handleCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setChecking(true);

    try {
      if (!formData.full_name || !formData.email || !formData.phone) {
        toast.error("กรุณากรอกข้อมูลให้ครบถ้วน");
        return;
      }

      console.log("🚀 Starting check-in process:", {
        meetingId,
        full_name: formData.full_name,
        email: formData.email,
      });

      // Call edge function to handle check-in (bypasses RLS)
      const { data, error } = await supabase.functions.invoke('check-in-participant', {
        body: {
          meeting_id: meetingId,
          full_name: formData.full_name,
          email: formData.email,
          phone: formData.phone,
        },
        headers: {
          "Content-Type": "application/json",
        },
      });

      console.log("✅ Edge function response:", { data, error });

      // Handle error from the function invocation itself
      if (error) {
        console.error("❌ Function invocation error:", error);
        
        // Map common errors to user-friendly messages
        if (error.message?.includes("Meeting not found")) {
          toast.error("ไม่พบข้อมูลการประชุม");
        } else if (error.message?.includes("FunctionsHttpError")) {
          toast.error("ไม่สามารถเชื่อมต่อกับระบบได้ กรุณาลองใหม่อีกครั้ง");
        } else {
          toast.error("เกิดข้อผิดพลาดในการเช็คอิน กรุณาลองใหม่อีกครั้ง");
        }
        return;
      }

      // Handle business logic responses
      if (data?.already_checked_in) {
        console.log("⚠️ Already checked in");
        toast.error("คุณได้เช็คอินการประชุมนี้แล้ว");
        setCheckedIn(true);
        return;
      }

      if (!data?.success) {
        console.error("❌ Check-in failed:", data?.error);
        
        // Map backend error messages to Thai
        const errorMsg = data?.error || "";
        if (errorMsg.includes("Meeting not found")) {
          toast.error("ไม่พบข้อมูลการประชุม");
        } else if (errorMsg.includes("Missing required fields")) {
          toast.error("กรุณากรอกข้อมูลให้ครบถ้วน");
        } else if (errorMsg.includes("already checked in")) {
          toast.error("คุณได้เช็คอินการประชุมนี้แล้ว");
          setCheckedIn(true);
        } else {
          toast.error("เกิดข้อผิดพลาดในการเช็คอิน กรุณาลองใหม่อีกครั้ง");
        }
        return;
      }

      console.log("🎉 Check-in successful!");
      toast.success("เช็คอินสำเร็จ! ยินดีต้อนรับเข้าสู่การประชุม");
      setCheckedIn(true);
    } catch (error: any) {
      console.error("❌ Unexpected error during check-in:", error);
      
      // Never show technical RLS errors to users
      if (error.message?.includes("row-level security") || error.message?.includes("RLS")) {
        console.error("🔒 RLS error detected - this should not happen!");
        toast.error("เกิดข้อผิดพลาดในระบบ กรุณาติดต่อผู้ดูแลระบบ");
      } else {
        toast.error("เกิดข้อผิดพลาดในการเช็คอิน กรุณาลองใหม่อีกครั้ง");
      }
    } finally {
      setChecking(false);
    }
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

  if (checkedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-4">
            <div className="flex justify-center">
              <div className="p-4 bg-green-100 rounded-full">
                <CheckCircle className="h-16 w-16 text-green-600" />
              </div>
            </div>
            <h1 className="text-2xl font-bold">เช็คอินสำเร็จ!</h1>
            <p className="text-muted-foreground">
              ยินดีต้อนรับเข้าสู่การประชุม<br />
              {meeting.tenants?.name}
            </p>
            <Button
              onClick={() => navigate(`/chapter/${meeting.tenants?.slug}`)}
              variant="outline"
              className="mt-4"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              กลับหน้า Chapter
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle>Check-In เข้าประชุม</CardTitle>
          <CardDescription>
            {meeting.tenants?.name}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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

          <form onSubmit={handleCheckIn} className="space-y-4">
            <div>
              <Label htmlFor="full_name">ชื่อ-นามสกุล *</Label>
              <Input
                id="full_name"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                required
                placeholder="กรอกชื่อ-นามสกุล"
              />
            </div>

            <div>
              <Label htmlFor="email">อีเมล *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                placeholder="example@email.com"
              />
            </div>

            <div>
              <Label htmlFor="phone">เบอร์โทรศัพท์ *</Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                required
                placeholder="08X-XXX-XXXX"
              />
            </div>

            <Button type="submit" className="w-full" disabled={checking}>
              {checking ? "กำลังเช็คอิน..." : "เช็คอิน"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
