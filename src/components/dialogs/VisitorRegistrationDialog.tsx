import { useState, useEffect } from "react";
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
  const [meetings, setMeetings] = useState<any[]>([]);
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | undefined>(meetingId);
  const [selectedMeeting, setSelectedMeeting] = useState<any>(null);
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    phone: "",
    company: "",
    business_type: "",
    goal: "",
    notes: "",
  });

  useEffect(() => {
    if (open) {
      loadUpcomingMeetings();
      if (selectedMeetingId) {
        loadMeetingDetails(selectedMeetingId);
      }
    }
  }, [open, selectedMeetingId]);

  const loadUpcomingMeetings = async () => {
    const today = new Date();
    const threeMonthsLater = new Date();
    threeMonthsLater.setMonth(threeMonthsLater.getMonth() + 3);

    const { data, error } = await supabase
      .from("meetings")
      .select("meeting_id, meeting_date, meeting_time, theme, venue, visitor_fee")
      .eq("tenant_id", tenantId)
      .gte("meeting_date", today.toISOString().split("T")[0])
      .lte("meeting_date", threeMonthsLater.toISOString().split("T")[0])
      .order("meeting_date", { ascending: true });

    if (!error && data) {
      setMeetings(data);
      if (!meetingId && data.length > 0) {
        setSelectedMeetingId(data[0].meeting_id);
      }
    }
  };

  const loadMeetingDetails = async (meetingIdToLoad: string) => {
    const { data, error } = await supabase
      .from("meetings")
      .select("*")
      .eq("meeting_id", meetingIdToLoad)
      .single();

    if (!error && data) {
      setSelectedMeeting(data);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate required fields only (meeting is optional now)
    if (!formData.full_name || !formData.email || !formData.phone) {
      toast.error("กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน");
      return;
    }

    setLoading(true);

    try {
      // Call backend function to register visitor (bypasses RLS)
      const { data, error: functionError } = await supabase.functions.invoke("register-visitor", {
        body: {
          tenant_id: tenantId,
          meeting_id: selectedMeetingId,
          full_name: formData.full_name,
          email: formData.email,
          phone: formData.phone,
          company: formData.company,
          business_type: formData.business_type,
          goal: formData.goal,
          notes: formData.notes,
        },
      });

      if (functionError) throw functionError;

      toast.success("ลงทะเบียนสำเร็จ! กำลังไปยังหน้าชำระเงิน...");
      
      // Redirect to payment page
      if (data?.participant_id) {
        const paymentUrl = `/payment/${data.participant_id}`;
        setTimeout(() => {
          window.location.href = paymentUrl;
        }, 1000);
      } else {
        onOpenChange(false);
      }
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
          {/* Meeting Selection */}
          {!meetingId && (
            <div className="space-y-2">
              <Label htmlFor="meeting">
                เลือกวันที่ประชุมที่ต้องการเข้าร่วม
                {meetings.length === 0 && <span className="text-muted-foreground"> (ทางเลือก)</span>}
              </Label>
              {meetings.length > 0 ? (
                <Select 
                  value={selectedMeetingId} 
                  onValueChange={(value) => {
                    setSelectedMeetingId(value);
                    loadMeetingDetails(value);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="-- เลือกวันประชุม (ถ้ามี) --" />
                  </SelectTrigger>
                  <SelectContent>
                    {meetings.map((meeting) => (
                      <SelectItem key={meeting.meeting_id} value={meeting.meeting_id}>
                        📅 {new Date(meeting.meeting_date).toLocaleDateString('th-TH')}
                        {meeting.meeting_time && ` เวลา ${meeting.meeting_time}`}
                        {meeting.theme && ` - ${meeting.theme}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="text-sm text-muted-foreground bg-accent/50 p-3 rounded border">
                  ℹ️ ขณะนี้ยังไม่มีการประชุมที่เปิดรับสมัคร คุณสามารถลงทะเบียนเป็น prospect ได้
                </div>
              )}
            </div>
          )}

          {/* Meeting Details Display */}
          {selectedMeeting && (
            <div className="bg-accent/50 rounded-lg p-4 space-y-2 border">
              <p className="font-semibold">📋 ข้อมูลการประชุมที่เลือก</p>
              <div className="text-sm space-y-1">
                <p>📅 วันที่: {new Date(selectedMeeting.meeting_date).toLocaleDateString('th-TH')}</p>
                {selectedMeeting.meeting_time && <p>⏰ เวลา: {selectedMeeting.meeting_time}</p>}
                {selectedMeeting.venue && <p>📍 สถานที่: {selectedMeeting.venue}</p>}
                {selectedMeeting.theme && (
                  <p className="truncate max-w-full" title={selectedMeeting.theme}>
                    🎯 หัวข้อ: {selectedMeeting.theme}
                  </p>
                )}
                
                {selectedMeeting.description && (
                  <div className="mt-2 pt-2 border-t">
                    <div 
                      className="prose prose-xs max-w-none prose-p:my-1 prose-headings:my-1 
                                 prose-li:my-0 text-muted-foreground"
                      dangerouslySetInnerHTML={{ __html: selectedMeeting.description }}
                    />
                  </div>
                )}
                
                <p className="font-medium text-primary">💰 ค่าเข้าร่วม: {selectedMeeting.visitor_fee} บาท</p>
              </div>
            </div>
          )}

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
