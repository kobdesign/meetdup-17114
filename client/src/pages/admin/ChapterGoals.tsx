import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useTenantContext } from "@/contexts/TenantContext";
import { supabase } from "@/integrations/supabase/client";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  ArrowLeft, 
  Plus, 
  Target, 
  Users, 
  UserCheck, 
  Calendar, 
  CalendarCheck,
  Gift,
  Trophy,
  Loader2,
  Trash2,
  RefreshCw,
  MapPin,
  Send
} from "lucide-react";
import { toast } from "sonner";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, addDays } from "date-fns";
import { th } from "date-fns/locale";

interface GoalTemplate {
  template_id: string;
  metric_type: string;
  name_th: string;
  name_en: string | null;
  description_th: string | null;
  icon: string;
  default_target: number;
}

interface MeetingInfo {
  meeting_id: string;
  meeting_date: string;
  meeting_time: string | null;
  theme: string | null;
  venue: string | null;
}

interface ChapterGoal {
  goal_id: string;
  tenant_id: string;
  template_id: string | null;
  metric_type: string;
  name: string;
  description: string | null;
  icon: string;
  target_value: number;
  current_value: number;
  progress_percent: number;
  start_date: string;
  end_date: string;
  meeting_id: string | null;
  meeting?: MeetingInfo | null;
  status: 'active' | 'achieved' | 'expired' | 'cancelled';
  achieved_at: string | null;
  created_at: string;
}

interface Meeting {
  meeting_id: string;
  meeting_date: string;
  theme: string | null;
  venue: string | null;
}

const iconMap: Record<string, any> = {
  target: Target,
  users: Users,
  "user-check": UserCheck,
  calendar: Calendar,
  "calendar-check": CalendarCheck,
  gift: Gift,
  trophy: Trophy,
};

function getIcon(iconName: string) {
  return iconMap[iconName] || Target;
}

function getDateRangeForMetric(metricType: string): { start: Date; end: Date } {
  const now = new Date();
  if (metricType.startsWith("weekly")) {
    return {
      start: startOfWeek(now, { weekStartsOn: 1 }),
      end: endOfWeek(now, { weekStartsOn: 1 })
    };
  } else if (metricType.startsWith("monthly")) {
    return {
      start: startOfMonth(now),
      end: endOfMonth(now)
    };
  } else {
    return {
      start: now,
      end: addDays(now, 30)
    };
  }
}

