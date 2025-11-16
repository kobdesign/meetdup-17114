import { useEffect, useState } from "react";
import AdminLayout from "@/components/layout/AdminLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, Download, ExternalLink, Share2 } from "lucide-react";
import QRCode from "react-qr-code";
import { useTenantContext } from "@/contexts/TenantContext";
import SelectTenantPrompt from "@/components/SelectTenantPrompt";

export default function Settings() {
  const { effectiveTenantId, isSuperAdmin } = useTenantContext();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [tenantSlug, setTenantSlug] = useState<string>("");
  const [tenantName, setTenantName] = useState<string>("");
  const [settings, setSettings] = useState({
    logo_url: "",
    branding_color: "#1e40af",
    currency: "THB",
    language: "th",
  });

  useEffect(() => {
    if (effectiveTenantId) {
      loadSettings();
    }
  }, [effectiveTenantId]);

  const loadSettings = async () => {
    if (!effectiveTenantId) {
      setLoading(false);
      return;
    }

    try {
      const { data: tenantData } = await supabase
        .from("tenants")
        .select("subdomain, tenant_name")
        .eq("tenant_id", effectiveTenantId)
        .single();

      if (tenantData) {
        setTenantSlug(tenantData.subdomain);
        setTenantName(tenantData.tenant_name);
      }

      const { data, error } = await supabase
        .from("tenant_settings")
        .select("*")
        .eq("tenant_id", effectiveTenantId)
        .single();

      if (error && error.code !== "PGRST116") throw error;

      if (data) {
        const settingsData = data as any;
        setSettings({
          logo_url: settingsData.logo_url || "",
          branding_color: settingsData.branding_color || "#1e40af",
          currency: settingsData.currency || "THB",
          language: settingsData.language || "th",
        });
      }
    } catch (error: any) {
      toast.error("เกิดข้อผิดพลาดในการโหลดการตั้งค่า");
    } finally {
      setLoading(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !effectiveTenantId) return;

    if (!file.type.startsWith("image/")) {
      toast.error("กรุณาเลือกไฟล์รูปภาพ");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error("ขนาดไฟล์ต้องไม่เกิน 2MB");
      return;
    }

    setUploading(true);

    try {
      if (settings.logo_url) {
        const oldPath = settings.logo_url.split("/").pop();
        if (oldPath) {
          await supabase.storage.from("avatars").remove([`logos/${oldPath}`]);
        }
      }

      const fileExt = file.name.split(".").pop();
      const fileName = `${effectiveTenantId}-${Date.now()}.${fileExt}`;
      const filePath = `logos/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      setSettings({ ...settings, logo_url: publicUrl });
      toast.success("อัปโหลดโลโก้สำเร็จ");
    } catch (error: any) {
      toast.error("เกิดข้อผิดพลาด: " + error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!effectiveTenantId) return;

    setSaving(true);

    try {
      const { error: tenantError } = await supabase
        .from("tenants")
        .update({ tenant_name: tenantName })
        .eq("tenant_id", effectiveTenantId);

      if (tenantError) throw tenantError;

      const { error } = await supabase
        .from("tenant_settings")
        .upsert({
          tenant_id: effectiveTenantId,
          logo_url: settings.logo_url,
          branding_color: settings.branding_color,
          currency: settings.currency,
          language: settings.language,
        });

      if (error) throw error;

      toast.success("บันทึกการตั้งค่าสำเร็จ");
    } catch (error: any) {
      toast.error("เกิดข้อผิดพลาด: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  const downloadQRCode = () => {
    const svg = document.getElementById("chapter-qr-code");
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
      downloadLink.download = `${tenantSlug}-qr-code.png`;
      downloadLink.href = pngFile;
      downloadLink.click();
    };

    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
  };

  const copyProfileLink = () => {
    const profileUrl = `${window.location.origin}/chapter/${tenantSlug}`;
    navigator.clipboard.writeText(profileUrl);
    toast.success("คัดลอกลิงก์แล้ว");
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

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">การตั้งค่า Chapter</h1>
          <p className="text-muted-foreground">จัดการโลโก้ สี และข้อมูลองค์กร</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>การตั้งค่าทั่วไป</CardTitle>
            <CardDescription>ปรับแต่งรูปลักษณ์และการตั้งค่าของ chapter</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <Label htmlFor="tenant_name">ชื่อ Chapter</Label>
              <Input
                id="tenant_name"
                value={tenantName}
                onChange={(e) => setTenantName(e.target.value)}
                placeholder="BNI Bangkok Central"
                className="mt-2"
              />
            </div>

            <div>
              <Label>โลโก้ Chapter</Label>
              <div className="mt-2 flex items-center gap-4">
                {settings.logo_url && (
                  <img
                    src={settings.logo_url}
                    alt="Logo"
                    className="w-20 h-20 rounded-lg object-cover border"
                  />
                )}
                <div>
                  <input
                    type="file"
                    id="logo-upload"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => document.getElementById("logo-upload")?.click()}
                    disabled={uploading}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    {uploading ? "กำลังอัปโหลด..." : "อัปโหลดโลโก้"}
                  </Button>
                  <p className="text-sm text-muted-foreground mt-1">
                    รองรับไฟล์ JPG, PNG (ไม่เกิน 2MB)
                  </p>
                </div>
              </div>
            </div>

            <div>
              <Label htmlFor="branding_color">สีของแบรนด์</Label>
              <div className="flex gap-2 mt-2">
                <Input
                  id="branding_color"
                  type="color"
                  value={settings.branding_color}
                  onChange={(e) => setSettings({ ...settings, branding_color: e.target.value })}
                  className="w-20 h-10"
                />
                <Input
                  type="text"
                  value={settings.branding_color}
                  onChange={(e) => setSettings({ ...settings, branding_color: e.target.value })}
                  placeholder="#1e40af"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="language">ภาษา</Label>
              <Select
                value={settings.language}
                onValueChange={(value) => setSettings({ ...settings, language: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="th">ไทย</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="currency">สกุลเงิน</Label>
              <Select
                value={settings.currency}
                onValueChange={(value) => setSettings({ ...settings, currency: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="THB">THB (บาท)</SelectItem>
                  <SelectItem value="USD">USD (ดอลลาร์)</SelectItem>
                  <SelectItem value="SGD">SGD (ดอลลาร์สิงคโปร์)</SelectItem>
                  <SelectItem value="MYR">MYR (ริงกิต)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button onClick={handleSave} disabled={saving} data-testid="button-save-settings">
              {saving ? "กำลังบันทึก..." : "บันทึกการตั้งค่า"}
            </Button>
          </CardContent>
        </Card>

        {/* QR Code Card */}
        {tenantSlug && (
          <Card>
            <CardHeader>
              <CardTitle>QR Code สำหรับ Public Profile</CardTitle>
              <CardDescription>
                แชร์ QR code นี้เพื่อให้ผู้สนใจสแกนและเข้าถึงหน้า public profile ของ chapter
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col md:flex-row gap-6 items-start">
                <div className="flex-shrink-0">
                  <div className="p-4 bg-white rounded-lg border inline-block">
                    <QRCode
                      id="chapter-qr-code"
                      value={`${window.location.origin}/chapter/${tenantSlug}`}
                      size={200}
                      level="H"
                    />
                  </div>
                </div>
                <div className="flex-1 space-y-4">
                  <div>
                    <Label>URL ของ Public Profile</Label>
                    <div className="flex gap-2 mt-2">
                      <Input
                        value={`${window.location.origin}/chapter/${tenantSlug}`}
                        readOnly
                        className="font-mono text-sm"
                      />
                      <Button variant="outline" size="icon" onClick={copyProfileLink}>
                        <Share2 className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="icon" asChild>
                        <a href={`/chapter/${tenantSlug}`} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={downloadQRCode} variant="outline">
                      <Download className="mr-2 h-4 w-4" />
                      ดาวน์โหลด QR Code
                    </Button>
                  </div>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p>💡 วิธีใช้งาน QR Code:</p>
                    <ul className="list-disc list-inside space-y-1 ml-2">
                      <li>ดาวน์โหลดและพิมพ์ติดที่สถานที่ประชุม</li>
                      <li>แชร์ในโซเชียลมีเดียหรือเอกสารประชาสัมพันธ์</li>
                      <li>ใส่ใน name card หรือเอกสารทางธุรกิจ</li>
                    </ul>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
}
