import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, User, Building2, Phone, Briefcase, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTenantContext } from "@/contexts/TenantContext";

export default function CompleteProfile() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { selectedTenantId } = useTenantContext();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [existingData, setExistingData] = useState<any>(null);
  
  const [fullNameTh, setFullNameTh] = useState("");
  const [phone, setPhone] = useState("");
  const [position, setPosition] = useState("");
  const [company, setCompany] = useState("");

  const tenantId = searchParams.get("tenant_id") || selectedTenantId;

  useEffect(() => {
    loadExistingData();
  }, [tenantId]);

  const loadExistingData = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate("/auth");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, phone")
        .eq("id", session.user.id)
        .maybeSingle();

      if (tenantId) {
        const { data: participant } = await supabase
          .from("participants")
          .select("full_name_th, phone, position, company")
          .eq("user_id", session.user.id)
          .eq("tenant_id", tenantId)
          .maybeSingle();

        if (participant) {
          setExistingData(participant);
          setFullNameTh(participant.full_name_th || profile?.full_name || "");
          setPhone(participant.phone || profile?.phone || "");
          setPosition(participant.position || "");
          setCompany(participant.company || "");
        } else if (profile) {
          setFullNameTh(profile.full_name || "");
          setPhone(profile.phone || "");
        }
      } else if (profile) {
        setFullNameTh(profile.full_name || "");
        setPhone(profile.phone || "");
      }

    } catch (error: any) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  const normalizePhone = (input: string): string => {
    return input.replace(/\D/g, '');
  };

  const validatePhone = (phoneNumber: string): boolean => {
    const normalized = normalizePhone(phoneNumber);
    return normalized.length >= 9 && normalized.length <= 10;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!fullNameTh.trim()) {
      toast.error("กรุณากรอกชื่อ-นามสกุล");
      return;
    }

    if (!phone.trim()) {
      toast.error("กรุณากรอกเบอร์โทรศัพท์");
      return;
    }

    if (!validatePhone(phone)) {
      toast.error("เบอร์โทรศัพท์ไม่ถูกต้อง (ต้องมี 9-10 หลัก)");
      return;
    }

    setSaving(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate("/auth");
        return;
      }

      const normalizedPhone = normalizePhone(phone);

      const { error: profileError } = await supabase
        .from("profiles")
        .upsert({
          id: session.user.id,
          full_name: fullNameTh.trim(),
          phone: normalizedPhone,
          updated_at: new Date().toISOString(),
        });

      if (profileError) {
        throw profileError;
      }

      if (tenantId) {
        const response = await fetch("/api/participants/complete-profile", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            tenant_id: tenantId,
            full_name_th: fullNameTh.trim(),
            phone: normalizedPhone,
            position: position.trim() || null,
            company: company.trim() || null,
          }),
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || "ไม่สามารถบันทึกข้อมูลได้");
        }
      }

      toast.success("บันทึกข้อมูลสำเร็จ!");
      
      setTimeout(() => {
        navigate("/admin");
      }, 500);

    } catch (error: any) {
      console.error("Error saving profile:", error);
      toast.error(error.message || "เกิดข้อผิดพลาดในการบันทึก");
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = () => {
    navigate("/admin");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted/30">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const isProfileComplete = existingData?.full_name_th && existingData?.phone;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
            {isProfileComplete ? (
              <CheckCircle className="h-8 w-8 text-primary" />
            ) : (
              <User className="h-8 w-8 text-primary" />
            )}
          </div>
          <CardTitle className="text-2xl">
            {isProfileComplete ? "ข้อมูลของคุณครบแล้ว!" : "กรอกข้อมูลให้ครบ"}
          </CardTitle>
          <CardDescription>
            {isProfileComplete 
              ? "คุณสามารถใช้งาน LINE OA ได้แล้ว"
              : "กรุณากรอกข้อมูลเพื่อใช้งาน LINE OA ได้"
            }
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullNameTh" className="flex items-center gap-2">
                <User className="h-4 w-4" />
                ชื่อ-นามสกุล (ภาษาไทย) <span className="text-destructive">*</span>
              </Label>
              <Input
                id="fullNameTh"
                value={fullNameTh}
                onChange={(e) => setFullNameTh(e.target.value)}
                placeholder="สมชาย ใจดี"
                required
                data-testid="input-fullname"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone" className="flex items-center gap-2">
                <Phone className="h-4 w-4" />
                เบอร์โทรศัพท์ <span className="text-destructive">*</span>
              </Label>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0812345678"
                required
                data-testid="input-phone"
              />
              <p className="text-xs text-muted-foreground">
                ใช้สำหรับเชื่อมต่อกับ LINE OA
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="position" className="flex items-center gap-2">
                <Briefcase className="h-4 w-4" />
                ตำแหน่ง <span className="text-muted-foreground text-xs">(ไม่บังคับ)</span>
              </Label>
              <Input
                id="position"
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                placeholder="CEO, Manager, ..."
                data-testid="input-position"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="company" className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                บริษัท/องค์กร <span className="text-muted-foreground text-xs">(ไม่บังคับ)</span>
              </Label>
              <Input
                id="company"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="บริษัท ABC จำกัด"
                data-testid="input-company"
              />
            </div>

            <div className="pt-4 space-y-3">
              <Button 
                type="submit" 
                className="w-full" 
                size="lg"
                disabled={saving}
                data-testid="button-save-profile"
              >
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {saving ? "กำลังบันทึก..." : "บันทึกและเข้าสู่ระบบ"}
              </Button>
              
              {!isProfileComplete && (
                <Button 
                  type="button"
                  variant="ghost" 
                  className="w-full"
                  onClick={handleSkip}
                  disabled={saving}
                  data-testid="button-skip"
                >
                  ข้ามไปก่อน (ใช้ LINE OA ไม่ได้)
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
