import { useEffect, useState } from "react";
import AdminLayout from "@/components/layout/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Users, Calendar, CheckSquare, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { useTenantContext } from "@/contexts/TenantContext";

export default function Dashboard() {
  const { effectiveTenantId, isSuperAdmin } = useTenantContext();
  const [stats, setStats] = useState({
    totalParticipants: 0,
    activeMembers: 0,
    upcomingMeetings: 0,
    pendingPayments: 0,
  });

  useEffect(() => {
    if (effectiveTenantId) {
      fetchStats();
    }
  }, [effectiveTenantId]);

  const fetchStats = async () => {
    if (!effectiveTenantId) return;

    try {
      const [participantsRes, membersRes, meetingsRes, paymentsRes] = await Promise.all([
        supabase.from("participants").select("*", { count: "exact", head: true }).eq("tenant_id", effectiveTenantId),
        supabase.from("participants").select("*", { count: "exact", head: true }).eq("tenant_id", effectiveTenantId).eq("status", "member"),
        supabase.from("meetings").select("*", { count: "exact", head: true }).eq("tenant_id", effectiveTenantId).gte("meeting_date", new Date().toISOString()),
        supabase.from("payments").select("*", { count: "exact", head: true }).eq("tenant_id", effectiveTenantId).eq("status", "pending"),
      ]);

      setStats({
        totalParticipants: participantsRes.count || 0,
        activeMembers: membersRes.count || 0,
        upcomingMeetings: meetingsRes.count || 0,
        pendingPayments: paymentsRes.count || 0,
      });
    } catch (error: any) {
      toast.error("Failed to load statistics");
    }
  };

  const statCards = [
    {
      title: "Total Participants",
      value: stats.totalParticipants,
      icon: Users,
      description: "All members and visitors",
    },
    {
      title: "Active Members",
      value: stats.activeMembers,
      icon: CheckSquare,
      description: "Current active members",
    },
    {
      title: "Upcoming Meetings",
      value: stats.upcomingMeetings,
      icon: Calendar,
      description: "Scheduled meetings",
    },
    {
      title: "Pending Payments",
      value: stats.pendingPayments,
      icon: CreditCard,
      description: "Awaiting payment",
    },
  ];

  if (!effectiveTenantId && isSuperAdmin) {
    return (
      <AdminLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Dashboard</h1>
            <p className="text-muted-foreground">Chapter overview and statistics</p>
          </div>
          <Card>
            <CardContent className="py-8">
              <p className="text-center text-muted-foreground">
                กรุณาเลือก Chapter ที่ต้องการดูข้อมูล
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
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Chapter overview and statistics</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {statCards.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.title}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {stat.title}
                  </CardTitle>
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stat.value}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {stat.description}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <button className="flex flex-col items-center justify-center p-6 border rounded-lg hover:bg-muted/50 transition-colors">
              <Users className="h-8 w-8 mb-2 text-primary" />
              <span className="font-medium">Add Participant</span>
            </button>
            <button className="flex flex-col items-center justify-center p-6 border rounded-lg hover:bg-muted/50 transition-colors">
              <Calendar className="h-8 w-8 mb-2 text-primary" />
              <span className="font-medium">Schedule Meeting</span>
            </button>
            <button className="flex flex-col items-center justify-center p-6 border rounded-lg hover:bg-muted/50 transition-colors">
              <CheckSquare className="h-8 w-8 mb-2 text-primary" />
              <span className="font-medium">Record Check-in</span>
            </button>
            <button className="flex flex-col items-center justify-center p-6 border rounded-lg hover:bg-muted/50 transition-colors">
              <CreditCard className="h-8 w-8 mb-2 text-primary" />
              <span className="font-medium">Record Payment</span>
            </button>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
