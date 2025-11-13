import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface AddTenantDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export default function AddTenantDialog({ open, onOpenChange, onSuccess }: AddTenantDialogProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    country: "TH",
    timezone: "Asia/Bangkok",
    language: "th",
    currency: "THB",
    defaultVisitorFee: "650",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validate slug format
      const slugRegex = /^[a-z0-9-]+$/;
      if (!slugRegex.test(formData.slug)) {
        toast.error("Slug ต้องเป็นตัวอักษรภาษาอังกฤษพิมพ์เล็ก ตัวเลข และขีดกลางเท่านั้น");
        return;
      }

      // Create tenant
      const { data: tenant, error: tenantError } = await supabase
        .from("tenants")
        .insert({
          name: formData.name,
          slug: formData.slug,
          country: formData.country,
          timezone: formData.timezone,
          status: "active",
        })
        .select()
        .single();

      if (tenantError) throw tenantError;

      // Create tenant settings
      const { error: settingsError } = await supabase
        .from("tenant_settings")
        .insert({
          tenant_id: tenant.tenant_id,
          language: formData.language,
          currency: formData.currency,
          default_visitor_fee: parseFloat(formData.defaultVisitorFee),
          require_visitor_payment: true,
        });

      if (settingsError) throw settingsError;

      toast.success("สร้าง tenant สำเร็จ");
      onSuccess();
      onOpenChange(false);
      
      // Reset form
      setFormData({
        name: "",
        slug: "",
        country: "TH",
        timezone: "Asia/Bangkok",
        language: "th",
        currency: "THB",
        defaultVisitorFee: "650",
      });
    } catch (error: any) {
      console.error('Error creating tenant:', error);
      if (error.code === '23505') {
        toast.error("Slug นี้ถูกใช้งานแล้ว กรุณาเลือก slug อื่น");
      } else {
        toast.error(error.message || "ไม่สามารถสร้าง tenant ได้");
      }
    } finally {
      setLoading(false);
    }
  };

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  const handleNameChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      name: value,
      slug: generateSlug(value),
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>เพิ่ม Tenant ใหม่</DialogTitle>
          <DialogDescription>
            สร้าง BNI Chapter ใหม่พร้อมตั้งค่าเริ่มต้น
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">ชื่อ Chapter *</Label>
              <Input
                id="name"
                placeholder="BNI Bangkok Central"
                value={formData.name}
                onChange={(e) => handleNameChange(e.target.value)}
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="slug">Slug *</Label>
              <Input
                id="slug"
                placeholder="bni-bangkok-central"
                value={formData.slug}
                onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value }))}
                required
              />
              <p className="text-xs text-muted-foreground">
                ใช้สำหรับ URL และต้องไม่ซ้ำกัน (เช่น bni-bangkok-central)
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="country">ประเทศ</Label>
                <Select
                  value={formData.country}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, country: value }))}
                >
                  <SelectTrigger id="country">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TH">ประเทศไทย</SelectItem>
                    <SelectItem value="SG">สิงคโปร์</SelectItem>
                    <SelectItem value="MY">มาเลเซีย</SelectItem>
                    <SelectItem value="ID">อินโดนีเซีย</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="timezone">เขตเวลา</Label>
                <Select
                  value={formData.timezone}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, timezone: value }))}
                >
                  <SelectTrigger id="timezone">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Asia/Bangkok">Asia/Bangkok</SelectItem>
                    <SelectItem value="Asia/Singapore">Asia/Singapore</SelectItem>
                    <SelectItem value="Asia/Kuala_Lumpur">Asia/Kuala_Lumpur</SelectItem>
                    <SelectItem value="Asia/Jakarta">Asia/Jakarta</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="language">ภาษา</Label>
                <Select
                  value={formData.language}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, language: value }))}
                >
                  <SelectTrigger id="language">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="th">ไทย</SelectItem>
                    <SelectItem value="en">English</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="currency">สกุลเงิน</Label>
                <Select
                  value={formData.currency}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, currency: value }))}
                >
                  <SelectTrigger id="currency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="THB">THB (บาท)</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="SGD">SGD</SelectItem>
                    <SelectItem value="MYR">MYR</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="visitorFee">ค่าเข้าชมเริ่มต้น</Label>
              <Input
                id="visitorFee"
                type="number"
                min="0"
                step="0.01"
                value={formData.defaultVisitorFee}
                onChange={(e) => setFormData(prev => ({ ...prev, defaultVisitorFee: e.target.value }))}
                required
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              ยกเลิก
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              สร้าง Tenant
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
