import { useEffect, useState } from "react";
import AdminLayout from "@/components/layout/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Users, Calendar, CheckCircle, DollarSign, CalendarIcon } from "lucide-react";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface AnalyticsData {
  totalParticipants: number;
  activeMembers: number;
  prospects: number;
  visitors: number;
  totalMeetings: number;
  thisMonthMeetings: number;
  totalCheckins: number;
  totalRevenue: number;
  participantsByStatus: { name: string; value: number }[];
  monthlyCheckins: { month: string; checkins: number }[];
  monthlyRevenue: { month: string; revenue: number }[];
}

const COLORS = ["hsl(var(--primary))", "hsl(var(--secondary))", "hsl(var(--accent))", "hsl(var(--muted))"];

export default function Analytics() {
  const [loading, setLoading] = useState(true);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: new Date(new Date().getFullYear(), new Date().getMonth() - 5, 1),
    to: new Date(),
  });
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [analytics, setAnalytics] = useState<AnalyticsData>({
    totalParticipants: 0,
    activeMembers: 0,
    prospects: 0,
    visitors: 0,
    totalMeetings: 0,
    thisMonthMeetings: 0,
    totalCheckins: 0,
    totalRevenue: 0,
    participantsByStatus: [],
    monthlyCheckins: [],
    monthlyRevenue: [],
  });

  useEffect(() => {
    loadAnalytics();
  }, [dateRange, statusFilter]);

  const loadAnalytics = async () => {
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

      setTenantId(userRole.tenant_id);

      // Fetch participants data with filters
      let participantsQuery = supabase
        .from("participants")
        .select("status, created_at")
        .eq("tenant_id", userRole.tenant_id)
        .gte("created_at", dateRange.from.toISOString())
        .lte("created_at", dateRange.to.toISOString());

      if (statusFilter !== "all") {
        participantsQuery = participantsQuery.eq("status", statusFilter as any);
      }

      const { data: participants } = await participantsQuery;

      // Fetch meetings data with date range
      const { data: meetings } = await supabase
        .from("meetings")
        .select("meeting_date, created_at")
        .eq("tenant_id", userRole.tenant_id)
        .gte("meeting_date", dateRange.from.toISOString().split('T')[0])
        .lte("meeting_date", dateRange.to.toISOString().split('T')[0]);

      // Fetch checkins data with date range
      const { data: checkins } = await supabase
        .from("checkins")
        .select("checkin_time")
        .eq("tenant_id", userRole.tenant_id)
        .gte("checkin_time", dateRange.from.toISOString())
        .lte("checkin_time", dateRange.to.toISOString());

      // Fetch payments data with date range
      const { data: payments } = await supabase
        .from("payments")
        .select("amount, created_at")
        .eq("tenant_id", userRole.tenant_id)
        .gte("created_at", dateRange.from.toISOString())
        .lte("created_at", dateRange.to.toISOString());

      // Process participants by status
      const statusCount = participants?.reduce((acc: any, p) => {
        acc[p.status] = (acc[p.status] || 0) + 1;
        return acc;
      }, {}) || {};

      const participantsByStatus = Object.entries(statusCount).map(([name, value]) => ({
        name: name === "active" ? "สมาชิก" : name === "prospect" ? "ผู้สนใจ" : name === "visitor" ? "ผู้เยี่ยมชม" : "อดีตสมาชิก",
        value: value as number,
      }));

      // Calculate this month's meetings
      const now = new Date();
      const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const thisMonthMeetings = meetings?.filter(
        m => new Date(m.meeting_date) >= thisMonthStart
      ).length || 0;

      // Process monthly checkins (last 6 months)
      const monthlyCheckinsMap = new Map<string, number>();
      for (let i = 5; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthKey = date.toLocaleDateString("th-TH", { month: "short", year: "2-digit" });
        monthlyCheckinsMap.set(monthKey, 0);
      }

      checkins?.forEach(c => {
        const date = new Date(c.checkin_time);
        const monthKey = date.toLocaleDateString("th-TH", { month: "short", year: "2-digit" });
        if (monthlyCheckinsMap.has(monthKey)) {
          monthlyCheckinsMap.set(monthKey, monthlyCheckinsMap.get(monthKey)! + 1);
        }
      });

      const monthlyCheckins = Array.from(monthlyCheckinsMap.entries()).map(([month, checkins]) => ({
        month,
        checkins,
      }));

      // Process monthly revenue (last 6 months)
      const monthlyRevenueMap = new Map<string, number>();
      for (let i = 5; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthKey = date.toLocaleDateString("th-TH", { month: "short", year: "2-digit" });
        monthlyRevenueMap.set(monthKey, 0);
      }

      payments?.forEach(p => {
        const date = new Date(p.created_at);
        const monthKey = date.toLocaleDateString("th-TH", { month: "short", year: "2-digit" });
        if (monthlyRevenueMap.has(monthKey)) {
          monthlyRevenueMap.set(monthKey, monthlyRevenueMap.get(monthKey)! + Number(p.amount));
        }
      });

      const monthlyRevenue = Array.from(monthlyRevenueMap.entries()).map(([month, revenue]) => ({
        month,
        revenue,
      }));

      const totalRevenue = payments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;

      setAnalytics({
        totalParticipants: participants?.length || 0,
        activeMembers: statusCount.active || 0,
        prospects: statusCount.prospect || 0,
        visitors: statusCount.visitor || 0,
        totalMeetings: meetings?.length || 0,
        thisMonthMeetings,
        totalCheckins: checkins?.length || 0,
        totalRevenue,
        participantsByStatus,
        monthlyCheckins,
        monthlyRevenue,
      });
    } catch (error: any) {
      toast.error("เกิดข้อผิดพลาดในการโหลดข้อมูล");
      console.error(error);
    } finally {
      setLoading(false);
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Analytics</h1>
            <p className="text-muted-foreground">สถิติและรายงานของ Chapter</p>
          </div>
          <div className="flex gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="สถานะ" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทั้งหมด</SelectItem>
                <SelectItem value="member_active">สมาชิกที่ใช้งาน</SelectItem>
                <SelectItem value="prospect">ผู้สนใจ</SelectItem>
                <SelectItem value="visitor_attended">ผู้เยี่ยมชม</SelectItem>
                <SelectItem value="alumni">อดีตสมาชิก</SelectItem>
              </SelectContent>
            </Select>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-[280px] justify-start text-left font-normal")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateRange.from ? (
                    dateRange.to ? (
                      <>
                        {format(dateRange.from, "dd/MM/yyyy")} - {format(dateRange.to, "dd/MM/yyyy")}
                      </>
                    ) : (
                      format(dateRange.from, "dd/MM/yyyy")
                    )
                  ) : (
                    <span>เลือกช่วงเวลา</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <div className="p-3 space-y-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">จาก</label>
                    <CalendarComponent
                      mode="single"
                      selected={dateRange.from}
                      onSelect={(date) => date && setDateRange({ ...dateRange, from: date })}
                      className={cn("pointer-events-auto")}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">ถึง</label>
                    <CalendarComponent
                      mode="single"
                      selected={dateRange.to}
                      onSelect={(date) => date && setDateRange({ ...dateRange, to: date })}
                      className={cn("pointer-events-auto")}
                    />
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">สมาชิกทั้งหมด</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics.totalParticipants}</div>
              <p className="text-xs text-muted-foreground">
                สมาชิก {analytics.activeMembers} | ผู้สนใจ {analytics.prospects}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">การประชุม</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics.totalMeetings}</div>
              <p className="text-xs text-muted-foreground">
                เดือนนี้ {analytics.thisMonthMeetings} ครั้ง
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">การเข้าร่วม</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics.totalCheckins}</div>
              <p className="text-xs text-muted-foreground">
                ทั้งหมด
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">รายได้</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {analytics.totalRevenue.toLocaleString()} ฿
              </div>
              <p className="text-xs text-muted-foreground">
                ทั้งหมด
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>สมาชิกแยกตามประเภท</CardTitle>
              <CardDescription>จำนวนสมาชิกในแต่ละสถานะ</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={analytics.participantsByStatus}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="hsl(var(--primary))"
                    dataKey="value"
                  >
                    {analytics.participantsByStatus.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>การเข้าร่วมประชุม</CardTitle>
              <CardDescription>6 เดือนที่ผ่านมา</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={analytics.monthlyCheckins}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="checkins" name="จำนวนเข้าร่วม" fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>รายได้รายเดือน</CardTitle>
              <CardDescription>6 เดือนที่ผ่านมา</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={analytics.monthlyRevenue}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="revenue" 
                    name="รายได้ (฿)" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                    dot={{ fill: "hsl(var(--primary))" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
