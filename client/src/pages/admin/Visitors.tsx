import { useEffect, useState } from "react";
import AdminLayout from "@/components/layout/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Search, CheckCircle, XCircle, Clock, Mail, Phone, UserPlus, UserCheck, Users, TrendingUp } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import { useTenantContext } from "@/contexts/TenantContext";
import SelectTenantPrompt from "@/components/SelectTenantPrompt";

interface VisitorAnalytics {
  prospects: number;
  visitors: number;
  visitorsWithCheckins: number;
  engagedVisitors: number;
  members: number;
  declined: number;
  avgCheckinsPerVisitor: number;
  totalInPipeline: number;
}

export default function Visitors() {
  const { effectiveTenantId, isSuperAdmin } = useTenantContext();
  const [loading, setLoading] = useState(true);
  const [visitors, setVisitors] = useState<any[]>([]);
  const [filteredVisitors, setFilteredVisitors] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [analytics, setAnalytics] = useState<VisitorAnalytics>({
    prospects: 0,
    visitors: 0,
    visitorsWithCheckins: 0,
    engagedVisitors: 0,
    members: 0,
    declined: 0,
    avgCheckinsPerVisitor: 0,
    totalInPipeline: 0,
  });

  useEffect(() => {
    if (effectiveTenantId) {
      loadVisitors();
      loadAnalytics();
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
        .in("status", ["visitor", "prospect", "declined"])
        .order("created_at", { ascending: false });

      if (error) throw error;
      setVisitors(data || []);
    } catch (error: any) {
      toast.error("เกิดข้อผิดพลาดในการโหลดข้อมูล");
    } finally {
      setLoading(false);
    }
  };

  const loadAnalytics = async () => {
    if (!effectiveTenantId) return;

    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        toast.error("กรุณาเข้าสู่ระบบ");
        return;
      }

      const response = await fetch(
        `/api/participants/visitor-analytics?tenant_id=${effectiveTenantId}`,
        {
          headers: {
            Authorization: `Bearer ${session.session.access_token}`,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error("Analytics API error:", {
          status: response.status,
          statusText: response.statusText,
          errorData
        });
        throw new Error(errorData.error || errorData.message || "Failed to load analytics");
      }

      const result = await response.json();
      if (result.success && result.analytics) {
        setAnalytics(result.analytics);
      }
    } catch (error: any) {
      console.error("Analytics error:", {
        message: error.message,
        stack: error.stack,
        error: error
      });
      toast.error("ไม่สามารถโหลดข้อมูลสถิติได้: " + (error.message || "Unknown error"));
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
      loadAnalytics(); // Refresh analytics after status change
    } catch (error: any) {
      toast.error("เกิดข้อผิดพลาด: " + error.message);
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

  if (!effectiveTenantId && isSuperAdmin) {
    return (
      <AdminLayout>
        <SelectTenantPrompt />
      </AdminLayout>
    );
  }

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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Visitor Pipeline</h1>
            <p className="text-muted-foreground">ติดตามและวิเคราะห์กระบวนการดูแลผู้เยี่ยมชม</p>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card data-testid="card-prospects">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">ผู้มุ่งหวัง</CardTitle>
              <UserPlus className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-prospects">{analytics.prospects}</div>
              <p className="text-xs text-muted-foreground">
                กำลังพิจารณาเข้าร่วม
              </p>
            </CardContent>
          </Card>

          <Card data-testid="card-visitors-active">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">ผู้เยี่ยมชมที่มาแล้ว</CardTitle>
              <UserCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-visitors-checkins">{analytics.visitorsWithCheckins}</div>
              <p className="text-xs text-muted-foreground">
                จาก {analytics.visitors} คน
              </p>
            </CardContent>
          </Card>

          <Card data-testid="card-engaged-visitors">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Hot Leads</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-engaged-visitors">{analytics.engagedVisitors}</div>
              <p className="text-xs text-muted-foreground">
                มา 2+ ครั้ง (พร้อม convert)
              </p>
            </CardContent>
          </Card>

          <Card data-testid="card-declined">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">ไม่ติดตาม</CardTitle>
              <XCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-declined">{analytics.declined}</div>
              <p className="text-xs text-muted-foreground">
                หมดความสนใจ
              </p>
            </CardContent>
          </Card>
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
              <SelectItem value="prospect">ผู้มุ่งหวัง</SelectItem>
              <SelectItem value="visitor">ผู้เยี่ยมชม</SelectItem>
              <SelectItem value="declined">ไม่ติดตาม</SelectItem>
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
                                <SelectItem value="visitor">ผู้เยี่ยมชม</SelectItem>
                                <SelectItem value="prospect">ผู้สนใจ</SelectItem>
                                <SelectItem value="declined">ไม่สนใจ</SelectItem>
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
