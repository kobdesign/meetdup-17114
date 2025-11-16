import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
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
  const [allowChangeMeeting, setAllowChangeMeeting] = useState(false);
  const [members, setMembers] = useState<any[]>([]);
  const [selectedReferrer, setSelectedReferrer] = useState<string>("");
  const [referrerSearchOpen, setReferrerSearchOpen] = useState(false);
  
  // 2-step form state
  const [step, setStep] = useState<"phone" | "form">("phone");
  const [existingParticipant, setExistingParticipant] = useState<any>(null);
  const [lookingUp, setLookingUp] = useState(false);
  
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    phone: "",
    company: "",
    business_type: "",
    goal: "",
    notes: "",
  });

  // Sync meetingId prop to state when dialog opens
  useEffect(() => {
    if (open && meetingId) {
      setSelectedMeetingId(meetingId);
    }
  }, [open, meetingId]);

  // Load data when dialog opens
  useEffect(() => {
    if (open && tenantId) {
      setLoading(true);
      
      const loadData = async () => {
        if (meetingId) {
          // If meetingId is pre-selected, load only its details
          await loadMeetingDetails(meetingId);
        } else {
          // If no meetingId, load list of upcoming meetings
          await loadUpcomingMeetings();
        }
        setLoading(false);
      };
      
      loadData();
    } else if (!open) {
      // Reset when dialog closes
      setStep("phone");
      setExistingParticipant(null);
      setSelectedMeetingId(undefined);
      setSelectedMeeting(null);
      setMeetings([]);
      setMembers([]);
      setSelectedReferrer("");
      setAllowChangeMeeting(false);
      setFormData({
        full_name: "",
        email: "",
        phone: "",
        company: "",
        business_type: "",
        goal: "",
        notes: "",
      });
    }
  }, [open, tenantId, meetingId]);

  // Load members when selectedMeetingId changes
  useEffect(() => {
    if (open && selectedMeetingId) {
      loadMembers();
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
      // Auto-select first meeting and load its details if no meetingId was pre-selected
      if (!meetingId && data.length > 0) {
        setSelectedMeetingId(data[0].meeting_id);
        await loadMeetingDetails(data[0].meeting_id);
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

  const loadMembers = async () => {
    try {
      // Only load members if meeting is selected (security requirement)
      if (!selectedMeetingId) {
        console.log("[loadMembers] No meeting selected, skipping members load");
        return;
      }

      const response = await fetch(
        `/api/participants/members-for-referral?meeting_id=${selectedMeetingId}`
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

    if (!selectedMeetingId) {
      toast.error("กรุณาเลือกการประชุมก่อน");
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
          meeting_id: selectedMeetingId,
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
        toast.success("พบข้อมูลผู้เข้าร่วมแล้ว! กรุณาตรวจสอบและแก้ไข");
      } else {
        // New participant
        console.log("New participant - no existing data");
        setExistingParticipant(null);
        toast.info("ผู้เข้าร่วมใหม่ กรุณากรอกข้อมูลเพื่อลงทะเบียน");
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

    // Validate required fields only (meeting is optional now)
    if (!formData.full_name || !formData.email || !formData.phone) {
      toast.error("กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน");
      return;
    }

    setLoading(true);

    try {
      const payload: any = {
        meeting_id: selectedMeetingId,
        full_name: formData.full_name,
        email: formData.email,
        phone: formData.phone,
        company: formData.company,
        business_type: formData.business_type,
        goal: formData.goal,
        notes: formData.notes,
        referred_by_participant_id: selectedReferrer || null,
      };

      // If updating existing participant, include participant_id
      if (existingParticipant?.participant_id) {
        payload.participant_id = existingParticipant.participant_id;
        console.log("UPDATE mode - participant_id:", payload.participant_id);
      } else {
        console.log("INSERT mode - new participant");
      }

      // Call Express API to register visitor (bypasses RLS)
      const response = await fetch("/api/participants/register-visitor", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      toast.success("ลงทะเบียนสำเร็จ! ยินดีต้อนรับสู่ชุมชน BNI");
      
      // Close dialog after successful registration
      setTimeout(() => {
        onOpenChange(false);
      }, 1000);
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
          <DialogTitle>
            {step === "phone" ? "ลงทะเบียนผู้เยี่ยมชม" : existingParticipant ? "ตรวจสอบและแก้ไขข้อมูล" : "ลงทะเบียนผู้เยี่ยมชม"}
          </DialogTitle>
          <DialogDescription>
            {step === "phone"
              ? "กรอกเบอร์โทรศัพท์เพื่อตรวจสอบข้อมูล"
              : existingParticipant
                ? "พบข้อมูลแล้ว กรุณาตรวจสอบและแก้ไข (ถ้าจำเป็น)"
                : "กรอกข้อมูลเพื่อลงทะเบียนเข้าร่วมการประชุม"
            }
          </DialogDescription>
        </DialogHeader>
        
        {/* Step 1: Phone Lookup */}
        {step === "phone" && (
          <form onSubmit={handlePhoneLookup} className="space-y-4">
          {/* Meeting Selection - Show dropdown if no meetingId OR user wants to change */}
          {(!meetingId || allowChangeMeeting) && (
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

          {/* Meeting Details Display - Show when meeting is selected */}
          {selectedMeeting && (
            <div className="bg-accent/50 rounded-lg p-4 space-y-2 border">
              <div className="flex justify-between items-start">
                <p className="font-semibold">📋 ข้อมูลการประชุมที่เลือก</p>
                {meetingId && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={async () => {
                      setAllowChangeMeeting(true);
                      if (meetings.length === 0) {
                        setLoading(true);
                        await loadUpcomingMeetings();
                        setLoading(false);
                      }
                    }}
                    className="text-xs h-7"
                  >
                    🔄 เปลี่ยนการประชุม
                  </Button>
                )}
              </div>
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

          {/* Phone Input for Lookup */}
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
              ระบบจะตรวจสอบว่าเคยลงทะเบียนหรือไม่
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              ยกเลิก
            </Button>
            <Button type="submit" disabled={lookingUp}>
              {lookingUp ? "กำลังค้นหา..." : "ถัดไป"}
            </Button>
          </DialogFooter>
        </form>
        )}

        {/* Step 2: Full Registration Form */}
        {step === "form" && (
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
            <Button type="button" variant="outline" onClick={() => setStep("phone")}>
              ← กลับไปแก้ไขเบอร์
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "กำลังบันทึก..." : existingParticipant ? "บันทึกข้อมูล" : "ลงทะเบียน"}
            </Button>
          </DialogFooter>
        </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
