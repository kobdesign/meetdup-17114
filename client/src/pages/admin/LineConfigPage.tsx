import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import AdminLayout from "@/components/layout/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, CheckCircle, XCircle, Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTenantContext } from "@/contexts/TenantContext";
import { supabase } from "@/integrations/supabase/client";
import SelectTenantPrompt from "@/components/SelectTenantPrompt";

const lineConfigSchema = z.object({
  channelAccessToken: z.string().optional(),
  channelSecret: z.string().optional(),
});

type LineConfigForm = z.infer<typeof lineConfigSchema>;

export default function LineConfigPage() {
  const { toast } = useToast();
  const { effectiveTenantId, isSuperAdmin } = useTenantContext();
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [webhookUrl, setWebhookUrl] = useState("");

  const form = useForm<LineConfigForm>({
    resolver: zodResolver(lineConfigSchema),
    defaultValues: {
      channelAccessToken: "",
      channelSecret: "",
    },
  });

  const { data: config, isLoading: isLoadingConfig } = useQuery({
    queryKey: ["/api/line/config", effectiveTenantId],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(
        `/api/line/config?tenantId=${effectiveTenantId}`,
        {
          headers: {
            "Authorization": `Bearer ${session?.access_token}`
          }
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch LINE configuration");
      }

      return response.json();
    },
    enabled: !!effectiveTenantId,
  });

  useEffect(() => {
    if (config && config.configured) {
      const isMasked = (value: string) => value.includes("••••");
      
      form.reset({
        channelAccessToken: isMasked(config.channelAccessToken) ? "" : config.channelAccessToken,
        channelSecret: isMasked(config.channelSecret) ? "" : config.channelSecret,
      });
    }
  }, [config, form]);

  const saveConfigMutation = useMutation({
    mutationFn: async (data: LineConfigForm) => {
      const { data: { session } } = await supabase.auth.getSession();

      const isUpdate = config?.configured;
      
      // Check if user provided any new values
      const hasNewToken = data.channelAccessToken && data.channelAccessToken.trim().length > 0;
      const hasNewSecret = data.channelSecret && data.channelSecret.trim().length > 0;
      
      // For new config, require both fields
      if (!isUpdate && (!hasNewToken || !hasNewSecret)) {
        throw new Error("กรุณากรอก Channel Access Token และ Channel Secret");
      }

      // For updates, need at least one field to change
      if (isUpdate && !hasNewToken && !hasNewSecret) {
        throw new Error("กรุณากรอกข้อมูลที่ต้องการเปลี่ยนแปลง");
      }

      // Build payload with only fields that user provided
      const payload: any = {
        tenantId: effectiveTenantId,
      };

      // Validate and get channel ID only if new token is provided
      if (hasNewToken) {
        const validateResponse = await fetch("/api/line/config/validate-token", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session?.access_token}`
          },
          body: JSON.stringify({
            accessToken: data.channelAccessToken
          })
        });

        if (!validateResponse.ok) {
          throw new Error("ไม่สามารถตรวจสอบ Access Token ได้");
        }

        const validationResult = await validateResponse.json();
        
        if (!validationResult.valid) {
          throw new Error(validationResult.error || "Invalid LINE Channel Access Token");
        }

        payload.channelId = validationResult.botUserId;

        if (!payload.channelId) {
          throw new Error("ไม่สามารถดึง LINE Bot User ID ได้");
        }
        
        payload.channelAccessToken = data.channelAccessToken;
      }

      // Add secret if provided
      if (hasNewSecret) {
        payload.channelSecret = data.channelSecret;
      }

      // Backend will merge with existing values and validate
      const response = await fetch("/api/line/config", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session?.access_token}`
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(errorData.error || "Failed to save configuration");
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "บันทึกสำเร็จ",
        description: "ตั้งค่า LINE Integration สำเร็จแล้ว",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "เกิดข้อผิดพลาด",
        description: error.message || "ไม่สามารถบันทึกการตั้งค่าได้",
        variant: "destructive",
      });
    },
  });

  const testConnectionMutation = useMutation({
    mutationFn: async () => {
      setTestStatus("testing");
      
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch("/api/line/webhook", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          destination: config?.channelId || "test-bot-id",
          events: [{
            type: "message",
            replyToken: "test-token",
            source: { type: "user", userId: "test-user" },
            message: { type: "text", text: "test" },
            timestamp: Date.now(),
          }],
        }),
      });

      if (!response.ok) throw new Error("Webhook test failed");
      return response.json();
    },
    onSuccess: () => {
      setTestStatus("success");
      toast({
        title: "ทดสอบสำเร็จ",
        description: "Webhook ทำงานปกติ",
      });
    },
    onError: () => {
      setTestStatus("error");
      toast({
        title: "ทดสอบล้มเหลว",
        description: "ไม่สามารถเชื่อมต่อ Webhook ได้",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: LineConfigForm) => {
    saveConfigMutation.mutate(data);
  };

  const copyWebhookUrl = () => {
    const baseUrl = window.location.origin;
    const url = `${baseUrl}/api/line/webhook`;
    navigator.clipboard.writeText(url);
    setWebhookUrl(url);
    toast({
      title: "คัดลอกแล้ว",
      description: "คัดลอก Webhook URL ไปยังคลิปบอร์ดแล้ว",
    });
  };

  if (!effectiveTenantId && isSuperAdmin) {
    return (
      <AdminLayout>
        <SelectTenantPrompt />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="max-w-4xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">LINE Integration</h1>
          <p className="text-muted-foreground mt-2">
            ตั้งค่าการเชื่อมต่อกับ LINE Official Account
          </p>
        </div>

        <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Webhook URL</CardTitle>
            <CardDescription>
              นำ URL นี้ไปตั้งค่าใน LINE Developers Console
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input
                readOnly
                value={webhookUrl || `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/line-webhook`}
                data-testid="input-webhook-url"
              />
              <Button
                onClick={copyWebhookUrl}
                variant="outline"
                size="icon"
                data-testid="button-copy-webhook-url"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>LINE Channel Credentials</CardTitle>
            <CardDescription>
              กรอกข้อมูลจาก LINE Developers Console
            </CardDescription>
          </CardHeader>
          <CardContent>
            {config?.configured && (
              <Alert className="mb-4" data-testid="alert-config-status">
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>LINE Integration ตั้งค่าแล้ว</strong>
                  <div className="mt-1 text-sm text-muted-foreground">
                    Channel ID: {config.channelId}
                  </div>
                  <div className="mt-1 text-sm">
                    ถ้าไม่ต้องการเปลี่ยนค่า ไม่จำเป็นต้องกรอกใหม่
                  </div>
                </AlertDescription>
              </Alert>
            )}
            
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="channelAccessToken"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Channel Access Token
                        {config?.configured && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            (ปัจจุบัน: {config.channelAccessToken})
                          </span>
                        )}
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder={config?.configured ? "กรอกเฉพาะเมื่อต้องการเปลี่ยนแปลง..." : "xxxxxxxxxx..."}
                          {...field}
                          data-testid="input-channel-access-token"
                        />
                      </FormControl>
                      <FormDescription>
                        Long-lived Channel Access Token จาก LINE Console
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="channelSecret"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Channel Secret
                        {config?.configured && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            (ปัจจุบัน: {config.channelSecret})
                          </span>
                        )}
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder={config?.configured ? "กรอกเฉพาะเมื่อต้องการเปลี่ยนแปลง..." : "xxxxxxxxxx..."}
                          {...field}
                          data-testid="input-channel-secret"
                        />
                      </FormControl>
                      <FormDescription>
                        Channel Secret สำหรับตรวจสอบ signature
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex gap-2">
                  <Button
                    type="submit"
                    disabled={saveConfigMutation.isPending}
                    data-testid="button-save-config"
                  >
                    {saveConfigMutation.isPending && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    บันทึกการตั้งค่า
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => testConnectionMutation.mutate()}
                    disabled={testConnectionMutation.isPending}
                    data-testid="button-test-webhook"
                  >
                    {testConnectionMutation.isPending && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    {testStatus === "success" && (
                      <CheckCircle className="mr-2 h-4 w-4 text-green-600" />
                    )}
                    {testStatus === "error" && (
                      <XCircle className="mr-2 h-4 w-4 text-red-600" />
                    )}
                    ทดสอบ Webhook
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>วิธีตั้งค่า LINE Official Account</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <h3 className="font-semibold">1. สร้าง LINE Official Account</h3>
              <p className="text-sm text-muted-foreground">
                ไปที่ LINE Developers Console และสร้าง Messaging API Channel
              </p>
            </div>

            <div className="space-y-2">
              <h3 className="font-semibold">2. ตั้งค่า Webhook</h3>
              <p className="text-sm text-muted-foreground">
                คัดลอก Webhook URL ข้างบนไปวางในช่อง Webhook URL ใน LINE Console
              </p>
            </div>

            <div className="space-y-2">
              <h3 className="font-semibold">3. เปิดใช้งาน Features</h3>
              <p className="text-sm text-muted-foreground">
                เปิดใช้งาน "Use webhooks" และ "Allow bot to join group chats"
              </p>
            </div>

            <div className="space-y-2">
              <h3 className="font-semibold">4. คัดลอก Credentials</h3>
              <p className="text-sm text-muted-foreground">
                คัดลอก Channel Access Token และ Channel Secret มากรอกในฟอร์มด้านบน
              </p>
            </div>
          </CardContent>
        </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
