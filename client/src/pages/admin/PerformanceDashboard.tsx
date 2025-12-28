import { useEffect, useState } from "react";
import AdminLayout from "@/components/layout/AdminLayout";
import { useTenantContext } from "@/contexts/TenantContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Users, UserCheck, TrendingUp, TrendingDown, Target, Clock, UserPlus, ArrowRight } from "lucide-react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import SelectTenantPrompt from "@/components/SelectTenantPrompt";

interface PerformanceMetrics {
  summary: {
    totalMembers: number;
    meetingsInPeriod: number;
    attendanceRate: number;
    attendanceRateChange: number;
    visitorConversionRate: number;
    visitorConversionRateChange: number;
    visitorCheckinRate: number;
  };
  attendance: {
    current: { checkedIn: number; onTime: number; late: number; substitutes: number };
    previous: { checkedIn: number; onTime: number; late: number; substitutes: number };
    onTimeRate: number;
  };
  visitors: {
    current: { registered: number; checkedIn: number; converted: number };
    previous: { registered: number; checkedIn: number; converted: number };
    funnel: { registered: number; checkedIn: number; converted: number };
  };
  monthlyTrend: Array<{
    month: string;
    attendanceRate: number;
    visitorConversionRate: number;
    meetings: number;
  }>;
  period: {
    current: { start: string; end: string };
    previous: { start: string; end: string };
  };
}

