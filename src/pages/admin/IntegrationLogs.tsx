import { useEffect, useState } from "react";
import AdminLayout from "@/components/layout/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useTenantContext } from "@/contexts/TenantContext";
import { toast } from "sonner";
import { RefreshCw, FileText, AlertCircle } from "lucide-react";
import { format } from "date-fns";

interface IntegrationLog {
  log_id: string;
  tenant_id: string;
  source: string;
  event_type: string;
  payload: any;
  metadata: any;
  created_at: string;
}

export default function IntegrationLogs() {
  const { effectiveTenantId, isSuperAdmin } = useTenantContext();
  const [logs, setLogs] = useState<IntegrationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  useEffect(() => {
    if (effectiveTenantId) {
      loadLogs();
    }
  }, [effectiveTenantId, sourceFilter]);

  const loadLogs = async () => {
    if (!effectiveTenantId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      let query = supabase
        .from("integration_logs")
        .select("*")
        .eq("tenant_id", effectiveTenantId)
        .order("created_at", { ascending: false })
        .limit(100);

      if (sourceFilter !== "all") {
        query = query.eq("source", sourceFilter);
      }

      const { data, error } = await query;

      if (error) throw error;

      setLogs(data || []);
    } catch (error: any) {
      console.error("Error loading logs:", error);
      toast.error("เกิดข้อผิดพลาดในการโหลด logs");
    } finally {
      setLoading(false);
    }
  };

  const getSourceBadgeColor = (source: string) => {
    switch (source) {
      case "line":
        return "bg-green-500";
      case "payment_gateway":
        return "bg-blue-500";
      case "api":
        return "bg-purple-500";
      default:
        return "bg-gray-500";
    }
  };

  const getEventTypeBadgeColor = (eventType: string) => {
    if (eventType.includes("error")) return "destructive";
    if (eventType.includes("success") || eventType.includes("replied")) return "default";
    return "secondary";
  };

  if (!effectiveTenantId && isSuperAdmin) {
    return (
      <AdminLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Integration Logs</h1>
            <p className="text-muted-foreground">ดู logs จากการเชื่อมต่อกับ LINE, Payment Gateway และ API อื่นๆ</p>
          </div>
          <Card>
            <CardContent className="py-8">
              <p className="text-center text-muted-foreground">
                กรุณาเลือก Chapter ที่ต้องการดู logs
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Integration Logs</h1>
            <p className="text-muted-foreground">ดู logs จากการเชื่อมต่อกับระบบภายนอก</p>
          </div>
          <Button onClick={loadLogs} disabled={loading} variant="outline">
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            รีเฟรช
          </Button>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Integration Logs</CardTitle>
                <CardDescription>
                  แสดง logs ล่าสุด 100 รายการ
                </CardDescription>
              </div>
              <Select value={sourceFilter} onValueChange={setSourceFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by source" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sources</SelectItem>
                  <SelectItem value="line">LINE</SelectItem>
                  <SelectItem value="payment_gateway">Payment Gateway</SelectItem>
                  <SelectItem value="api">API</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">กำลังโหลด logs...</div>
            ) : logs.length === 0 ? (
              <div className="text-center py-8">
                <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">ยังไม่มี logs</p>
              </div>
            ) : (
              <div className="space-y-2">
                {logs.map((log) => (
                  <Card key={log.log_id} className="border-l-4" style={{ borderLeftColor: log.metadata?.error ? 'rgb(239 68 68)' : 'rgb(34 197 94)' }}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge className={getSourceBadgeColor(log.source)}>
                              {log.source}
                            </Badge>
                            <Badge variant={getEventTypeBadgeColor(log.event_type)}>
                              {log.event_type}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(log.created_at), "dd/MM/yyyy HH:mm:ss")}
                            </span>
                          </div>
                          
                          {log.metadata?.user_id && (
                            <p className="text-sm text-muted-foreground">
                              User ID: {log.metadata.user_id}
                            </p>
                          )}
                          
                          {log.metadata?.error && (
                            <p className="text-sm text-destructive">
                              Error: {log.metadata.error}
                            </p>
                          )}
                          
                          {log.metadata?.message && (
                            <p className="text-sm">
                              Message: {log.metadata.message}
                            </p>
                          )}
                          
                          {expandedLog === log.log_id && (
                            <div className="mt-2 p-3 bg-muted rounded-md">
                              <p className="text-xs font-medium mb-2">Full Payload:</p>
                              <pre className="text-xs overflow-x-auto">
                                {JSON.stringify(log.payload, null, 2)}
                              </pre>
                              {log.metadata && Object.keys(log.metadata).length > 0 && (
                                <>
                                  <p className="text-xs font-medium mt-3 mb-2">Metadata:</p>
                                  <pre className="text-xs overflow-x-auto">
                                    {JSON.stringify(log.metadata, null, 2)}
                                  </pre>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                        
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setExpandedLog(expandedLog === log.log_id ? null : log.log_id)}
                        >
                          <FileText className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>ℹ️ LINE Webhook Setup</CardTitle>
            <CardDescription>วิธีตั้งค่า LINE webhook</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium mb-2">Webhook URL:</p>
              <code className="block p-3 bg-muted rounded-md text-sm break-all">
                {`${window.location.origin.replace('lovableproject.com', 'supabase.co')}/functions/v1/line-webhook/{tenant_slug}`}
              </code>
              <p className="text-xs text-muted-foreground mt-2">
                แทนที่ {'{tenant_slug}'} ด้วย slug ของ chapter คุณ
              </p>
            </div>
            
            <div className="border-t pt-4">
              <p className="text-sm font-medium mb-2">คำสั่งที่รองรับ:</p>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• <code className="bg-muted px-1">card &lt;name&gt;</code> - ค้นหานามบัตร</li>
                <li>• <code className="bg-muted px-1">checkin</code> - เปิดหน้า check-in</li>
                <li>• <code className="bg-muted px-1">pay</code> - แสดงข้อมูลการชำระเงิน</li>
                <li>• อื่นๆ - แสดง help message</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
