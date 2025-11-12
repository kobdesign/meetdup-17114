import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AdminLayout from "@/components/layout/AdminLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Search, CheckCircle, XCircle, Clock, Mail, Phone, Bell, History } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import { useTenantContext } from "@/contexts/TenantContext";

export default function Visitors() {
  const navigate = useNavigate();
  const { effectiveTenantId, isSuperAdmin } = useTenantContext();
  const [loading, setLoading] = useState(true);
  const [visitors, setVisitors] = useState<any[]>([]);
  const [filteredVisitors, setFilteredVisitors] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sendingReminders, setSendingReminders] = useState(false);

  useEffect(() => {
    if (effectiveTenantId) {
      loadVisitors();
    }
  }, [effectiveTenantId]);

  useEffect(() => {
    filterVisitors();
  }, [visitors, searchTerm, statusFilter]);

  const loadVisitors = async () => {
    if (!effectiveTenantId) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("participants")
        .select("*")
        .eq("tenant_id", effectiveTenantId)
        .in("status", ["visitor", "prospect"])
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

  const sendPaymentReminders = async () => {
    if (!effectiveTenantId) {
      toast.error(isSuperAdmin 
        ? "กรุณาเลือก Chapter ที่ต้องการจัดการก่อน" 
        : "ไม่พบข้อมูล Tenant"
      );
      return;
    }

    setSendingReminders(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-payment-reminder', {
        body: { tenant_id: effectiveTenantId }
      });

      if (error) throw error;

      toast.success(`ส่งการแจ้งเตือนสำเร็จ ${data.sent} ข้อความ`);
    } catch (error: any) {
      toast.error("เกิดข้อผิดพลาด: " + error.message);
    } finally {
      setSendingReminders(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "visitor":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "prospect":
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

  if (!effectiveTenantId && isSuperAdmin) {
    return (
      <AdminLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold">จัดการผู้เยี่ยมชม</h1>
            <p className="text-muted-foreground">ดูรายชื่อและจัดการผู้เยี่ยมชมที่ลงทะเบียน</p>
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
            <h1 className="text-3xl font-bold">จัดการผู้เยี่ยมชม</h1>
            <p className="text-muted-foreground">ดูรายชื่อและจัดการผู้เยี่ยมชมที่ลงทะเบียน</p>
          </div>
          <Button 
            onClick={sendPaymentReminders} 
            disabled={sendingReminders}
            variant="outline"
          >
            <Bell className="mr-2 h-4 w-4" />
            {sendingReminders ? "กำลังส่ง..." : "ส่งการแจ้งเตือนชำระเงิน"}
          </Button>
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
              <SelectItem value="prospect">ผู้สนใจ</SelectItem>
              <SelectItem value="visitor">ผู้เยี่ยมชม</SelectItem>
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
                          <div className="space-y-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => navigate(`/admin/payment-history/${visitor.participant_id}`)}
                              className="w-full"
                            >
                              <History className="h-4 w-4 mr-1" />
                              ประวัติการชำระ
                            </Button>
                            
                            <Select
                              value={visitor.status}
                              onValueChange={(value) => updateVisitorStatus(visitor.participant_id, value)}
                            >
                              <SelectTrigger className="w-[160px]">
                                <SelectValue />
                              </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="visitor">ผู้เยี่ยมชม</SelectItem>
                                  <SelectItem value="prospect">ผู้สนใจ</SelectItem>
                                  <SelectItem value="declined">ไม่สนใจ</SelectItem>
                                </SelectContent>
                            </Select>
                          </div>
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
