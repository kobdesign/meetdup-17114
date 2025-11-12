import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, CheckCircle, ArrowLeft, DollarSign } from "lucide-react";

export default function PaymentPage() {
  const { participantId } = useParams<{ participantId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [participant, setParticipant] = useState<any>(null);
  const [tenantSettings, setTenantSettings] = useState<any>(null);
  const [paymentComplete, setPaymentComplete] = useState(false);

  useEffect(() => {
    loadParticipantData();
  }, [participantId]);

  const loadParticipantData = async () => {
    try {
      if (!participantId) return;

      const { data: participantData, error: participantError } = await supabase
        .from("participants")
        .select(`
          *,
          tenants:tenant_id (
            name,
            slug
          )
        `)
        .eq("participant_id", participantId)
        .single();

      if (participantError) throw participantError;
      setParticipant(participantData);

      // Get tenant settings for QR code
      const { data: settingsData, error: settingsError } = await supabase
        .from("tenant_settings")
        .select("payment_qr_payload, default_visitor_fee, currency")
        .eq("tenant_id", participantData.tenant_id)
        .single();

      if (settingsError) throw settingsError;
      setTenantSettings(settingsData);
    } catch (error: any) {
      toast.error("ไม่พบข้อมูล");
    } finally {
      setLoading(false);
    }
  };

  const handleSlipUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !participant) return;

    if (!file.type.startsWith("image/")) {
      toast.error("กรุณาอัปโหลดไฟล์รูปภาพ");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("ขนาดไฟล์ต้องไม่เกิน 5MB");
      return;
    }

    setUploading(true);

    try {
      // Create payment record first
      const { data: payment, error: paymentError } = await supabase
        .from("payments")
        .insert([{
          tenant_id: participant.tenant_id,
          participant_id: participant.participant_id,
          amount: tenantSettings?.default_visitor_fee || 650,
          currency: tenantSettings?.currency || "THB",
          method: "transfer",
          status: "pending",
        }])
        .select()
        .single();

      if (paymentError) throw paymentError;

      // Upload slip to storage
      const fileExt = file.name.split(".").pop();
      const fileName = `${payment.payment_id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("payment-slips")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("payment-slips")
        .getPublicUrl(fileName);

      // Update payment with slip URL
      const { error: updateError } = await supabase
        .from("payments")
        .update({ slip_url: publicUrl })
        .eq("payment_id", payment.payment_id);

      if (updateError) throw updateError;

      // Update participant status
      await supabase
        .from("participants")
        .update({ 
          status: "visitor_paid",
          payment_status: "pending"
        })
        .eq("participant_id", participant.participant_id);

      toast.success("อัปโหลดสลิปสำเร็จ! รอการตรวจสอบ");
      setPaymentComplete(true);
    } catch (error: any) {
      toast.error("เกิดข้อผิดพลาด: " + error.message);
    } finally {
      setUploading(false);
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

  if (!participant || !tenantSettings) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold">ไม่พบข้อมูล</h1>
          <p className="text-muted-foreground">กรุณาตรวจสอบลิงก์และลองอีกครั้ง</p>
        </div>
      </div>
    );
  }

  if (paymentComplete) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-4">
            <div className="flex justify-center">
              <div className="p-4 bg-green-100 rounded-full">
                <CheckCircle className="h-16 w-16 text-green-600" />
              </div>
            </div>
            <h1 className="text-2xl font-bold">อัปโหลดสลิปสำเร็จ!</h1>
            <p className="text-muted-foreground">
              เราได้รับสลิปการโอนของคุณแล้ว<br />
              จะติดต่อกลับหลังตรวจสอบ
            </p>
            <Button
              onClick={() => navigate(`/chapter/${participant.tenants?.slug}`)}
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
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background to-muted">
      <Card className="max-w-2xl w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-6 w-6" />
            ชำระค่าเข้าร่วมประชุม
          </CardTitle>
          <CardDescription>
            {participant.tenants?.name}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Amount */}
          <div className="p-6 bg-primary/5 rounded-lg border-2 border-primary/20">
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-2">จำนวนเงิน</p>
              <p className="text-4xl font-bold text-primary">
                {(tenantSettings.default_visitor_fee || 650).toLocaleString()} {tenantSettings.currency || "THB"}
              </p>
            </div>
          </div>

          {/* QR Code */}
          {tenantSettings.payment_qr_payload ? (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">สแกน QR Code เพื่อโอนเงิน</h3>
                <div className="flex justify-center p-6 bg-white rounded-lg border">
                  <img
                    src={tenantSettings.payment_qr_payload}
                    alt="Payment QR Code"
                    className="max-w-[300px] w-full"
                  />
                </div>
              </div>

              {/* Upload Slip */}
              <div className="space-y-2">
                <Label htmlFor="slip-upload" className="text-base font-semibold">
                  อัปโหลดสลิปการโอนเงิน
                </Label>
                <p className="text-sm text-muted-foreground mb-3">
                  หลังจากโอนเงินแล้ว กรุณาถ่ายภาพสลิปและอัปโหลดด้านล่าง
                </p>
                <input
                  type="file"
                  id="slip-upload"
                  accept="image/*"
                  onChange={handleSlipUpload}
                  className="hidden"
                  disabled={uploading}
                />
                <Button
                  onClick={() => document.getElementById("slip-upload")?.click()}
                  disabled={uploading}
                  className="w-full"
                  size="lg"
                >
                  <Upload className="mr-2 h-5 w-5" />
                  {uploading ? "กำลังอัปโหลด..." : "อัปโหลดสลิป"}
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  รองรับไฟล์ JPG, PNG (ไม่เกิน 5MB)
                </p>
              </div>
            </div>
          ) : (
            <div className="p-6 bg-yellow-50 rounded-lg border border-yellow-200">
              <p className="text-center text-sm text-yellow-800">
                ⚠️ Chapter ยังไม่ได้ตั้งค่า QR Code สำหรับรับเงิน<br />
                กรุณาติดต่อผู้ดูแลระบบ
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
