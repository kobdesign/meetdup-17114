import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Loader2, Save, ExternalLink, Info, Share2, AppWindow } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface LiffSettingsData {
  liff_id: string;
  liff_channel_id: string;
  liff_enabled: boolean;
  liff_share_enabled: boolean;
  liff_share_service_url: string;
  apps_liff_id: string;
}

export default function LiffSettings() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<LiffSettingsData>({
    liff_id: "",
    liff_channel_id: "",
    liff_enabled: false,
    liff_share_enabled: true,
    liff_share_service_url: "",
    apps_liff_id: ""
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/login");
        return;
      }

      const response = await fetch("/api/admin/system-settings/liff", {
        headers: {
          "Authorization": `Bearer ${session.access_token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setSettings(data);
      } else if (response.status === 403) {
        toast({
          title: "Access Denied",
          description: "Super admin access required",
          variant: "destructive"
        });
        navigate("/admin");
      }
    } catch (error) {
      console.error("Error fetching LIFF settings:", error);
      toast({
        title: "Error",
        description: "Failed to load LIFF settings",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/login");
        return;
      }

      const response = await fetch("/api/admin/system-settings/liff", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`
        },
        body: JSON.stringify(settings)
      });

      if (response.ok) {
        toast({
          title: "Saved",
          description: "LIFF settings updated successfully"
        });
      } else {
        throw new Error("Failed to save");
      }
    } catch (error) {
      console.error("Error saving LIFF settings:", error);
      toast({
        title: "Error",
        description: "Failed to save LIFF settings",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button 
          variant="ghost" 
          size="icon"
          onClick={() => navigate("/admin")}
          data-testid="button-back"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">LIFF Settings</h1>
          <p className="text-muted-foreground">Configure LINE LIFF applications for all tenants</p>
        </div>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          LIFF (LINE Front-end Framework) allows users to interact with your app directly within LINE. 
          You can configure separate LIFF apps for Share Card and Mini-apps. Get your LIFF IDs from{" "}
          <a 
            href="https://developers.line.biz/console/" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-primary underline inline-flex items-center gap-1"
          >
            LINE Developers Console
            <ExternalLink className="h-3 w-3" />
          </a>
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Share2 className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle>LIFF Share Configuration</CardTitle>
              <CardDescription>
                Settings for Share Card feature (share business cards via LINE)
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="liff-enabled">Enable LIFF SDK</Label>
              <p className="text-sm text-muted-foreground">
                When enabled, LIFF pages will use LINE features like share picker
              </p>
            </div>
            <Switch
              id="liff-enabled"
              checked={settings.liff_enabled}
              onCheckedChange={(checked) => setSettings({ ...settings, liff_enabled: checked })}
              data-testid="switch-liff-enabled"
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="liff-share-enabled">Enable Share Button</Label>
              <p className="text-sm text-muted-foreground">
                Show share button on business cards to let members share via LINE
              </p>
            </div>
            <Switch
              id="liff-share-enabled"
              checked={settings.liff_share_enabled}
              onCheckedChange={(checked) => setSettings({ ...settings, liff_share_enabled: checked })}
              data-testid="switch-liff-share-enabled"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="liff-id">Share LIFF ID</Label>
            <Input
              id="liff-id"
              placeholder="1234567890-abcdefgh"
              value={settings.liff_id}
              onChange={(e) => setSettings({ ...settings, liff_id: e.target.value })}
              data-testid="input-liff-id"
            />
            <p className="text-xs text-muted-foreground">
              LIFF ID for Share Card feature. Endpoint should point to your share service.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="liff-channel-id">LINE Login Channel ID (Optional)</Label>
            <Input
              id="liff-channel-id"
              placeholder="1234567890"
              value={settings.liff_channel_id}
              onChange={(e) => setSettings({ ...settings, liff_channel_id: e.target.value })}
              data-testid="input-liff-channel-id"
            />
            <p className="text-xs text-muted-foreground">
              The channel ID associated with your LIFF app
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="liff-share-service-url">Share Service URL (Optional)</Label>
            <Input
              id="liff-share-service-url"
              placeholder="https://line-share-flex-api.lovable.app"
              value={settings.liff_share_service_url}
              onChange={(e) => setSettings({ ...settings, liff_share_service_url: e.target.value })}
              data-testid="input-liff-share-service-url"
            />
            <p className="text-xs text-muted-foreground">
              URL of the external LINE Share Target Picker service. Leave empty to use default.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <AppWindow className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle>LIFF Apps Configuration</CardTitle>
              <CardDescription>
                Settings for Mini-apps (Chapter Apps accessible via LINE Bot)
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="apps-liff-id">Apps LIFF ID</Label>
            <Input
              id="apps-liff-id"
              placeholder="1234567890-xxxxxxxx"
              value={settings.apps_liff_id}
              onChange={(e) => setSettings({ ...settings, apps_liff_id: e.target.value })}
              data-testid="input-apps-liff-id"
            />
            <p className="text-xs text-muted-foreground">
              LIFF ID for Mini-apps. Endpoint should point to: <code className="bg-muted px-1 py-0.5 rounded">https://meetdup.com/liff/apps</code>
            </p>
          </div>

          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription className="text-sm">
              <strong>Setup Guide:</strong> Create a separate LIFF app in LINE Developer Console with:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Endpoint URL: <code className="bg-muted px-1 py-0.5 rounded text-xs">https://meetdup.com/liff/apps</code></li>
                <li>Size: Full</li>
                <li>Scopes: openid, profile</li>
              </ul>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      <Button 
        onClick={handleSave} 
        disabled={saving}
        className="w-full"
        data-testid="button-save-liff"
      >
        {saving ? (
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
        ) : (
          <Save className="h-4 w-4 mr-2" />
        )}
        Save Settings
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>LIFF App Setup Guide</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <ol className="list-decimal list-inside space-y-2">
            <li>Go to <a href="https://developers.line.biz/console/" target="_blank" rel="noopener noreferrer" className="text-primary underline">LINE Developers Console</a></li>
            <li>Create or select your LINE Login channel</li>
            <li>Navigate to "LIFF" tab</li>
            <li>Click "Add" to create a new LIFF app</li>
            <li>For <strong>Share Card</strong>: Set Endpoint URL to your share service, enable shareTargetPicker scope</li>
            <li>For <strong>Mini-apps</strong>: Set Endpoint URL to <code className="bg-muted px-1 py-0.5 rounded text-xs">https://meetdup.com/liff/apps</code></li>
            <li>Copy the LIFF IDs and paste them above</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
