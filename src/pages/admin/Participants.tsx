import { useEffect, useState } from "react";
import AdminLayout from "@/components/layout/AdminLayout";
import { useTenantContext } from "@/contexts/TenantContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/StatusBadge";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Search, Pencil, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
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

export default function Participants() {
  const { effectiveTenantId, isSuperAdmin } = useTenantContext();
  const [participants, setParticipants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [adding, setAdding] = useState(false);
  
  const [newParticipant, setNewParticipant] = useState({
    full_name: "",
    nickname: "",
    email: "",
    phone: "",
    company: "",
    business_type: "",
    goal: "",
    status: "prospect" as const,
    notes: "",
  });

  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingParticipant, setEditingParticipant] = useState<any | null>(null);
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (effectiveTenantId) {
      fetchParticipants();
    }
  }, [effectiveTenantId]);

  const fetchParticipants = async () => {
    if (!effectiveTenantId) return;

    try {
      const { data, error } = await supabase
        .from("participants")
        .select("*")
        .eq("tenant_id", effectiveTenantId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setParticipants(data || []);
    } catch (error: any) {
      toast.error("Failed to load participants");
    } finally {
      setLoading(false);
    }
  };

  const handleAddParticipant = async () => {
    if (!newParticipant.full_name) {
      toast.error("กรุณากรอกชื่อ-นามสกุล");
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
      const { error } = await supabase
        .from("participants")
        .insert({
          tenant_id: effectiveTenantId,
          full_name: newParticipant.full_name,
          nickname: newParticipant.nickname || null,
          email: newParticipant.email || null,
          phone: newParticipant.phone || null,
          company: newParticipant.company || null,
          business_type: newParticipant.business_type || null,
          goal: newParticipant.goal || null,
          status: newParticipant.status,
          notes: newParticipant.notes || null,
        });

      if (error) throw error;

      toast.success("เพิ่มสมาชิกสำเร็จ");
      setShowAddDialog(false);
      setNewParticipant({
        full_name: "",
        nickname: "",
        email: "",
        phone: "",
        company: "",
        business_type: "",
        goal: "",
        status: "prospect",
        notes: "",
      });
      fetchParticipants();
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
    if (!editingParticipant?.full_name) {
      toast.error("กรุณากรอกชื่อ-นามสกุล");
      return;
    }

    setUpdating(true);
    try {
      const { error } = await supabase
        .from("participants")
        .update({
          full_name: editingParticipant.full_name,
          nickname: editingParticipant.nickname || null,
          email: editingParticipant.email || null,
          phone: editingParticipant.phone || null,
          company: editingParticipant.company || null,
          business_type: editingParticipant.business_type || null,
          goal: editingParticipant.goal || null,
          status: editingParticipant.status,
          notes: editingParticipant.notes || null,
        })
        .eq("participant_id", editingParticipant.participant_id);

      if (error) throw error;

      toast.success("แก้ไขข้อมูลสำเร็จ");
      setShowEditDialog(false);
      setEditingParticipant(null);
      fetchParticipants();
    } catch (error: any) {
      toast.error("เกิดข้อผิดพลาด: " + error.message);
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteParticipant = async (participantId: string) => {
    setDeleting(true);
    try {
      // Check for dependencies
      const { data: checkins } = await supabase
        .from("checkins")
        .select("checkin_id")
        .eq("participant_id", participantId)
        .limit(1);

      const { data: payments } = await supabase
        .from("payments")
        .select("payment_id")
        .eq("participant_id", participantId)
        .limit(1);

      if (checkins && checkins.length > 0) {
        toast.error("ไม่สามารถลบได้ เนื่องจากมีประวัติการเช็คอิน");
        return;
      }

      if (payments && payments.length > 0) {
        toast.error("ไม่สามารถลบได้ เนื่องจากมีประวัติการชำระเงิน");
        return;
      }

      // Delete participant
      const { error } = await supabase
        .from("participants")
        .delete()
        .eq("participant_id", participantId);

      if (error) throw error;

      toast.success("ลบสมาชิกสำเร็จ");
      fetchParticipants();
    } catch (error: any) {
      toast.error("เกิดข้อผิดพลาด: " + error.message);
    } finally {
      setDeleting(false);
    }
  };

  const filteredParticipants = participants.filter((p) =>
    p.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.company?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!effectiveTenantId && isSuperAdmin) {
    return (
      <AdminLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Participants</h1>
            <p className="text-muted-foreground">Manage members and visitors</p>
          </div>
          <Card>
            <CardContent className="py-8">
              <p className="text-center text-muted-foreground">
                กรุณาเลือก Chapter ที่ต้องการจัดการ
              </p>
            </CardContent>
          </Card>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Participants</h1>
            <p className="text-muted-foreground">Manage members and visitors</p>
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
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="full_name">ชื่อ-นามสกุล *</Label>
                    <Input
                      id="full_name"
                      value={newParticipant.full_name}
                      onChange={(e) => setNewParticipant({ ...newParticipant, full_name: e.target.value })}
                      placeholder="จอห์น สมิธ"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="nickname">ชื่อเล่น</Label>
                    <Input
                      id="nickname"
                      value={newParticipant.nickname}
                      onChange={(e) => setNewParticipant({ ...newParticipant, nickname: e.target.value })}
                      placeholder="จอห์น"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">อีเมล</Label>
                    <Input
                      id="email"
                      type="email"
                      value={newParticipant.email}
                      onChange={(e) => setNewParticipant({ ...newParticipant, email: e.target.value })}
                      placeholder="john@example.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">เบอร์โทร</Label>
                    <Input
                      id="phone"
                      value={newParticipant.phone}
                      onChange={(e) => setNewParticipant({ ...newParticipant, phone: e.target.value })}
                      placeholder="081-234-5678"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="company">บริษัท</Label>
                    <Input
                      id="company"
                      value={newParticipant.company}
                      onChange={(e) => setNewParticipant({ ...newParticipant, company: e.target.value })}
                      placeholder="ABC Company Ltd."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="business_type">ประเภทธุรกิจ</Label>
                    <Input
                      id="business_type"
                      value={newParticipant.business_type}
                      onChange={(e) => setNewParticipant({ ...newParticipant, business_type: e.target.value })}
                      placeholder="เทคโนโลยี"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="status">สถานะ</Label>
                  <Select
                    value={newParticipant.status}
                    onValueChange={(value: any) => setNewParticipant({ ...newParticipant, status: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="prospect">🟡 ผู้สนใจ</SelectItem>
                      <SelectItem value="visitor">🟢 ผู้เยี่ยมชม</SelectItem>
                      <SelectItem value="declined">🔴 ไม่สนใจ</SelectItem>
                      <SelectItem value="member">🔵 สมาชิก</SelectItem>
                      <SelectItem value="alumni">⚫ อดีตสมาชิก</SelectItem>
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
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">หมายเหตุ</Label>
                  <Textarea
                    id="notes"
                    value={newParticipant.notes}
                    onChange={(e) => setNewParticipant({ ...newParticipant, notes: e.target.value })}
                    placeholder="บันทึกเพิ่มเติม..."
                    rows={2}
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
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit_full_name">ชื่อ-นามสกุล *</Label>
                      <Input
                        id="edit_full_name"
                        value={editingParticipant.full_name}
                        onChange={(e) => setEditingParticipant({ ...editingParticipant, full_name: e.target.value })}
                        placeholder="จอห์น สมิธ"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit_nickname">ชื่อเล่น</Label>
                      <Input
                        id="edit_nickname"
                        value={editingParticipant.nickname || ""}
                        onChange={(e) => setEditingParticipant({ ...editingParticipant, nickname: e.target.value })}
                        placeholder="จอห์น"
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit_email">อีเมล</Label>
                      <Input
                        id="edit_email"
                        type="email"
                        value={editingParticipant.email || ""}
                        onChange={(e) => setEditingParticipant({ ...editingParticipant, email: e.target.value })}
                        placeholder="john@example.com"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit_phone">เบอร์โทร</Label>
                      <Input
                        id="edit_phone"
                        value={editingParticipant.phone || ""}
                        onChange={(e) => setEditingParticipant({ ...editingParticipant, phone: e.target.value })}
                        placeholder="081-234-5678"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit_company">บริษัท</Label>
                      <Input
                        id="edit_company"
                        value={editingParticipant.company || ""}
                        onChange={(e) => setEditingParticipant({ ...editingParticipant, company: e.target.value })}
                        placeholder="ABC Company Ltd."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit_business_type">ประเภทธุรกิจ</Label>
                      <Input
                        id="edit_business_type"
                        value={editingParticipant.business_type || ""}
                        onChange={(e) => setEditingParticipant({ ...editingParticipant, business_type: e.target.value })}
                        placeholder="เทคโนโลยี"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit_status">สถานะ</Label>
                    <Select
                      value={editingParticipant.status}
                      onValueChange={(value: any) => setEditingParticipant({ ...editingParticipant, status: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="prospect">🟡 ผู้สนใจ</SelectItem>
                        <SelectItem value="visitor">🟢 ผู้เยี่ยมชม</SelectItem>
                        <SelectItem value="declined">🔴 ไม่สนใจ</SelectItem>
                        <SelectItem value="member">🔵 สมาชิก</SelectItem>
                        <SelectItem value="alumni">⚫ อดีตสมาชิก</SelectItem>
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
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit_notes">หมายเหตุ</Label>
                    <Textarea
                      id="edit_notes"
                      value={editingParticipant.notes || ""}
                      onChange={(e) => setEditingParticipant({ ...editingParticipant, notes: e.target.value })}
                      placeholder="บันทึกเพิ่มเติม..."
                      rows={2}
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
                    <TableHead>Company</TableHead>
                    <TableHead>Business Type</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">จัดการ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredParticipants.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        No participants found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredParticipants.map((participant) => (
                      <TableRow key={participant.participant_id}>
                        <TableCell className="font-medium">
                          <div>
                            <div>{participant.full_name}</div>
                            {participant.nickname && (
                              <div className="text-sm text-muted-foreground">
                                ({participant.nickname})
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{participant.company || "-"}</TableCell>
                        <TableCell>{participant.business_type || "-"}</TableCell>
                        <TableCell>{participant.email || "-"}</TableCell>
                        <TableCell>
                          <StatusBadge status={participant.status} />
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
                                    คุณต้องการลบ {participant.full_name} ใช่หรือไม่?
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
    </AdminLayout>
  );
}