function TrendIndicator({ value, suffix = "%" }: { value: number; suffix?: string }) {
  if (value === 0) return null;
  
  const isPositive = value > 0;
  const Icon = isPositive ? TrendingUp : TrendingDown;
  
  return (
    <span className={`inline-flex items-center gap-1 text-sm ${isPositive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
      <Icon className="h-4 w-4" />
      {isPositive ? "+" : ""}{value}{suffix}
    </span>
  );
}

function MetricCard({ 
  title, 
  value, 
  change, 
  suffix = "%", 
  icon: Icon,
  description 
}: { 
  title: string; 
  value: number; 
  change?: number; 
  suffix?: string;
  icon: React.ComponentType<{ className?: string }>;
  description?: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold" data-testid={`metric-${title.toLowerCase().replace(/\s/g, '-')}`}>
            {value}{suffix}
          </span>
          {change !== undefined && <TrendIndicator value={change} />}
        </div>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}

function ConversionFunnel({ funnel }: { funnel: { registered: number; checkedIn: number; converted: number } }) {
  const checkinRate = funnel.registered > 0 ? Math.round((funnel.checkedIn / funnel.registered) * 100) : 0;
  const conversionRate = funnel.registered > 0 ? Math.round((funnel.converted / funnel.registered) * 100) : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Visitor Conversion Funnel</CardTitle>
        <CardDescription>ขั้นตอนการแปลง Visitor เป็น Member</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 text-center">
            <div className="bg-blue-100 dark:bg-blue-900/30 rounded-lg p-4">
              <UserPlus className="h-8 w-8 mx-auto text-blue-600 dark:text-blue-400 mb-2" />
              <div className="text-2xl font-bold" data-testid="funnel-registered">{funnel.registered}</div>
              <div className="text-sm text-muted-foreground">ลงทะเบียน</div>
            </div>
          </div>
          
          <div className="flex flex-col items-center">
            <ArrowRight className="h-6 w-6 text-muted-foreground" />
            <Badge variant="secondary" className="mt-1">{checkinRate}%</Badge>
          </div>
          
          <div className="flex-1 text-center">
            <div className="bg-green-100 dark:bg-green-900/30 rounded-lg p-4">
              <UserCheck className="h-8 w-8 mx-auto text-green-600 dark:text-green-400 mb-2" />
              <div className="text-2xl font-bold" data-testid="funnel-checkedin">{funnel.checkedIn}</div>
              <div className="text-sm text-muted-foreground">เช็คอิน</div>
            </div>
          </div>
          
          <div className="flex flex-col items-center">
            <ArrowRight className="h-6 w-6 text-muted-foreground" />
            <Badge variant="secondary" className="mt-1">{conversionRate}%</Badge>
          </div>
          
          <div className="flex-1 text-center">
            <div className="bg-purple-100 dark:bg-purple-900/30 rounded-lg p-4">
              <Target className="h-8 w-8 mx-auto text-purple-600 dark:text-purple-400 mb-2" />
              <div className="text-2xl font-bold" data-testid="funnel-converted">{funnel.converted}</div>
              <div className="text-sm text-muted-foreground">สมัครสมาชิก</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function AttendanceBreakdown({ attendance }: { attendance: PerformanceMetrics["attendance"] }) {
  const data = [
    { name: "ตรงเวลา", current: attendance.current.onTime, previous: attendance.previous.onTime },
    { name: "มาสาย", current: attendance.current.late, previous: attendance.previous.late },
    { name: "ส่งตัวแทน", current: attendance.current.substitutes, previous: attendance.previous.substitutes },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">การเข้าร่วมประชุม</CardTitle>
        <CardDescription>เปรียบเทียบกับช่วงก่อนหน้า</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="current" name="ปัจจุบัน" fill="hsl(var(--primary))" />
            <Bar dataKey="previous" name="ก่อนหน้า" fill="hsl(var(--muted))" />
          </BarChart>
        </ResponsiveContainer>
        
        <div className="mt-4 flex items-center justify-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            อัตราตรงเวลา: <span className="font-medium">{attendance.onTimeRate}%</span>
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function TrendChart({ data }: { data: PerformanceMetrics["monthlyTrend"] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">แนวโน้ม 6 เดือนย้อนหลัง</CardTitle>
        <CardDescription>Attendance Rate และ Visitor Conversion Rate</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis domain={[0, 100]} />
            <Tooltip />
            <Legend />
            <Line 
              type="monotone" 
              dataKey="attendanceRate" 
              name="Attendance Rate %" 
              stroke="hsl(var(--primary))" 
              strokeWidth={2}
              dot={{ fill: "hsl(var(--primary))" }}
            />
            <Line 
              type="monotone" 
              dataKey="visitorConversionRate" 
              name="Visitor Conversion %" 
              stroke="hsl(var(--success))" 
              strokeWidth={2}
              dot={{ fill: "hsl(var(--success))" }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

function ComparisonTable({ metrics }: { metrics: PerformanceMetrics }) {
  const rows = [
    { 
      label: "การเข้าประชุม (Check-in)", 
      current: metrics.attendance.current.checkedIn, 
      previous: metrics.attendance.previous.checkedIn 
    },
    { 
      label: "ตรงเวลา", 
      current: metrics.attendance.current.onTime, 
      previous: metrics.attendance.previous.onTime 
    },
    { 
      label: "มาสาย", 
      current: metrics.attendance.current.late, 
      previous: metrics.attendance.previous.late 
    },
    { 
      label: "ส่งตัวแทน", 
      current: metrics.attendance.current.substitutes, 
      previous: metrics.attendance.previous.substitutes 
    },
    { 
      label: "Visitor ลงทะเบียน", 
      current: metrics.visitors.current.registered, 
      previous: metrics.visitors.previous.registered 
    },
    { 
      label: "Visitor เช็คอิน", 
      current: metrics.visitors.current.checkedIn, 
      previous: metrics.visitors.previous.checkedIn 
    },
    { 
      label: "Visitor แปลงเป็นสมาชิก", 
      current: metrics.visitors.current.converted, 
      previous: metrics.visitors.previous.converted 
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">เปรียบเทียบตัวเลข</CardTitle>
        <CardDescription>
          ปัจจุบัน ({metrics.period.current.start} - {metrics.period.current.end}) vs 
          ก่อนหน้า ({metrics.period.previous.start} - {metrics.period.previous.end})
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 font-medium">รายการ</th>
                <th className="text-center py-2 font-medium">ปัจจุบัน</th>
                <th className="text-center py-2 font-medium">ก่อนหน้า</th>
                <th className="text-center py-2 font-medium">เปลี่ยนแปลง</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => {
                const change = row.current - row.previous;
                const percentChange = row.previous > 0 
                  ? Math.round((change / row.previous) * 100) 
                  : (row.current > 0 ? 100 : 0);
                
                return (
                  <tr key={idx} className="border-b last:border-0">
                    <td className="py-2">{row.label}</td>
                    <td className="text-center py-2 font-medium">{row.current}</td>
                    <td className="text-center py-2 text-muted-foreground">{row.previous}</td>
                    <td className="text-center py-2">
                      <TrendIndicator value={percentChange} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

export default function PerformanceDashboard() {
  const { effectiveTenantId } = useTenantContext();
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("current_month");
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);

  useEffect(() => {
    if (!effectiveTenantId) return;

    const fetchMetrics = async () => {
      setLoading(true);
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;

        if (!token) {
          toast.error("กรุณาเข้าสู่ระบบใหม่");
          return;
        }

        const response = await fetch(
          `/api/chapters/${effectiveTenantId}/performance-metrics?period=${period}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!response.ok) {
          throw new Error("Failed to fetch metrics");
        }

        const data = await response.json();
        setMetrics(data);
      } catch (error) {
        console.error("Error fetching metrics:", error);
        toast.error("ไม่สามารถโหลดข้อมูลได้");
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
  }, [effectiveTenantId, period]);

  if (!effectiveTenantId) {
    return (
      <AdminLayout>
        <SelectTenantPrompt />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold" data-testid="page-title">Chapter Performance</h1>
            <p className="text-muted-foreground">ติดตามผลลัพธ์และ KPIs ของ Chapter</p>
          </div>
          
          <Select value={period} onValueChange={setPeriod} data-testid="select-period">
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="เลือกช่วงเวลา" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="current_month">เดือนนี้</SelectItem>
              <SelectItem value="last_3_months">3 เดือนล่าสุด</SelectItem>
              <SelectItem value="last_6_months">6 เดือนล่าสุด</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i}>
                <CardHeader className="pb-2">
                  <div className="h-4 bg-muted rounded animate-pulse w-24" />
                </CardHeader>
                <CardContent>
                  <div className="h-8 bg-muted rounded animate-pulse w-16" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : metrics ? (
          <>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <MetricCard
                title="Attendance Rate"
                value={metrics.summary.attendanceRate}
                change={metrics.summary.attendanceRateChange}
                icon={Users}
                description={`${metrics.summary.totalMembers} สมาชิก, ${metrics.summary.meetingsInPeriod} ประชุม`}
              />
              <MetricCard
                title="Visitor Conversion"
                value={metrics.summary.visitorConversionRate}
                change={metrics.summary.visitorConversionRateChange}
                icon={Target}
                description="อัตราการแปลง Visitor เป็น Member"
              />
              <MetricCard
                title="Visitor Check-in Rate"
                value={metrics.summary.visitorCheckinRate}
                suffix="%"
                icon={UserCheck}
                description="Visitor ที่มาจริงจากที่ลงทะเบียน"
              />
              <MetricCard
                title="On-time Rate"
                value={metrics.attendance.onTimeRate}
                suffix="%"
                icon={Clock}
                description="สมาชิกที่มาตรงเวลา"
              />
            </div>

            <ConversionFunnel funnel={metrics.visitors.funnel} />

            <div className="grid gap-4 lg:grid-cols-2">
              <AttendanceBreakdown attendance={metrics.attendance} />
              <TrendChart data={metrics.monthlyTrend} />
            </div>

            <ComparisonTable metrics={metrics} />
          </>
        ) : (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              ไม่พบข้อมูล กรุณาตรวจสอบว่ามีการประชุมในช่วงเวลาที่เลือก
            </CardContent>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
}
