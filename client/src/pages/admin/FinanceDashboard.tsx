import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTenantContext } from "@/contexts/TenantContext";
import AdminLayout from "@/components/layout/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Loader2, DollarSign, Users, AlertTriangle, CheckCircle, Settings, Calendar, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { queryClient, apiRequest } from "@/lib/queryClient";

interface DuesConfig {
  config_id: string;
  tenant_id: string;
  monthly_amount: number;
  due_day_of_month: number;
  grace_period_days: number;
  promptpay_number: string | null;
  promptpay_name: string | null;
  bank_name: string | null;
  bank_account_number: string | null;
  bank_account_name: string | null;
  is_active: boolean;
}

interface MemberDue {
  dues_id: string;
  dues_month: string;
  amount_due: number;
  amount_paid: number;
  status: string;
  due_date: string;
}

interface MemberSummary {
  participant_id: string;
  full_name_th: string;
  nickname_th: string | null;
  phone: string | null;
  company: string | null;
  photo_url: string | null;
  dues: MemberDue[];
  total_due: number;
  total_paid: number;
  overdue_months: number;
}

interface DuesSummary {
  members: MemberSummary[];
  summary: {
    total_members: number;
    total_due: number;
    total_paid: number;
    total_outstanding: number;
    members_with_overdue: number;
  };
}

