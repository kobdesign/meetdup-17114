import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTenantContext } from "@/contexts/TenantContext";
import { usePipelineRealtime } from "@/hooks/usePipelineRealtime";
import AdminLayout from "@/components/layout/AdminLayout";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  Search,
  MoreVertical,
  Phone,
  Mail,
  MessageCircle,
  Calendar,
  User,
  ArrowRight,
  Archive,
  Clock,
  TrendingUp,
  Users,
  UserPlus,
  CheckCircle,
  AlertTriangle,
  Download,
  Eye,
  EyeOff,
  AlertCircle,
  RefreshCw,
  Star,
  GraduationCap,
  FileText,
} from "lucide-react";

interface PipelineStage {
  id: number;
  stage_key: string;
  stage_name: string;
  stage_name_th: string;
  description: string;
  stage_group: string;
  stage_order: number;
  color: string;
  icon: string;
  auto_move_days: number | null;
  sub_statuses: SubStatus[];
  records: PipelineRecord[];
  count: number;
}

interface SubStatus {
  id: number;
  stage_key: string;
  sub_status_key: string;
  sub_status_name: string;
  sub_status_name_th: string;
  color: string;
}

interface PipelineRecord {
  id: string;
  tenant_id: string;
  participant_id: string | null;
  visitor_id: string | null;
  full_name: string;
  nickname_th: string | null;
  phone: string | null;
  email: string | null;
  line_id: string | null;
  current_stage: string;
  current_sub_status: string | null;
  stage_entered_at: string;
  owner_user_id: string | null;
  referrer_participant_id: string | null;
  referrer_name: string | null;
  source: string | null;
  meetings_attended: number;
  last_meeting_date: string | null;
  notes: string | null;
  tags: string[] | null;
  created_at: string;
}

const iconMap: Record<string, any> = {
  UserPlus: UserPlus,
  CheckCircle: CheckCircle,
  Calendar: Calendar,
  CalendarCheck: Calendar,
  Users: Users,
  MessageCircle: MessageCircle,
  FileText: FileText,
  CheckCircle2: CheckCircle,
  GraduationCap: GraduationCap,
  Star: Star,
  AlertTriangle: AlertTriangle,
  Archive: Archive,
  RefreshCw: RefreshCw,
};

interface ImportVisitor {
  participant_id: string;
  full_name: string;
  nickname_th: string | null;
  phone: string | null;
  email: string | null;
  status: string;
  referrer_name: string | null;
  first_meeting_date: string;
  first_meeting_name: string;
  meeting_count: number;
  checkin_count: number;
  recommended_stage: string;
}

const STAGE_LABELS: Record<string, string> = {
  lead: "Lead",
  attended: "เข้าประชุมแล้ว",
  revisit: "มาซ้ำ",
  follow_up: "กำลังติดตาม",
  application_submitted: "ยื่นใบสมัคร",
  active_member: "สมาชิก Active",
  onboarding: "Onboarding",
  archived: "Archive",
  // Legacy stage labels for backward compatibility
  rsvp_confirmed: "RSVP",
  attended_meeting: "เข้าประชุม",
  lead_capture: "Lead",
};

