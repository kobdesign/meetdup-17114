import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Loader2, Save, ExternalLink, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface LiffSettings {
  liff_id: string;
  liff_channel_id: string;
  liff_enabled: boolean;
}

export default function LiffSettings() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<LiffSettings>({
    liff_id: "",
    liff_channel_id: "",
    liff_enabled: false
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
          <p className="text-muted-foreground">Configure LINE LIFF application for all tenants</p>
        </div>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          LIFF (LINE Front-end Framework) allows users to interact with your app directly within LINE. 
          One LIFF app is shared across all tenants. Get your LIFF ID from{" "}
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
          <CardTitle>LIFF Configuration</CardTitle>
          <CardDescription>
            Configure LIFF app settings. Changes will apply to all chapters.
          </CardDescription>
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

          <div className="space-y-2">
            <Label htmlFor="liff-id">LIFF ID</Label>
            <Input
              id="liff-id"
              placeholder="1234567890-abcdefgh"
              value={settings.liff_id}
              onChange={(e) => setSettings({ ...settings, liff_id: e.target.value })}
              data-testid="input-liff-id"
            />
            <p className="text-xs text-muted-foreground">
              Found in LINE Developers Console under your LIFF app
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
        </CardContent>
      </Card>

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
            <li>Set Endpoint URL to: <code className="bg-muted px-1 py-0.5 rounded text-xs">https://your-domain.com/liff/search</code></li>
            <li>Set Size to "Tall" or "Full"</li>
            <li>Enable "shareTargetPicker" in Scopes</li>
            <li>Copy the LIFF ID and paste it above</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
