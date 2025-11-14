import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface EditTenantDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  tenant: any;
}

export default function EditTenantDialog({ open, onOpenChange, onSuccess, tenant }: EditTenantDialogProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    tenant_name: "",
    subdomain: "",
  });

  useEffect(() => {
    if (tenant) {
      setFormData({
        tenant_name: tenant.tenant_name || "",
        subdomain: tenant.subdomain || "",
      });
    }
  }, [tenant]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase
        .from("tenants")
        .update({
          tenant_name: formData.tenant_name,
          subdomain: formData.subdomain,
        })
        .eq("tenant_id", tenant.tenant_id);

      if (error) throw error;

      toast.success("อัปเดต tenant สำเร็จ");
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast.error("เกิดข้อผิดพลาด: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>แก้ไข Tenant</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="tenant_name">ชื่อ Chapter *</Label>
            <Input
              id="tenant_name"
              value={formData.tenant_name}
              onChange={(e) => setFormData({ ...formData, tenant_name: e.target.value })}
              required
            />
          </div>

          <div>
            <Label htmlFor="subdomain">Subdomain *</Label>
            <Input
              id="subdomain"
              value={formData.subdomain}
              onChange={(e) => setFormData({ ...formData, subdomain: e.target.value.toLowerCase().replace(/\s+/g, "-") })}
              required
            />
            <p className="text-xs text-muted-foreground mt-1">
              ใช้สำหรับ URL และต้องไม่ซ้ำกัน
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              ยกเลิก
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "กำลังบันทึก..." : "บันทึก"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