export default function ChapterGoals() {
  const navigate = useNavigate();
  const { effectiveTenantId: tenantId, selectedTenant } = useTenantContext();
  const tenantName = selectedTenant?.tenant_name || "";
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<GoalTemplate | null>(null);
  const [targetValue, setTargetValue] = useState("");
  const [customName, setCustomName] = useState("");
  const [customDescription, setCustomDescription] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedMeetingId, setSelectedMeetingId] = useState<string>("");
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [meetingsLoading, setMeetingsLoading] = useState(false);

  const { data: templates = [], isLoading: templatesLoading } = useQuery({
    queryKey: ["/api/goals/templates"],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No session");
      return apiRequest("/api/goals/templates", "GET", undefined, {
        headers: { Authorization: `Bearer ${session.access_token}` }
      });
    }
  });

  const { data: goals = [], isLoading: goalsLoading, refetch: refetchGoals } = useQuery({
    queryKey: ["/api/goals", tenantId, statusFilter],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No session");
      const url = statusFilter === "all" 
        ? `/api/goals?tenant_id=${tenantId}`
        : `/api/goals?tenant_id=${tenantId}&status=${statusFilter}`;
      return apiRequest(url, "GET", undefined, {
        headers: { Authorization: `Bearer ${session.access_token}` }
      });
    },
    enabled: !!tenantId
  });

  const createGoalMutation = useMutation({
    mutationFn: async (goalData: any) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No session");
      return apiRequest("/api/goals", "POST", goalData, {
        headers: { Authorization: `Bearer ${session.access_token}` }
      });
    },
    onSuccess: () => {
      toast.success("สร้างเป้าหมายสำเร็จ!");
      queryClient.invalidateQueries({ queryKey: ["/api/goals"] });
      setShowAddDialog(false);
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error.message || "เกิดข้อผิดพลาด");
    }
  });

  const deleteGoalMutation = useMutation({
    mutationFn: async (goalId: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No session");
      return apiRequest(`/api/goals/${goalId}`, "DELETE", undefined, {
        headers: { Authorization: `Bearer ${session.access_token}` }
      });
    },
    onSuccess: () => {
      toast.success("ลบเป้าหมายสำเร็จ!");
      queryClient.invalidateQueries({ queryKey: ["/api/goals"] });
    },
    onError: (error: any) => {
      toast.error(error.message || "เกิดข้อผิดพลาด");
    }
  });

  const recalculateMutation = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No session");
      return apiRequest("/api/goals/recalculate-all", "POST", { tenant_id: tenantId }, {
        headers: { Authorization: `Bearer ${session.access_token}` }
      });
    },
    onSuccess: (data: any) => {
      toast.success(`อัพเดท ${data.updated} เป้าหมาย${data.newly_achieved > 0 ? ` (บรรลุใหม่ ${data.newly_achieved})` : ""}`);
      queryClient.invalidateQueries({ queryKey: ["/api/goals"] });
    },
    onError: (error: any) => {
      toast.error(error.message || "เกิดข้อผิดพลาด");
    }
  });

  const sendSummaryMutation = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No session");
      return apiRequest("/api/goals/send-summary", "POST", { tenant_id: tenantId }, {
        headers: { Authorization: `Bearer ${session.access_token}` }
      });
    },
    onSuccess: (data: any) => {
      if (data.success) {
        toast.success(data.message || "ส่งสรุปเป้าหมายทาง LINE แล้ว");
      } else {
        toast.error(data.error || data.message || "ไม่สามารถส่งได้");
      }
    },
    onError: (error: any) => {
      toast.error(error.message || "เกิดข้อผิดพลาด");
    }
  });

  const fetchMeetings = async () => {
    if (!tenantId) return;
    setMeetingsLoading(true);
    try {
      const { data, error } = await supabase
        .from("meetings")
        .select("*")
        .eq("tenant_id", tenantId)
        .gte("meeting_date", new Date().toISOString().split("T")[0])
        .order("meeting_date", { ascending: true })
        .limit(20);
      
      if (error) throw error;
      setMeetings((data as Meeting[]) || []);
    } catch (error) {
      console.error("Failed to fetch meetings:", error);
    } finally {
      setMeetingsLoading(false);
    }
  };

  const resetForm = () => {
    setSelectedTemplate(null);
    setTargetValue("");
    setCustomName("");
    setCustomDescription("");
    setSelectedMeetingId("");
  };

  const handleDialogOpen = (open: boolean) => {
    setShowAddDialog(open);
    if (open) {
      resetForm();
      setMeetings([]);
    }
  };

  const handleTemplateSelect = (templateId: string) => {
    const template = templates.find((t: GoalTemplate) => t.template_id === templateId);
    if (template) {
      setSelectedTemplate(template);
      setTargetValue(template.default_target.toString());
      setCustomName(template.name_th);
      setCustomDescription(template.description_th || "");
      setSelectedMeetingId("");
      
      if (template.metric_type === "meeting_visitors" || template.metric_type === "meeting_checkins") {
        fetchMeetings();
      }
    }
  };

  const isMeetingBased = selectedTemplate?.metric_type === "meeting_visitors" || 
                         selectedTemplate?.metric_type === "meeting_checkins";
  
  const selectedMeeting = meetings.find(m => m.meeting_id === selectedMeetingId);
  
  const canSubmit = selectedTemplate && 
                    targetValue && 
                    !createGoalMutation.isPending && 
                    (!isMeetingBased || (selectedMeetingId && !meetingsLoading && meetings.length > 0));

  const handleCreateGoal = () => {
    if (!selectedTemplate || !targetValue || !customName) {
      toast.error("กรุณากรอกข้อมูลให้ครบ");
      return;
    }

    if (isMeetingBased && !selectedMeetingId) {
      toast.error("กรุณาเลือก Meeting");
      return;
    }

    let startDate: string;
    let endDate: string;

    if (isMeetingBased && selectedMeeting) {
      startDate = selectedMeeting.meeting_date;
      endDate = selectedMeeting.meeting_date;
    } else {
      const dateRange = getDateRangeForMetric(selectedTemplate.metric_type);
      startDate = format(dateRange.start, "yyyy-MM-dd");
      endDate = format(dateRange.end, "yyyy-MM-dd");
    }

    createGoalMutation.mutate({
      tenant_id: tenantId,
      template_id: selectedTemplate.template_id,
      metric_type: selectedTemplate.metric_type,
      name: customName,
      description: customDescription,
      icon: selectedTemplate.icon,
      target_value: parseInt(targetValue),
      start_date: startDate,
      end_date: endDate,
      meeting_id: isMeetingBased ? selectedMeetingId : null
    });
  };

  const activeGoals = goals.filter((g: ChapterGoal) => g.status === "active");
  const achievedGoals = goals.filter((g: ChapterGoal) => g.status === "achieved");

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">เป้าหมาย Chapter</h1>
            <p className="text-muted-foreground">{tenantName}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => recalculateMutation.mutate()}
            disabled={recalculateMutation.isPending}
            data-testid="button-recalculate"
          >
            {recalculateMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            อัพเดท Progress
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => sendSummaryMutation.mutate()}
            disabled={sendSummaryMutation.isPending}
            data-testid="button-send-summary"
          >
            {sendSummaryMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            ส่งสรุป LINE
          </Button>
          <Dialog open={showAddDialog} onOpenChange={handleDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-goal">
                <Plus className="h-4 w-4 mr-2" />
                ตั้งเป้าหมาย
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>ตั้งเป้าหมายใหม่</DialogTitle>
                <DialogDescription>
                  เลือกประเภทเป้าหมายและกำหนดค่าเป้าหมาย
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>ประเภทเป้าหมาย</Label>
                  <Select onValueChange={handleTemplateSelect}>
                    <SelectTrigger data-testid="select-goal-template">
                      <SelectValue placeholder="เลือกประเภท..." />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.map((template: GoalTemplate) => {
                        const Icon = getIcon(template.icon);
                        return (
                          <SelectItem 
                            key={template.template_id} 
                            value={template.template_id}
                          >
                            <div className="flex items-center gap-2">
                              <Icon className="h-4 w-4" />
                              <span>{template.name_th}</span>
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                {selectedTemplate && (
                  <>
                    {isMeetingBased && (
                      <div className="space-y-2">
                        <Label>เลือก Meeting</Label>
                        {meetingsLoading ? (
                          <div className="flex items-center gap-2 p-3 text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span>กำลังโหลด meetings...</span>
                          </div>
                        ) : meetings.length === 0 ? (
                          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md text-sm text-destructive">
                            ไม่พบ Meeting ที่กำลังจะมาถึง - กรุณาสร้าง Meeting ก่อนตั้งเป้าหมายประเภทนี้
                          </div>
                        ) : (
                          <Select 
                            value={selectedMeetingId} 
                            onValueChange={setSelectedMeetingId}
                          >
                            <SelectTrigger data-testid="select-meeting">
                              <SelectValue placeholder="เลือก Meeting..." />
                            </SelectTrigger>
                            <SelectContent>
                              {meetings.map((meeting) => (
                                <SelectItem 
                                  key={meeting.meeting_id} 
                                  value={meeting.meeting_id}
                                >
                                  <div className="flex items-center gap-2">
                                    <Calendar className="h-4 w-4" />
                                    <span>
                                      {format(new Date(meeting.meeting_date), "d MMM yyyy", { locale: th })}
                                      {meeting.theme && ` - ${meeting.theme}`}
                                    </span>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label>ชื่อเป้าหมาย</Label>
                      <Input
                        value={customName}
                        onChange={(e) => setCustomName(e.target.value)}
                        placeholder="เช่น Visitor สัปดาห์นี้"
                        data-testid="input-goal-name"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>รายละเอียด (ไม่บังคับ)</Label>
                      <Textarea
                        value={customDescription}
                        onChange={(e) => setCustomDescription(e.target.value)}
                        placeholder="รายละเอียดเพิ่มเติม..."
                        className="resize-none"
                        data-testid="input-goal-description"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>เป้าหมาย (จำนวน)</Label>
                      <Input
                        type="number"
                        value={targetValue}
                        onChange={(e) => setTargetValue(e.target.value)}
                        min="1"
                        data-testid="input-goal-target"
                      />
                    </div>

                    <div className="p-3 bg-muted rounded-md text-sm">
                      <p className="text-muted-foreground">
                        {isMeetingBased && selectedMeeting
                          ? `Meeting: ${format(new Date(selectedMeeting.meeting_date), "d MMMM yyyy", { locale: th })}`
                          : selectedTemplate.metric_type.startsWith("weekly") 
                            ? "ช่วงเวลา: รายสัปดาห์" 
                            : selectedTemplate.metric_type.startsWith("monthly") 
                              ? "ช่วงเวลา: รายเดือน" 
                              : "ช่วงเวลา: ไม่จำกัด"}
                      </p>
                    </div>
                  </>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => handleDialogOpen(false)}>
                  ยกเลิก
                </Button>
                <Button 
                  onClick={handleCreateGoal}
                  disabled={!canSubmit}
                  data-testid="button-confirm-create-goal"
                >
                  {createGoalMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  สร้างเป้าหมาย
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="flex gap-2">
          <Button
            variant={statusFilter === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setStatusFilter("all")}
          >
            ทั้งหมด
          </Button>
          <Button
            variant={statusFilter === "active" ? "default" : "outline"}
            size="sm"
            onClick={() => setStatusFilter("active")}
          >
            กำลังดำเนินการ
          </Button>
          <Button
            variant={statusFilter === "achieved" ? "default" : "outline"}
            size="sm"
            onClick={() => setStatusFilter("achieved")}
          >
            สำเร็จแล้ว
          </Button>
        </div>

        {goalsLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : goals.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Trophy className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground mb-4">ยังไม่มีเป้าหมาย</p>
              <Button onClick={() => setShowAddDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                ตั้งเป้าหมายแรก
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {goals.map((goal: ChapterGoal) => {
              const Icon = getIcon(goal.icon);
              const isAchieved = goal.status === "achieved";

              return (
                <Card 
                  key={goal.goal_id}
                  className={`relative overflow-visible ${isAchieved ? "border-green-500/50 bg-green-50/50 dark:bg-green-950/20" : ""}`}
                  data-testid={`goal-card-${goal.goal_id}`}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className={`p-3 rounded-lg ${isAchieved ? "bg-green-100 dark:bg-green-900/50" : "bg-primary/10"}`}>
                        <Icon className={`h-6 w-6 ${isAchieved ? "text-green-600 dark:text-green-400" : "text-primary"}`} />
                      </div>
                      <div className="flex items-center gap-2">
                        {isAchieved && (
                          <Badge variant="default" className="bg-green-600">
                            <Trophy className="h-3 w-3 mr-1" />
                            สำเร็จ
                          </Badge>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => deleteGoalMutation.mutate(goal.goal_id)}
                          data-testid={`button-delete-goal-${goal.goal_id}`}
                        >
                          <Trash2 className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </div>
                    </div>
                    <CardTitle className="text-lg mt-2">{goal.name}</CardTitle>
                    {goal.description && (
                      <CardDescription>{goal.description}</CardDescription>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">ความคืบหน้า</span>
                      <span className="font-semibold">
                        {goal.current_value}/{goal.target_value}
                      </span>
                    </div>
                    <Progress 
                      value={goal.progress_percent} 
                      className={isAchieved ? "[&>div]:bg-green-600" : ""}
                    />
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        {goal.meeting_id 
                          ? format(new Date(goal.start_date), "d MMM yyyy", { locale: th })
                          : `${format(new Date(goal.start_date), "d MMM", { locale: th })} - ${format(new Date(goal.end_date), "d MMM yyyy", { locale: th })}`
                        }
                      </span>
                      <span>{goal.progress_percent}%</span>
                    </div>
                    {goal.meeting_id && goal.meeting && (
                      <div className="p-2 bg-muted/50 rounded-md space-y-1">
                        <div className="flex items-center gap-1.5 text-xs font-medium">
                          <Calendar className="h-3 w-3 text-primary" />
                          <span>
                            {format(new Date(goal.meeting.meeting_date), "EEEE d MMMM yyyy", { locale: th })}
                            {goal.meeting.meeting_time && ` เวลา ${goal.meeting.meeting_time.slice(0, 5)} น.`}
                          </span>
                        </div>
                        {goal.meeting.theme && (
                          <div className="text-xs text-muted-foreground pl-4">
                            {goal.meeting.theme}
                          </div>
                        )}
                        {goal.meeting.venue && (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <MapPin className="h-3 w-3" />
                            <span>{goal.meeting.venue}</span>
                          </div>
                        )}
                      </div>
                    )}
                    {goal.meeting_id && !goal.meeting && (
                      <Badge variant="outline" className="text-xs">
                        <Calendar className="h-3 w-3 mr-1" />
                        Meeting Goal
                      </Badge>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
