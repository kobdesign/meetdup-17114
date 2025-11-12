import { useEffect, useState } from "react";
import AdminLayout from "@/components/layout/AdminLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/StatusBadge";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Search } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export default function Participants() {
  const [participants, setParticipants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [adding, setAdding] = useState(false);
  const [tenantId, setTenantId] = useState<string | null>(null);
  
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

  useEffect(() => {
    loadTenantId();
    fetchParticipants();
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

  const fetchParticipants = async () => {
    try {
      const { data, error } = await supabase
        .from("participants")
        .select("*")
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
    if (!newParticipant.full_name || !tenantId) {
      toast.error("กรุณากรอกชื่อ-นามสกุล");
      return;
    }

    setAdding(true);
    try {
      const { error } = await supabase
        .from("participants")
        .insert({
          tenant_id: tenantId,
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

  const filteredParticipants = participants.filter((p) =>
    p.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.company?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
                      <SelectItem value="prospect">Prospect</SelectItem>
                      <SelectItem value="visitor">Visitor</SelectItem>
                      <SelectItem value="member_active">Member (Active)</SelectItem>
                      <SelectItem value="member_inactive">Member (Inactive)</SelectItem>
                      <SelectItem value="alumni">Alumni</SelectItem>
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
                    <TableHead>Payment</TableHead>
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
                        <TableCell>
                          <StatusBadge status={participant.payment_status} />
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