export default function ChapterPipeline() {
  const { selectedTenant, isReady } = useTenantContext();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");

  usePipelineRealtime({ tenantId: selectedTenant?.tenant_id || null });
  const [isMoveDialogOpen, setIsMoveDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<PipelineRecord | null>(null);
  const [targetStage, setTargetStage] = useState<string>("");
  const [moveReason, setMoveReason] = useState("");
  const [showStaleLeads, setShowStaleLeads] = useState(false);
  const [selectedImports, setSelectedImports] = useState<Set<string>>(new Set()); // selected participant_ids
  const [stageOverrides, setStageOverrides] = useState<Map<string, string>>(new Map()); // participant_id -> user-chosen stage
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [meetingFilter, setMeetingFilter] = useState<"all" | "upcoming" | "latest_past">("all");

  interface MeetingFilterData {
    upcoming: {
      meeting_id: string;
      meeting_date: string;
      meeting_name: string;
      participant_ids: string[];
    } | null;
    latest_past: {
      meeting_id: string;
      meeting_date: string;
      meeting_name: string;
      participant_ids: string[];
    } | null;
  }

  const { data: meetingFilterData } = useQuery<MeetingFilterData>({
    queryKey: ["/api/pipeline/meeting-filter", selectedTenant?.tenant_id],
    queryFn: () => apiRequest(`/api/pipeline/meeting-filter/${selectedTenant?.tenant_id}`),
    enabled: !!selectedTenant?.tenant_id,
  });

  // Calculate current selected meeting_id for filtering
  const selectedMeetingId = useMemo(() => {
    if (meetingFilter === "upcoming" && meetingFilterData?.upcoming) {
      return meetingFilterData.upcoming.meeting_id;
    } else if (meetingFilter === "latest_past" && meetingFilterData?.latest_past) {
      return meetingFilterData.latest_past.meeting_id;
    }
    return null;
  }, [meetingFilter, meetingFilterData]);

  const { data: kanbanData, isLoading } = useQuery<PipelineStage[]>({
    queryKey: ["/api/pipeline/kanban", selectedTenant?.tenant_id],
    queryFn: () => apiRequest(`/api/pipeline/kanban/${selectedTenant?.tenant_id}`),
    enabled: !!selectedTenant?.tenant_id,
  });

  const { data: stats } = useQuery({
    queryKey: ["/api/pipeline/stats", selectedTenant?.tenant_id, selectedMeetingId],
    queryFn: () => {
      const url = selectedMeetingId 
        ? `/api/pipeline/stats/${selectedTenant?.tenant_id}?meeting_id=${selectedMeetingId}`
        : `/api/pipeline/stats/${selectedTenant?.tenant_id}`;
      return apiRequest(url);
    },
    enabled: !!selectedTenant?.tenant_id,
  });

  const { data: importPreview, isLoading: isLoadingImport } = useQuery<{
    total_found: number;
    already_in_pipeline: number;
    visitors: ImportVisitor[];
  }>({
    queryKey: ["/api/pipeline/import-preview", selectedTenant?.tenant_id],
    queryFn: () => apiRequest(`/api/pipeline/import-preview/${selectedTenant?.tenant_id}`),
    enabled: isImportDialogOpen && !!selectedTenant?.tenant_id,
  });

  const moveRecordMutation = useMutation({
    mutationFn: async ({ recordId, toStage, reason }: { recordId: string; toStage: string; reason: string }) => {
      return apiRequest(`/api/pipeline/records/${recordId}/move`, "POST", {
        to_stage: toStage,
        change_reason: reason,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pipeline/kanban"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pipeline/stats"] });
      setIsMoveDialogOpen(false);
      setSelectedRecord(null);
      setTargetStage("");
      setMoveReason("");
      toast({ title: "ย้าย Stage สำเร็จ" });
    },
    onError: (error: any) => {
      toast({ title: "เกิดข้อผิดพลาด", description: error.message, variant: "destructive" });
    },
  });

  const archiveRecordMutation = useMutation({
    mutationFn: async ({ recordId, reason }: { recordId: string; reason: string }) => {
      return apiRequest(`/api/pipeline/records/${recordId}/archive`, "POST", {
        archive_reason: reason,
        sub_status: "declined",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pipeline/kanban"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pipeline/stats"] });
      toast({ title: "Archive สำเร็จ" });
    },
  });

  const importMutation = useMutation({
    mutationFn: async (visitors: { participant_id: string; target_stage: string }[]) => {
      return apiRequest("/api/pipeline/import-batch", "POST", {
        tenant_id: selectedTenant?.tenant_id,
        visitors,
      });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/pipeline/kanban"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pipeline/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pipeline/import-preview"] });
      setIsImportDialogOpen(false);
      setSelectedImports(new Set());
      setStageOverrides(new Map());
      toast({ title: `นำเข้า ${data.imported} รายการสำเร็จ` });
    },
    onError: (error: any) => {
      toast({ title: "เกิดข้อผิดพลาด", description: error.message, variant: "destructive" });
    },
  });

  const resetPipelineMutation = useMutation({
    mutationFn: async () => {
      return apiRequest(`/api/pipeline/reset/${selectedTenant?.tenant_id}`, "DELETE");
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/pipeline/kanban"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pipeline/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pipeline/import-preview"] });
      toast({ title: `ลบข้อมูล Pipeline ${data.deleted} รายการสำเร็จ` });
    },
    onError: (error: any) => {
      toast({ title: "เกิดข้อผิดพลาด", description: error.message, variant: "destructive" });
    },
  });

  const getDaysSinceUpdate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    return Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  };

  const getStaleStatus = (record: PipelineRecord) => {
    const days = getDaysSinceUpdate(record.stage_entered_at || record.created_at);
    if (days >= 30) return "critical";
    if (days >= 14) return "warning";
    return "ok";
  };

  const filteredKanbanData = useMemo(() => {
    if (!kanbanData) return kanbanData;
    
    const searchTerm = searchQuery.trim().toLowerCase();
    
    // Get meeting filter participant_ids
    let meetingParticipantIds: string[] | null = null;
    if (meetingFilter === "upcoming" && meetingFilterData?.upcoming) {
      meetingParticipantIds = meetingFilterData.upcoming.participant_ids;
    } else if (meetingFilter === "latest_past" && meetingFilterData?.latest_past) {
      meetingParticipantIds = meetingFilterData.latest_past.participant_ids;
    }
    
    return kanbanData.map(stage => {
      const filteredRecords = stage.records.filter(record => {
        const matchesSearch = !searchTerm || 
          (record.full_name || "").toLowerCase().includes(searchTerm) ||
          (record.nickname_th || "").toLowerCase().includes(searchTerm) ||
          (record.phone || "").toLowerCase().includes(searchTerm) ||
          (record.email || "").toLowerCase().includes(searchTerm);
        
        const staleStatus = getStaleStatus(record);
        const matchesStaleFilter = showStaleLeads || staleStatus !== "critical";
        
        // Meeting filter - match by visitor_id (which is participant_id in pipeline_records)
        let matchesMeeting = true;
        if (meetingParticipantIds && meetingParticipantIds.length > 0) {
          matchesMeeting = record.visitor_id ? meetingParticipantIds.includes(record.visitor_id) : false;
        }
        
        return matchesSearch && matchesStaleFilter && matchesMeeting;
      });
      
      return {
        ...stage,
        records: filteredRecords,
        count: filteredRecords.length
      };
    });
  }, [kanbanData, searchQuery, showStaleLeads, meetingFilter, meetingFilterData]);

  if (!isReady) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!selectedTenant) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            กรุณาเลือก Chapter ก่อน
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleMoveToStage = (record: PipelineRecord, stage: string) => {
    setSelectedRecord(record);
    setTargetStage(stage);
    setIsMoveDialogOpen(true);
  };

  const confirmMove = () => {
    if (selectedRecord && targetStage) {
      moveRecordMutation.mutate({
        recordId: selectedRecord.id,
        toStage: targetStage,
        reason: moveReason,
      });
    }
  };

  const getDaysInStage = (enteredAt: string) => {
    const entered = new Date(enteredAt);
    const now = new Date();
    const diff = Math.floor((now.getTime() - entered.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  const getStageGroupLabel = (group: string) => {
    const labels: Record<string, string> = {
      lead_intake: "Lead Intake",
      engagement: "Engagement",
      conversion: "Conversion",
      onboarding: "Onboarding",
      retention: "Retention",
    };
    return labels[group] || group;
  };

  
  const toggleImportSelection = (participantId: string) => {
    setSelectedImports(prev => {
      const newSet = new Set(prev);
      if (newSet.has(participantId)) {
        newSet.delete(participantId);
      } else {
        newSet.add(participantId);
      }
      return newSet;
    });
  };

  const updateImportStage = (participantId: string, stage: string) => {
    setStageOverrides(prev => {
      const newMap = new Map(prev);
      newMap.set(participantId, stage);
      return newMap;
    });
  };

  const getVisitorStage = (visitor: ImportVisitor): string => {
    return stageOverrides.get(visitor.participant_id) || visitor.recommended_stage;
  };

  const selectAllImports = () => {
    if (!importPreview?.visitors) return;
    setSelectedImports(new Set(importPreview.visitors.map(v => v.participant_id)));
  };

  const clearImportSelection = () => {
    setSelectedImports(new Set());
  };

  return (
    <AdminLayout>
      <div className="h-full flex flex-col">
        <div className="p-4 border-b flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-page-title">Chapter Growth Pipeline</h1>
            <p className="text-muted-foreground text-sm">
            ติดตาม Lead และ Visitor ตลอดเส้นทางสู่การเป็นสมาชิก
          </p>
        </div>
        
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="ค้นหาชื่อ, เบอร์โทร..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-64"
              data-testid="input-search"
            />
          </div>
          
          <div className="flex items-center gap-2">
            <Switch 
              id="stale-filter"
              checked={showStaleLeads}
              onCheckedChange={setShowStaleLeads}
            />
            <Label htmlFor="stale-filter" className="text-sm">
              {showStaleLeads ? <Eye className="h-4 w-4 inline mr-1" /> : <EyeOff className="h-4 w-4 inline mr-1" />}
              Lead นิ่ง 30+ วัน
            </Label>
          </div>

          <ToggleGroup 
            type="single" 
            value={meetingFilter} 
            onValueChange={(v) => v && setMeetingFilter(v as "all" | "upcoming" | "latest_past")}
            className="border rounded-md"
            data-testid="toggle-meeting-filter"
          >
            <ToggleGroupItem 
              value="upcoming" 
              disabled={!meetingFilterData?.upcoming}
              className="text-sm px-3"
            >
              <Calendar className="h-4 w-4 mr-1.5" />
              Meeting ปัจจุบัน
              {meetingFilterData?.upcoming && (
                <span className="text-muted-foreground ml-1">
                  ({new Date(meetingFilterData.upcoming.meeting_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })})
                </span>
              )}
            </ToggleGroupItem>
            <ToggleGroupItem 
              value="latest_past" 
              disabled={!meetingFilterData?.latest_past}
              className="text-sm px-3"
            >
              Meeting ที่ผ่านมา
              {meetingFilterData?.latest_past && (
                <span className="text-muted-foreground ml-1">
                  ({new Date(meetingFilterData.latest_past.meeting_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })})
                </span>
              )}
            </ToggleGroupItem>
            <ToggleGroupItem value="all" className="text-sm px-3">
              ทั้งหมด
            </ToggleGroupItem>
          </ToggleGroup>

          <Button variant="outline" onClick={() => setIsImportDialogOpen(true)} data-testid="button-import">
            <Download className="h-4 w-4 mr-2" />
            นำเข้า Visitor
          </Button>
        </div>
      </div>

      {stats && (
        <div className="p-4 border-b grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold">{(stats as any).total || 0}</div>
              <div className="text-xs text-muted-foreground">Total in Pipeline</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold">{(stats as any).by_group?.lead_intake || 0}</div>
              <div className="text-xs text-muted-foreground">Lead Intake</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold">{(stats as any).by_group?.engagement || 0}</div>
              <div className="text-xs text-muted-foreground">Engagement</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold">{(stats as any).by_group?.conversion || 0}</div>
              <div className="text-xs text-muted-foreground">Conversion</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold">{(stats as any).by_group?.onboarding || 0}</div>
              <div className="text-xs text-muted-foreground">Onboarding</div>
            </CardContent>
          </Card>
        </div>
      )}

      <ScrollArea className="flex-1">
        <div className="p-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : (
            <div className="flex gap-4 pb-4" style={{ minWidth: "max-content" }}>
              {filteredKanbanData?.map((stage) => {
                const IconComponent = iconMap[stage.icon] || User;
                
                return (
                  <div
                    key={stage.stage_key}
                    className="w-72 flex-shrink-0"
                    data-testid={`column-${stage.stage_key}`}
                  >
                    <div
                      className="rounded-t-lg p-3 flex items-center justify-between gap-2"
                      style={{ backgroundColor: stage.color + "20" }}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="w-6 h-6 rounded flex items-center justify-center"
                          style={{ backgroundColor: stage.color }}
                        >
                          <IconComponent className="h-3 w-3 text-white" />
                        </div>
                        <span className="font-medium text-sm">{stage.stage_name_th}</span>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {stage.count}
                      </Badge>
                    </div>
                    
                    <div
                      className="min-h-[400px] rounded-b-lg border border-t-0 p-2 space-y-2"
                      style={{ backgroundColor: stage.color + "05" }}
                    >
                      {stage.records.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground text-sm">
                          ไม่มีรายการ
                        </div>
                      ) : (
                        stage.records.map((record) => {
                          const daysInStage = getDaysInStage(record.stage_entered_at);
                          const isOverdue = stage.auto_move_days && daysInStage > stage.auto_move_days;
                          const staleStatus = getStaleStatus(record);
                          
                          return (
                            <Card
                              key={record.id}
                              className={`hover-elevate cursor-pointer ${isOverdue ? "border-orange-400" : ""} ${staleStatus === "critical" ? "border-red-400 opacity-60" : ""}`}
                              data-testid={`card-record-${record.id}`}
                            >
                              <CardContent className="p-3">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1 min-w-0">
                                    <div className="font-medium truncate flex items-center gap-1">
                                      {staleStatus === "warning" && (
                                        <AlertCircle className="h-3 w-3 text-yellow-500 flex-shrink-0" />
                                      )}
                                      {staleStatus === "critical" && (
                                        <AlertTriangle className="h-3 w-3 text-red-500 flex-shrink-0" />
                                      )}
                                      {record.full_name}
                                      {record.nickname_th && (
                                        <span className="text-muted-foreground font-normal">({record.nickname_th})</span>
                                      )}
                                    </div>
                                    {record.current_sub_status && (
                                      <Badge variant="outline" className="text-xs mt-1">
                                        {record.current_sub_status}
                                      </Badge>
                                    )}
                                  </div>
                                  
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="icon" className="h-6 w-6">
                                        <MoreVertical className="h-3 w-3" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      {kanbanData?.map((s) => (
                                        s.stage_key !== record.current_stage && (
                                          <DropdownMenuItem
                                            key={s.stage_key}
                                            onClick={() => handleMoveToStage(record, s.stage_key)}
                                          >
                                            <ArrowRight className="h-4 w-4 mr-2" />
                                            ย้ายไป {s.stage_name_th}
                                          </DropdownMenuItem>
                                        )
                                      ))}
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem
                                        onClick={() => archiveRecordMutation.mutate({ recordId: record.id, reason: "Archived" })}
                                        className="text-destructive"
                                      >
                                        <Archive className="h-4 w-4 mr-2" />
                                        Archive
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                                
                                <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                                  {record.referrer_name && (
                                    <div className="flex items-center gap-1">
                                      <UserPlus className="h-3 w-3" />
                                      <span>แนะนำโดย: {record.referrer_name}</span>
                                    </div>
                                  )}
                                  {record.phone && (
                                    <div className="flex items-center gap-1">
                                      <Phone className="h-3 w-3" />
                                      <span>{record.phone}</span>
                                    </div>
                                  )}
                                  {record.email && (
                                    <div className="flex items-center gap-1 truncate">
                                      <Mail className="h-3 w-3 flex-shrink-0" />
                                      <span className="truncate">{record.email}</span>
                                    </div>
                                  )}
                                  {record.line_id && (
                                    <div className="flex items-center gap-1">
                                      <MessageCircle className="h-3 w-3" />
                                      <span>{record.line_id}</span>
                                    </div>
                                  )}
                                </div>
                                
                                <div className="mt-2 flex items-center justify-between text-xs">
                                  <div className="flex items-center gap-1 text-muted-foreground">
                                    <Clock className="h-3 w-3" />
                                    <span>{daysInStage} วัน</span>
                                  </div>
                                  {record.meetings_attended > 0 && (
                                    <div className="flex flex-col items-end gap-0.5">
                                      <Badge variant="secondary" className="text-xs">
                                        เข้าประชุม {record.meetings_attended} ครั้ง
                                      </Badge>
                                      {record.last_meeting_date && !isNaN(new Date(record.last_meeting_date).getTime()) && (
                                        <span className="text-[10px] text-muted-foreground">
                                          ล่าสุด: {new Date(record.last_meeting_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      <Dialog open={isMoveDialogOpen} onOpenChange={setIsMoveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ย้าย Stage</DialogTitle>
            <DialogDescription>
              ย้าย {selectedRecord?.full_name} ไป Stage ใหม่
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label>ไปยัง Stage</Label>
              <div className="text-sm font-medium mt-1">
                {kanbanData?.find(s => s.stage_key === targetStage)?.stage_name_th}
              </div>
            </div>
            
            <div>
              <Label>เหตุผล (ไม่บังคับ)</Label>
              <Textarea
                value={moveReason}
                onChange={(e) => setMoveReason(e.target.value)}
                placeholder="บันทึกเหตุผลในการย้าย..."
                data-testid="input-move-reason"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsMoveDialogOpen(false)}>
              ยกเลิก
            </Button>
            <Button
              onClick={confirmMove}
              disabled={moveRecordMutation.isPending}
              data-testid="button-confirm-move"
            >
              {moveRecordMutation.isPending ? "กำลังย้าย..." : "ยืนยันการย้าย"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>นำเข้า Visitor ย้อนหลัง</DialogTitle>
            <DialogDescription>
              เลือก Visitor ที่เคยเข้าร่วมประชุมแต่ยังไม่อยู่ใน Pipeline
            </DialogDescription>
          </DialogHeader>
          
          {isLoadingImport ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div className="text-sm text-muted-foreground">
                  พบ {importPreview?.total_found || 0} คนที่สามารถนำเข้าได้
                  {importPreview?.already_in_pipeline ? ` (อยู่ใน Pipeline แล้ว ${importPreview.already_in_pipeline} คน)` : ""}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={selectAllImports}>
                    เลือกทั้งหมด
                  </Button>
                  <Button variant="outline" size="sm" onClick={clearImportSelection}>
                    ล้างการเลือก
                  </Button>
                </div>
              </div>
              
              {importPreview?.visitors && importPreview.visitors.length > 0 ? (
                <div className="border rounded-lg divide-y max-h-[300px] overflow-y-auto">
                  {importPreview.visitors.map((visitor) => (
                    <div
                      key={visitor.participant_id}
                      className="flex items-center gap-3 p-3 hover-elevate"
                    >
                      <Checkbox
                        checked={selectedImports.has(visitor.participant_id)}
                        onCheckedChange={() => toggleImportSelection(visitor.participant_id)}
                        data-testid={`checkbox-import-${visitor.participant_id}`}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">
                          {visitor.full_name}
                          {visitor.nickname_th && (
                            <span className="text-muted-foreground font-normal ml-1">({visitor.nickname_th})</span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                          {visitor.referrer_name && (
                            <span className="flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              {visitor.referrer_name}
                            </span>
                          )}
                          {visitor.phone && <span>{visitor.phone}</span>}
                          {visitor.checkin_count > 0 && (
                            <Badge variant="outline" className="text-xs">
                              Check-in {visitor.checkin_count} ครั้ง
                            </Badge>
                          )}
                          {visitor.meeting_count > 1 && (
                            <Badge variant="secondary" className="text-xs">
                              ลงทะเบียน {visitor.meeting_count} ครั้ง
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {selectedImports.has(visitor.participant_id) ? (
                          <Select
                            value={getVisitorStage(visitor)}
                            onValueChange={(value) => updateImportStage(visitor.participant_id, value)}
                          >
                            <SelectTrigger className="w-[120px] h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="rsvp_confirmed">RSVP</SelectItem>
                              <SelectItem value="attended_meeting">เข้าประชุม</SelectItem>
                              <SelectItem value="active_member">Member</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge 
                            variant={visitor.recommended_stage === "attended_meeting" ? "default" : "secondary"}
                            className="text-xs"
                          >
                            {STAGE_LABELS[visitor.recommended_stage] || visitor.recommended_stage}
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  ไม่พบ Visitor ที่สามารถนำเข้าได้
                </div>
              )}
              
              {selectedImports.size > 0 && (
                <div className="text-sm text-muted-foreground">
                  เลือกแล้ว <span className="font-bold text-foreground">{selectedImports.size}</span> คน
                </div>
              )}
            </div>
          )}
          
          <DialogFooter className="gap-2 flex-wrap">
            <Button 
              variant="destructive" 
              size="sm"
              onClick={() => setIsResetDialogOpen(true)}
              disabled={resetPipelineMutation.isPending}
            >
              {resetPipelineMutation.isPending ? "กำลังลบ..." : "Reset Pipeline"}
            </Button>
            <div className="flex-1" />
            <Button variant="outline" onClick={() => setIsImportDialogOpen(false)}>
              ยกเลิก
            </Button>
            <Button
              onClick={() => {
                if (!importPreview?.visitors) return;
                const visitors = Array.from(selectedImports).map(participant_id => {
                  const visitor = importPreview.visitors.find(v => v.participant_id === participant_id);
                  return {
                    participant_id,
                    target_stage: getVisitorStage(visitor!),
                  };
                });
                importMutation.mutate(visitors);
              }}
              disabled={selectedImports.size === 0 || importMutation.isPending}
              data-testid="button-confirm-import"
            >
              {importMutation.isPending ? "กำลังนำเข้า..." : `นำเข้า ${selectedImports.size} คน`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isResetDialogOpen} onOpenChange={setIsResetDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันการ Reset Pipeline</AlertDialogTitle>
            <AlertDialogDescription>
              การดำเนินการนี้จะลบข้อมูล Pipeline ทั้งหมดของ Chapter นี้ 
              รวมถึงประวัติการเปลี่ยน Stage ทั้งหมด ไม่สามารถกู้คืนได้
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                resetPipelineMutation.mutate();
                setIsResetDialogOpen(false);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              ยืนยันลบทั้งหมด
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </div>
    </AdminLayout>
  );
}
