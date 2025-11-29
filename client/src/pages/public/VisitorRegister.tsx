import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle, Check, ChevronsUpDown, User } from "lucide-react";
import { cn } from "@/lib/utils";

export default function VisitorRegister() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [profileToken, setProfileToken] = useState<string | null>(null);
  const [meeting, setMeeting] = useState<any>(null);
  const [tenant, setTenant] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [selectedReferrer, setSelectedReferrer] = useState<string>("");
  const [referrerSearchOpen, setReferrerSearchOpen] = useState(false);
  
  // 2-step form state
  const [step, setStep] = useState<"phone" | "form">("phone");
  const [existingParticipant, setExistingParticipant] = useState<any>(null);
  const [lookingUp, setLookingUp] = useState(false);
  
  // Get params from URL
  const meetingId = searchParams.get("meeting_id");
  const prefilledPhone = searchParams.get("phone") || "";
  const autoCheckin = searchParams.get("auto_checkin") === "true";

  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    phone: prefilledPhone,
    company: "",
    business_type: "",
    goal: "",
    notes: "",
  });

  useEffect(() => {
    loadMeetingData();
  }, [meetingId]);

  const loadMeetingData = async () => {
    try {
      if (!meetingId) {
        toast.error("ไม่พบข้อมูลการประชุม");
        return;
      }

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
      setTenant(data.tenants);
      
      // Load members for referral dropdown
      if (meetingId) {
        await loadMembers(meetingId);
      }
    } catch (error: any) {
      toast.error("ไม่พบข้อมูลการประชุม");
      console.error("Error loading meeting:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadMembers = async (meetingId: string) => {
    try {
      const response = await fetch(
        `/api/participants/members-for-referral?meeting_id=${meetingId}`
      );

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.members) {
          setMembers(result.members);
        }
      }
    } catch (error) {
      console.error("Failed to load members:", error);
    }
  };

  // Step 1: Phone lookup
  const handlePhoneLookup = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.phone) {
      toast.error("กรุณากรอกเบอร์โทรศัพท์");
      return;
    }

    if (!meetingId) {
      toast.error("ไม่พบข้อมูลการประชุม");
      return;
    }

    setLookingUp(true);

    try {
      const response = await fetch("/api/participants/lookup-by-phone", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone: formData.phone,
          meeting_id: meetingId,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to lookup phone");
      }

      const data = await response.json();

      if (data.success && data.exists && data.participant) {
        // Found existing participant - pre-fill form
        console.log("Found existing participant:", data.participant);
        setExistingParticipant(data.participant);
        setFormData({
          full_name: data.participant.full_name || "",
          email: data.participant.email || "",
          phone: data.participant.phone || formData.phone,
          company: data.participant.company || "",
          business_type: data.participant.business_type || "",
          goal: data.participant.goal || "",
          notes: data.participant.notes || "",
        });
        setSelectedReferrer(data.participant.referred_by_participant_id || "");
        toast.success("พบข้อมูลของคุณแล้ว! กรุณาตรวจสอบและแก้ไข (ถ้าจำเป็น)");
      } else {
        // New participant - go to empty form
        console.log("New participant - no existing data");
        setExistingParticipant(null);
        toast.info("ยินดีต้อนรับ! กรุณากรอกข้อมูลเพื่อลงทะเบียน");
      }

      // Go to form step
      setStep("form");
    } catch (error: any) {
      toast.error("เกิดข้อผิดพลาดในการค้นหา: " + error.message);
      console.error("Phone lookup error:", error);
    } finally {
      setLookingUp(false);
    }
  };

  // Step 2: Submit registration (INSERT or UPDATE)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.full_name || !formData.email || !formData.phone) {
      toast.error("กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน");
      return;
    }

    if (!tenant?.tenant_id) {
      toast.error("ไม่พบข้อมูล tenant");
      return;
    }

    setSubmitting(true);

    try {
      const payload: any = {
        meeting_id: meetingId, // Backend derives tenant_id from meeting_id
        full_name: formData.full_name,
        email: formData.email,
        phone: formData.phone,
        company: formData.company,
        business_type: formData.business_type,
        goal: formData.goal,
        notes: formData.notes,
        auto_checkin: autoCheckin, // Pass auto_checkin flag to API
        referred_by_participant_id: selectedReferrer || null,
      };

      // If updating existing participant, include participant_id
      if (existingParticipant?.participant_id) {
        payload.participant_id = existingParticipant.participant_id;
        console.log("UPDATE mode - participant_id:", payload.participant_id);
      } else {
        console.log("INSERT mode - new participant");
      }

      const response = await fetch("/api/participants/register-visitor", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        
        // Handle duplicate phone number (409 Conflict)
        if (response.status === 409) {
          toast.warning(errorData.message || "หากเคยลงทะเบียนแล้ว ให้เช็คอินด้วยเบอร์โทรศัพท์โดยตรง");
          // Redirect back to check-in page after a moment
          setTimeout(() => {
            navigate(`/checkin/${meetingId}`);
          }, 2000);
          return; // Don't throw error
        }
        
        // Other errors
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      console.log("✅ Registration successful:", data);

      // Save profile token for edit profile link
      if (data.profile_token) {
        setProfileToken(data.profile_token);
      }

      if (autoCheckin && data.auto_checked_in) {
        toast.success("ลงทะเบียนและเช็คอินสำเร็จ!");
        // Redirect to check-in success screen
        setTimeout(() => {
          navigate(`/checkin/${meetingId}`, { 
            replace: true,
            state: { skipToSuccess: true, profileToken: data.profile_token }
          });
        }, 1000);
      } else {
        toast.success("ลงทะเบียนสำเร็จ! ยินดีต้อนรับสู่ชุมชน Meetdup");
        setSuccess(true);
      }
    } catch (error: any) {
      toast.error("เกิดข้อผิดพลาด: " + error.message);
      console.error("Registration error:", error);
    } finally {
      setSubmitting(false);
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

  if (!meeting || !tenant) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold">ไม่พบข้อมูลการประชุม</h1>
          <p className="text-muted-foreground">กรุณาตรวจสอบลิงก์และลองอีกครั้ง</p>
        </div>
      </div>
    );
  }

  // Success screen
  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-4">
            <div className="flex justify-center">
              <div className="p-4 bg-green-100 dark:bg-green-900 rounded-full">
                <CheckCircle className="h-16 w-16 text-green-600 dark:text-green-400" />
              </div>
            </div>
            <h1 className="text-2xl font-bold">ลงทะเบียนสำเร็จ!</h1>
            <p className="text-muted-foreground">
              ยินดีต้อนรับสู่ชุมชน Meetdup<br />
              {tenant.tenant_name}
            </p>
            <div className="flex flex-col gap-2 pt-4">
              {profileToken && (
                <Button
                  onClick={() => navigate(`/participant-profile/edit?token=${profileToken}`)}
                  data-testid="button-edit-profile"
                >
                  <User className="mr-2 h-4 w-4" />
                  แก้ไขโปรไฟล์ของฉัน
                </Button>
              )}
              <Button
                onClick={() => navigate(`/chapter/${tenant.subdomain}`)}
                variant="outline"
                data-testid="button-back-to-chapter"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                กลับหน้า Chapter
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Step 1: Phone Lookup Form
  if (step === "phone") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>
              {autoCheckin ? "ลงทะเบียนและเช็คอิน" : "ลงทะเบียนผู้เยี่ยมชม"}
            </CardTitle>
            <CardDescription>
              {tenant.tenant_name}
              {autoCheckin && (
                <span className="block mt-1 text-xs text-primary">
                  ระบบจะเช็คอินให้อัตโนมัติหลังลงทะเบียน
                </span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePhoneLookup} className="space-y-4">
              <div>
                <Label htmlFor="phone">เบอร์โทรศัพท์ *</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  required
                  placeholder="08X-XXX-XXXX"
                  maxLength={10}
                  data-testid="input-phone-lookup"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  ระบบจะตรวจสอบว่าคุณเคยลงทะเบียนหรือไม่ เพื่อนำข้อมูลเดิมมาแสดงให้คุณ
                </p>
              </div>

              <div className="space-y-2">
                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={lookingUp}
                  data-testid="button-lookup-phone"
                >
                  {lookingUp ? "กำลังค้นหา..." : "ถัดไป"}
                </Button>
                <Button
                  type="button"
                  onClick={() => navigate(`/checkin/${meetingId}`)}
                  variant="outline"
                  className="w-full"
                  disabled={lookingUp}
                  data-testid="button-back-to-checkin"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  กลับไปหน้าเช็คอิน
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Step 2: Registration Form
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle>
            {existingParticipant ? "ตรวจสอบและแก้ไขข้อมูล" : (autoCheckin ? "ลงทะเบียนและเช็คอิน" : "ลงทะเบียนผู้เยี่ยมชม")}
          </CardTitle>
          <CardDescription>
            {tenant.tenant_name}
            {existingParticipant && (
              <span className="block mt-1 text-xs text-primary">
                พบข้อมูลของคุณแล้ว กรุณาตรวจสอบและแก้ไข (ถ้าจำเป็น)
              </span>
            )}
            {autoCheckin && !existingParticipant && (
              <span className="block mt-1 text-xs text-primary">
                ระบบจะเช็คอินให้อัตโนมัติหลังลงทะเบียน
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="full_name">ชื่อ-นามสกุล *</Label>
              <Input
                id="full_name"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                required
                placeholder="กรอกชื่อ-นามสกุล"
                data-testid="input-full-name"
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
                data-testid="input-email"
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
                maxLength={10}
                data-testid="input-phone"
                disabled={!!prefilledPhone} // Disable if pre-filled from check-in flow
              />
              {prefilledPhone && (
                <p className="text-xs text-muted-foreground mt-1">
                  เบอร์โทรศัพท์จากการเช็คอิน
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="company">บริษัท/ธุรกิจ</Label>
              <Input
                id="company"
                value={formData.company}
                onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                placeholder="ชื่อบริษัท/ธุรกิจ"
                data-testid="input-company"
              />
            </div>

            <div>
              <Label htmlFor="business_type">ประเภทธุรกิจ</Label>
              <Input
                id="business_type"
                value={formData.business_type}
                onChange={(e) => setFormData({ ...formData, business_type: e.target.value })}
                placeholder="เช่น บริการทางการเงิน, IT, อสังหาริมทรัพย์"
                data-testid="input-business-type"
              />
            </div>

            {/* Referral Combobox */}
            <div>
              <Label htmlFor="referrer">ผู้แนะนำ (ถ้ามี)</Label>
              <Popover open={referrerSearchOpen} onOpenChange={setReferrerSearchOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={referrerSearchOpen}
                    className="w-full justify-between font-normal"
                    data-testid="button-select-referrer"
                  >
                    {selectedReferrer
                      ? members.find((m) => m.participant_id === selectedReferrer)?.display_name
                      : "เลือกสมาชิกที่แนะนำคุณ (ถ้ามี)"}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0" align="start">
                  <Command>
                    <CommandInput placeholder="ค้นหาสมาชิก..." />
                    <CommandList>
                      <CommandEmpty>ไม่พบสมาชิก</CommandEmpty>
                      <CommandGroup>
                        {members.map((member) => (
                          <CommandItem
                            key={member.participant_id}
                            value={member.display_name}
                            onSelect={() => {
                              setSelectedReferrer(member.participant_id === selectedReferrer ? "" : member.participant_id);
                              setReferrerSearchOpen(false);
                            }}
                            data-testid={`option-referrer-${member.participant_id}`}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selectedReferrer === member.participant_id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {member.display_name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div>
              <Label htmlFor="goal">เป้าหมายในการเข้าร่วม</Label>
              <Textarea
                id="goal"
                value={formData.goal}
                onChange={(e) => setFormData({ ...formData, goal: e.target.value })}
                placeholder="คุณหวังอะไรจากการเข้าร่วม Meetdup?"
                rows={3}
                data-testid="input-goal"
              />
            </div>

            <div>
              <Label htmlFor="notes">หมายเหตุ</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="ข้อมูลเพิ่มเติม (ถ้ามี)"
                rows={2}
                data-testid="input-notes"
              />
            </div>

            <div className="space-y-2">
              <Button 
                type="submit" 
                className="w-full" 
                disabled={submitting}
                data-testid="button-submit"
              >
                {submitting 
                  ? "กำลังดำเนินการ..." 
                  : existingParticipant
                    ? "บันทึกข้อมูล"
                    : autoCheckin 
                      ? "ลงทะเบียนและเช็คอิน" 
                      : "ลงทะเบียน"
                }
              </Button>
              <Button
                type="button"
                onClick={() => setStep("phone")}
                variant="outline"
                className="w-full"
                disabled={submitting}
                data-testid="button-back-to-phone"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                กลับไปแก้ไขเบอร์โทร
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
