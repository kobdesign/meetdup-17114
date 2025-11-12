import { useEffect, useState } from "react";
import AdminLayout from "@/components/layout/AdminLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload } from "lucide-react";

export default function Settings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [settings, setSettings] = useState({
    logo_url: "",
    branding_color: "#1e40af",
    currency: "THB",
    language: "th",
    default_visitor_fee: 650,
    require_visitor_payment: true,
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userRole } = await supabase
        .from("user_roles")
        .select("tenant_id")
        .eq("user_id", user.id)
        .single();

      if (!userRole?.tenant_id) {
        toast.error("ไม่พบข้อมูล tenant");
        return;
      }

      setTenantId(userRole.tenant_id);

      const { data, error } = await supabase
        .from("tenant_settings")
        .select("*")
        .eq("tenant_id", userRole.tenant_id)
        .single();

      if (error && error.code !== "PGRST116") throw error;

      if (data) {
        setSettings({
          logo_url: data.logo_url || "",
          branding_color: data.branding_color || "#1e40af",
          currency: data.currency || "THB",
          language: data.language || "th",
          default_visitor_fee: data.default_visitor_fee || 650,
          require_visitor_payment: data.require_visitor_payment ?? true,
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
    if (!file || !tenantId) return;

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
      const fileName = `${tenantId}-${Date.now()}.${fileExt}`;
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
    if (!tenantId) return;

    setSaving(true);

    try {
      const { error } = await supabase
        .from("tenant_settings")
        .upsert({
          tenant_id: tenantId,
          logo_url: settings.logo_url,
          branding_color: settings.branding_color,
          currency: settings.currency,
          language: settings.language,
          default_visitor_fee: settings.default_visitor_fee,
          require_visitor_payment: settings.require_visitor_payment,
        });

      if (error) throw error;

      toast.success("บันทึกการตั้งค่าสำเร็จ");
    } catch (error: any) {
      toast.error("เกิดข้อผิดพลาด: " + error.message);
    } finally {
      setSaving(false);
    }
  };

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

            <div>
              <Label htmlFor="default_visitor_fee">ค่าเข้าชมผู้เยี่ยมชม (ค่าเริ่มต้น)</Label>
              <Input
                id="default_visitor_fee"
                type="number"
                value={settings.default_visitor_fee}
                onChange={(e) => setSettings({ ...settings, default_visitor_fee: parseFloat(e.target.value) })}
                min="0"
                step="50"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="require_visitor_payment"
                checked={settings.require_visitor_payment}
                onChange={(e) => setSettings({ ...settings, require_visitor_payment: e.target.checked })}
                className="w-4 h-4"
              />
              <Label htmlFor="require_visitor_payment" className="cursor-pointer">
                บังคับให้ผู้เยี่ยมชมชำระเงิน
              </Label>
            </div>

            <Button onClick={handleSave} disabled={saving}>
              {saving ? "กำลังบันทึก..." : "บันทึกการตั้งค่า"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
