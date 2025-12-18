import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useTenantContext } from "@/contexts/TenantContext";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Bell, Clock, Users, Send, Settings, MessageSquare } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface NotificationSettings {
  tenant_id: string;
  notify_7_days_before: boolean;
  notify_1_day_before: boolean;
  notify_2_hours_before: boolean;
  notification_time: string;
  send_to_group: boolean;
  group_line_id: string | null;
  custom_message_template: string | null;
}

export default function NotificationSettings() {
  const { toast } = useToast();
  const { selectedTenantId } = useTenantContext();
  const [settings, setSettings] = useState<NotificationSettings | null>(null);

  const { isLoading, error } = useQuery({
    queryKey: ["/api/notifications/settings", selectedTenantId],
    queryFn: async () => {
      const data = await apiRequest(`/api/notifications/settings/${selectedTenantId}`, "GET");
      if (data.success) {
        setSettings(data.settings);
        return data.settings;
      }
      throw new Error(data.error);
    },
    enabled: !!selectedTenantId
  });

  const updateMutation = useMutation({
    mutationFn: async (newSettings: Partial<NotificationSettings>) => {
      return apiRequest(`/api/notifications/settings/${selectedTenantId}`, "PUT", newSettings);
    },
    onSuccess: () => {
      toast({
        title: "บันทึกสำเร็จ",
        description: "การตั้งค่าแจ้งเตือนถูกอัพเดตแล้ว"
      });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/settings", selectedTenantId] });
    },
    onError: (error: any) => {
      toast({
        title: "เกิดข้อผิดพลาด",
        description: error.message || "ไม่สามารถบันทึกการตั้งค่าได้",
        variant: "destructive"
      });
    }
  });

  const handleSave = () => {
    if (settings) {
      updateMutation.mutate(settings);
    }
  };

  const handleToggle = (key: keyof NotificationSettings, value: boolean) => {
    if (settings) {
      setSettings({ ...settings, [key]: value });
    }
  };

  const handleInputChange = (key: keyof NotificationSettings, value: string) => {
    if (settings) {
      setSettings({ ...settings, [key]: value });
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (error || !settings) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-6">
            <p className="text-muted-foreground">ไม่สามารถโหลดการตั้งค่าได้</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <Bell className="h-6 w-6" />
            ตั้งค่าแจ้งเตือน Event
          </h1>
          <p className="text-muted-foreground">กำหนดการส่งแจ้งเตือน Meeting ให้สมาชิก</p>
        </div>
        <Button 
          onClick={handleSave} 
          disabled={updateMutation.isPending}
          data-testid="button-save-settings"
        >
          <Settings className="h-4 w-4 mr-2" />
          {updateMutation.isPending ? "กำลังบันทึก..." : "บันทึกการตั้งค่า"}
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              ช่วงเวลาแจ้งเตือน
            </CardTitle>
            <CardDescription>เลือกว่าจะส่งแจ้งเตือนล่วงหน้ากี่วัน/ชั่วโมง</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <Label>7 วันก่อน Meeting</Label>
                <p className="text-sm text-muted-foreground">ให้เวลาเตรียมตัวล่วงหน้า</p>
              </div>
              <Switch
                checked={settings.notify_7_days_before}
                onCheckedChange={(checked) => handleToggle("notify_7_days_before", checked)}
                data-testid="switch-7-days"
              />
            </div>

            <div className="flex items-center justify-between gap-4">
              <div>
                <Label>1 วันก่อน Meeting</Label>
                <p className="text-sm text-muted-foreground">เตือนความจำก่อนวัน</p>
              </div>
              <Switch
                checked={settings.notify_1_day_before}
                onCheckedChange={(checked) => handleToggle("notify_1_day_before", checked)}
                data-testid="switch-1-day"
              />
            </div>

            <div className="flex items-center justify-between gap-4">
              <div>
                <Label>2 ชั่วโมงก่อน Meeting</Label>
                <p className="text-sm text-muted-foreground">แจ้งเตือนใกล้เวลาจริง</p>
              </div>
              <Switch
                checked={settings.notify_2_hours_before}
                onCheckedChange={(checked) => handleToggle("notify_2_hours_before", checked)}
                data-testid="switch-2-hours"
              />
            </div>

            <div className="pt-4 border-t">
              <Label htmlFor="notification-time">เวลาส่งแจ้งเตือน (สำหรับ 7 วัน / 1 วัน)</Label>
              <Input
                id="notification-time"
                type="time"
                value={settings.notification_time?.slice(0, 5) || "09:00"}
                onChange={(e) => handleInputChange("notification_time", e.target.value + ":00")}
                className="mt-2 w-32"
                data-testid="input-notification-time"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              ช่องทางส่ง
            </CardTitle>
            <CardDescription>เลือกว่าจะส่งแจ้งเตือนไปที่ไหน</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <Label>ส่งในกลุ่ม LINE ด้วย</Label>
                <p className="text-sm text-muted-foreground">นอกเหนือจากส่วนตัว</p>
              </div>
              <Switch
                checked={settings.send_to_group}
                onCheckedChange={(checked) => handleToggle("send_to_group", checked)}
                data-testid="switch-group"
              />
            </div>

            {settings.send_to_group && (
              <div>
                <Label htmlFor="group-line-id">LINE Group ID</Label>
                <Input
                  id="group-line-id"
                  placeholder="C..."
                  value={settings.group_line_id || ""}
                  onChange={(e) => handleInputChange("group_line_id", e.target.value)}
                  className="mt-2"
                  data-testid="input-group-id"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Group ID จาก LINE Developers Console
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              ข้อความกำหนดเอง (ไม่บังคับ)
            </CardTitle>
            <CardDescription>ใส่ข้อความเพิ่มเติมที่ต้องการแสดงในการแจ้งเตือน</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="เช่น: อย่าลืมเตรียม Weekly Slip และ Visitor Invite Card มาด้วยนะครับ"
              value={settings.custom_message_template || ""}
              onChange={(e) => handleInputChange("custom_message_template", e.target.value)}
              rows={3}
              data-testid="input-custom-message"
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            ส่งแจ้งเตือนทดสอบ
          </CardTitle>
          <CardDescription>ทดสอบส่งแจ้งเตือนไปยังสมาชิกทั้งหมด (ใช้สำหรับ debug)</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            หมายเหตุ: การส่งทดสอบจะส่งไปยังสมาชิกทุกคนที่เชื่อมต่อ LINE แล้ว
          </p>
          <Button variant="outline" disabled data-testid="button-test-notification">
            <Send className="h-4 w-4 mr-2" />
            ส่งทดสอบ (เร็วๆ นี้)
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
