import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import AdminLayout from "@/components/layout/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle, XCircle, Copy, ExternalLink, MessageSquare, Smartphone, Link as LinkIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTenantContext } from "@/contexts/TenantContext";
import { supabase } from "@/integrations/supabase/client";

export default function SuperAdminLineConfigPage() {
  const { toast } = useToast();
  const { isSuperAdmin } = useTenantContext();
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [testMessage, setTestMessage] = useState("");
  
  const webhookUrl = `${window.location.origin}/api/line/webhook`;

  const { data: config, isLoading } = useQuery({
    queryKey: ["/api/line/config/shared-config"],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch("/api/line/config/shared-config", {
        headers: {
          "Authorization": `Bearer ${session?.access_token}`
        }
      });

      if (!response.ok) {
        throw new Error("Failed to fetch LINE configuration");
      }

      return response.json();
    },
    enabled: isSuperAdmin,
  });

  const handleTestConnection = async () => {
    setTestStatus("testing");
    setTestMessage("");
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch("/api/line/config/shared-config/test", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${session?.access_token}`
        }
      });
      
      const result = await response.json();
      
      if (result.success) {
        setTestStatus("success");
        setTestMessage(`Connected to: ${result.botName || "LINE Bot"}`);
      } else {
        setTestStatus("error");
        setTestMessage(result.error || "Connection failed");
      }
    } catch (error: any) {
      setTestStatus("error");
      setTestMessage(error.message || "Connection failed");
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: `${label} copied to clipboard`,
    });
  };

  if (!isSuperAdmin) {
    return (
      <AdminLayout>
        <div className="container py-6">
          <Alert variant="destructive">
            <AlertDescription>
              You don't have permission to access this page.
            </AlertDescription>
          </Alert>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="container py-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">LINE Configuration</h1>
          <p className="text-muted-foreground">
            Shared LINE Official Account configuration for all chapters
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {/* Messaging API Config */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Messaging API
                </CardTitle>
                <CardDescription>
                  LINE Official Account credentials for webhooks and messaging
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Channel Access Token</label>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant={config?.hasAccessToken ? "default" : "destructive"}>
                      {config?.hasAccessToken ? "Configured" : "Not Set"}
                    </Badge>
                    {config?.hasAccessToken && (
                      <span className="text-sm text-muted-foreground">
                        {config.accessTokenPreview}
                      </span>
                    )}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium">Channel Secret</label>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant={config?.hasChannelSecret ? "default" : "destructive"}>
                      {config?.hasChannelSecret ? "Configured" : "Not Set"}
                    </Badge>
                    {config?.hasChannelSecret && (
                      <span className="text-sm text-muted-foreground">
                        {config.channelSecretPreview}
                      </span>
                    )}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium">Channel ID</label>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant={config?.hasChannelId ? "default" : "secondary"}>
                      {config?.channelId || "Not Set"}
                    </Badge>
                  </div>
                </div>

                <div className="pt-2">
                  <Button 
                    onClick={handleTestConnection}
                    disabled={testStatus === "testing" || !config?.hasAccessToken}
                    data-testid="button-test-connection"
                  >
                    {testStatus === "testing" ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : testStatus === "success" ? (
                      <CheckCircle className="mr-2 h-4 w-4 text-green-500" />
                    ) : testStatus === "error" ? (
                      <XCircle className="mr-2 h-4 w-4 text-red-500" />
                    ) : null}
                    Test Connection
                  </Button>
                  {testMessage && (
                    <p className={`text-sm mt-2 ${testStatus === "success" ? "text-green-600" : "text-red-600"}`}>
                      {testMessage}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* LIFF Config */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Smartphone className="h-5 w-5" />
                  LIFF Configuration
                </CardTitle>
                <CardDescription>
                  LINE Frontend Framework for in-app web pages
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium">LIFF ID</label>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant={config?.hasLiffId ? "default" : "destructive"}>
                      {config?.hasLiffId ? "Configured" : "Not Set"}
                    </Badge>
                    {config?.liffId && (
                      <span className="text-sm text-muted-foreground font-mono">
                        {config.liffId}
                      </span>
                    )}
                  </div>
                </div>

                {config?.liffId && (
                  <div>
                    <label className="text-sm font-medium">LIFF URL</label>
                    <div className="flex items-center gap-2 mt-1">
                      <code className="text-sm bg-muted px-2 py-1 rounded">
                        https://liff.line.me/{config.liffId}
                      </code>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => copyToClipboard(`https://liff.line.me/${config.liffId}`, "LIFF URL")}
                        data-testid="button-copy-liff-url"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}

                <Alert>
                  <AlertDescription className="text-sm">
                    LIFF credentials are managed via environment variables.
                    Update <code className="bg-muted px-1 rounded">LIFF_ID</code> and <code className="bg-muted px-1 rounded">VITE_LIFF_ID</code> in Replit Secrets.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>

            {/* Webhook URL */}
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <LinkIcon className="h-5 w-5" />
                  Webhook Configuration
                </CardTitle>
                <CardDescription>
                  Configure this URL in LINE Developers Console
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Webhook URL</label>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="text-sm bg-muted px-3 py-2 rounded flex-1 overflow-x-auto">
                      {webhookUrl}
                    </code>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => copyToClipboard(webhookUrl, "Webhook URL")}
                      data-testid="button-copy-webhook"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" asChild>
                    <a 
                      href="https://developers.line.biz/console/" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      data-testid="link-line-console"
                    >
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Open LINE Developers Console
                    </a>
                  </Button>
                </div>

                <Alert>
                  <AlertDescription className="text-sm space-y-2">
                    <p><strong>How to configure:</strong></p>
                    <ol className="list-decimal list-inside space-y-1">
                      <li>Go to LINE Developers Console</li>
                      <li>Select your Messaging API channel</li>
                      <li>Navigate to "Messaging API" tab</li>
                      <li>Paste the Webhook URL above</li>
                      <li>Enable "Use webhook"</li>
                    </ol>
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>

            {/* Environment Variables Info */}
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Environment Variables</CardTitle>
                <CardDescription>
                  Required environment variables for LINE integration
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <h4 className="font-medium">Messaging API</h4>
                    <ul className="text-sm space-y-1">
                      <li className="flex items-center gap-2">
                        <Badge variant={config?.hasAccessToken ? "default" : "destructive"} className="text-xs">
                          {config?.hasAccessToken ? "Set" : "Missing"}
                        </Badge>
                        <code>LINE_CHANNEL_ACCESS_TOKEN</code>
                      </li>
                      <li className="flex items-center gap-2">
                        <Badge variant={config?.hasChannelSecret ? "default" : "destructive"} className="text-xs">
                          {config?.hasChannelSecret ? "Set" : "Missing"}
                        </Badge>
                        <code>LINE_CHANNEL_SECRET</code>
                      </li>
                      <li className="flex items-center gap-2">
                        <Badge variant={config?.hasChannelId ? "default" : "secondary"} className="text-xs">
                          {config?.hasChannelId ? "Set" : "Optional"}
                        </Badge>
                        <code>LINE_CHANNEL_ID</code>
                      </li>
                    </ul>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-medium">LIFF</h4>
                    <ul className="text-sm space-y-1">
                      <li className="flex items-center gap-2">
                        <Badge variant={config?.hasLiffId ? "default" : "destructive"} className="text-xs">
                          {config?.hasLiffId ? "Set" : "Missing"}
                        </Badge>
                        <code>LIFF_ID</code>
                      </li>
                      <li className="flex items-center gap-2">
                        <Badge variant={config?.hasLiffId ? "default" : "destructive"} className="text-xs">
                          {config?.hasLiffId ? "Set" : "Missing"}
                        </Badge>
                        <code>VITE_LIFF_ID</code>
                      </li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
