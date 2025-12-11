import { useEffect, useState, useRef } from "react";
import AdminLayout from "@/components/layout/AdminLayout";
import { useTenantContext } from "@/contexts/TenantContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/StatusBadge";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Search, Pencil, Trash2, CheckCircle2, XCircle, Globe, Instagram, Facebook, MessageCircle, MapPin, Linkedin, AlertCircle, Users, Phone, Upload, Loader2, FileImage, X, Building2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import ImageCropper from "@/components/ImageCropper";
import imageCompression from "browser-image-compression";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import SelectTenantPrompt from "@/components/SelectTenantPrompt";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { MemberSearchSelect } from "@/components/MemberSearchSelect";
import { Separator } from "@/components/ui/separator";
import TagInput from "@/components/TagInput";
import BusinessTypeSelector from "@/components/BusinessTypeSelector";
import { useBusinessCategories } from "@/hooks/useBusinessCategories";

export default function Participants() {
  const { effectiveTenantId, isSuperAdmin } = useTenantContext();
  const { getCategoryLabel } = useBusinessCategories();
  const [participants, setParticipants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [adding, setAdding] = useState(false);
  
  const [newParticipant, setNewParticipant] = useState({
    full_name_th: "",
    full_name_en: "",
    nickname_th: "",
    nickname_en: "",
    email: "",
    phone: "",
    company: "",
    position: "",
    tagline: "",
    business_type: "",
    business_type_code: null as string | null,
    goal: "",
    status: "member" as const,
    notes: "",
    website_url: "",
    facebook_url: "",
    instagram_url: "",
    linkedin_url: "",
    line_id: "",
    business_address: "",
    tags: [] as string[],
    referral_origin: "member" as "member" | "central" | "external",
    referred_by_participant_id: null as string | null,
  });
  
  const [members, setMembers] = useState<any[]>([]);

  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingParticipant, setEditingParticipant] = useState<any | null>(null);
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Image upload states
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadingOnepage, setUploadingOnepage] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [cropperOpen, setCropperOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const onepageInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!effectiveTenantId) {
      setLoading(false);
      return;
    }
    fetchParticipants();
    fetchMembers();
  }, [effectiveTenantId]);

  const fetchMembers = async () => {
    if (!effectiveTenantId) return;
    try {
      const { data, error } = await supabase
        .from("participants")
        .select("participant_id, full_name_th, nickname_th")
        .eq("tenant_id", effectiveTenantId)
        .in("status", ["member", "alumni"])
        .order("full_name_th");
      if (error) throw error;
      setMembers(data || []);
    } catch (error) {
      console.error("Failed to fetch members for referrer list:", error);
    }
  };

  const fetchParticipants = async () => {
    if (!effectiveTenantId) return;

    try {
      const { data, error } = await supabase
        .from("participants")
        .select("*")
        .eq("tenant_id", effectiveTenantId)
        .eq("status", "member")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setParticipants(data || []);
    } catch (error: any) {
      toast.error("Failed to load participants");
    } finally {
      setLoading(false);
    }
  };

  // Photo upload handlers
  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error("กรุณาเลือกไฟล์รูปภาพ");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error("ไฟล์ต้องมีขนาดไม่เกิน 10MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setSelectedImage(reader.result as string);
      setCropperOpen(true);
    };
    reader.readAsDataURL(file);
    
    if (photoInputRef.current) {
      photoInputRef.current.value = "";
    }
  };

  const handleCroppedImage = async (croppedBlob: Blob) => {
    if (!editingParticipant) return;
    
    try {
      setUploadingPhoto(true);

      const options = {
        maxSizeMB: 1,
        maxWidthOrHeight: 800,
        useWebWorker: true
      };
      
      const file = new File([croppedBlob], "avatar.jpg", { type: "image/jpeg" });
      const compressedFile = await imageCompression(file, options);
      
      const fileName = `${editingParticipant.participant_id}-${Date.now()}.jpg`;
      const filePath = `profiles/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, compressedFile, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      setEditingParticipant(prev => prev ? { ...prev, photo_url: publicUrl } : prev);
      toast.success("อัปโหลดรูปโปรไฟล์สำเร็จ");
      
    } catch (error: any) {
      console.error('Error uploading photo:', error);
      toast.error(error.message || "ไม่สามารถอัปโหลดรูปภาพได้");
    } finally {
      setUploadingPhoto(false);
      setCropperOpen(false);
      setSelectedImage(null);
    }
  };

  const handleOnepageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!editingParticipant) return;
    
    try {
      const file = e.target.files?.[0];
      if (!file) return;

      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
      if (!allowedTypes.includes(file.type)) {
        toast.error("กรุณาเลือกไฟล์รูปภาพหรือ PDF");
        return;
      }

      if (file.size > 10 * 1024 * 1024) {
        toast.error("ไฟล์ต้องมีขนาดไม่เกิน 10MB");
        return;
      }

      setUploadingOnepage(true);

      let uploadFile: File | Blob = file;
      
      if (file.type.startsWith('image/')) {
        const options = {
          maxSizeMB: 2,
          maxWidthOrHeight: 2000,
          useWebWorker: true
        };
        uploadFile = await imageCompression(file, options);
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `${editingParticipant.participant_id}-onepage-${Date.now()}.${fileExt}`;
      const filePath = `onepages/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, uploadFile, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      setEditingParticipant(prev => prev ? { ...prev, onepage_url: publicUrl } : prev);
      toast.success("อัปโหลด One Page สำเร็จ");
      
    } catch (error: any) {
      console.error('Error uploading onepage:', error);
      toast.error(error.message || "ไม่สามารถอัปโหลดไฟล์ได้");
    } finally {
      setUploadingOnepage(false);
      if (onepageInputRef.current) {
        onepageInputRef.current.value = "";
      }
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!editingParticipant) return;
    
    try {
      const file = e.target.files?.[0];
      if (!file) return;

      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
      if (!allowedTypes.includes(file.type)) {
        toast.error("กรุณาเลือกไฟล์รูปภาพ (JPG, PNG, WEBP, SVG)");
        return;
      }

      if (file.size > 2 * 1024 * 1024) {
        toast.error("ไฟล์ต้องมีขนาดไม่เกิน 2MB");
        return;
      }

      setUploadingLogo(true);

      let uploadFile: File | Blob = file;
      
      if (file.type.startsWith('image/') && file.type !== 'image/svg+xml') {
        const options = {
          maxSizeMB: 0.5,
          maxWidthOrHeight: 500,
          useWebWorker: true
        };
        uploadFile = await imageCompression(file, options);
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `${editingParticipant.participant_id}-logo-${Date.now()}.${fileExt}`;
      const filePath = `logos/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, uploadFile, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      setEditingParticipant(prev => prev ? { ...prev, company_logo_url: publicUrl } : prev);
      toast.success("อัปโหลดโลโก้บริษัทสำเร็จ");
      
    } catch (error: any) {
      console.error('Error uploading logo:', error);
      toast.error(error.message || "ไม่สามารถอัปโหลดโลโก้ได้");
    } finally {
      setUploadingLogo(false);
      if (logoInputRef.current) {
        logoInputRef.current.value = "";
      }
    }
  };

  const getInitials = (name: string | null) => {
    if (!name) return "?";
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const handleAddParticipant = async () => {
    if (!newParticipant.full_name_th) {
      toast.error("กรุณากรอกชื่อ-นามสกุล (ไทย)");
      return;
    }

    if (!newParticipant.phone) {
      toast.error("กรุณากรอกเบอร์โทรศัพท์");
      return;
    }

    if (newParticipant.referral_origin === "member") {
      if (members.length === 0) {
        toast.error("ไม่มีสมาชิกในระบบ กรุณาเปลี่ยนแหล่งที่มาหรือเพิ่มสมาชิกก่อน");
        return;
      }
      if (!newParticipant.referred_by_participant_id) {
        toast.error("กรุณาเลือกผู้แนะนำ");
        return;
      }
    }

    if (!effectiveTenantId) {
      toast.error(isSuperAdmin 
        ? "กรุณาเลือก Chapter ที่ต้องการจัดการก่อน" 
        : "ไม่พบข้อมูล Tenant"
      );
      return;
    }

    setAdding(true);
    try {
      const { error } = await supabase
        .from("participants")
        .insert({
          tenant_id: effectiveTenantId,
          full_name_th: newParticipant.full_name_th,
          full_name_en: newParticipant.full_name_en || null,
          nickname_th: newParticipant.nickname_th || null,
          nickname_en: newParticipant.nickname_en || null,
          email: newParticipant.email || null,
          phone: newParticipant.phone || null,
          company: newParticipant.company || null,
          position: newParticipant.position || null,
          tagline: newParticipant.tagline || null,
          business_type: newParticipant.business_type || null,
          business_type_code: newParticipant.business_type_code || null,
          goal: newParticipant.goal || null,
          status: newParticipant.status,
          notes: newParticipant.notes || null,
          website_url: newParticipant.website_url || null,
          facebook_url: newParticipant.facebook_url || null,
          instagram_url: newParticipant.instagram_url || null,
          linkedin_url: newParticipant.linkedin_url || null,
          line_id: newParticipant.line_id || null,
          business_address: newParticipant.business_address || null,
          tags: newParticipant.tags.length > 0 ? newParticipant.tags : null,
          referral_origin: newParticipant.referral_origin,
          referred_by_participant_id: newParticipant.referral_origin === "member" ? newParticipant.referred_by_participant_id : null,
        });

      if (error) throw error;

      toast.success("เพิ่มสมาชิกสำเร็จ");
      setShowAddDialog(false);
      setNewParticipant({
        full_name_th: "",
        full_name_en: "",
        nickname_th: "",
        nickname_en: "",
        email: "",
        phone: "",
        company: "",
        position: "",
        tagline: "",
        business_type: "",
        business_type_code: null,
        goal: "",
        status: "member",
        notes: "",
        website_url: "",
        facebook_url: "",
        instagram_url: "",
        linkedin_url: "",
        line_id: "",
        business_address: "",
        tags: [],
        referral_origin: "member",
        referred_by_participant_id: null,
      });
      fetchParticipants();
      fetchMembers();
    } catch (error: any) {
      toast.error("เกิดข้อผิดพลาด: " + error.message);
    } finally {
      setAdding(false);
    }
  };

  const startEditParticipant = (participant: any) => {
    setEditingParticipant(participant);
    setShowEditDialog(true);
  };

  const handleUpdateParticipant = async () => {
    if (!editingParticipant?.full_name_th && !editingParticipant?.full_name) {
      toast.error("กรุณากรอกชื่อ-นามสกุล (ไทย)");
      return;
    }

    if (!editingParticipant?.phone) {
      toast.error("กรุณากรอกเบอร์โทรศัพท์");
      return;
    }

    if (editingParticipant?.referral_origin === "member") {
      const availableMembers = members.filter(m => m.participant_id !== editingParticipant.participant_id);
      if (availableMembers.length === 0) {
        toast.error("ไม่มีสมาชิกคนอื่นในระบบ กรุณาเปลี่ยนแหล่งที่มาหรือเพิ่มสมาชิกก่อน");
        return;
      }
      if (!editingParticipant?.referred_by_participant_id) {
        toast.error("กรุณาเลือกผู้แนะนำ");
        return;
      }
    }

    setUpdating(true);
    try {
      const { error } = await supabase
        .from("participants")
        .update({
          full_name_th: editingParticipant.full_name_th || editingParticipant.full_name || null,
          full_name_en: editingParticipant.full_name_en || null,
          nickname_th: editingParticipant.nickname_th || null,
          nickname_en: editingParticipant.nickname_en || null,
          email: editingParticipant.email || null,
          phone: editingParticipant.phone || null,
          company: editingParticipant.company || null,
          position: editingParticipant.position || null,
          tagline: editingParticipant.tagline || null,
          business_type: editingParticipant.business_type || null,
          business_type_code: editingParticipant.business_type_code || null,
          goal: editingParticipant.goal || null,
          status: editingParticipant.status,
          notes: editingParticipant.notes || null,
          website_url: editingParticipant.website_url || null,
          facebook_url: editingParticipant.facebook_url || null,
          instagram_url: editingParticipant.instagram_url || null,
          linkedin_url: editingParticipant.linkedin_url || null,
          line_id: editingParticipant.line_id || null,
          business_address: editingParticipant.business_address || null,
          tags: editingParticipant.tags?.length > 0 ? editingParticipant.tags : null,
          referral_origin: editingParticipant.referral_origin || "member",
          referred_by_participant_id: editingParticipant.referral_origin === "member" ? editingParticipant.referred_by_participant_id : null,
          photo_url: editingParticipant.photo_url || null,
          onepage_url: editingParticipant.onepage_url || null,
          company_logo_url: editingParticipant.company_logo_url || null,
        })
        .eq("participant_id", editingParticipant.participant_id);

      if (error) throw error;

      toast.success("แก้ไขข้อมูลสำเร็จ");
      setShowEditDialog(false);
      setEditingParticipant(null);
      fetchParticipants();
      fetchMembers();
    } catch (error: any) {
      toast.error("เกิดข้อผิดพลาด: " + error.message);
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteParticipant = async (participantId: string) => {
    setDeleting(true);
    try {
      // Get session for auth header
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("กรุณาเข้าสู่ระบบใหม่");
        return;
      }

      // Call API endpoint to delete participant (handles all cleanup)
      const response = await fetch(`/api/participants/${participantId}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${session.access_token}`,
          "Content-Type": "application/json"
        }
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to delete participant");
      }

      toast.success("ลบสมาชิกสำเร็จ");
      fetchParticipants();
    } catch (error: any) {
      toast.error("เกิดข้อผิดพลาด: " + error.message);
    } finally {
      setDeleting(false);
    }
  };

  const filteredParticipants = participants.filter((p) => {
    const displayName = (p.full_name_th || p.full_name || "").toLowerCase();
    return displayName.includes(searchTerm.toLowerCase()) ||
      p.company?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.email?.toLowerCase().includes(searchTerm.toLowerCase());
  });

  if (!effectiveTenantId && isSuperAdmin) {
    return (
      <AdminLayout>
        <SelectTenantPrompt />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">สมาชิก</h1>
            <p className="text-muted-foreground">จัดการสมาชิกที่ Active</p>
          </div>
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                เพิ่มสมาชิก
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>เพิ่มสมาชิกใหม่</DialogTitle>
                <DialogDescription>
                  กรอกข้อมูลสมาชิกหรือผู้สนใจ
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                {/* Thai Name Section */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground">ข้อมูลชื่อ (ไทย)</Label>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="full_name_th">ชื่อ-นามสกุล (ไทย) *</Label>
                      <Input
                        id="full_name_th"
                        value={newParticipant.full_name_th}
                        onChange={(e) => setNewParticipant({ ...newParticipant, full_name_th: e.target.value })}
                        placeholder="สมชาย ใจดี"
                        data-testid="input-add-fullname-th"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="nickname_th">ชื่อเล่น (ไทย)</Label>
                      <Input
                        id="nickname_th"
                        value={newParticipant.nickname_th}
                        onChange={(e) => setNewParticipant({ ...newParticipant, nickname_th: e.target.value })}
                        placeholder="ชาย"
                        data-testid="input-add-nickname-th"
                      />
                    </div>
                  </div>
                </div>

                {/* English Name Section */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground">ข้อมูลชื่อ (อังกฤษ) - Optional</Label>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="full_name_en">ชื่อ-นามสกุล (อังกฤษ)</Label>
                      <Input
                        id="full_name_en"
                        value={newParticipant.full_name_en}
                        onChange={(e) => setNewParticipant({ ...newParticipant, full_name_en: e.target.value })}
                        placeholder="Somchai Jaidee"
                        data-testid="input-add-fullname-en"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="nickname_en">ชื่อเล่น (อังกฤษ)</Label>
                      <Input
                        id="nickname_en"
                        value={newParticipant.nickname_en}
                        onChange={(e) => setNewParticipant({ ...newParticipant, nickname_en: e.target.value })}
                        placeholder="Chai"
                        data-testid="input-add-nickname-en"
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Referral Section */}
                <div className="space-y-4 p-4 border rounded-md bg-muted/30">
                  <Label className="flex items-center gap-2 text-sm font-medium">
                    <Users className="h-4 w-4" />
                    แหล่งที่มา / ผู้แนะนำ *
                  </Label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { value: "central", label: "ส่วนกลาง" },
                      { value: "member", label: "สมาชิกแนะนำ" },
                      { value: "external", label: "ภายนอก" },
                    ].map((option) => (
                      <Button
                        key={option.value}
                        type="button"
                        variant={newParticipant.referral_origin === option.value ? "default" : "outline"}
                        size="sm"
                        onClick={() => setNewParticipant({ 
                          ...newParticipant, 
                          referral_origin: option.value as any,
                          referred_by_participant_id: option.value !== "member" ? null : newParticipant.referred_by_participant_id
                        })}
                        data-testid={`button-referral-${option.value}`}
                      >
                        {option.label}
                      </Button>
                    ))}
                  </div>
                  {newParticipant.referral_origin === "member" && (
                    <div className="space-y-2">
                      <Label htmlFor="referred_by">เลือกผู้แนะนำ *</Label>
                      {members.length === 0 ? (
                        <div className="p-3 border rounded-md bg-muted/50 text-sm text-muted-foreground flex items-center gap-2">
                          <AlertCircle className="h-4 w-4" />
                          ยังไม่มีสมาชิกในระบบ กรุณาเพิ่มสมาชิกก่อนเลือกผู้แนะนำ
                        </div>
                      ) : (
                        <MemberSearchSelect
                          members={members}
                          value={newParticipant.referred_by_participant_id || ""}
                          onChange={(value) => setNewParticipant({ ...newParticipant, referred_by_participant_id: value })}
                          placeholder="เลือกสมาชิกที่แนะนำ"
                          data-testid="select-referrer"
                        />
                      )}
                    </div>
                  )}
                </div>

                <Separator />
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="position">ตำแหน่ง</Label>
                    <Input
                      id="position"
                      value={newParticipant.position}
                      onChange={(e) => setNewParticipant({ ...newParticipant, position: e.target.value })}
                      placeholder="CEO, Manager, etc."
                      data-testid="input-add-position"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="company">บริษัท</Label>
                    <Input
                      id="company"
                      value={newParticipant.company}
                      onChange={(e) => setNewParticipant({ ...newParticipant, company: e.target.value })}
                      placeholder="ABC Company Ltd."
                      data-testid="input-add-company"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tagline">Tagline / คำโปรย</Label>
                  <Input
                    id="tagline"
                    value={newParticipant.tagline}
                    onChange={(e) => setNewParticipant({ ...newParticipant, tagline: e.target.value })}
                    placeholder="ผู้เชี่ยวชาญด้านการตลาดดิจิทัล"
                    data-testid="input-add-tagline"
                  />
                </div>

                <Separator />

                {/* Contact Info Section */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone">
                      <Phone className="inline h-4 w-4 mr-2" />
                      เบอร์โทร *
                    </Label>
                    <Input
                      id="phone"
                      value={newParticipant.phone}
                      onChange={(e) => setNewParticipant({ ...newParticipant, phone: e.target.value })}
                      placeholder="081-234-5678"
                      required
                      data-testid="input-add-phone"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">อีเมล</Label>
                    <Input
                      id="email"
                      type="email"
                      value={newParticipant.email}
                      onChange={(e) => setNewParticipant({ ...newParticipant, email: e.target.value })}
                      placeholder="john@example.com"
                      data-testid="input-add-email"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="line_id" className="flex items-center gap-2">
                      <MessageCircle className="h-4 w-4" />
                      LINE ID
                    </Label>
                    <Input
                      id="line_id"
                      value={newParticipant.line_id}
                      onChange={(e) => setNewParticipant({ ...newParticipant, line_id: e.target.value })}
                      placeholder="@lineid"
                      data-testid="input-add-lineid"
                    />
                    {!newParticipant.line_id && (
                      <p className="text-xs text-warning flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        ยังไม่กรอก LINE ID - คนอื่นจะไม่สามารถแชทหาได้
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="linkedin_url" className="flex items-center gap-2">
                      <Linkedin className="h-4 w-4" />
                      LinkedIn URL
                    </Label>
                    <Input
                      id="linkedin_url"
                      value={newParticipant.linkedin_url}
                      onChange={(e) => setNewParticipant({ ...newParticipant, linkedin_url: e.target.value })}
                      placeholder="https://linkedin.com/in/username"
                      data-testid="input-add-linkedin"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="website_url" className="flex items-center gap-2">
                      <Globe className="h-4 w-4" />
                      Website
                    </Label>
                    <Input
                      id="website_url"
                      value={newParticipant.website_url}
                      onChange={(e) => setNewParticipant({ ...newParticipant, website_url: e.target.value })}
                      placeholder="https://example.com"
                      data-testid="input-add-website"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="facebook_url" className="flex items-center gap-2">
                      <Facebook className="h-4 w-4" />
                      Facebook URL
                    </Label>
                    <Input
                      id="facebook_url"
                      value={newParticipant.facebook_url}
                      onChange={(e) => setNewParticipant({ ...newParticipant, facebook_url: e.target.value })}
                      placeholder="https://facebook.com/username"
                      data-testid="input-add-facebook"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="instagram_url" className="flex items-center gap-2">
                    <Instagram className="h-4 w-4" />
                    Instagram URL
                  </Label>
                  <Input
                    id="instagram_url"
                    value={newParticipant.instagram_url}
                    onChange={(e) => setNewParticipant({ ...newParticipant, instagram_url: e.target.value })}
                    placeholder="https://instagram.com/username"
                    data-testid="input-add-instagram"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="business_address" className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    ที่อยู่ธุรกิจ
                  </Label>
                  <Textarea
                    id="business_address"
                    value={newParticipant.business_address}
                    onChange={(e) => setNewParticipant({ ...newParticipant, business_address: e.target.value })}
                    placeholder="123 ถนนสุขุมวิท, กรุงเทพฯ 10110"
                    rows={2}
                    data-testid="input-add-address"
                  />
                </div>

                <Separator />

                {/* Business Info Section */}
                <BusinessTypeSelector
                  value={newParticipant.business_type_code}
                  onChange={(value) => setNewParticipant({ 
                    ...newParticipant, 
                    business_type_code: value,
                    business_type: value ? getCategoryLabel(value) : ""
                  })}
                />

                <TagInput
                  value={newParticipant.tags}
                  onChange={(tags) => setNewParticipant({ ...newParticipant, tags })}
                  placeholder="พิมพ์แล้วกด Enter เช่น Marketing, Finance"
                />

                <Separator />

                {/* Status Section */}
                <div className="space-y-2">
                  <Label htmlFor="status">สถานะ</Label>
                  <Select
                    value={newParticipant.status}
                    onValueChange={(value: any) => setNewParticipant({ ...newParticipant, status: value })}
                  >
                    <SelectTrigger data-testid="select-add-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="prospect">ผู้สนใจ</SelectItem>
                      <SelectItem value="visitor">ผู้เยี่ยมชม</SelectItem>
                      <SelectItem value="declined">ไม่สนใจ</SelectItem>
                      <SelectItem value="member">สมาชิก</SelectItem>
                      <SelectItem value="alumni">อดีตสมาชิก</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="goal">เป้าหมาย/ความสนใจ</Label>
                  <Textarea
                    id="goal"
                    value={newParticipant.goal}
                    onChange={(e) => setNewParticipant({ ...newParticipant, goal: e.target.value })}
                    placeholder="ต้องการหาพาร์ทเนอร์ทางธุรกิจ"
                    rows={2}
                    data-testid="input-add-goal"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">หมายเหตุ (Admin เท่านั้น)</Label>
                  <Textarea
                    id="notes"
                    value={newParticipant.notes}
                    onChange={(e) => setNewParticipant({ ...newParticipant, notes: e.target.value })}
                    placeholder="บันทึกเพิ่มเติม..."
                    rows={2}
                    data-testid="input-add-notes"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                  ยกเลิก
                </Button>
                <Button onClick={handleAddParticipant} disabled={adding}>
                  {adding ? "กำลังเพิ่ม..." : "เพิ่มสมาชิก"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Edit Participant Dialog */}
          <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>แก้ไขข้อมูลสมาชิก</DialogTitle>
                <DialogDescription>
                  แก้ไขข้อมูลสมาชิกหรือผู้สนใจ
                </DialogDescription>
              </DialogHeader>
              {editingParticipant && (
                <div className="grid gap-4 py-4">
                  {/* Photo Upload Section */}
                  <div className="space-y-4 p-4 border rounded-md bg-muted/30">
                    <Label className="text-sm font-medium text-muted-foreground">รูปภาพ</Label>
                    
                    {/* Profile Photo */}
                    <div className="flex items-center gap-4">
                      <Avatar className="h-16 w-16">
                        <AvatarImage src={editingParticipant.photo_url || ""} />
                        <AvatarFallback className="text-lg">
                          {getInitials(editingParticipant.full_name_th || editingParticipant.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="space-y-2">
                        <input
                          ref={photoInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handlePhotoSelect}
                          className="hidden"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => photoInputRef.current?.click()}
                          disabled={uploadingPhoto}
                          data-testid="button-upload-photo"
                        >
                          {uploadingPhoto ? (
                            <><Loader2 className="mr-2 h-4 w-4 animate-spin" />กำลังอัปโหลด...</>
                          ) : (
                            <><Upload className="mr-2 h-4 w-4" />อัปโหลดรูปโปรไฟล์</>
                          )}
                        </Button>
                        <p className="text-xs text-muted-foreground">รูปโปรไฟล์ (ไม่เกิน 10MB)</p>
                      </div>
                    </div>

                    <Separator />

                    {/* One Page Upload */}
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <FileImage className="h-4 w-4" />
                        รูป One Page
                      </Label>
                      <div className="flex items-center gap-4">
                        {editingParticipant.onepage_url && (
                          <a 
                            href={editingParticipant.onepage_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-sm text-primary hover:underline flex items-center gap-1"
                          >
                            <FileImage className="h-4 w-4" />
                            ดูไฟล์ปัจจุบัน
                          </a>
                        )}
                        <input
                          ref={onepageInputRef}
                          type="file"
                          accept="image/*,.pdf"
                          onChange={handleOnepageUpload}
                          className="hidden"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => onepageInputRef.current?.click()}
                          disabled={uploadingOnepage}
                          data-testid="button-upload-onepage"
                        >
                          {uploadingOnepage ? (
                            <><Loader2 className="mr-2 h-4 w-4 animate-spin" />กำลังอัปโหลด...</>
                          ) : (
                            <><Upload className="mr-2 h-4 w-4" />{editingParticipant.onepage_url ? "เปลี่ยนไฟล์" : "อัปโหลด"}</>
                          )}
                        </Button>
                        {editingParticipant.onepage_url && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingParticipant({ ...editingParticipant, onepage_url: null })}
                            data-testid="button-remove-onepage"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">รูปภาพหรือ PDF (ไม่เกิน 10MB)</p>
                    </div>

                    <Separator />

                    {/* Company Logo Upload */}
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <Building2 className="h-4 w-4" />
                        โลโก้บริษัท
                      </Label>
                      <div className="flex items-center gap-4">
                        {editingParticipant.company_logo_url && (
                          <img 
                            src={editingParticipant.company_logo_url} 
                            alt="Company Logo" 
                            className="h-12 w-12 object-contain border rounded"
                          />
                        )}
                        <input
                          ref={logoInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleLogoUpload}
                          className="hidden"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => logoInputRef.current?.click()}
                          disabled={uploadingLogo}
                          data-testid="button-upload-logo"
                        >
                          {uploadingLogo ? (
                            <><Loader2 className="mr-2 h-4 w-4 animate-spin" />กำลังอัปโหลด...</>
                          ) : (
                            <><Upload className="mr-2 h-4 w-4" />{editingParticipant.company_logo_url ? "เปลี่ยนโลโก้" : "อัปโหลด"}</>
                          )}
                        </Button>
                        {editingParticipant.company_logo_url && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingParticipant({ ...editingParticipant, company_logo_url: null })}
                            data-testid="button-remove-logo"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">รูปภาพ JPG, PNG, WEBP, SVG (ไม่เกิน 2MB)</p>
                    </div>
                  </div>

                  <Separator />

                  {/* Thai Name Section */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-muted-foreground">ข้อมูลชื่อ (ไทย)</Label>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="edit_full_name_th">ชื่อ-นามสกุล (ไทย) *</Label>
                        <Input
                          id="edit_full_name_th"
                          value={editingParticipant.full_name_th || editingParticipant.full_name || ""}
                          onChange={(e) => setEditingParticipant({ ...editingParticipant, full_name_th: e.target.value })}
                          placeholder="สมชาย ใจดี"
                          data-testid="input-edit-fullname-th"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="edit_nickname_th">ชื่อเล่น (ไทย)</Label>
                        <Input
                          id="edit_nickname_th"
                          value={editingParticipant.nickname_th || ""}
                          onChange={(e) => setEditingParticipant({ ...editingParticipant, nickname_th: e.target.value })}
                          placeholder="ชาย"
                          data-testid="input-edit-nickname-th"
                        />
                      </div>
                    </div>
                  </div>

                  {/* English Name Section */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-muted-foreground">ข้อมูลชื่อ (อังกฤษ) - Optional</Label>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="edit_full_name_en">ชื่อ-นามสกุล (อังกฤษ)</Label>
                        <Input
                          id="edit_full_name_en"
                          value={editingParticipant.full_name_en || ""}
                          onChange={(e) => setEditingParticipant({ ...editingParticipant, full_name_en: e.target.value })}
                          placeholder="Somchai Jaidee"
                          data-testid="input-edit-fullname-en"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="edit_nickname_en">ชื่อเล่น (อังกฤษ)</Label>
                        <Input
                          id="edit_nickname_en"
                          value={editingParticipant.nickname_en || ""}
                          onChange={(e) => setEditingParticipant({ ...editingParticipant, nickname_en: e.target.value })}
                          placeholder="Chai"
                          data-testid="input-edit-nickname-en"
                        />
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Referral Section */}
                  <div className="space-y-4 p-4 border rounded-md bg-muted/30">
                    <Label className="flex items-center gap-2 text-sm font-medium">
                      <Users className="h-4 w-4" />
                      แหล่งที่มา / ผู้แนะนำ *
                    </Label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { value: "central", label: "ส่วนกลาง" },
                        { value: "member", label: "สมาชิกแนะนำ" },
                        { value: "external", label: "ภายนอก" },
                      ].map((option) => (
                        <Button
                          key={option.value}
                          type="button"
                          variant={(editingParticipant.referral_origin || "member") === option.value ? "default" : "outline"}
                          size="sm"
                          onClick={() => setEditingParticipant({ 
                            ...editingParticipant, 
                            referral_origin: option.value,
                            referred_by_participant_id: option.value !== "member" ? null : editingParticipant.referred_by_participant_id
                          })}
                          data-testid={`button-edit-referral-${option.value}`}
                        >
                          {option.label}
                        </Button>
                      ))}
                    </div>
                    {((editingParticipant.referral_origin || "member") === "member") && (
                      <div className="space-y-2">
                        <Label htmlFor="edit_referred_by">เลือกผู้แนะนำ *</Label>
                        {members.filter(m => m.participant_id !== editingParticipant.participant_id).length === 0 ? (
                          <div className="p-3 border rounded-md bg-muted/50 text-sm text-muted-foreground flex items-center gap-2">
                            <AlertCircle className="h-4 w-4" />
                            ยังไม่มีสมาชิกคนอื่นในระบบ กรุณาเพิ่มสมาชิกก่อนเลือกผู้แนะนำ
                          </div>
                        ) : (
                          <MemberSearchSelect
                            members={members.filter(m => m.participant_id !== editingParticipant.participant_id)}
                            value={editingParticipant.referred_by_participant_id || ""}
                            onChange={(value) => setEditingParticipant({ ...editingParticipant, referred_by_participant_id: value })}
                            placeholder="เลือกสมาชิกที่แนะนำ"
                            data-testid="select-edit-referrer"
                          />
                        )}
                      </div>
                    )}
                  </div>

                  <Separator />
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit_position">ตำแหน่ง</Label>
                      <Input
                        id="edit_position"
                        value={editingParticipant.position || ""}
                        onChange={(e) => setEditingParticipant({ ...editingParticipant, position: e.target.value })}
                        placeholder="CEO, Manager, etc."
                        data-testid="input-edit-position"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit_company">บริษัท</Label>
                      <Input
                        id="edit_company"
                        value={editingParticipant.company || ""}
                        onChange={(e) => setEditingParticipant({ ...editingParticipant, company: e.target.value })}
                        placeholder="ABC Company Ltd."
                        data-testid="input-edit-company"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit_tagline">Tagline / คำโปรย</Label>
                    <Input
                      id="edit_tagline"
                      value={editingParticipant.tagline || ""}
                      onChange={(e) => setEditingParticipant({ ...editingParticipant, tagline: e.target.value })}
                      placeholder="ผู้เชี่ยวชาญด้านการตลาดดิจิทัล"
                      data-testid="input-edit-tagline"
                    />
                  </div>

                  <Separator />

                  {/* Contact Info Section */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit_phone">
                        <Phone className="inline h-4 w-4 mr-2" />
                        เบอร์โทร *
                      </Label>
                      <Input
                        id="edit_phone"
                        value={editingParticipant.phone || ""}
                        onChange={(e) => setEditingParticipant({ ...editingParticipant, phone: e.target.value })}
                        placeholder="081-234-5678"
                        required
                        data-testid="input-edit-phone"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit_email">อีเมล</Label>
                      <Input
                        id="edit_email"
                        type="email"
                        value={editingParticipant.email || ""}
                        onChange={(e) => setEditingParticipant({ ...editingParticipant, email: e.target.value })}
                        placeholder="john@example.com"
                        data-testid="input-edit-email"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit_line_id" className="flex items-center gap-2">
                        <MessageCircle className="h-4 w-4" />
                        LINE ID
                      </Label>
                      <Input
                        id="edit_line_id"
                        value={editingParticipant.line_id || ""}
                        onChange={(e) => setEditingParticipant({ ...editingParticipant, line_id: e.target.value })}
                        placeholder="@lineid"
                        data-testid="input-edit-lineid"
                      />
                      {!editingParticipant.line_id && (
                        <p className="text-xs text-warning flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          ยังไม่กรอก LINE ID - คนอื่นจะไม่สามารถแชทหาได้
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit_linkedin_url" className="flex items-center gap-2">
                        <Linkedin className="h-4 w-4" />
                        LinkedIn URL
                      </Label>
                      <Input
                        id="edit_linkedin_url"
                        value={editingParticipant.linkedin_url || ""}
                        onChange={(e) => setEditingParticipant({ ...editingParticipant, linkedin_url: e.target.value })}
                        placeholder="https://linkedin.com/in/username"
                        data-testid="input-edit-linkedin"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit_website_url" className="flex items-center gap-2">
                        <Globe className="h-4 w-4" />
                        Website
                      </Label>
                      <Input
                        id="edit_website_url"
                        value={editingParticipant.website_url || ""}
                        onChange={(e) => setEditingParticipant({ ...editingParticipant, website_url: e.target.value })}
                        placeholder="https://example.com"
                        data-testid="input-edit-website"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit_facebook_url" className="flex items-center gap-2">
                        <Facebook className="h-4 w-4" />
                        Facebook URL
                      </Label>
                      <Input
                        id="edit_facebook_url"
                        value={editingParticipant.facebook_url || ""}
                        onChange={(e) => setEditingParticipant({ ...editingParticipant, facebook_url: e.target.value })}
                        placeholder="https://facebook.com/username"
                        data-testid="input-edit-facebook"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit_instagram_url" className="flex items-center gap-2">
                      <Instagram className="h-4 w-4" />
                      Instagram URL
                    </Label>
                    <Input
                      id="edit_instagram_url"
                      value={editingParticipant.instagram_url || ""}
                      onChange={(e) => setEditingParticipant({ ...editingParticipant, instagram_url: e.target.value })}
                      placeholder="https://instagram.com/username"
                      data-testid="input-edit-instagram"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit_business_address" className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      ที่อยู่ธุรกิจ
                    </Label>
                    <Textarea
                      id="edit_business_address"
                      value={editingParticipant.business_address || ""}
                      onChange={(e) => setEditingParticipant({ ...editingParticipant, business_address: e.target.value })}
                      placeholder="123 ถนนสุขุมวิท, กรุงเทพฯ 10110"
                      rows={2}
                      data-testid="input-edit-address"
                    />
                  </div>

                  <Separator />

                  {/* Business Info Section */}
                  <BusinessTypeSelector
                    value={editingParticipant.business_type_code}
                    onChange={(value) => setEditingParticipant({ 
                      ...editingParticipant, 
                      business_type_code: value,
                      business_type: value ? getCategoryLabel(value) : null
                    })}
                  />

                  <TagInput
                    value={editingParticipant.tags || []}
                    onChange={(tags) => setEditingParticipant({ ...editingParticipant, tags })}
                    placeholder="พิมพ์แล้วกด Enter เช่น Marketing, Finance"
                  />

                  <Separator />

                  {/* Status Section */}
                  <div className="space-y-2">
                    <Label htmlFor="edit_status">สถานะ</Label>
                    <Select
                      value={editingParticipant.status}
                      onValueChange={(value: any) => setEditingParticipant({ ...editingParticipant, status: value })}
                    >
                      <SelectTrigger data-testid="select-edit-status">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="prospect">ผู้สนใจ</SelectItem>
                        <SelectItem value="visitor">ผู้เยี่ยมชม</SelectItem>
                        <SelectItem value="declined">ไม่สนใจ</SelectItem>
                        <SelectItem value="member">สมาชิก</SelectItem>
                        <SelectItem value="alumni">อดีตสมาชิก</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit_goal">เป้าหมาย/ความสนใจ</Label>
                    <Textarea
                      id="edit_goal"
                      value={editingParticipant.goal || ""}
                      onChange={(e) => setEditingParticipant({ ...editingParticipant, goal: e.target.value })}
                      placeholder="ต้องการหาพาร์ทเนอร์ทางธุรกิจ"
                      rows={2}
                      data-testid="input-edit-goal"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit_notes">หมายเหตุ (Admin เท่านั้น)</Label>
                    <Textarea
                      id="edit_notes"
                      value={editingParticipant.notes || ""}
                      onChange={(e) => setEditingParticipant({ ...editingParticipant, notes: e.target.value })}
                      placeholder="บันทึกเพิ่มเติม..."
                      rows={2}
                      data-testid="input-edit-notes"
                    />
                  </div>
                </div>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowEditDialog(false)}>
                  ยกเลิก
                </Button>
                <Button onClick={handleUpdateParticipant} disabled={updating}>
                  {updating ? "กำลังบันทึก..." : "บันทึกการแก้ไข"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>All Participants</span>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search participants..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Account</TableHead>
                    <TableHead className="text-right">จัดการ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredParticipants.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground">
                        No participants found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredParticipants.map((participant) => (
                      <TableRow key={participant.participant_id}>
                        <TableCell className="font-medium">
                          <div>
                            <div>{participant.full_name_th || participant.full_name}</div>
                            {participant.nickname_th && (
                              <div className="text-sm text-muted-foreground">
                                ({participant.nickname_th})
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">{participant.phone || "-"}</div>
                        </TableCell>
                        <TableCell>{participant.company || "-"}</TableCell>
                        <TableCell>{participant.email || "-"}</TableCell>
                        <TableCell>
                          <StatusBadge status={participant.status} />
                        </TableCell>
                        <TableCell>
                          {participant.user_id ? (
                            <Badge variant="outline" className="bg-success/10 text-success border-success/20">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Activated
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20">
                              <XCircle className="h-3 w-3 mr-1" />
                              Not Activated
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => startEditParticipant(participant)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="sm" variant="destructive" disabled={deleting}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>ยืนยันการลบสมาชิก</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    คุณต้องการลบ {participant.full_name_th || participant.full_name} ใช่หรือไม่?
                                    <br />
                                    <span className="text-destructive font-semibold">
                                      การดำเนินการนี้ไม่สามารถย้อนกลับได้
                                    </span>
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDeleteParticipant(participant.participant_id)}
                                    className="bg-destructive hover:bg-destructive/90"
                                  >
                                    ลบ
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Image Cropper Modal */}
      {selectedImage && (
        <ImageCropper
          open={cropperOpen}
          onClose={() => {
            setCropperOpen(false);
            setSelectedImage(null);
          }}
          image={selectedImage}
          onCropComplete={handleCroppedImage}
          aspectRatio={1}
          cropShape="round"
        />
      )}
    </AdminLayout>
  );
}
