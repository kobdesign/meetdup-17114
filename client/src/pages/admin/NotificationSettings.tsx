import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import AdminLayout from "@/components/layout/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useTenantContext } from "@/contexts/TenantContext";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Bell, Clock, Users, Send, Settings, MessageSquare, Calendar, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface NotificationSettingsData {
  tenant_id: string;
  notify_7_days_before: boolean;
  notify_1_day_before: boolean;
  notify_2_hours_before: boolean;
  notification_time: string;
  send_to_group: boolean;
  group_line_id: string | null;
  custom_message_template: string | null;
}

interface Meeting {
  meeting_id: string;
  meeting_date: string;
  meeting_time: string | null;
  theme: string | null;
}

export default function NotificationSettings() {
  const { toast } = useToast();
  const { selectedTenantId } = useTenantContext();
  const [localSettings, setLocalSettings] = useState<NotificationSettingsData | null>(null);
  const [selectedMeetingId, setSelectedMeetingId] = useState<string>("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["/api/notifications/settings", selectedTenantId],
    queryFn: async () => {
      const response = await apiRequest(`/api/notifications/settings/${selectedTenantId}`, "GET");
      if (response.success) {
        return response.settings as NotificationSettingsData;
      }
      throw new Error(response.error);
    },
    enabled: !!selectedTenantId,
    staleTime: 0
  });

  // Fetch upcoming meetings
  const { data: meetingsData } = useQuery({
    queryKey: ["/api/meetings", selectedTenantId, "upcoming"],
    queryFn: async () => {
      const response = await apiRequest(`/api/meetings?tenant_id=${selectedTenantId}&upcoming=true`, "GET");
      if (response.success) {
        return response.meetings as Meeting[];
      }
      return [];
    },
    enabled: !!selectedTenantId
  });

  // Sync local state with query data
  useEffect(() => {
    if (data) {
      setLocalSettings(data);
    }
  }, [data]);

  // Auto-select first meeting if none selected
  useEffect(() => {
    if (meetingsData && meetingsData.length > 0 && !selectedMeetingId) {
      setSelectedMeetingId(meetingsData[0].meeting_id);
    }
  }, [meetingsData, selectedMeetingId]);

  const updateMutation = useMutation({
    mutationFn: async (newSettings: Partial<NotificationSettingsData>) => {
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

  // Test notification mutation (send to admin only)
  const testMutation = useMutation({
    mutationFn: async () => {
      return apiRequest(`/api/notifications/test/${selectedTenantId}`, "POST", {});
    },
    onSuccess: (data) => {
      toast({
        title: "ส่งทดสอบสำเร็จ",
        description: data.message || "กรุณาตรวจสอบ LINE ของคุณ"
      });
    },
    onError: (error: any) => {
      toast({
        title: "ส่งไม่สำเร็จ",
        description: error.message || "ไม่สามารถส่งแจ้งเตือนทดสอบได้",
        variant: "destructive"
      });
    }
  });

  // Manual trigger mutation (send to all members)
  const sendMutation = useMutation({
    mutationFn: async (meetingId: string) => {
      return apiRequest(`/api/notifications/send/${meetingId}`, "POST", { notification_type: "manual" });
    },
    onSuccess: (data) => {
      toast({
        title: "ส่งแจ้งเตือนสำเร็จ",
        description: data.message || `ส่ง ${data.sent} รายการ, ล้มเหลว ${data.failed} รายการ`
      });
    },
    onError: (error: any) => {
      toast({
        title: "ส่งไม่สำเร็จ",
        description: error.message || "ไม่สามารถส่งแจ้งเตือนได้",
        variant: "destructive"
      });
    }
  });

  const handleSave = () => {
    if (localSettings) {
      updateMutation.mutate(localSettings);
    }
  };

  const handleToggle = (key: keyof NotificationSettingsData, value: boolean) => {
    if (localSettings) {
      setLocalSettings({ ...localSettings, [key]: value });
    }
  };

  const handleInputChange = (key: keyof NotificationSettingsData, value: string) => {
    if (localSettings) {
      setLocalSettings({ ...localSettings, [key]: value });
    }
  };

  // Use data from query OR local state for rendering
  const settings = localSettings || data;

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="p-6 space-y-6">
          <Skeleton className="h-10 w-64" />
          <div className="grid gap-6 md:grid-cols-2">
            <Skeleton className="h-64" />
            <Skeleton className="h-64" />
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (error) {
    return (
      <AdminLayout>
        <div className="p-6">
          <Card>
            <CardContent className="p-6">
              <p className="text-muted-foreground">ไม่สามารถโหลดการตั้งค่าได้: {error.message}</p>
            </CardContent>
          </Card>
        </div>
      </AdminLayout>
    );
  }

  if (!settings) {
    return (
      <AdminLayout>
        <div className="p-6 space-y-6">
          <Skeleton className="h-10 w-64" />
          <div className="grid gap-6 md:grid-cols-2">
            <Skeleton className="h-64" />
            <Skeleton className="h-64" />
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
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

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="h-5 w-5" />
              ส่งแจ้งเตือนทดสอบ
            </CardTitle>
            <CardDescription>ส่ง Flex Message ทดสอบไปยัง LINE ของคุณ (Admin)</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              กดปุ่มเพื่อรับตัวอย่างแจ้งเตือนใน LINE ของคุณ
            </p>
            <Button 
              variant="outline" 
              onClick={() => testMutation.mutate()}
              disabled={testMutation.isPending}
              data-testid="button-test-notification"
            >
              {testMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              {testMutation.isPending ? "กำลังส่ง..." : "ส่งทดสอบ"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              ส่งแจ้งเตือน Meeting
            </CardTitle>
            <CardDescription>เลือก Meeting แล้วส่งแจ้งเตือนให้สมาชิกทุกคน</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>เลือก Meeting</Label>
              <Select 
                value={selectedMeetingId} 
                onValueChange={setSelectedMeetingId}
              >
                <SelectTrigger className="mt-2" data-testid="select-meeting">
                  <SelectValue placeholder="เลือก Meeting..." />
                </SelectTrigger>
                <SelectContent>
                  {meetingsData && meetingsData.length > 0 ? (
                    meetingsData.map((meeting) => {
                      const dateObj = new Date(meeting.meeting_date);
                      const formattedDate = dateObj.toLocaleDateString('th-TH', {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'short'
                      });
                      return (
                        <SelectItem 
                          key={meeting.meeting_id} 
                          value={meeting.meeting_id}
                        >
                          {formattedDate} - {meeting.theme || "ประชุมประจำสัปดาห์"}
                        </SelectItem>
                      );
                    })
                  ) : (
                    <SelectItem value="none" disabled>ไม่มี Meeting ที่กำลังจะมาถึง</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            <Button 
              onClick={() => selectedMeetingId && sendMutation.mutate(selectedMeetingId)}
              disabled={!selectedMeetingId || sendMutation.isPending}
              data-testid="button-send-notification"
            >
              {sendMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              {sendMutation.isPending ? "กำลังส่ง..." : "ส่งแจ้งเตือนทุกคน"}
            </Button>
            <p className="text-xs text-muted-foreground">
              จะส่งแจ้งเตือนไปยังสมาชิกทุกคนที่เชื่อมต่อ LINE แล้ว
            </p>
          </CardContent>
        </Card>
      </div>
      </div>
    </AdminLayout>
  );
}
