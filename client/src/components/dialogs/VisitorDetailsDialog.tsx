import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { StatusBadge } from "@/components/StatusBadge";
import { Mail, Phone, Building2, Briefcase, UserCircle, Calendar, Edit2, Save, X, Check, ChevronsUpDown } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useTenantContext } from "@/contexts/TenantContext";
import { cn } from "@/lib/utils";

interface VisitorDetailsDialogProps {
  visitor: any | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: (participantId?: string) => void | Promise<void>;
}

export function VisitorDetailsDialog({ visitor, open, onOpenChange, onUpdate }: VisitorDetailsDialogProps) {
  const { selectedTenant } = useTenantContext();
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [members, setMembers] = useState<Array<{ participant_id: string; full_name_th: string; nickname: string | null }>>([]);
  const [referrerSearchOpen, setReferrerSearchOpen] = useState(false);
  const [formData, setFormData] = useState({
    full_name_th: "",
    email: "",
    phone: "",
    company: "",
    business_type: "",
    status: "prospect",
    referred_by_participant_id: "",
  });

  // Reset edit mode when dialog closes or visitor changes
  useEffect(() => {
    if (!open) {
      setIsEditMode(false);
    }
  }, [open]);

  // Fetch members list for referrer dropdown
  useEffect(() => {
    async function fetchMembers() {
      if (!selectedTenant?.tenant_id) return;

      const { data, error } = await supabase
        .from("participants")
        .select("participant_id, full_name_th, nickname")
        .eq("tenant_id", selectedTenant.tenant_id)
        .eq("status", "member")
        .order("nickname", { ascending: true, nullsFirst: false })
        .order("full_name_th", { ascending: true });

      if (!error && data) {
        setMembers(data);
      }
    }

    if (open) {
      fetchMembers();
    }
  }, [open, selectedTenant?.tenant_id]);

  // Initialize form when visitor changes
  useEffect(() => {
    if (visitor) {
      setFormData({
        full_name_th: visitor.full_name_th || visitor.full_name || "",
        email: visitor.email || "",
        phone: visitor.phone || "",
        company: visitor.company || "",
        business_type: visitor.business_type || "",
        status: visitor.status || "prospect",
        referred_by_participant_id: visitor.referred_by_participant_id || "",
      });
      // Reset to view mode when visitor changes
      setIsEditMode(false);
    }
  }, [visitor]);

  const handleEdit = () => {
    setFormData({
      full_name_th: visitor.full_name_th || visitor.full_name || "",
      email: visitor.email || "",
      phone: visitor.phone || "",
      company: visitor.company || "",
      business_type: visitor.business_type || "",
      status: visitor.status || "prospect",
      referred_by_participant_id: visitor.referred_by_participant_id || "",
    });
    setIsEditMode(true);
  };

  const handleCancel = () => {
    setIsEditMode(false);
    setFormData({
      full_name_th: visitor.full_name_th || visitor.full_name || "",
      email: visitor.email || "",
      phone: visitor.phone || "",
      company: visitor.company || "",
      business_type: visitor.business_type || "",
      status: visitor.status || "prospect",
      referred_by_participant_id: visitor.referred_by_participant_id || "",
    });
  };

  const handleSave = async () => {
    if (!visitor) return;

    setIsSaving(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        toast.error("กรุณาเข้าสู่ระบบ");
        return;
      }

      const response = await fetch(`/api/participants/${visitor.participant_id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.session.access_token}`,
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update participant");
      }

      const result = await response.json();
      toast.success("อัปเดตข้อมูลสำเร็จ");
      setIsEditMode(false);
      
      // Pass participant ID back to parent to fetch fresh data
      await onUpdate(visitor.participant_id);
    } catch (error: any) {
      console.error("Error updating participant:", error);
      toast.error(error.message || "เกิดข้อผิดพลาดในการอัปเดตข้อมูล");
    } finally {
      setIsSaving(false);
    }
  };

  if (!visitor) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between gap-4">
            <DialogTitle className="text-xl">
              {isEditMode ? "แก้ไขข้อมูล" : "รายละเอียด"} Visitor
            </DialogTitle>
            {!isEditMode && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleEdit}
                data-testid="button-edit-visitor"
              >
                <Edit2 className="w-4 h-4 mr-2" />
                แก้ไข
              </Button>
            )}
          </div>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Status Badge */}
          <div className="flex items-center gap-2">
            <Label>สถานะ:</Label>
            {isEditMode ? (
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value })}
              >
                <SelectTrigger className="w-40" data-testid="select-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="prospect">Prospect</SelectItem>
                  <SelectItem value="visitor">Visitor</SelectItem>
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="declined">Declined</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <StatusBadge status={visitor.status} />
            )}
          </div>

          {/* Personal Info */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <UserCircle className="w-4 h-4" />
              ข้อมูลส่วนตัว
            </div>
            
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="full_name_th">ชื่อ-นามสกุล *</Label>
                {isEditMode ? (
                  <Input
                    id="full_name_th"
                    value={formData.full_name_th}
                    onChange={(e) => setFormData({ ...formData, full_name_th: e.target.value })}
                    data-testid="input-full-name"
                  />
                ) : (
                  <div className="flex items-center gap-2">
                    <UserCircle className="w-4 h-4 text-muted-foreground" />
                    <span>{visitor.full_name_th || visitor.full_name || "-"}</span>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">เบอร์โทรศัพท์ *</Label>
                {isEditMode ? (
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    data-testid="input-phone"
                    disabled
                    className="bg-muted"
                  />
                ) : (
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    <span>{visitor.phone || "-"}</span>
                  </div>
                )}
                {isEditMode && (
                  <p className="text-xs text-muted-foreground">
                    เบอร์โทรศัพท์ไม่สามารถแก้ไขได้
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">อีเมล</Label>
                {isEditMode ? (
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    data-testid="input-email"
                  />
                ) : (
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <span>{visitor.email || "-"}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Business Info */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Building2 className="w-4 h-4" />
              ข้อมูลธุรกิจ
            </div>

            <div className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="company">บริษัท/ธุรกิจ</Label>
                {isEditMode ? (
                  <Input
                    id="company"
                    value={formData.company}
                    onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                    data-testid="input-company"
                  />
                ) : (
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-muted-foreground" />
                    <span>{visitor.company || "-"}</span>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="business_type">ประเภทธุรกิจ</Label>
                {isEditMode ? (
                  <Input
                    id="business_type"
                    value={formData.business_type}
                    onChange={(e) => setFormData({ ...formData, business_type: e.target.value })}
                    data-testid="input-business-type"
                  />
                ) : (
                  <div className="flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-muted-foreground" />
                    <span>{visitor.business_type || "-"}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Referrer Selection (Edit Mode Only) */}
          {isEditMode && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="referrer">แนะนำโดย (ชื่อเล่นสมาชิก)</Label>
                <Popover open={referrerSearchOpen} onOpenChange={setReferrerSearchOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={referrerSearchOpen}
                      className="w-full justify-between"
                      data-testid="button-select-referrer"
                    >
                      {formData.referred_by_participant_id
                        ? members.find((m) => m.participant_id === formData.referred_by_participant_id)?.nickname ||
                          members.find((m) => m.participant_id === formData.referred_by_participant_id)?.full_name_th ||
                          members.find((m) => m.participant_id === formData.referred_by_participant_id)?.full_name ||
                          "เลือกผู้แนะนำ"
                        : "เลือกผู้แนะนำ (ไม่บังคับ)"}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0">
                    <Command>
                      <CommandInput placeholder="ค้นหาชื่อเล่น..." />
                      <CommandList>
                        <CommandEmpty>ไม่พบสมาชิก</CommandEmpty>
                        <CommandGroup>
                          <CommandItem
                            value="none"
                            onSelect={() => {
                              setFormData({ ...formData, referred_by_participant_id: "" });
                              setReferrerSearchOpen(false);
                            }}
                            data-testid="option-referrer-none"
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                !formData.referred_by_participant_id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            ไม่มีผู้แนะนำ
                          </CommandItem>
                          {members.map((member) => (
                            <CommandItem
                              key={member.participant_id}
                              value={`${member.nickname || member.full_name_th} ${member.participant_id}`}
                              onSelect={() => {
                                setFormData({ ...formData, referred_by_participant_id: member.participant_id });
                                setReferrerSearchOpen(false);
                              }}
                              data-testid={`option-referrer-${member.participant_id}`}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  formData.referred_by_participant_id === member.participant_id ? "opacity-100" : "opacity-0"
                                )}
                              />
                              {member.nickname ? (
                                <span>
                                  {member.nickname} <span className="text-muted-foreground">({member.full_name_th})</span>
                                </span>
                              ) : (
                                <span>{member.full_name_th}</span>
                              )}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          )}

          {/* Additional Info (View Mode Only) */}
          {!isEditMode && (
            <div className="space-y-4 pt-4 border-t">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <Label className="text-muted-foreground">Check-ins</Label>
                  <div className="font-medium">{visitor.checkins_count || 0} ครั้ง</div>
                </div>
                <div>
                  <Label className="text-muted-foreground">วันประชุมถัดไป</Label>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium">
                      {visitor.upcoming_meeting_date
                        ? new Date(visitor.upcoming_meeting_date).toLocaleDateString("th-TH")
                        : "-"}
                    </span>
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground">แนะนำโดย</Label>
                  <div className="font-medium">{visitor.referred_by_name || "-"}</div>
                </div>
                <div>
                  <Label className="text-muted-foreground">วันที่สร้าง</Label>
                  <div className="font-medium">
                    {visitor.created_at
                      ? new Date(visitor.created_at).toLocaleDateString("th-TH")
                      : "-"}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          {isEditMode ? (
            <div className="flex gap-2 w-full justify-end">
              <Button
                variant="outline"
                onClick={handleCancel}
                disabled={isSaving}
                data-testid="button-cancel"
              >
                <X className="w-4 h-4 mr-2" />
                ยกเลิก
              </Button>
              <Button
                onClick={handleSave}
                disabled={isSaving || !formData.full_name_th || !formData.phone}
                data-testid="button-save"
              >
                <Save className="w-4 h-4 mr-2" />
                {isSaving ? "กำลังบันทึก..." : "บันทึก"}
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              data-testid="button-close"
            >
              ปิด
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
