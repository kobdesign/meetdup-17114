import { useEffect, useState } from "react";
import AdminLayout from "@/components/layout/AdminLayout";
import { useTenantContext } from "@/contexts/TenantContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Users, UserPlus, UserCheck, UserX, CalendarIcon } from "lucide-react";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { format, endOfMonth } from "date-fns";
import { cn } from "@/lib/utils";
import SelectTenantPrompt from "@/components/SelectTenantPrompt";

interface AnalyticsData {
  activeMembers: number;
  prospects: number;
  visitorsWithCheckins: number;
  declined: number;
  participantsByStatus: { name: string; value: number }[];
  monthlyCheckins: { month: string; checkins: number }[];
}

const COLORS = ["hsl(var(--primary))", "hsl(var(--success))", "hsl(var(--warning))", "hsl(var(--destructive))", "hsl(var(--muted))"];

export default function Dashboard() {
  const { effectiveTenantId, isSuperAdmin } = useTenantContext();
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    to: endOfMonth(new Date()),
  });
  const [dateRangePreset, setDateRangePreset] = useState<string>("current_month");
  const [showCustomDatePicker, setShowCustomDatePicker] = useState(false);
  const [analytics, setAnalytics] = useState<AnalyticsData>({
    activeMembers: 0,
    prospects: 0,
    visitorsWithCheckins: 0,
    declined: 0,
    participantsByStatus: [],
    monthlyCheckins: [],
  });

  // Helper function to get date ranges based on preset
  const getDateRangeFromPreset = (preset: string): { from: Date; to: Date } => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    
    switch (preset) {
      case "current_month":
        return {
          from: new Date(currentYear, currentMonth, 1),
          to: new Date(currentYear, currentMonth + 1, 0),
        };
      
      case "last_month":
        const lastMonthStart = new Date(currentYear, currentMonth - 1, 1);
        const lastMonthEnd = new Date(currentYear, currentMonth, 0);
        return {
          from: lastMonthStart,
          to: lastMonthEnd,
        };
      
      case "last_2_months":
        return {
          from: new Date(currentYear, currentMonth - 2, 1),
          to: new Date(currentYear, currentMonth, 0),
        };
      
      case "last_3_months":
        return {
          from: new Date(currentYear, currentMonth - 3, 1),
          to: new Date(currentYear, currentMonth, 0),
        };
      
      case "last_6_months":
        return {
          from: new Date(currentYear, currentMonth - 6, 1),
          to: new Date(currentYear, currentMonth, 0),
        };
      
      case "last_12_months":
        return {
          from: new Date(currentYear, currentMonth - 12, 1),
          to: new Date(currentYear, currentMonth, 0),
        };
      
      case "current_year":
        return {
          from: new Date(currentYear, 0, 1),
          to: now,
        };
      
      case "last_year":
        return {
          from: new Date(currentYear - 1, 0, 1),
          to: new Date(currentYear - 1, 11, 31),
        };
      
      case "custom":
        return dateRange;
      
      default:
        return {
          from: new Date(currentYear, currentMonth, 1),
          to: now,
        };
    }
  };

  // Handler when preset changes
  const handlePresetChange = (preset: string) => {
    setDateRangePreset(preset);
    
    if (preset === "custom") {
      setShowCustomDatePicker(true);
    } else {
      setShowCustomDatePicker(false);
      const newRange = getDateRangeFromPreset(preset);
      setDateRange(newRange);
    }
  };

  // Sync dateRange with preset on initial load
  useEffect(() => {
    const initialRange = getDateRangeFromPreset(dateRangePreset);
    setDateRange(initialRange);
  }, []); // Run only once on mount

  useEffect(() => {
    if (!effectiveTenantId) {
      setLoading(false);
      return;
    }
    loadAnalytics();
  }, [effectiveTenantId, dateRange]);

  const loadAnalytics = async () => {
    if (!effectiveTenantId) {
      setLoading(false);
      return;
    }

    try {
      // Fetch all participants (no date filter - we want current state)
      const { data: participants } = await supabase
        .from("participants")
        .select("participant_id, status, created_at")
        .eq("tenant_id", effectiveTenantId);

      // Count visitors with at least one check-in
      const { data: visitorsWithCheckins } = await supabase
        .from("participants")
        .select("participant_id")
        .eq("tenant_id", effectiveTenantId)
        .eq("status", "visitor");

      let visitorsWithCheckinsCount = 0;
      if (visitorsWithCheckins && visitorsWithCheckins.length > 0) {
        const participantIds = visitorsWithCheckins.map(p => p.participant_id);
        const { data: checkedInVisitors } = await supabase
          .from("checkins")
          .select("participant_id")
          .eq("tenant_id", effectiveTenantId)
          .in("participant_id", participantIds);

        // Count unique participant_ids
        const uniqueVisitors = new Set(checkedInVisitors?.map(c => c.participant_id) || []);
        visitorsWithCheckinsCount = uniqueVisitors.size;
      }

      // Fetch checkins data for monthly chart (last 6 months)
      const now = new Date();
      const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1);
      const { data: checkins } = await supabase
        .from("checkins")
        .select("checkin_time")
        .eq("tenant_id", effectiveTenantId)
        .gte("checkin_time", sixMonthsAgo.toISOString());

      // Process participants by status
      const statusCount = participants?.reduce((acc: any, p) => {
        acc[p.status] = (acc[p.status] || 0) + 1;
        return acc;
      }, {}) || {};

      const participantsByStatus = Object.entries(statusCount).map(([name, value]) => ({
        name:
          name === "member"
            ? "สมาชิกปัจจุบัน"
            : name === "prospect"
            ? "ผู้มุ่งหวัง"
            : name === "visitor"
            ? "ผู้เยี่ยมชม"
            : name === "declined"
            ? "ไม่ติดตาม"
            : "อดีตสมาชิก",
        value: value as number,
      }));

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

      setAnalytics({
        activeMembers: statusCount.member || 0,
        prospects: statusCount.prospect || 0,
        visitorsWithCheckins: visitorsWithCheckinsCount,
        declined: statusCount.declined || 0,
        participantsByStatus,
        monthlyCheckins,
      });
    } catch (error: any) {
      toast.error("เกิดข้อผิดพลาดในการโหลดข้อมูล");
      console.error(error);
    } finally {
      setLoading(false);
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
            <h1 className="text-3xl font-bold">Dashboard</h1>
            <p className="text-muted-foreground">Chapter overview and statistics</p>
          </div>
          <div className="flex gap-2">
            {/* Date Range Preset Dropdown */}
            <Select value={dateRangePreset} onValueChange={handlePresetChange}>
              <SelectTrigger className="w-[240px]">
                <SelectValue placeholder="เลือกช่วงเวลา" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="current_month">เดือนปัจจุบัน</SelectItem>
                <SelectItem value="last_month">เดือนก่อน</SelectItem>
                <SelectItem value="last_2_months">2 เดือนที่ผ่านมา</SelectItem>
                <SelectItem value="last_3_months">3 เดือนที่ผ่านมา</SelectItem>
                <SelectItem value="last_6_months">6 เดือนที่ผ่านมา</SelectItem>
                <SelectItem value="last_12_months">1 ปีที่ผ่านมา</SelectItem>
                <SelectItem value="current_year">ปีปัจจุบัน</SelectItem>
                <SelectItem value="last_year">ปีก่อน</SelectItem>
                <SelectItem value="custom">กำหนดเอง...</SelectItem>
              </SelectContent>
            </Select>

            {/* Custom Date Picker - แสดงเฉพาะเมื่อเลือก "กำหนดเอง" */}
            {showCustomDatePicker && (
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
            )}
          </div>
        </div>

        {/* Member Pipeline Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card data-testid="card-active-members">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">สมาชิกปัจจุบัน</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-active-members">{analytics.activeMembers}</div>
              <p className="text-xs text-muted-foreground">
                สมาชิกที่ active
              </p>
            </CardContent>
          </Card>

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

          <Card data-testid="card-visitors">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">ผู้เยี่ยมชม</CardTitle>
              <UserCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-visitors">{analytics.visitorsWithCheckins}</div>
              <p className="text-xs text-muted-foreground">
                มาร่วมประชุมแล้ว
              </p>
            </CardContent>
          </Card>

          <Card data-testid="card-declined">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">ไม่ติดตาม</CardTitle>
              <UserX className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-declined">{analytics.declined}</div>
              <p className="text-xs text-muted-foreground">
                หมดความสนใจ
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

          <Card className="md:col-span-2">
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
        </div>
      </div>
    </AdminLayout>
  );
}
