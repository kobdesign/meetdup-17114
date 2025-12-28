import { useEffect, useState, useRef } from "react";
import AdminLayout from "@/components/layout/AdminLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { Upload, Save, RefreshCw, Image as ImageIcon, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { MeetdupLogo, meetdupLogoUrl } from "@/components/MeetdupLogo";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { apiRequest } from "@/lib/queryClient";
import { usePlatformSettings } from "@/contexts/PlatformSettingsContext";

async function uploadLogoViaServer(file: File, type: "light" | "dark"): Promise<{ success: boolean; url?: string; error?: string }> {
  const session = await supabase.auth.getSession();
  const token = session.data.session?.access_token;
  
  if (!token) {
    return { success: false, error: "Not authenticated" };
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("type", type);

  const response = await fetch("/api/admin/system-settings/platform/upload-logo", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  const data = await response.json();
  
  if (!response.ok) {
    return { success: false, error: data.error || "Upload failed" };
  }

  return { success: true, url: data.url };
}

interface PlatformSettingsData {
  platform_logo_url: string | null;
  platform_logo_dark_url: string | null;
  platform_name: string;
}

export default function PlatformSettings() {
  const [settings, setSettings] = useState<PlatformSettingsData>({
    platform_logo_url: null,
    platform_logo_dark_url: null,
    platform_name: "Meetdup",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const darkFileInputRef = useRef<HTMLInputElement>(null);
  
  const { refetch: refetchGlobalSettings } = usePlatformSettings();

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const data = await apiRequest("/api/admin/system-settings/platform");
      setSettings({
        platform_logo_url: data.platform_logo_url || null,
        platform_logo_dark_url: data.platform_logo_dark_url || null,
        platform_name: data.platform_name || "Meetdup",
      });
    } catch (error: any) {
      console.error("Failed to load platform settings:", error);
      toast.error("Failed to load platform settings");
    } finally {
      setLoading(false);
    }
  };

  const uploadLogo = async (file: File, variant: "light" | "dark") => {
    setUploading(true);
    try {
      const result = await uploadLogoViaServer(file, variant);
      
      if (!result.success) {
        throw new Error(result.error || "Upload failed");
      }

      const settingKey = variant === "light" ? "platform_logo_url" : "platform_logo_dark_url";
      
      setSettings((prev) => ({
        ...prev,
        [settingKey]: result.url!,
      }));

      await refetchGlobalSettings();
      toast.success(`${variant === "light" ? "Light" : "Dark"} mode logo uploaded successfully`);
    } catch (error: any) {
      toast.error("Failed to upload logo: " + error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, variant: "light" | "dark") => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        toast.error("Please select an image file");
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error("File size must be less than 5MB");
        return;
      }
      uploadLogo(file, variant);
    }
  };

  const savePlatformName = async () => {
    setSaving(true);
    try {
      await apiRequest("/api/admin/system-settings/platform", "PUT", {
        platform_name: settings.platform_name,
      });
      await refetchGlobalSettings();
      toast.success("Platform name saved successfully");
    } catch (error: any) {
      toast.error("Failed to save platform name: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  const resetToDefault = async (settingKey: string) => {
    try {
      await apiRequest("/api/admin/system-settings/platform", "PUT", {
        [settingKey]: null,
      });

      setSettings((prev) => ({
        ...prev,
        [settingKey]: null,
      }));

      await refetchGlobalSettings();
      toast.success("Reset to default logo");
    } catch (error: any) {
      toast.error("Failed to reset: " + error.message);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Platform Settings</h1>
          <p className="text-muted-foreground">Configure platform-wide branding and settings</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5" />
              Platform Logo
            </CardTitle>
            <CardDescription>
              Upload custom logos for your platform. For best results, use transparent PNG files.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                For dark backgrounds (like pitch decks), use a transparent PNG logo. The current logo has a white background which doesn't look good on dark surfaces.
              </AlertDescription>
            </Alert>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-4">
                <Label>Light Mode Logo (for light backgrounds)</Label>
                <div className="border rounded-lg p-4 bg-background flex flex-col items-center gap-4">
                  <div className="w-32 h-32 flex items-center justify-center bg-muted rounded-lg">
                    {settings.platform_logo_url ? (
                      <img
                        src={settings.platform_logo_url}
                        alt="Platform Logo (Light)"
                        className="max-w-full max-h-full object-contain"
                        data-testid="img-logo-light"
                      />
                    ) : (
                      <img
                        src={meetdupLogoUrl}
                        alt="Default Logo"
                        className="max-w-full max-h-full object-contain"
                      />
                    )}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="file"
                      ref={fileInputRef}
                      className="hidden"
                      accept="image/*"
                      onChange={(e) => handleFileChange(e, "light")}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      data-testid="button-upload-light-logo"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Upload
                    </Button>
                    {settings.platform_logo_url && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => resetToDefault("platform_logo_url")}
                        data-testid="button-reset-light-logo"
                      >
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Reset
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <Label>Dark Mode Logo (for dark backgrounds)</Label>
                <div className="border rounded-lg p-4 bg-slate-800 flex flex-col items-center gap-4">
                  <div className="w-32 h-32 flex items-center justify-center bg-slate-700 rounded-lg">
                    {settings.platform_logo_dark_url ? (
                      <img
                        src={settings.platform_logo_dark_url}
                        alt="Platform Logo (Dark)"
                        className="max-w-full max-h-full object-contain"
                        data-testid="img-logo-dark"
                      />
                    ) : (
                      <div className="text-slate-400 text-sm text-center p-2">
                        No dark mode logo uploaded
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="file"
                      ref={darkFileInputRef}
                      className="hidden"
                      accept="image/*"
                      onChange={(e) => handleFileChange(e, "dark")}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => darkFileInputRef.current?.click()}
                      disabled={uploading}
                      data-testid="button-upload-dark-logo"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Upload
                    </Button>
                    {settings.platform_logo_dark_url && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => resetToDefault("platform_logo_dark_url")}
                        data-testid="button-reset-dark-logo"
                      >
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Reset
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Platform Name</CardTitle>
            <CardDescription>
              The name displayed throughout the platform
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <Label htmlFor="platform-name">Platform Name</Label>
                <Input
                  id="platform-name"
                  value={settings.platform_name}
                  onChange={(e) => setSettings((prev) => ({ ...prev, platform_name: e.target.value }))}
                  placeholder="Meetdup"
                  data-testid="input-platform-name"
                />
              </div>
              <Button onClick={savePlatformName} disabled={saving} data-testid="button-save-name">
                <Save className="h-4 w-4 mr-2" />
                {saving ? "Saving..." : "Save"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Current Logo Preview</CardTitle>
            <CardDescription>
              How the logo appears in different contexts
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Navbar (Light Background)</Label>
                <div className="border rounded-lg p-4 bg-background">
                  <MeetdupLogo size="md" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Dark Background Context</Label>
                <div className="border rounded-lg p-4 bg-slate-800">
                  <MeetdupLogo size="md" variant="dark" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
