import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface VisitorRegistrationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  meetingId?: string;
}

export default function VisitorRegistrationDialog({ 
  open, 
  onOpenChange, 
  tenantId,
  meetingId 
}: VisitorRegistrationDialogProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    phone: "",
    company: "",
    business_type: "",
    goal: "",
    notes: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validate required fields
      if (!formData.full_name || !formData.email || !formData.phone) {
        toast.error("กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน");
        return;
      }

      // Create visitor participant
      const { data: participant, error: participantError } = await supabase
        .from("participants")
        .insert({
          tenant_id: tenantId,
          full_name: formData.full_name,
          email: formData.email,
          phone: formData.phone,
          company: formData.company,
          business_type: formData.business_type,
          goal: formData.goal,
          notes: formData.notes,
          status: "visitor_pending_payment",
        })
        .select()
        .single();

      if (participantError) throw participantError;

      // If a specific meeting is selected, create check-in record
      if (meetingId && participant) {
        const { error: checkinError } = await supabase
          .from("checkins")
          .insert({
            tenant_id: tenantId,
            meeting_id: meetingId,
            participant_id: participant.participant_id,
            source: "manual",
          });

        if (checkinError) throw checkinError;
      }

      toast.success("ลงทะเบียนสำเร็จ! เราจะติดต่อกลับโดยเร็วที่สุด");
      
      // Show payment link
      if (participant) {
        const paymentUrl = `${window.location.origin}/payment/${participant.participant_id}`;
        toast.info(
          "กรุณาชำระเงินผ่านลิงก์ที่แสดง",
          {
            duration: 10000,
            action: {
              label: "ชำระเงิน",
              onClick: () => window.open(paymentUrl, "_blank")
            }
          }
        );
      }
      
      // Reset form
      setFormData({
        full_name: "",
        email: "",
        phone: "",
        company: "",
        business_type: "",
        goal: "",
        notes: "",
      });
      
      onOpenChange(false);
    } catch (error: any) {
      toast.error("เกิดข้อผิดพลาด: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>ลงทะเบียนผู้เยี่ยมชม</DialogTitle>
          <DialogDescription>
            กรอกข้อมูลเพื่อลงทะเบียนเข้าร่วมการประชุมในฐานะผู้เยี่ยมชม
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
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

          <div>
            <Label htmlFor="company">บริษัท/ชื่อธุรกิจ</Label>
            <Input
              id="company"
              value={formData.company}
              onChange={(e) => setFormData({ ...formData, company: e.target.value })}
              placeholder="ชื่อบริษัทหรือธุรกิจ"
            />
          </div>

          <div>
            <Label htmlFor="business_type">ประเภทธุรกิจ</Label>
            <Input
              id="business_type"
              value={formData.business_type}
              onChange={(e) => setFormData({ ...formData, business_type: e.target.value })}
              placeholder="เช่น ร้านอาหาร, IT, การตลาด"
            />
          </div>

          <div>
            <Label htmlFor="goal">เป้าหมายในการเข้าร่วม BNI</Label>
            <Textarea
              id="goal"
              value={formData.goal}
              onChange={(e) => setFormData({ ...formData, goal: e.target.value })}
              placeholder="บอกเราว่าคุณมีเป้าหมายอย่างไรในการเข้าร่วม BNI"
              rows={3}
            />
          </div>

          <div>
            <Label htmlFor="notes">ข้อความเพิ่มเติม</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="มีอะไรอยากสอบถามเพิ่มเติมหรือไม่"
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              ยกเลิก
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "กำลังลงทะเบียน..." : "ลงทะเบียน"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
