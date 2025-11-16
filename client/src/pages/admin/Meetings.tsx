import { useEffect, useState, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import AdminLayout from "@/components/layout/AdminLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Calendar as CalendarIcon, Pencil, Trash2, Eye as EyeIcon, Repeat, LayoutGrid, List, Info, Check } from "lucide-react";
import { toast } from "sonner";
import MeetingsCalendar from "@/components/MeetingsCalendar";
import RecurrenceSelector from "@/components/RecurrenceSelector";
import { useTenantContext } from "@/contexts/TenantContext";
import SelectTenantPrompt from "@/components/SelectTenantPrompt";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import { uploadMeetingImage } from "@/lib/imageUploadHandler";
import { generateRecurringMeetings } from "@/lib/meetingUtils";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import LocationSearch from "@/components/LocationSearch";

export default function Meetings() {
  const [meetings, setMeetings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [adding, setAdding] = useState(false);
  const { effectiveTenantId, isSuperAdmin } = useTenantContext();
  const [viewMode, setViewMode] = useState<"table" | "calendar">("table");
  const [quillKey, setQuillKey] = useState(0);
  
  const navigate = useNavigate();
  
  // Refs for ReactQuill
  const quillRef = useRef<any>(null);
  const editQuillRef = useRef<any>(null);
  
  // Preview state
  const [showPreview, setShowPreview] = useState(false);
  const [previewContent, setPreviewContent] = useState({
    theme: "",
    description: ""
  });
  
  
  const [newMeeting, setNewMeeting] = useState({
    meeting_date: "",
    meeting_time: "",
    venue: "",
    location_details: "",
    location_lat: "",
    location_lng: "",
    theme: "",
    description: "",
    visitor_fee: 650,
    recurrence_pattern: "none",
    recurrence_interval: 1,
    recurrence_end_date: "",
    recurrence_days_of_week: [] as string[],
    recurrence_end_type: "never" as "never" | "date" | "count",
    recurrence_occurrence_count: 10,
  });

  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState<any | null>(null);
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  
  // Advanced location settings visibility
  const [showAdvancedLocation, setShowAdvancedLocation] = useState(false);
  const [showAdvancedLocationEdit, setShowAdvancedLocationEdit] = useState(false);

  useEffect(() => {
    if (!effectiveTenantId) {
      setLoading(false);
      return;
    }
    fetchMeetings();
  }, [effectiveTenantId]);

  const fetchMeetings = async () => {
    if (!effectiveTenantId) {
      setLoading(false);
      return;
    }
    
    try {
      const { data, error } = await supabase
        .from("meetings")
        .select(`
          *,
          checkins(count)
        `)
        .eq("tenant_id", effectiveTenantId)
        .order("meeting_date", { ascending: false });

      if (error) throw error;
      setMeetings(data || []);
    } catch (error: any) {
      toast.error("Failed to load meetings");
    } finally {
      setLoading(false);
    }
  };

  // Image handler for Add Dialog
  const imageHandler = async () => {
    const input = document.createElement('input');
    input.setAttribute('type', 'file');
    input.setAttribute('accept', 'image/jpeg,image/jpg,image/png,image/gif,image/webp');
    input.click();

    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;

      toast.loading('กำลังอัปโหลดรูปภาพ...', { id: 'image-upload' });

      const result = await uploadMeetingImage(file);

      if (!result.success) {
        toast.error(result.error || 'อัปโหลดล้มเหลว', { id: 'image-upload' });
        return;
      }

      const quill = quillRef.current?.getEditor();
      if (quill) {
        const range = quill.getSelection(true);
        quill.insertEmbed(range.index, 'image', result.url);
        quill.setSelection(range.index + 1);
      }

      toast.success('อัปโหลดรูปภาพสำเร็จ!', { id: 'image-upload' });
    };
  };
  
  // Image handler for Edit Dialog
  const editImageHandler = async () => {
    const input = document.createElement('input');
    input.setAttribute('type', 'file');
    input.setAttribute('accept', 'image/jpeg,image/jpg,image/png,image/gif,image/webp');
    input.click();

    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;

      toast.loading('กำลังอัปโหลดรูปภาพ...', { id: 'image-upload-edit' });

      const result = await uploadMeetingImage(file);

      if (!result.success) {
        toast.error(result.error || 'อัปโหลดล้มเหลว', { id: 'image-upload-edit' });
        return;
      }

      const quill = editQuillRef.current?.getEditor();
      if (quill) {
        const range = quill.getSelection(true);
        quill.insertEmbed(range.index, 'image', result.url);
        quill.setSelection(range.index + 1);
      }

      toast.success('อัปโหลดรูปภาพสำเร็จ!', { id: 'image-upload-edit' });
    };
  };
  
  // Quill modules for Add Dialog
  const quillModules = useMemo(() => ({
    toolbar: {
      container: [
        [{ 'header': [1, 2, 3, false] }],
        ['bold', 'italic', 'underline', 'strike'],
        [{ 'list': 'ordered'}, { 'list': 'bullet' }],
        ['link', 'image', 'blockquote'],
        ['clean']
      ],
      handlers: {
        image: imageHandler
      }
    }
  }), []);
  
  // Quill modules for Edit Dialog
  const editQuillModules = useMemo(() => ({
    toolbar: {
      container: [
        [{ 'header': [1, 2, 3, false] }],
        ['bold', 'italic', 'underline', 'strike'],
        [{ 'list': 'ordered'}, { 'list': 'bullet' }],
        ['link', 'image', 'blockquote'],
        ['clean']
      ],
      handlers: {
        image: editImageHandler
      }
    }
  }), [editImageHandler]);
  
  // Preview handler
  const handlePreview = () => {
    setPreviewContent({
      theme: newMeeting.theme,
      description: newMeeting.description
    });
    setShowPreview(true);
  };
  

  const handleAddMeeting = async () => {
    if (!newMeeting.meeting_date) {
      toast.error("กรุณาเลือกวันที่ประชุม");
      return;
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
      // Insert parent meeting
      const { data: insertedMeeting, error: insertError } = await supabase
        .from("meetings")
        .insert({
          tenant_id: effectiveTenantId,
          meeting_name: newMeeting.theme || "การประชุม",
          meeting_date: newMeeting.meeting_date,
          meeting_time: newMeeting.meeting_time || null,
          venue: newMeeting.venue || null,
          location_details: newMeeting.location_details || null,
          location_lat: newMeeting.location_lat ? parseFloat(newMeeting.location_lat) : null,
          location_lng: newMeeting.location_lng ? parseFloat(newMeeting.location_lng) : null,
          theme: newMeeting.theme || null,
          description: newMeeting.description || null,
          visitor_fee: newMeeting.visitor_fee,
          recurrence_pattern: newMeeting.recurrence_pattern,
          recurrence_interval: newMeeting.recurrence_interval,
          recurrence_end_date: newMeeting.recurrence_end_date || null,
          recurrence_days_of_week: newMeeting.recurrence_days_of_week.length > 0 ? newMeeting.recurrence_days_of_week : null,
          parent_meeting_id: null,
        })
        .select()
        .single();

      if (insertError) throw insertError;
      if (!insertedMeeting) throw new Error("Failed to create meeting");

      // If recurring, create instance records
      if (newMeeting.recurrence_pattern !== "none" && insertedMeeting) {
        const instances = generateRecurringMeetings({
          ...insertedMeeting,
          meeting_date: newMeeting.meeting_date,
          recurrence_pattern: newMeeting.recurrence_pattern,
          recurrence_interval: newMeeting.recurrence_interval,
          recurrence_end_date: newMeeting.recurrence_end_date,
          recurrence_days_of_week: newMeeting.recurrence_days_of_week,
          recurrence_end_type: newMeeting.recurrence_end_type,
          recurrence_occurrence_count: newMeeting.recurrence_occurrence_count,
        });

        if (instances.length > 0) {
          const instancesToInsert = instances.map(instance => ({
            tenant_id: effectiveTenantId,
            meeting_name: newMeeting.theme || "การประชุม",
            meeting_date: instance.instance_date,
            meeting_time: newMeeting.meeting_time || null,
            venue: newMeeting.venue || null,
            location_details: newMeeting.location_details || null,
            location_lat: newMeeting.location_lat ? parseFloat(newMeeting.location_lat) : null,
            location_lng: newMeeting.location_lng ? parseFloat(newMeeting.location_lng) : null,
            theme: newMeeting.theme || null,
            description: newMeeting.description || null,
            visitor_fee: newMeeting.visitor_fee,
            recurrence_pattern: "none",
            recurrence_interval: null,
            recurrence_end_date: null,
            recurrence_days_of_week: null,
            parent_meeting_id: insertedMeeting.meeting_id,
          }));

          const { error: instancesError } = await supabase
            .from("meetings")
            .insert(instancesToInsert);

          if (instancesError) {
            console.error("Error creating recurring instances:", instancesError);
            toast.error("สร้างการประชุมหลักสำเร็จ แต่เกิดข้อผิดพลาดในการสร้างรอบถัดไป");
          } else {
            toast.success(`สร้างการประชุมสำเร็จ (${instances.length + 1} รอบ)`);
          }
        } else {
          toast.success("กำหนดการประชุมสำเร็จ");
        }
      } else {
        toast.success("กำหนดการประชุมสำเร็จ");
      }

      setShowAddDialog(false);
      setShowAdvancedLocation(false);
      setNewMeeting({
        meeting_date: "",
        meeting_time: "",
        venue: "",
        location_details: "",
        location_lat: "",
        location_lng: "",
        theme: "",
        description: "",
        visitor_fee: 650,
        recurrence_pattern: "none",
        recurrence_interval: 1,
        recurrence_end_date: "",
        recurrence_days_of_week: [],
        recurrence_end_type: "never",
        recurrence_occurrence_count: 10,
      });
      fetchMeetings();
    } catch (error: any) {
      toast.error("เกิดข้อผิดพลาด: " + error.message);
    } finally {
      setAdding(false);
    }
  };

  const startEditMeeting = (meeting: any) => {
    // Prevent editing recurrence for child instances
    if (meeting.parent_meeting_id) {
      setEditingMeeting({
        ...meeting,
        recurrence_pattern: "none",
        recurrence_interval: 1,
        recurrence_end_date: "",
        recurrence_days_of_week: [],
        recurrence_end_type: "never",
        recurrence_occurrence_count: 10,
      });
    } else {
      setEditingMeeting(meeting);
    }
    setShowEditDialog(true);
    // Set advanced section visibility based on whether coordinates exist
    setShowAdvancedLocationEdit(!!(meeting.location_lat && meeting.location_lng));
  };

  const handleUpdateMeeting = async () => {
    if (!editingMeeting?.meeting_date) {
      toast.error("กรุณาเลือกวันที่ประชุม");
      return;
    }

    if (!effectiveTenantId) {
      toast.error(isSuperAdmin 
        ? "กรุณาเลือก Chapter ที่ต้องการจัดการก่อน" 
        : "ไม่พบข้อมูล Tenant"
      );
      return;
    }

    setUpdating(true);
    try {
      // Get original meeting to compare recurrence changes
      const { data: originalMeeting } = await supabase
        .from("meetings")
        .select("recurrence_pattern, parent_meeting_id")
        .eq("meeting_id", editingMeeting.meeting_id)
        .single();

      // Handle recurring instances only if this is NOT a child instance
      if (!originalMeeting?.parent_meeting_id) {
        const wasRecurring = originalMeeting?.recurrence_pattern && originalMeeting.recurrence_pattern !== "none";
        const isNowRecurring = editingMeeting.recurrence_pattern && editingMeeting.recurrence_pattern !== "none";

        // Delete existing instances FIRST before updating parent
        if (wasRecurring) {
          const { error: deleteError } = await supabase
            .from("meetings")
            .delete()
            .eq("parent_meeting_id", editingMeeting.meeting_id);

          if (deleteError) {
            toast.error("ไม่สามารถลบการประชุมรอบถัดไปได้ เนื่องจากมีการเช็คอินแล้ว กรุณาลบรายการที่มีการเช็คอินก่อน");
            setUpdating(false);
            return;
          }
        }
      }

      // Update the main meeting record AFTER deleting children
      const { error: updateError } = await supabase
        .from("meetings")
        .update({
          meeting_name: editingMeeting.theme || "การประชุม",
          meeting_date: editingMeeting.meeting_date,
          meeting_time: editingMeeting.meeting_time || null,
          venue: editingMeeting.venue || null,
          location_details: editingMeeting.location_details || null,
          location_lat: editingMeeting.location_lat ? parseFloat(editingMeeting.location_lat) : null,
          location_lng: editingMeeting.location_lng ? parseFloat(editingMeeting.location_lng) : null,
          theme: editingMeeting.theme || null,
          description: editingMeeting.description || null,
          visitor_fee: editingMeeting.visitor_fee,
          recurrence_pattern: editingMeeting.recurrence_pattern,
          recurrence_interval: editingMeeting.recurrence_interval,
          recurrence_end_date: editingMeeting.recurrence_end_date || null,
          recurrence_days_of_week: editingMeeting.recurrence_days_of_week?.length > 0 ? editingMeeting.recurrence_days_of_week : null,
        })
        .eq("meeting_id", editingMeeting.meeting_id);

      if (updateError) throw updateError;

      // Create new instances if now recurring
      if (!originalMeeting?.parent_meeting_id) {
        const isNowRecurring = editingMeeting.recurrence_pattern && editingMeeting.recurrence_pattern !== "none";

        // Create new instances if now recurring
        if (isNowRecurring) {
          const instances = generateRecurringMeetings({
            ...editingMeeting,
            meeting_id: editingMeeting.meeting_id,
            recurrence_end_type: editingMeeting.recurrence_end_type || "never",
            recurrence_occurrence_count: editingMeeting.recurrence_occurrence_count || 10,
          });

          if (instances.length > 0) {
            const instancesToInsert = instances.map(instance => ({
              tenant_id: effectiveTenantId,
              meeting_name: editingMeeting.theme || "การประชุม",
              meeting_date: instance.instance_date,
              meeting_time: editingMeeting.meeting_time || null,
              venue: editingMeeting.venue || null,
              location_details: editingMeeting.location_details || null,
              location_lat: editingMeeting.location_lat ? parseFloat(editingMeeting.location_lat) : null,
              location_lng: editingMeeting.location_lng ? parseFloat(editingMeeting.location_lng) : null,
              theme: editingMeeting.theme || null,
              description: editingMeeting.description || null,
              visitor_fee: editingMeeting.visitor_fee,
              recurrence_pattern: "none",
              recurrence_interval: null,
              recurrence_end_date: null,
              recurrence_days_of_week: null,
              parent_meeting_id: editingMeeting.meeting_id,
            }));

            const { error: instancesError } = await supabase
              .from("meetings")
              .insert(instancesToInsert);

            if (instancesError) {
              console.error("Error creating recurring instances:", instancesError);
              toast.error("แก้ไขการประชุมสำเร็จ แต่เกิดข้อผิดพลาดในการสร้างรอบถัดไป");
            } else {
              toast.success(`แก้ไขการประชุมสำเร็จ (${instances.length + 1} รอบ)`);
            }
          } else {
            toast.success("แก้ไขการประชุมสำเร็จ");
          }
        } else {
          toast.success("แก้ไขการประชุมสำเร็จ");
        }
      } else {
        toast.success("แก้ไขการประชุมสำเร็จ");
      }

      setShowEditDialog(false);
      setShowAdvancedLocationEdit(false);
      setEditingMeeting(null);
      fetchMeetings();
    } catch (error: any) {
      toast.error("เกิดข้อผิดพลาด: " + error.message);
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteMeeting = async (meetingId: string) => {
    setDeleting(true);
    try {
      // Check for dependencies
      const { data: checkins } = await supabase
        .from("checkins")
        .select("checkin_id")
        .eq("meeting_id", meetingId)
        .limit(1);

      if (checkins && checkins.length > 0) {
        toast.error("ไม่สามารถลบได้ เนื่องจากมีประวัติการเช็คอิน");
        return;
      }

      // Delete meeting
      const { error } = await supabase
        .from("meetings")
        .delete()
        .eq("meeting_id", meetingId);

      if (error) throw error;

      toast.success("ลบการประชุมสำเร็จ");
      fetchMeetings();
    } catch (error: any) {
      toast.error("เกิดข้อผิดพลาด: " + error.message);
    } finally {
      setDeleting(false);
    }
  };

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
            <h1 className="text-3xl font-bold">Meetings</h1>
            <p className="text-muted-foreground">Schedule and track chapter meetings</p>
          </div>
          <div className="flex gap-2">
            <div className="flex gap-1 border rounded-lg p-1">
              <Button
                variant={viewMode === "table" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setViewMode("table")}
              >
                <List className="h-4 w-4 mr-2" />
                ตาราง
              </Button>
              <Button
                variant={viewMode === "calendar" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setViewMode("calendar")}
              >
                <LayoutGrid className="h-4 w-4 mr-2" />
                ปฏิทิน
              </Button>
            </div>
          </div>
        <Dialog open={showAddDialog} onOpenChange={(open) => {
          setShowAddDialog(open);
          if (!open) {
            setShowAdvancedLocation(false);
          }
        }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                กำหนดการประชุม
              </Button>
            </DialogTrigger>
              <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>กำหนดการประชุมใหม่</DialogTitle>
                <DialogDescription>
                  เพิ่มการประชุม Chapter พร้อมตั้งค่าการทำซ้ำ
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="meeting_datetime">วันที่และเวลาประชุม *</Label>
                  <Input
                    id="meeting_datetime"
                    type="datetime-local"
                    value={newMeeting.meeting_date && newMeeting.meeting_time 
                      ? `${newMeeting.meeting_date}T${newMeeting.meeting_time}` 
                      : newMeeting.meeting_date || ''}
                    onChange={(e) => {
                      const datetime = e.target.value;
                      if (datetime) {
                        const [date, time] = datetime.split('T');
                        setNewMeeting(prev => ({ 
                          ...prev, 
                          meeting_date: date,
                          meeting_time: time || ''
                        }));
                      } else {
                        setNewMeeting(prev => ({ 
                          ...prev, 
                          meeting_date: '',
                          meeting_time: ''
                        }));
                      }
                    }}
                  />
                </div>

                <LocationSearch
                  label="สถานที่"
                  value={newMeeting.venue}
                  onChange={(value) => setNewMeeting(prev => ({ ...prev, venue: value }))}
                  onLocationSelect={(lat, lng, placeName, fullAddress) => {
                    setNewMeeting(prev => ({
                      ...prev,
                      venue: placeName,
                      location_details: fullAddress,
                      location_lat: lat.toString(),
                      location_lng: lng.toString(),
                    }));
                    setShowAdvancedLocation(true);
                  }}
                  placeholder="ค้นหาสถานที่... (เช่น โรงแรม ABC)"
                />

                <div className="space-y-2">
                  <Label htmlFor="location_details">รายละเอียดสถานที่</Label>
                  <Input
                    id="location_details"
                    value={newMeeting.location_details}
                    onChange={(e) => setNewMeeting(prev => ({ ...prev, location_details: e.target.value }))}
                    placeholder="ห้องประชุม 1 ชั้น 5"
                  />
                </div>

                <details 
                  className="space-y-2"
                  open={showAdvancedLocation}
                  onToggle={(e) => setShowAdvancedLocation((e.target as HTMLDetailsElement).open)}
                >
                  <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground flex items-center gap-2">
                    <span>ตั้งค่าพิกัดขั้นสูง (Advanced Location Settings)</span>
                    {newMeeting.location_lat && newMeeting.location_lng && (
                      <span className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                        <Check className="h-3 w-3" />
                        มีพิกัด
                      </span>
                    )}
                  </summary>
                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div className="space-y-2">
                      <Label htmlFor="location_lat" className="text-xs">
                        ละติจูด (Latitude)
                        <span className="text-muted-foreground ml-1">- กรอกอัตโนมัติ</span>
                      </Label>
                      <Input
                        id="location_lat"
                        type="number"
                        step="any"
                        value={newMeeting.location_lat}
                        onChange={(e) => setNewMeeting(prev => ({ ...prev, location_lat: e.target.value }))}
                        placeholder="13.7563"
                        className="text-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="location_lng" className="text-xs">
                        ลองจิจูด (Longitude)
                        <span className="text-muted-foreground ml-1">- กรอกอัตโนมัติ</span>
                      </Label>
                      <Input
                        id="location_lng"
                        type="number"
                        step="any"
                        value={newMeeting.location_lng}
                        onChange={(e) => setNewMeeting(prev => ({ ...prev, location_lng: e.target.value }))}
                        placeholder="100.5018"
                        className="text-sm"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground pt-1 flex items-start gap-1">
                    <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
                    <span>พิกัดจะถูกกรอกอัตโนมัติเมื่อคุณเลือกสถานที่จากช่องค้นหา หากต้องการแก้ไขหรือกรอกเอง สามารถทำได้ที่นี่</span>
                  </p>
                </details>

                <div className="space-y-2">
                  <Label htmlFor="theme">หัวข้อ/ธีม *</Label>
                  <Input
                    id="theme"
                    value={newMeeting.theme}
                    onChange={(e) => setNewMeeting(prev => ({ ...prev, theme: e.target.value }))}
                    placeholder="หัวข้อการประชุม (สูงสุด 200 ตัวอักษร)"
                    maxLength={200}
                  />
                  <p className="text-xs text-muted-foreground">
                    {newMeeting.theme.length}/200 ตัวอักษร
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">รายละเอียดการประชุม</Label>
                  <div className="border rounded-md">
                    <ReactQuill
                      key={showAddDialog ? 'add-quill' : 'add-quill-hidden'}
                      ref={quillRef}
                      theme="snow"
                      value={newMeeting.description || ""}
                      onChange={(content) => setNewMeeting(prev => ({ ...prev, description: content }))}
                      placeholder="รายละเอียดเพิ่มเติม เช่น วิทยากร, agenda, หัวข้อพิเศษ..."
                      modules={quillModules}
                      className="bg-background"
                      style={{ minHeight: '200px' }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    รองรับ: หัวข้อ, ตัวหนา, ตัวเอียง, lists, links, 🖼️รูปภาพ
                  </p>
                </div>
                
                {/* Preview Button */}
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handlePreview}
                    className="flex-1"
                  >
                    <EyeIcon className="h-4 w-4 mr-2" />
                    ดูตัวอย่าง
                  </Button>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="visitor_fee">ค่าเข้าร่วมสำหรับผู้เยี่ยมชม (บาท)</Label>
                  <Input
                    id="visitor_fee"
                    type="number"
                    value={newMeeting.visitor_fee}
                    onChange={(e) => setNewMeeting(prev => ({ ...prev, visitor_fee: parseFloat(e.target.value) }))}
                    min="0"
                    step="50"
                  />
                </div>

                <Separator className="my-4" />

                <div className="space-y-2 pt-2">
                  <h4 className="text-sm font-medium">ตัวเลือกการทำซ้ำ</h4>
                  <RecurrenceSelector
                  meetingDate={newMeeting.meeting_date}
                  value={{
                    pattern: newMeeting.recurrence_pattern,
                    interval: newMeeting.recurrence_interval,
                    endDate: newMeeting.recurrence_end_date,
                    daysOfWeek: newMeeting.recurrence_days_of_week,
                    endType: newMeeting.recurrence_end_type,
                    occurrenceCount: newMeeting.recurrence_occurrence_count,
                  }}
                    onChange={(config) => setNewMeeting(prev => ({
                      ...prev,
                      recurrence_pattern: config.pattern,
                      recurrence_interval: config.interval,
                      recurrence_end_date: config.endDate,
                      recurrence_days_of_week: config.daysOfWeek,
                      recurrence_end_type: config.endType,
                      recurrence_occurrence_count: config.occurrenceCount,
                    }))}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                  ยกเลิก
                </Button>
                <Button onClick={handleAddMeeting} disabled={adding}>
                  {adding ? "กำลังสร้าง..." : "สร้างการประชุม"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Edit Meeting Dialog */}
          <Dialog open={showEditDialog} onOpenChange={(open) => {
            setShowEditDialog(open);
            if (!open) {
              setShowAdvancedLocationEdit(false);
            }
          }}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>แก้ไขการประชุม</DialogTitle>
                <DialogDescription>
                  แก้ไขข้อมูลการประชุม Chapter พร้อมตั้งค่าการทำซ้ำ
                </DialogDescription>
              </DialogHeader>
              {editingMeeting && (
                <div className="grid gap-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit_meeting_datetime">วันที่และเวลาประชุม *</Label>
                    <Input
                      id="edit_meeting_datetime"
                      type="datetime-local"
                      value={editingMeeting.meeting_date && editingMeeting.meeting_time 
                        ? `${editingMeeting.meeting_date}T${editingMeeting.meeting_time}` 
                        : editingMeeting.meeting_date || ''}
                      onChange={(e) => {
                        const datetime = e.target.value;
                        if (datetime) {
                          const [date, time] = datetime.split('T');
                          setEditingMeeting(prev => ({ 
                            ...prev, 
                            meeting_date: date,
                            meeting_time: time || ''
                          }));
                        } else {
                          setEditingMeeting(prev => ({ 
                            ...prev, 
                            meeting_date: '',
                            meeting_time: ''
                          }));
                        }
                      }}
                    />
                  </div>

                  <LocationSearch
                    label="สถานที่"
                    value={editingMeeting.venue || ""}
                    onChange={(value) => setEditingMeeting(prev => ({ ...prev, venue: value }))}
                    onLocationSelect={(lat, lng, placeName, fullAddress) => {
                      setEditingMeeting(prev => ({
                        ...prev,
                        venue: placeName,
                        location_details: fullAddress,
                        location_lat: lat.toString(),
                        location_lng: lng.toString(),
                      }));
                      setShowAdvancedLocationEdit(true);
                    }}
                    placeholder="ค้นหาสถานที่... (เช่น โรงแรม ABC)"
                  />

                  <div className="space-y-2">
                    <Label htmlFor="edit_location_details">รายละเอียดสถานที่</Label>
                    <Input
                      id="edit_location_details"
                      value={editingMeeting.location_details || ""}
                      onChange={(e) => setEditingMeeting(prev => ({ ...prev, location_details: e.target.value }))}
                      placeholder="ห้องประชุม 1 ชั้น 5"
                    />
                  </div>

                  <details 
                    className="space-y-2"
                    open={showAdvancedLocationEdit}
                    onToggle={(e) => setShowAdvancedLocationEdit((e.target as HTMLDetailsElement).open)}
                  >
                    <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground flex items-center gap-2">
                      <span>ตั้งค่าพิกัดขั้นสูง (Advanced Location Settings)</span>
                      {editingMeeting.location_lat && editingMeeting.location_lng && (
                        <span className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                          <Check className="h-3 w-3" />
                          มีพิกัด
                        </span>
                      )}
                    </summary>
                    <div className="grid grid-cols-2 gap-4 pt-2">
                      <div className="space-y-2">
                        <Label htmlFor="edit_location_lat" className="text-xs">
                          ละติจูด (Latitude)
                          <span className="text-muted-foreground ml-1">- กรอกอัตโนมัติ</span>
                        </Label>
                        <Input
                          id="edit_location_lat"
                          type="number"
                          step="any"
                          value={editingMeeting.location_lat || ""}
                          onChange={(e) => setEditingMeeting(prev => ({ ...prev, location_lat: e.target.value }))}
                          placeholder="13.7563"
                          className="text-sm"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="edit_location_lng" className="text-xs">
                          ลองจิจูด (Longitude)
                          <span className="text-muted-foreground ml-1">- กรอกอัตโนมัติ</span>
                        </Label>
                        <Input
                          id="edit_location_lng"
                          type="number"
                          step="any"
                          value={editingMeeting.location_lng || ""}
                          onChange={(e) => setEditingMeeting(prev => ({ ...prev, location_lng: e.target.value }))}
                          placeholder="100.5018"
                          className="text-sm"
                        />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground pt-1 flex items-start gap-1">
                      <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
                      <span>พิกัดจะถูกกรอกอัตโนมัติเมื่อคุณเลือกสถานที่จากช่องค้นหา หากต้องการแก้ไขหรือกรอกเอง สามารถทำได้ที่นี่</span>
                    </p>
                  </details>

                  <div className="space-y-2">
                    <Label htmlFor="edit_theme">หัวข้อ/ธีม *</Label>
                    <Input
                      id="edit_theme"
                      value={editingMeeting.theme || ""}
                      onChange={(e) => setEditingMeeting(prev => ({ ...prev, theme: e.target.value }))}
                      placeholder="หัวข้อการประชุม (สูงสุด 200 ตัวอักษร)"
                      maxLength={200}
                    />
                    <p className="text-xs text-muted-foreground">
                      {(editingMeeting.theme || "").length}/200 ตัวอักษร
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit_description">รายละเอียดการประชุม</Label>
                    <div className="border rounded-md overflow-hidden">
                      <ReactQuill
                        key={`edit-quill-${editingMeeting?.meeting_id}`}
                        ref={editQuillRef}
                        theme="snow"
                        value={editingMeeting.description || ""}
                        onChange={(content) => setEditingMeeting(prev => ({ ...prev, description: content }))}
                        placeholder="รายละเอียดเพิ่มเติม..."
                        modules={editQuillModules}
                        className="bg-background"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      รองรับ: หัวข้อ, ตัวหนา, ตัวเอียง, lists, links, 🖼️ รูปภาพ
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit_visitor_fee">ค่าเข้าร่วมสำหรับผู้เยี่ยมชม (บาท)</Label>
                    <Input
                      id="edit_visitor_fee"
                      type="number"
                      value={editingMeeting.visitor_fee}
                      onChange={(e) => setEditingMeeting(prev => ({ ...prev, visitor_fee: parseFloat(e.target.value) }))}
                      min="0"
                      step="50"
                    />
                  </div>

                  <Separator className="my-4" />

                  <div className="space-y-2 pt-2">
                    <h4 className="text-sm font-medium">ตัวเลือกการทำซ้ำ</h4>
                    <RecurrenceSelector
                    meetingDate={editingMeeting.meeting_date}
                    value={{
                      pattern: editingMeeting.recurrence_pattern || "none",
                      interval: editingMeeting.recurrence_interval || 1,
                      endDate: editingMeeting.recurrence_end_date || "",
                      daysOfWeek: editingMeeting.recurrence_days_of_week || [],
                      endType: (editingMeeting.recurrence_end_type as "never" | "date" | "count") || "never",
                      occurrenceCount: editingMeeting.recurrence_occurrence_count || 10,
                    }}
                    onChange={(config) => setEditingMeeting(prev => ({
                      ...prev,
                      recurrence_pattern: config.pattern,
                      recurrence_interval: config.interval,
                      recurrence_end_date: config.endDate,
                      recurrence_days_of_week: config.daysOfWeek,
                      recurrence_end_type: config.endType,
                      recurrence_occurrence_count: config.occurrenceCount,
                    }))}
                  />
                  </div>
                </div>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowEditDialog(false)}>
                  ยกเลิก
                </Button>
                <Button onClick={handleUpdateMeeting} disabled={updating}>
                  {updating ? "กำลังบันทึก..." : "บันทึกการแก้ไข"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          
          {/* Preview Dialog */}
          <Dialog open={showPreview} onOpenChange={setShowPreview}>
            <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>👁️ ตัวอย่างรายละเอียดการประชุม</DialogTitle>
                <DialogDescription>
                  ตรวจสอบการแสดงผลก่อนบันทึก
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 p-4 border rounded-lg bg-accent/30">
                {previewContent.theme && (
                  <div>
                    <Label className="text-base font-semibold">🎯 หัวข้อ/ธีม</Label>
                    <p className="mt-2 text-lg font-medium">{previewContent.theme}</p>
                  </div>
                )}

                {previewContent.theme && previewContent.description && <Separator />}

                {previewContent.description && (
                  <div>
                    <Label className="text-base font-semibold">📝 รายละเอียดการประชุม</Label>
                    <div 
                      className="mt-3 prose prose-sm max-w-none dark:prose-invert
                                 prose-headings:text-foreground prose-p:text-muted-foreground
                                 prose-li:text-muted-foreground prose-a:text-primary
                                 prose-img:rounded-lg prose-img:shadow-md"
                      dangerouslySetInnerHTML={{ __html: previewContent.description }}
                    />
                  </div>
                )}

                {!previewContent.theme && !previewContent.description && (
                  <div className="text-center py-8 text-muted-foreground">
                    ยังไม่มีเนื้อหาให้แสดงตัวอย่าง
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setShowPreview(false)}>
                  ปิด
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {viewMode === "calendar" ? (
          loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : (
            <MeetingsCalendar meetings={meetings} />
          )
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Upcoming & Past Meetings</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : (
                <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Venue</TableHead>
                    <TableHead>Theme</TableHead>
                    <TableHead>Visitor Fee</TableHead>
                    <TableHead>Attendance</TableHead>
                    <TableHead className="text-right">จัดการ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {meetings.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        No meetings scheduled
                      </TableCell>
                    </TableRow>
                  ) : (
                    meetings.map((meeting) => (
                      <TableRow key={meeting.meeting_id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                            {new Date(meeting.meeting_date).toLocaleDateString("th-TH", {
                              year: "numeric",
                              month: "long",
                              day: "numeric",
                            })}
                            {meeting.recurrence_pattern && meeting.recurrence_pattern !== "none" && (
                              <Repeat className="h-3 w-3 text-primary" />
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{meeting.venue || "-"}</TableCell>
                        <TableCell className="max-w-[200px]">
                          <div className="truncate" title={meeting.theme || "-"}>
                            {meeting.theme || "-"}
                          </div>
                        </TableCell>
                        <TableCell>฿{meeting.visitor_fee}</TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {meeting.checkins?.[0]?.count || 0} attendees
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => navigate(`/admin/meetings/${meeting.meeting_id}`)}
                            >
                              <EyeIcon className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => startEditMeeting(meeting)}
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
                                  <AlertDialogTitle>ยืนยันการลบการประชุม</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    คุณต้องการลบการประชุมวันที่{" "}
                                    {new Date(meeting.meeting_date).toLocaleDateString("th-TH")} ใช่หรือไม่?
                                    <br />
                                    <span className="text-destructive font-semibold">
                                      การดำเนินการนี้ไม่สามารถย้อนกลับได้
                                    </span>
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDeleteMeeting(meeting.meeting_id)}
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
        )}
      </div>
    </AdminLayout>
  );
}
