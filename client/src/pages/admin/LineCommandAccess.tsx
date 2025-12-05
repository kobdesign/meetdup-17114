import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useTenantContext } from "@/contexts/TenantContext";
import { supabase } from "@/integrations/supabase/client";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  ArrowLeft, 
  Shield,
  Users,
  Globe,
  Lock,
  MessageSquare,
  Loader2,
  Save,
  RefreshCw
} from "lucide-react";
import { toast } from "sonner";

type AccessLevel = 'public' | 'member' | 'admin';

interface CommandPermission {
  command_key: string;
  command_name: string;
  command_description: string | null;
  access_level: AccessLevel;
  allow_group: boolean;
}

interface PermissionChange {
  command_key: string;
  access_level?: AccessLevel;
  allow_group?: boolean;
}

const accessLevelLabels: Record<AccessLevel, { label: string; icon: any; color: string }> = {
  public: { 
    label: 'ทุกคน (Public)', 
    icon: Globe, 
    color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
  },
  member: { 
    label: 'สมาชิก (Member)', 
    icon: Users, 
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' 
  },
  admin: { 
    label: 'แอดมินเท่านั้น (Admin)', 
    icon: Lock, 
    color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' 
  },
};

export default function LineCommandAccess() {
  const navigate = useNavigate();
  const { effectiveTenantId } = useTenantContext();
  const [pendingChanges, setPendingChanges] = useState<Map<string, PermissionChange>>(new Map());

  const tenantId = effectiveTenantId;

  const { data: permissionsData, isLoading, refetch } = useQuery({
    queryKey: ['/api/line/command-access', tenantId],
    queryFn: async () => {
      if (!tenantId) return { permissions: [] };
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No session");
      
      const response = await fetch(`/api/line/command-access?tenant_id=${tenantId}`, {
        headers: { Authorization: `Bearer ${session.access_token}` }
      });
      
      if (!response.ok) {
        throw new Error("Failed to fetch permissions");
      }
      
      return response.json();
    },
    enabled: !!tenantId
  });

  const savePermissionsMutation = useMutation({
    mutationFn: async (changes: PermissionChange[]) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No session");
      
      return apiRequest("/api/line/command-access", "POST", {
        tenant_id: tenantId,
        permissions: changes
      }, {
        headers: { Authorization: `Bearer ${session.access_token}` }
      });
    },
    onSuccess: () => {
      toast.success("บันทึกการตั้งค่าสิทธิ์เรียบร้อยแล้ว");
      setPendingChanges(new Map());
      queryClient.invalidateQueries({ queryKey: ['/api/line/command-access', tenantId] });
    },
    onError: (error: any) => {
      toast.error(error.message || "ไม่สามารถบันทึกได้");
    }
  });

  const permissions: CommandPermission[] = permissionsData?.permissions || [];

  const getEffectiveValue = (perm: CommandPermission, field: 'access_level' | 'allow_group') => {
    const change = pendingChanges.get(perm.command_key);
    if (change && field in change) {
      return change[field];
    }
    return perm[field];
  };

  const handleAccessLevelChange = (commandKey: string, newLevel: AccessLevel) => {
    const newChanges = new Map(pendingChanges);
    const existing = newChanges.get(commandKey) || { command_key: commandKey };
    newChanges.set(commandKey, { ...existing, access_level: newLevel });
    setPendingChanges(newChanges);
  };

  const handleAllowGroupChange = (commandKey: string, allowed: boolean) => {
    const newChanges = new Map(pendingChanges);
    const existing = newChanges.get(commandKey) || { command_key: commandKey };
    newChanges.set(commandKey, { ...existing, allow_group: allowed });
    setPendingChanges(newChanges);
  };

  const handleSave = () => {
    if (pendingChanges.size === 0) {
      toast.info("ไม่มีการเปลี่ยนแปลง");
      return;
    }
    savePermissionsMutation.mutate(Array.from(pendingChanges.values()));
  };

  const handleReset = () => {
    setPendingChanges(new Map());
  };

  const hasPendingChanges = pendingChanges.size > 0;

  if (!tenantId) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">กรุณาเลือก Chapter ก่อน</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => navigate("/admin")}
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Shield className="h-6 w-6" />
              สิทธิ์คำสั่ง LINE Bot
            </h1>
            <p className="text-sm text-muted-foreground">
              กำหนดว่าใครสามารถใช้คำสั่งใดได้บ้าง
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {hasPendingChanges && (
            <Button 
              variant="outline" 
              onClick={handleReset}
              data-testid="button-reset-changes"
            >
              ยกเลิกการเปลี่ยนแปลง
            </Button>
          )}
          <Button
            onClick={handleSave}
            disabled={!hasPendingChanges || savePermissionsMutation.isPending}
            data-testid="button-save-permissions"
          >
            {savePermissionsMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            บันทึก
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            คำสั่งที่ใช้ได้
          </CardTitle>
          <CardDescription>
            ระบบจะตรวจสอบสิทธิ์ก่อนประมวลผลคำสั่งจาก LINE
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              <span>กำลังโหลด...</span>
            </div>
          ) : permissions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>ไม่พบการตั้งค่าคำสั่ง</p>
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-4"
                onClick={() => refetch()}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                รีเฟรช
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {permissions.map((perm) => {
                const effectiveLevel = getEffectiveValue(perm, 'access_level') as AccessLevel;
                const effectiveAllowGroup = getEffectiveValue(perm, 'allow_group') as boolean;
                const levelInfo = accessLevelLabels[effectiveLevel];
                const LevelIcon = levelInfo.icon;
                const hasChange = pendingChanges.has(perm.command_key);

                return (
                  <div 
                    key={perm.command_key}
                    className={`p-4 border rounded-lg ${hasChange ? 'border-primary bg-primary/5' : ''}`}
                    data-testid={`permission-row-${perm.command_key}`}
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-medium">{perm.command_name}</h3>
                          {hasChange && (
                            <Badge variant="outline" className="text-xs">
                              มีการเปลี่ยนแปลง
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {perm.command_description || `คำสั่ง: ${perm.command_key}`}
                        </p>
                      </div>

                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
                        <div className="flex items-center gap-2">
                          <Label 
                            htmlFor={`access-${perm.command_key}`}
                            className="text-sm whitespace-nowrap"
                          >
                            สิทธิ์:
                          </Label>
                          <Select
                            value={effectiveLevel}
                            onValueChange={(value: AccessLevel) => handleAccessLevelChange(perm.command_key, value)}
                          >
                            <SelectTrigger 
                              id={`access-${perm.command_key}`}
                              className="w-[180px]"
                              data-testid={`select-access-${perm.command_key}`}
                            >
                              <SelectValue>
                                <span className="flex items-center gap-2">
                                  <LevelIcon className="h-4 w-4" />
                                  {levelInfo.label}
                                </span>
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(accessLevelLabels).map(([level, info]) => {
                                const Icon = info.icon;
                                return (
                                  <SelectItem key={level} value={level}>
                                    <span className="flex items-center gap-2">
                                      <Icon className="h-4 w-4" />
                                      {info.label}
                                    </span>
                                  </SelectItem>
                                );
                              })}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="flex items-center gap-2">
                          <Switch
                            id={`group-${perm.command_key}`}
                            checked={effectiveAllowGroup}
                            onCheckedChange={(checked) => handleAllowGroupChange(perm.command_key, checked)}
                            data-testid={`switch-group-${perm.command_key}`}
                          />
                          <Label 
                            htmlFor={`group-${perm.command_key}`}
                            className="text-sm whitespace-nowrap"
                          >
                            ใช้ใน Group ได้
                          </Label>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>คำอธิบายระดับสิทธิ์</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Object.entries(accessLevelLabels).map(([level, info]) => {
              const Icon = info.icon;
              return (
                <div key={level} className="flex items-start gap-3">
                  <Badge className={info.color}>
                    <Icon className="h-3 w-3 mr-1" />
                    {level}
                  </Badge>
                  <p className="text-sm text-muted-foreground">
                    {level === 'public' && 'ทุกคนที่ส่งข้อความมาที่ Bot สามารถใช้คำสั่งนี้ได้'}
                    {level === 'member' && 'เฉพาะสมาชิกที่ผูกบัญชี LINE กับระบบแล้วเท่านั้นที่ใช้ได้'}
                    {level === 'admin' && 'เฉพาะ Chapter Admin และ Super Admin เท่านั้นที่ใช้ได้'}
                  </p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
