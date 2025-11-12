import { useEffect, useState } from "react";
import AdminLayout from "@/components/layout/AdminLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Search, CheckCircle, XCircle, Clock, Mail, Phone } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";

export default function Visitors() {
  const [loading, setLoading] = useState(true);
  const [visitors, setVisitors] = useState<any[]>([]);
  const [filteredVisitors, setFilteredVisitors] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    loadVisitors();
  }, []);

  useEffect(() => {
    filterVisitors();
  }, [visitors, searchTerm, statusFilter]);

  const loadVisitors = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userRole } = await supabase
        .from("user_roles")
        .select("tenant_id")
        .eq("user_id", user.id)
        .single();

      if (!userRole?.tenant_id) {
        toast.error("ไม่พบข้อมูล tenant");
        return;
      }

      const { data, error } = await supabase
        .from("participants")
        .select("*")
        .eq("tenant_id", userRole.tenant_id)
        .in("status", ["visitor_pending_payment", "visitor_paid", "visitor_attended"])
        .order("created_at", { ascending: false });

      if (error) throw error;
      setVisitors(data || []);
    } catch (error: any) {
      toast.error("เกิดข้อผิดพลาดในการโหลดข้อมูล");
    } finally {
      setLoading(false);
    }
  };

  const filterVisitors = () => {
    let filtered = [...visitors];

    if (statusFilter !== "all") {
      filtered = filtered.filter(v => v.status === statusFilter);
    }

    if (searchTerm) {
      filtered = filtered.filter(v =>
        v.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v.phone?.includes(searchTerm) ||
        v.company?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredVisitors(filtered);
  };

  const updateVisitorStatus = async (participantId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from("participants")
        .update({ status: newStatus as any })
        .eq("participant_id", participantId);

      if (error) throw error;

      toast.success("อัปเดตสถานะสำเร็จ");
      loadVisitors();
    } catch (error: any) {
      toast.error("เกิดข้อผิดพลาด: " + error.message);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "visitor_paid":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "visitor_attended":
        return <CheckCircle className="h-4 w-4 text-blue-500" />;
      case "visitor_pending_payment":
        return <Clock className="h-4 w-4 text-yellow-500" />;
      default:
        return <XCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="text-center py-8 text-muted-foreground">กำลังโหลด...</div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">จัดการผู้เยี่ยมชม</h1>
          <p className="text-muted-foreground">ดูรายชื่อและจัดการผู้เยี่ยมชมที่ลงทะเบียน</p>
        </div>

        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="ค้นหาชื่อ, อีเมล, เบอร์โทร, หรือบริษัท..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทุกสถานะ</SelectItem>
              <SelectItem value="visitor_pending_payment">รอชำระเงิน</SelectItem>
              <SelectItem value="visitor_paid">ชำระเงินแล้ว</SelectItem>
              <SelectItem value="visitor_attended">เข้าร่วมแล้ว</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>รายชื่อผู้เยี่ยมชม ({filteredVisitors.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {filteredVisitors.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {searchTerm || statusFilter !== "all"
                  ? "ไม่พบผู้เยี่ยมชมที่ตรงกับเงื่อนไข"
                  : "ยังไม่มีผู้เยี่ยมชมลงทะเบียน"}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ชื่อ-นามสกุล</TableHead>
                    <TableHead>ติดต่อ</TableHead>
                    <TableHead>บริษัท/ธุรกิจ</TableHead>
                    <TableHead>สถานะ</TableHead>
                    <TableHead>วันที่ลงทะเบียน</TableHead>
                    <TableHead className="text-right">จัดการ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredVisitors.map((visitor) => (
                    <TableRow key={visitor.participant_id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{visitor.full_name}</div>
                          {visitor.business_type && (
                            <div className="text-sm text-muted-foreground">
                              {visitor.business_type}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1 text-sm">
                          {visitor.email && (
                            <div className="flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {visitor.email}
                            </div>
                          )}
                          {visitor.phone && (
                            <div className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {visitor.phone}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{visitor.company || "-"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getStatusIcon(visitor.status)}
                          <StatusBadge status={visitor.status} />
                        </div>
                      </TableCell>
                      <TableCell>
                        {new Date(visitor.created_at).toLocaleDateString("th-TH")}
                      </TableCell>
                      <TableCell className="text-right">
                        <Select
                          value={visitor.status}
                          onValueChange={(value) => updateVisitorStatus(visitor.participant_id, value)}
                        >
                          <SelectTrigger className="w-[160px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="visitor_pending_payment">รอชำระเงิน</SelectItem>
                            <SelectItem value="visitor_paid">ชำระเงินแล้ว</SelectItem>
                            <SelectItem value="visitor_attended">เข้าร่วมแล้ว</SelectItem>
                            <SelectItem value="prospect">เปลี่ยนเป็นผู้สนใจ</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
