import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Calculator, LayoutGrid, FileSpreadsheet, Users, Loader2 } from "lucide-react";
import AdminLayout from "@/components/layout/AdminLayout";
import { useTenantContext } from "@/contexts/TenantContext";
import { supabase } from "@/integrations/supabase/client";

interface App {
  app_id: string;
  name: string;
  description: string | null;
  icon: string;
  route: string;
  category: string;
  is_active: boolean;
  is_enabled: boolean;
  enabled_at: string | null;
  enabled_by: string | null;
}

const iconMap: Record<string, any> = {
  calculator: Calculator,
  "layout-grid": LayoutGrid,
  "file-spreadsheet": FileSpreadsheet,
  users: Users,
};

const categoryLabels: Record<string, string> = {
  construction: "ก่อสร้าง",
  finance: "การเงิน",
  utility: "เครื่องมือ",
  sales: "ขาย",
  networking: "เครือข่าย",
};

export default function AppCenter() {
  const { toast } = useToast();
  const { effectiveTenantId: currentTenantId } = useTenantContext();

  const { data: apps, isLoading } = useQuery<App[]>({
    queryKey: ["/api/apps/chapter", currentTenantId],
    queryFn: async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) throw new Error("Not authenticated");
      
      const response = await fetch(`/api/apps/chapter/${currentTenantId}`, {
        headers: {
          "Authorization": `Bearer ${sessionData.session.access_token}`,
        },
      });
      if (!response.ok) throw new Error("Failed to fetch apps");
      return response.json();
    },
    enabled: !!currentTenantId,
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ appId, enable }: { appId: string; enable: boolean }) => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) throw new Error("Not authenticated");
      
      const action = enable ? "enable" : "disable";
      const response = await fetch(`/api/apps/chapter/${currentTenantId}/${appId}/${action}`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${sessionData.session.access_token}`,
        },
      });
      if (!response.ok) throw new Error(`Failed to ${action} app`);
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/apps/chapter", currentTenantId] });
      toast({
        title: variables.enable ? "เปิดใช้งานแอปสำเร็จ" : "ปิดใช้งานแอปสำเร็จ",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "เกิดข้อผิดพลาด",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleToggle = (appId: string, currentEnabled: boolean) => {
    toggleMutation.mutate({ appId, enable: !currentEnabled });
  };

  const getIcon = (iconName: string) => {
    const IconComponent = iconMap[iconName] || LayoutGrid;
    return IconComponent;
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" data-testid="text-page-title">App Center</h1>
          <p className="text-muted-foreground">
            จัดการแอปพลิเคชันสำหรับสมาชิกใน Chapter ของคุณ
          </p>
        </div>

        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <Skeleton className="h-12 w-12 rounded-lg" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-5 w-32" />
                      <Skeleton className="h-4 w-full" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : apps && apps.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {apps.map((app) => {
              const IconComponent = getIcon(app.icon);
              const isPending = toggleMutation.isPending && 
                toggleMutation.variables?.appId === app.app_id;
              
              return (
                <Card key={app.app_id} data-testid={`card-app-${app.app_id}`}>
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className={`h-12 w-12 rounded-lg flex items-center justify-center ${
                        app.is_enabled 
                          ? "bg-primary/10 text-primary" 
                          : "bg-muted text-muted-foreground"
                      }`}>
                        <IconComponent className="h-6 w-6" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <h3 className="font-semibold truncate">{app.name}</h3>
                          {isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Switch
                              checked={app.is_enabled}
                              onCheckedChange={() => handleToggle(app.app_id, app.is_enabled)}
                              data-testid={`switch-app-${app.app_id}`}
                            />
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {app.description}
                        </p>
                        <Badge variant="secondary" className="mt-2">
                          {categoryLabels[app.category] || app.category}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <LayoutGrid className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="font-medium text-lg mb-1">ยังไม่มีแอปพลิเคชัน</h3>
              <p className="text-sm text-muted-foreground">
                แอปพลิเคชันใหม่จะปรากฏที่นี่เมื่อพร้อมใช้งาน
              </p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>เกี่ยวกับ App Center</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>
              App Center ช่วยให้คุณจัดการแอปพลิเคชันที่สมาชิกใน Chapter สามารถเข้าถึงได้
            </p>
            <ul className="list-disc list-inside space-y-1">
              <li>เปิด/ปิดแอปสำหรับสมาชิกทั้งหมดใน Chapter</li>
              <li>สมาชิกจะเห็นเฉพาะแอปที่เปิดใช้งานในหน้า Profile</li>
              <li>แอปใหม่จะถูกเพิ่มเข้ามาเรื่อยๆ ตาม feedback ของผู้ใช้</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
