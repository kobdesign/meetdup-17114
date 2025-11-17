import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, CheckCircle2, UserCircle } from "lucide-react";

declare global {
  interface Window {
    liff: any;
  }
}

interface LiffProfile {
  userId: string;
  displayName: string;
  pictureUrl?: string;
  statusMessage?: string;
}

interface ExistingParticipant {
  participant_id: string;
  full_name: string;
  email: string;
  phone: string;
  company?: string;
  business_type?: string;
  goal?: string;
  status: string;
  line_user_id?: string;
}

export default function LineRegister() {
  const [, navigate] = useLocation();
  const [step, setStep] = useState<"loading" | "phone" | "form" | "success">("loading");
  const [liffReady, setLiffReady] = useState(false);
  const [liffProfile, setLiffProfile] = useState<LiffProfile | null>(null);
  const [lookingUp, setLookingUp] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [existingParticipant, setExistingParticipant] = useState<ExistingParticipant | null>(null);
  const [selectedMeeting, setSelectedMeeting] = useState<string>("");
  const [meetings, setMeetings] = useState<any[]>([]);
  
  const [formData, setFormData] = useState({
    phone: "",
    full_name: "",
    email: "",
    company: "",
    business_type: "",
    goal: "",
    notes: "",
  });

  // Initialize LIFF
  useEffect(() => {
    const initLiff = async () => {
      try {
        console.log("🔵 Initializing LIFF...");
        
        // Check if LIFF SDK is loaded
        if (!window.liff) {
          console.error("❌ LIFF SDK not loaded");
          toast({
            title: "ข้อผิดพลาด",
            description: "ไม่สามารถเชื่อมต่อกับ LINE ได้ กรุณาเปิดผ่าน LINE แอป",
            variant: "destructive",
          });
          return;
        }

        // Get LIFF ID from URL parameter
        const urlParams = new URLSearchParams(window.location.search);
        const liffId = urlParams.get('liff_id') || import.meta.env.VITE_LIFF_ID;

        if (!liffId) {
          console.error("❌ LIFF ID not found");
          toast({
            title: "ข้อผิดพลาด",
            description: "ไม่พบ LIFF ID กรุณาติดต่อผู้ดูแลระบบ",
            variant: "destructive",
          });
          return;
        }

        await window.liff.init({ liffId });
        console.log("✅ LIFF initialized successfully");

        // Check if user is logged in
        if (!window.liff.isLoggedIn()) {
          console.log("⚠️ User not logged in, redirecting to LINE login");
          window.liff.login();
          return;
        }

        // Get user profile
        const profile = await window.liff.getProfile();
        console.log("✅ Got LINE profile:", profile.displayName);
        setLiffProfile(profile);
        setLiffReady(true);
        setStep("phone");

        // Pre-fill name from LINE profile
        setFormData(prev => ({
          ...prev,
          full_name: profile.displayName || "",
        }));

      } catch (error: any) {
        console.error("❌ LIFF init failed:", error);
        toast({
          title: "ข้อผิดพลาด",
          description: `ไม่สามารถเชื่อมต่อกับ LINE ได้: ${error.message}`,
          variant: "destructive",
        });
      }
    };

    initLiff();
  }, []);

  // Fetch available meetings (optional - for future use)
  useEffect(() => {
    if (liffReady) {
      fetchMeetings();
    }
  }, [liffReady]);

  const fetchMeetings = async () => {
    try {
      // TODO: Get tenant_id from LIFF URL params or backend
      // For now, we'll skip meeting selection and link without meeting
      console.log("📅 Meetings feature: Coming soon");
    } catch (error) {
      console.error("Error fetching meetings:", error);
    }
  };

  const handlePhoneLookup = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.phone) {
      toast({
        title: "กรุณากรอกเบอร์โทรศัพท์",
        variant: "destructive",
      });
      return;
    }

    // Validate phone format
    const cleanPhone = formData.phone.replace(/\D/g, "");
    if (cleanPhone.length !== 10) {
      toast({
        title: "เบอร์โทรศัพท์ไม่ถูกต้อง",
        description: "กรุณากรอกเบอร์โทรศัพท์ 10 หลัก",
        variant: "destructive",
      });
      return;
    }

    setLookingUp(true);

    try {
      console.log("🔍 Looking up participant by phone:", cleanPhone);

      // Call backend to lookup participant by phone
      const response = await fetch("/api/participants/lookup-by-line-phone", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone: cleanPhone,
          line_user_id: liffProfile?.userId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to lookup phone");
      }

      if (data.found && data.participant) {
        // Found existing participant
        console.log("✅ Found existing participant:", data.participant);
        setExistingParticipant(data.participant);
        
        // Check if already linked
        if (data.participant.line_user_id === liffProfile?.userId) {
          toast({
            title: "เชื่อมโยงแล้ว",
            description: "LINE account ของคุณเชื่อมโยงกับข้อมูลนี้อยู่แล้ว",
          });
          setStep("success");
          return;
        }

        // Pre-fill form with existing data
        setFormData({
          phone: cleanPhone,
          full_name: data.participant.full_name || liffProfile?.displayName || "",
          email: data.participant.email || "",
          company: data.participant.company || "",
          business_type: data.participant.business_type || "",
          goal: data.participant.goal || "",
          notes: data.participant.notes || "",
        });
        
        toast({
          title: "พบข้อมูลของคุณแล้ว",
          description: "กรุณาตรวจสอบและยืนยันการเชื่อมโยง LINE",
        });
      } else {
        // New participant
        console.log("ℹ️ New participant - no existing data");
        setExistingParticipant(null);
        setFormData(prev => ({
          ...prev,
          phone: cleanPhone,
        }));
        toast({
          title: "ยินดีต้อนรับ",
          description: "กรุณากรอกข้อมูลเพื่อลงทะเบียน",
        });
      }

      setStep("form");
    } catch (error: any) {
      console.error("❌ Phone lookup error:", error);
      toast({
        title: "เกิดข้อผิดพลาด",
        description: error.message || "ไม่สามารถค้นหาข้อมูลได้",
        variant: "destructive",
      });
    } finally {
      setLookingUp(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.full_name || !formData.email || !formData.phone) {
      toast({
        title: "กรุณากรอกข้อมูลให้ครบถ้วน",
        description: "ชื่อ-นามสกุล, อีเมล, และเบอร์โทรศัพท์เป็นข้อมูลจำเป็น",
        variant: "destructive",
      });
      return;
    }

    if (!liffProfile?.userId) {
      toast({
        title: "ข้อผิดพลาด",
        description: "ไม่พบข้อมูล LINE User ID",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);

    try {
      console.log("📝 Submitting registration/link...");

      const payload = {
        line_user_id: liffProfile.userId,
        line_display_name: liffProfile.displayName,
        line_picture_url: liffProfile.pictureUrl,
        phone: formData.phone.replace(/\D/g, ""),
        full_name: formData.full_name,
        email: formData.email,
        company: formData.company || null,
        business_type: formData.business_type || null,
        goal: formData.goal || null,
        notes: formData.notes || null,
        is_update: !!existingParticipant,
        participant_id: existingParticipant?.participant_id,
      };

      const response = await fetch("/api/participants/line-register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Registration failed");
      }

      console.log("✅ Registration/link successful:", data);
      
      toast({
        title: "สำเร็จ! 🎉",
        description: existingParticipant 
          ? "เชื่อมโยง LINE account สำเร็จแล้ว"
          : "ลงทะเบียนและเชื่อมโยง LINE สำเร็จแล้ว",
      });

      setStep("success");

      // Close LIFF window after 2 seconds
      setTimeout(() => {
        if (window.liff && window.liff.closeWindow) {
          window.liff.closeWindow();
        }
      }, 2000);

    } catch (error: any) {
      console.error("❌ Registration error:", error);
      toast({
        title: "เกิดข้อผิดพลาด",
        description: error.message || "ไม่สามารถลงทะเบียนได้",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Loading state
  if (step === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 to-accent/10 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-4 py-8">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="text-lg text-muted-foreground">กำลังเชื่อมต่อกับ LINE...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Success state
  if (step === "success") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 to-accent/10 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-4 py-8">
              <CheckCircle2 className="h-16 w-16 text-green-600" />
              <h2 className="text-2xl font-bold">สำเร็จ! 🎉</h2>
              <p className="text-center text-muted-foreground">
                {existingParticipant 
                  ? "เชื่อมโยง LINE account ของคุณสำเร็จแล้ว"
                  : "ลงทะเบียนและเชื่อมโยง LINE สำเร็จแล้ว"}
              </p>
              <p className="text-sm text-muted-foreground">
                หน้าต่างนี้จะปิดอัตโนมัติ...
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 to-accent/10 p-4 py-8">
      <div className="max-w-2xl mx-auto">
        {/* LINE Profile Header */}
        {liffProfile && (
          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                {liffProfile.pictureUrl ? (
                  <img 
                    src={liffProfile.pictureUrl} 
                    alt={liffProfile.displayName}
                    className="h-16 w-16 rounded-full"
                  />
                ) : (
                  <UserCircle className="h-16 w-16 text-muted-foreground" />
                )}
                <div>
                  <h3 className="font-semibold text-lg">{liffProfile.displayName}</h3>
                  <p className="text-sm text-muted-foreground">LINE Account</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 1: Phone Lookup */}
        {step === "phone" && (
          <Card>
            <CardHeader>
              <CardTitle>ลงทะเบียนผ่าน LINE</CardTitle>
              <CardDescription>
                กรุณากรอกเบอร์โทรศัพท์เพื่อค้นหาข้อมูลของคุณ
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handlePhoneLookup} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">เบอร์โทรศัพท์ *</Label>
                  <Input
                    id="phone"
                    data-testid="input-phone"
                    type="tel"
                    placeholder="0812345678"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    maxLength={10}
                    required
                  />
                  <p className="text-sm text-muted-foreground">
                    กรอกเบอร์โทรศัพท์ 10 หลัก (ไม่ต้องมีขีด)
                  </p>
                </div>

                <Button
                  type="submit"
                  data-testid="button-lookup"
                  className="w-full"
                  disabled={lookingUp}
                >
                  {lookingUp ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      กำลังค้นหา...
                    </>
                  ) : (
                    "ถัดไป"
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Registration Form */}
        {step === "form" && (
          <Card>
            <CardHeader>
              <CardTitle>
                {existingParticipant ? "ยืนยันข้อมูลและเชื่อมโยง LINE" : "ลงทะเบียนสมาชิก"}
              </CardTitle>
              <CardDescription>
                {existingParticipant 
                  ? "ตรวจสอบข้อมูลของคุณและกดยืนยันเพื่อเชื่อมโยง LINE account"
                  : "กรุณากรอกข้อมูลของคุณให้ครบถ้วน"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="full_name">ชื่อ-นามสกุล *</Label>
                  <Input
                    id="full_name"
                    data-testid="input-fullname"
                    type="text"
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">อีเมล *</Label>
                  <Input
                    id="email"
                    data-testid="input-email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="company">บริษัท / องค์กร</Label>
                  <Input
                    id="company"
                    data-testid="input-company"
                    type="text"
                    value={formData.company}
                    onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="business_type">ประเภทธุรกิจ</Label>
                  <Input
                    id="business_type"
                    data-testid="input-business-type"
                    type="text"
                    value={formData.business_type}
                    onChange={(e) => setFormData({ ...formData, business_type: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="goal">เป้าหมายในการเข้าร่วม</Label>
                  <Textarea
                    id="goal"
                    data-testid="textarea-goal"
                    value={formData.goal}
                    onChange={(e) => setFormData({ ...formData, goal: e.target.value })}
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">หมายเหตุเพิ่มเติม</Label>
                  <Textarea
                    id="notes"
                    data-testid="textarea-notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={2}
                  />
                </div>

                <div className="flex gap-3">
                  <Button
                    type="button"
                    data-testid="button-back"
                    variant="outline"
                    onClick={() => setStep("phone")}
                    disabled={submitting}
                    className="flex-1"
                  >
                    ย้อนกลับ
                  </Button>
                  <Button
                    type="submit"
                    data-testid="button-submit"
                    disabled={submitting}
                    className="flex-1"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        กำลังบันทึก...
                      </>
                    ) : (
                      existingParticipant ? "ยืนยันและเชื่อมโยง" : "ลงทะเบียน"
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