export default function FinanceDashboard() {
  const { effectiveTenantId } = useTenantContext();
  const tenantId = effectiveTenantId;
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [overdueFilter, setOverdueFilter] = useState<string>("all");
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [configForm, setConfigForm] = useState({
    monthly_amount: "",
    due_day_of_month: "1",
    grace_period_days: "7",
    promptpay_number: "",
    promptpay_name: "",
    bank_name: "",
    bank_account_number: "",
    bank_account_name: "",
  });

  // Fetch dues config
  const { data: configData, isLoading: loadingConfig } = useQuery<{ success: boolean; data: DuesConfig | null }>({
    queryKey: ["/api/payments/dues-config", tenantId],
    queryFn: () => apiRequest(`/api/payments/dues-config/${tenantId}`),
    enabled: !!tenantId,
  });

  // Fetch member dues summary
  const { data: duesData, isLoading: loadingDues, refetch: refetchDues } = useQuery<{ success: boolean; data: DuesSummary }>({
    queryKey: ["/api/payments/member-dues-summary", tenantId],
    queryFn: () => apiRequest(`/api/payments/member-dues-summary/${tenantId}`),
    enabled: !!tenantId,
  });

  // Generate dues for current month
  const generateMutation = useMutation({
    mutationFn: async () => {
      const now = new Date();
      const duesMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
      return apiRequest("/api/payments/member-dues/generate", "POST", {
        tenant_id: tenantId,
        dues_month: duesMonth,
      });
    },
    onSuccess: (data: any) => {
      toast.success(`สร้างรายการค่ารายเดือนสำเร็จ ${data.count} รายการ`);
      queryClient.invalidateQueries({ queryKey: ["/api/payments/member-dues-summary", tenantId] });
    },
    onError: (err: any) => {
      toast.error(err.message || "ไม่สามารถสร้างรายการได้");
    },
  });

  // Bulk mark paid
  const bulkMarkPaidMutation = useMutation({
    mutationFn: async (duesIds: string[]) => {
      return apiRequest("/api/payments/member-dues/bulk-mark-paid", "POST", {
        dues_ids: duesIds,
      });
    },
    onSuccess: (data: any) => {
      toast.success(`บันทึกการชำระเงินสำเร็จ ${data.count} รายการ`);
      setSelectedMembers([]);
      queryClient.invalidateQueries({ queryKey: ["/api/payments/member-dues-summary", tenantId] });
    },
    onError: (err: any) => {
      toast.error(err.message || "ไม่สามารถบันทึกได้");
    },
  });

  // Save dues config
  const saveConfigMutation = useMutation({
    mutationFn: async () => {
      const bankName = configForm.bank_name && configForm.bank_name !== "none" ? configForm.bank_name : null;
      return apiRequest("/api/payments/dues-config", "POST", {
        tenant_id: tenantId,
        monthly_amount: parseFloat(configForm.monthly_amount) || 0,
        due_day_of_month: parseInt(configForm.due_day_of_month) || 1,
        grace_period_days: parseInt(configForm.grace_period_days) || 7,
        promptpay_number: configForm.promptpay_number || null,
        promptpay_name: configForm.promptpay_name || null,
        bank_name: bankName,
        bank_account_number: configForm.bank_account_number || null,
        bank_account_name: configForm.bank_account_name || null,
      });
    },
    onSuccess: () => {
      toast.success("บันทึกการตั้งค่าสำเร็จ");
      setConfigDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/payments/dues-config", tenantId] });
    },
    onError: (err: any) => {
      toast.error(err.message || "ไม่สามารถบันทึกได้");
    },
  });

  const config = configData?.data;
  const duesSummary = duesData?.data;

  // Filter members
  const filteredMembers = duesSummary?.members.filter((m) => {
    if (overdueFilter === "all") return true;
    if (overdueFilter === "overdue") return m.overdue_months > 0;
    if (overdueFilter === "paid") return m.overdue_months === 0 && m.total_paid > 0;
    return true;
  }) || [];

  const handleSelectMember = (participantId: string, checked: boolean) => {
    if (checked) {
      setSelectedMembers([...selectedMembers, participantId]);
    } else {
      setSelectedMembers(selectedMembers.filter((id) => id !== participantId));
    }
  };

  const handleBulkMarkPaid = () => {
    // Get all unpaid dues for selected members
    const unpaidDuesIds: string[] = [];
    for (const member of duesSummary?.members || []) {
      if (selectedMembers.includes(member.participant_id)) {
        for (const due of member.dues) {
          if (due.status !== "paid") {
            unpaidDuesIds.push(due.dues_id);
          }
        }
      }
    }
    
    if (unpaidDuesIds.length === 0) {
      toast.info("ไม่มีรายการค้างชำระ");
      return;
    }
    
    bulkMarkPaidMutation.mutate(unpaidDuesIds);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "paid":
        return <Badge variant="default" className="bg-green-500">จ่ายแล้ว</Badge>;
      case "partial":
        return <Badge variant="secondary">จ่ายบางส่วน</Badge>;
      case "overdue":
        return <Badge variant="destructive">ค้างชำระ</Badge>;
      case "waived":
        return <Badge variant="outline">ยกเว้น</Badge>;
      default:
        return <Badge variant="secondary">รอชำระ</Badge>;
    }
  };

  const formatMonth = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("th-TH", { month: "short", year: "2-digit" });
  };

  if (!tenantId) {
    return (
      <AdminLayout>
        <div className="p-6">
          <p className="text-muted-foreground">กรุณาเข้าสู่ระบบ</p>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-page-title">การเงิน</h1>
            <p className="text-muted-foreground">ติดตามค่ารายเดือนและค่าประชุม</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              onClick={() => refetchDues()}
              data-testid="button-refresh"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              รีเฟรช
            </Button>
            <Button
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending || !config}
              data-testid="button-generate-dues"
            >
              {generateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <Calendar className="h-4 w-4 mr-2" />
              สร้างรายการเดือนนี้
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        {loadingDues ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>สมาชิกทั้งหมด</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-muted-foreground" />
                    <span className="text-2xl font-bold" data-testid="text-total-members">
                      {duesSummary?.summary.total_members || 0}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>ยอดค้างชำระ</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-orange-500" />
                    <span className="text-2xl font-bold text-orange-600" data-testid="text-outstanding">
                      {(duesSummary?.summary.total_outstanding || 0).toLocaleString()}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>ยอดเก็บได้</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <span className="text-2xl font-bold text-green-600" data-testid="text-collected">
                      {(duesSummary?.summary.total_paid || 0).toLocaleString()}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>คนค้างชำระ</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-red-500" />
                    <span className="text-2xl font-bold text-red-600" data-testid="text-overdue-count">
                      {duesSummary?.summary.members_with_overdue || 0}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Config Warning or Current Config */}
            <Card className={!config ? "border-orange-200 bg-orange-50 dark:border-orange-900 dark:bg-orange-950" : ""}>
              <CardContent className="py-4">
                <div className="flex items-center gap-3 flex-wrap">
                  <Settings className={`h-5 w-5 ${!config ? "text-orange-500" : "text-muted-foreground"}`} />
                  {!config ? (
                    <>
                      <div className="flex-1">
                        <p className="font-medium">ยังไม่ได้ตั้งค่าค่ารายเดือน</p>
                        <p className="text-sm text-muted-foreground">กรุณาตั้งค่าเพื่อเริ่มติดตามการชำระเงิน</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex-1">
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground">ค่ารายเดือน</p>
                            <p className="font-medium">{config.monthly_amount.toLocaleString()} บาท</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">วันครบกำหนด</p>
                            <p className="font-medium">วันที่ {config.due_day_of_month}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">ผ่อนผัน</p>
                            <p className="font-medium">{config.grace_period_days} วัน</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">PromptPay</p>
                            <p className="font-medium">{config.promptpay_number || "-"}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">ธนาคาร</p>
                            <p className="font-medium">{config.bank_name ? `${config.bank_name}` : "-"}</p>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                  <Dialog open={configDialogOpen} onOpenChange={(open) => {
                    if (open) {
                      setConfigForm({
                        monthly_amount: config ? String(config.monthly_amount) : "",
                        due_day_of_month: config ? String(config.due_day_of_month) : "1",
                        grace_period_days: config ? String(config.grace_period_days) : "7",
                        promptpay_number: config?.promptpay_number || "",
                        promptpay_name: config?.promptpay_name || "",
                        bank_name: config?.bank_name || "",
                        bank_account_number: config?.bank_account_number || "",
                        bank_account_name: config?.bank_account_name || "",
                      });
                    }
                    setConfigDialogOpen(open);
                  }}>
                    <DialogTrigger asChild>
                      <Button 
                        variant={!config ? "default" : "outline"}
                        data-testid="button-config"
                      >
                        <Settings className="h-4 w-4 mr-2" />
                        {!config ? "ตั้งค่า" : "แก้ไข"}
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>ตั้งค่าค่ารายเดือน</DialogTitle>
                        <DialogDescription>
                          กำหนดจำนวนเงินและรายละเอียดการชำระเงินสำหรับสมาชิก
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label htmlFor="monthly_amount">ค่ารายเดือน (บาท)</Label>
                          <Input
                            id="monthly_amount"
                            type="number"
                            placeholder="1000"
                            value={configForm.monthly_amount}
                            onChange={(e) => setConfigForm({ ...configForm, monthly_amount: e.target.value })}
                            data-testid="input-monthly-amount"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="due_day">วันครบกำหนด</Label>
                            <Select
                              value={configForm.due_day_of_month}
                              onValueChange={(v) => setConfigForm({ ...configForm, due_day_of_month: v })}
                            >
                              <SelectTrigger data-testid="select-due-day">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {[1, 5, 10, 15, 20, 25, 28].map((d) => (
                                  <SelectItem key={d} value={String(d)}>วันที่ {d}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="grace_days">ระยะผ่อนผัน (วัน)</Label>
                            <Input
                              id="grace_days"
                              type="number"
                              value={configForm.grace_period_days}
                              onChange={(e) => setConfigForm({ ...configForm, grace_period_days: e.target.value })}
                              data-testid="input-grace-days"
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="promptpay_number">เลข PromptPay</Label>
                          <Input
                            id="promptpay_number"
                            placeholder="08x-xxx-xxxx"
                            value={configForm.promptpay_number}
                            onChange={(e) => setConfigForm({ ...configForm, promptpay_number: e.target.value })}
                            data-testid="input-promptpay-number"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="promptpay_name">ชื่อบัญชี PromptPay</Label>
                          <Input
                            id="promptpay_name"
                            placeholder="ชื่อ-นามสกุล"
                            value={configForm.promptpay_name}
                            onChange={(e) => setConfigForm({ ...configForm, promptpay_name: e.target.value })}
                            data-testid="input-promptpay-name"
                          />
                        </div>
                        
                        <div className="pt-2 border-t">
                          <p className="text-sm font-medium mb-3">บัญชีธนาคาร (ทางเลือก)</p>
                          <div className="space-y-3">
                            <div className="space-y-2">
                              <Label htmlFor="bank_name">ธนาคาร</Label>
                              <Select
                                value={configForm.bank_name}
                                onValueChange={(v) => setConfigForm({ ...configForm, bank_name: v })}
                              >
                                <SelectTrigger data-testid="select-bank">
                                  <SelectValue placeholder="เลือกธนาคาร" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">ไม่ระบุ</SelectItem>
                                  <SelectItem value="SCB">ไทยพาณิชย์ (SCB)</SelectItem>
                                  <SelectItem value="KBANK">กสิกรไทย (KBANK)</SelectItem>
                                  <SelectItem value="BBL">กรุงเทพ (BBL)</SelectItem>
                                  <SelectItem value="KTB">กรุงไทย (KTB)</SelectItem>
                                  <SelectItem value="TMB">ทหารไทยธนชาต (TTB)</SelectItem>
                                  <SelectItem value="BAY">กรุงศรี (BAY)</SelectItem>
                                  <SelectItem value="GSB">ออมสิน (GSB)</SelectItem>
                                  <SelectItem value="BAAC">ธ.ก.ส. (BAAC)</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="bank_account_number">เลขบัญชี</Label>
                              <Input
                                id="bank_account_number"
                                placeholder="xxx-x-xxxxx-x"
                                value={configForm.bank_account_number}
                                onChange={(e) => setConfigForm({ ...configForm, bank_account_number: e.target.value })}
                                data-testid="input-bank-account-number"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="bank_account_name">ชื่อบัญชี</Label>
                              <Input
                                id="bank_account_name"
                                placeholder="ชื่อ-นามสกุล"
                                value={configForm.bank_account_name}
                                onChange={(e) => setConfigForm({ ...configForm, bank_account_name: e.target.value })}
                                data-testid="input-bank-account-name"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button
                          variant="outline"
                          onClick={() => setConfigDialogOpen(false)}
                        >
                          ยกเลิก
                        </Button>
                        <Button
                          onClick={() => saveConfigMutation.mutate()}
                          disabled={saveConfigMutation.isPending || !configForm.monthly_amount}
                          data-testid="button-save-config"
                        >
                          {saveConfigMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                          บันทึก
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardContent>
            </Card>

            {/* Member Dues List */}
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <CardTitle>สถานะการชำระค่ารายเดือน</CardTitle>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Select value={overdueFilter} onValueChange={setOverdueFilter}>
                      <SelectTrigger className="w-40" data-testid="select-filter">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">ทั้งหมด</SelectItem>
                        <SelectItem value="overdue">ค้างชำระ</SelectItem>
                        <SelectItem value="paid">จ่ายแล้ว</SelectItem>
                      </SelectContent>
                    </Select>
                    {selectedMembers.length > 0 && (
                      <Button
                        onClick={handleBulkMarkPaid}
                        disabled={bulkMarkPaidMutation.isPending}
                        data-testid="button-bulk-mark-paid"
                      >
                        {bulkMarkPaidMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        <CheckCircle className="h-4 w-4 mr-2" />
                        บันทึกจ่ายแล้ว ({selectedMembers.length})
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {filteredMembers.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">ไม่มีข้อมูล</p>
                ) : (
                  <div className="space-y-3">
                    {filteredMembers.map((member) => (
                      <div
                        key={member.participant_id}
                        className="flex items-start gap-3 p-3 rounded-lg border"
                        data-testid={`row-member-${member.participant_id}`}
                      >
                        <Checkbox
                          checked={selectedMembers.includes(member.participant_id)}
                          onCheckedChange={(checked) =>
                            handleSelectMember(member.participant_id, checked as boolean)
                          }
                          data-testid={`checkbox-member-${member.participant_id}`}
                        />
                        
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={member.photo_url || undefined} />
                          <AvatarFallback>{member.full_name_th?.charAt(0) || "?"}</AvatarFallback>
                        </Avatar>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium">{member.full_name_th}</p>
                            {member.nickname_th && (
                              <span className="text-sm text-muted-foreground">({member.nickname_th})</span>
                            )}
                            {member.overdue_months > 0 && (
                              <Badge variant="destructive" className="text-xs">
                                ค้าง {member.overdue_months} เดือน
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">{member.company || member.phone || "-"}</p>
                          
                          {/* Month chips */}
                          <div className="flex items-center gap-1 mt-2 flex-wrap">
                            {member.dues.slice(0, 6).map((due) => (
                              <div
                                key={due.dues_id}
                                className="flex items-center gap-1"
                              >
                                <span className="text-xs text-muted-foreground">{formatMonth(due.dues_month)}</span>
                                {getStatusBadge(due.status)}
                              </div>
                            ))}
                          </div>
                        </div>
                        
                        <div className="text-right shrink-0">
                          <p className="text-sm text-muted-foreground">ค้างชำระ</p>
                          <p className="font-bold text-lg">
                            {(member.total_due - member.total_paid).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
