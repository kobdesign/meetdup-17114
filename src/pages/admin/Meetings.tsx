import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AdminLayout from "@/components/layout/AdminLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Calendar as CalendarIcon, Pencil, Trash2, Eye, Repeat, LayoutGrid, List } from "lucide-react";
import { toast } from "sonner";
import MeetingsCalendar from "@/components/MeetingsCalendar";
import RecurrenceSelector from "@/components/RecurrenceSelector";
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
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"table" | "calendar">("table");
  
  const navigate = useNavigate();
  
  const [newMeeting, setNewMeeting] = useState({
    meeting_date: "",
    meeting_time: "",
    venue: "",
    location_details: "",
    location_lat: "",
    location_lng: "",
    theme: "",
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

  useEffect(() => {
    loadTenantId();
    fetchMeetings();
  }, []);

  const loadTenantId = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: userRole } = await supabase
      .from("user_roles")
      .select("tenant_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (userRole?.tenant_id) {
      setTenantId(userRole.tenant_id);
    }
  };

  const fetchMeetings = async () => {
    try {
      const { data, error } = await supabase
        .from("meetings")
        .select(`
          *,
          checkins(count)
        `)
        .order("meeting_date", { ascending: false });

      if (error) throw error;
      setMeetings(data || []);
    } catch (error: any) {
      toast.error("Failed to load meetings");
    } finally {
      setLoading(false);
    }
  };

  const handleAddMeeting = async () => {
    if (!newMeeting.meeting_date || !tenantId) {
      toast.error("กรุณาเลือกวันที่ประชุม");
      return;
    }

    setAdding(true);
    try {
      const { error } = await supabase
        .from("meetings")
        .insert({
          tenant_id: tenantId,
          meeting_date: newMeeting.meeting_date,
          meeting_time: newMeeting.meeting_time || null,
          venue: newMeeting.venue || null,
          location_details: newMeeting.location_details || null,
          location_lat: newMeeting.location_lat ? parseFloat(newMeeting.location_lat) : null,
          location_lng: newMeeting.location_lng ? parseFloat(newMeeting.location_lng) : null,
          theme: newMeeting.theme || null,
          visitor_fee: newMeeting.visitor_fee,
          recurrence_pattern: newMeeting.recurrence_pattern,
          recurrence_interval: newMeeting.recurrence_interval,
          recurrence_end_date: newMeeting.recurrence_end_date || null,
          recurrence_days_of_week: newMeeting.recurrence_days_of_week.length > 0 ? newMeeting.recurrence_days_of_week : null,
        });

      if (error) throw error;

      toast.success("กำหนดการประชุมสำเร็จ");
      setShowAddDialog(false);
      setNewMeeting({
        meeting_date: "",
        meeting_time: "",
        venue: "",
        location_details: "",
        location_lat: "",
        location_lng: "",
        theme: "",
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
    setEditingMeeting(meeting);
    setShowEditDialog(true);
  };

  const handleUpdateMeeting = async () => {
    if (!editingMeeting?.meeting_date) {
      toast.error("กรุณาเลือกวันที่ประชุม");
      return;
    }

    setUpdating(true);
    try {
      const { error } = await supabase
        .from("meetings")
        .update({
          meeting_date: editingMeeting.meeting_date,
          meeting_time: editingMeeting.meeting_time || null,
          venue: editingMeeting.venue || null,
          location_details: editingMeeting.location_details || null,
          location_lat: editingMeeting.location_lat ? parseFloat(editingMeeting.location_lat) : null,
          location_lng: editingMeeting.location_lng ? parseFloat(editingMeeting.location_lng) : null,
          theme: editingMeeting.theme || null,
          visitor_fee: editingMeeting.visitor_fee,
          recurrence_pattern: editingMeeting.recurrence_pattern,
          recurrence_interval: editingMeeting.recurrence_interval,
          recurrence_end_date: editingMeeting.recurrence_end_date || null,
          recurrence_days_of_week: editingMeeting.recurrence_days_of_week?.length > 0 ? editingMeeting.recurrence_days_of_week : null,
        })
        .eq("meeting_id", editingMeeting.meeting_id);

      if (error) throw error;

      toast.success("แก้ไขการประชุมสำเร็จ");
      setShowEditDialog(false);
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

      const { data: payments } = await supabase
        .from("payments")
        .select("payment_id")
        .eq("meeting_id", meetingId)
        .limit(1);

      if (checkins && checkins.length > 0) {
        toast.error("ไม่สามารถลบได้ เนื่องจากมีประวัติการเช็คอิน");
        return;
      }

      if (payments && payments.length > 0) {
        toast.error("ไม่สามารถลบได้ เนื่องจากมีประวัติการชำระเงิน");
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
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
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
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="meeting_date">วันที่ประชุม *</Label>
                    <Input
                      id="meeting_date"
                      type="date"
                      value={newMeeting.meeting_date}
                      onChange={(e) => setNewMeeting({ ...newMeeting, meeting_date: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="meeting_time">เวลา</Label>
                    <Input
                      id="meeting_time"
                      type="time"
                      value={newMeeting.meeting_time}
                      onChange={(e) => setNewMeeting({ ...newMeeting, meeting_time: e.target.value })}
                    />
                  </div>
                </div>

                <LocationSearch
                  label="สถานที่"
                  value={newMeeting.venue}
                  onChange={(value) => setNewMeeting({ ...newMeeting, venue: value })}
                  onLocationSelect={(lat, lng, placeName) => {
                    setNewMeeting({
                      ...newMeeting,
                      location_lat: lat.toString(),
                      location_lng: lng.toString(),
                    });
                  }}
                  placeholder="ค้นหาสถานที่... (เช่น โรงแรม ABC)"
                />

                <div className="space-y-2">
                  <Label htmlFor="location_details">รายละเอียดสถานที่</Label>
                  <Input
                    id="location_details"
                    value={newMeeting.location_details}
                    onChange={(e) => setNewMeeting({ ...newMeeting, location_details: e.target.value })}
                    placeholder="ห้องประชุม 1 ชั้น 5"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="location_lat">ละติจูด (Latitude)</Label>
                    <Input
                      id="location_lat"
                      type="number"
                      step="any"
                      value={newMeeting.location_lat}
                      onChange={(e) => setNewMeeting({ ...newMeeting, location_lat: e.target.value })}
                      placeholder="13.7563"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="location_lng">ลองจิจูด (Longitude)</Label>
                    <Input
                      id="location_lng"
                      type="number"
                      step="any"
                      value={newMeeting.location_lng}
                      onChange={(e) => setNewMeeting({ ...newMeeting, location_lng: e.target.value })}
                      placeholder="100.5018"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="theme">หัวข้อ/ธีม</Label>
                  <Textarea
                    id="theme"
                    value={newMeeting.theme}
                    onChange={(e) => setNewMeeting({ ...newMeeting, theme: e.target.value })}
                    placeholder="หัวข้อการประชุม หรือวิทยากรพิเศษ"
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="visitor_fee">ค่าเข้าร่วมสำหรับผู้เยี่ยมชม (บาท)</Label>
                  <Input
                    id="visitor_fee"
                    type="number"
                    value={newMeeting.visitor_fee}
                    onChange={(e) => setNewMeeting({ ...newMeeting, visitor_fee: parseFloat(e.target.value) })}
                    min="0"
                    step="50"
                  />
                </div>

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
                  onChange={(config) => setNewMeeting({
                    ...newMeeting,
                    recurrence_pattern: config.pattern,
                    recurrence_interval: config.interval,
                    recurrence_end_date: config.endDate,
                    recurrence_days_of_week: config.daysOfWeek,
                    recurrence_end_type: config.endType,
                    recurrence_occurrence_count: config.occurrenceCount,
                  })}
                />
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
          <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>แก้ไขการประชุม</DialogTitle>
                <DialogDescription>
                  แก้ไขข้อมูลการประชุม Chapter พร้อมตั้งค่าการทำซ้ำ
                </DialogDescription>
              </DialogHeader>
              {editingMeeting && (
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit_meeting_date">วันที่ประชุม *</Label>
                      <Input
                        id="edit_meeting_date"
                        type="date"
                        value={editingMeeting.meeting_date}
                        onChange={(e) => setEditingMeeting({ ...editingMeeting, meeting_date: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit_meeting_time">เวลา</Label>
                      <Input
                        id="edit_meeting_time"
                        type="time"
                        value={editingMeeting.meeting_time || ""}
                        onChange={(e) => setEditingMeeting({ ...editingMeeting, meeting_time: e.target.value })}
                      />
                    </div>
                  </div>

                  <LocationSearch
                    label="สถานที่"
                    value={editingMeeting.venue || ""}
                    onChange={(value) => setEditingMeeting({ ...editingMeeting, venue: value })}
                    onLocationSelect={(lat, lng, placeName) => {
                      setEditingMeeting({
                        ...editingMeeting,
                        location_lat: lat.toString(),
                        location_lng: lng.toString(),
                      });
                    }}
                    placeholder="ค้นหาสถานที่... (เช่น โรงแรม ABC)"
                  />

                  <div className="space-y-2">
                    <Label htmlFor="edit_location_details">รายละเอียดสถานที่</Label>
                    <Input
                      id="edit_location_details"
                      value={editingMeeting.location_details || ""}
                      onChange={(e) => setEditingMeeting({ ...editingMeeting, location_details: e.target.value })}
                      placeholder="ห้องประชุม 1 ชั้น 5"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit_location_lat">ละติจูด (Latitude)</Label>
                      <Input
                        id="edit_location_lat"
                        type="number"
                        step="any"
                        value={editingMeeting.location_lat || ""}
                        onChange={(e) => setEditingMeeting({ ...editingMeeting, location_lat: e.target.value })}
                        placeholder="13.7563"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit_location_lng">ลองจิจูด (Longitude)</Label>
                      <Input
                        id="edit_location_lng"
                        type="number"
                        step="any"
                        value={editingMeeting.location_lng || ""}
                        onChange={(e) => setEditingMeeting({ ...editingMeeting, location_lng: e.target.value })}
                        placeholder="100.5018"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit_theme">หัวข้อ/ธีม</Label>
                    <Textarea
                      id="edit_theme"
                      value={editingMeeting.theme || ""}
                      onChange={(e) => setEditingMeeting({ ...editingMeeting, theme: e.target.value })}
                      placeholder="หัวข้อการประชุม หรือวิทยากรพิเศษ"
                      rows={3}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit_visitor_fee">ค่าเข้าร่วมสำหรับผู้เยี่ยมชม (บาท)</Label>
                    <Input
                      id="edit_visitor_fee"
                      type="number"
                      value={editingMeeting.visitor_fee}
                      onChange={(e) => setEditingMeeting({ ...editingMeeting, visitor_fee: parseFloat(e.target.value) })}
                      min="0"
                      step="50"
                    />
                  </div>

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
                    onChange={(config) => setEditingMeeting({
                      ...editingMeeting,
                      recurrence_pattern: config.pattern,
                      recurrence_interval: config.interval,
                      recurrence_end_date: config.endDate,
                      recurrence_days_of_week: config.daysOfWeek,
                      recurrence_end_type: config.endType,
                      recurrence_occurrence_count: config.occurrenceCount,
                    })}
                  />
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
                        <TableCell>{meeting.theme || "-"}</TableCell>
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
                              <Eye className="h-4 w-4" />
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
