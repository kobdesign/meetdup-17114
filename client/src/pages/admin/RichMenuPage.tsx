import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useTenantContext } from "@/contexts/TenantContext";
import { useToast } from "@/hooks/use-toast";
import AdminLayout from "@/components/layout/AdminLayout";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Trash2, Star, StarOff, Image as ImageIcon, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface RichMenuArea {
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  action: {
    type: string;
    [key: string]: any;
  };
}

interface RichMenu {
  rich_menu_id: string;
  tenant_id: string;
  line_rich_menu_id: string;
  name: string;
  chat_bar_text: string;
  selected: boolean;
  is_default: boolean;
  is_active: boolean;
  image_url: string | null;
  image_width: number;
  image_height: number;
  areas: RichMenuArea[];
  created_at: string;
}

export default function RichMenuPage() {
  const { effectiveTenantId } = useTenantContext();
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  // Fetch rich menus
  const { data: richMenusData, isLoading } = useQuery<{ richMenus: RichMenu[] }>({
    queryKey: ["/api/line-rich-menu", effectiveTenantId],
    enabled: !!effectiveTenantId,
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/line-rich-menu?tenantId=${effectiveTenantId}`,
        {
          headers: {
            "Authorization": `Bearer ${session.access_token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch rich menus");
      }

      return response.json();
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (richMenuId: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/line-rich-menu?richMenuId=${richMenuId}`,
        {
          method: "DELETE",
          headers: {
            "Authorization": `Bearer ${session.access_token}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete rich menu");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/line-rich-menu", effectiveTenantId] });
      toast({
        title: "Success",
        description: "Rich menu deleted successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Set default mutation
  const setDefaultMutation = useMutation({
    mutationFn: async (richMenuId: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/line-rich-menu/set-default`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ richMenuId, tenantId: effectiveTenantId }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to set default rich menu");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/line-rich-menu", effectiveTenantId] });
      toast({
        title: "Success",
        description: "Default rich menu updated",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const richMenus = richMenusData?.richMenus || [];

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold">Rich Menu Management</h1>
            <p className="text-muted-foreground mt-1">
              Create and manage LINE Rich Menus for your chapter
            </p>
          </div>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-create-rich-menu">
                <Plus className="w-4 h-4 mr-2" />
                Create Rich Menu
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <CreateRichMenuForm
                tenantId={effectiveTenantId || ""}
                onSuccess={() => {
                  setIsCreateDialogOpen(false);
                  queryClient.invalidateQueries({ queryKey: ["/api/line-rich-menu", effectiveTenantId] });
                }}
              />
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-32 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : richMenus.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <ImageIcon className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Rich Menus Yet</h3>
              <p className="text-muted-foreground text-center mb-6">
                Create your first Rich Menu to provide quick access buttons for your LINE users
              </p>
              <Button onClick={() => setIsCreateDialogOpen(true)} data-testid="button-create-first-rich-menu">
                <Plus className="w-4 h-4 mr-2" />
                Create Your First Rich Menu
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {richMenus.map((menu) => (
              <Card key={menu.rich_menu_id} data-testid={`card-rich-menu-${menu.rich_menu_id}`}>
                <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg truncate">{menu.name}</CardTitle>
                    <CardDescription className="truncate">{menu.chat_bar_text}</CardDescription>
                  </div>
                  {menu.is_default && (
                    <Badge variant="default" className="shrink-0">
                      <Star className="w-3 h-3 mr-1" />
                      Default
                    </Badge>
                  )}
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="aspect-video bg-muted rounded-md flex items-center justify-center">
                    <ImageIcon className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <div className="text-sm space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground">Size:</span>
                      <span className="font-medium">{menu.image_width} × {menu.image_height}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground">Areas:</span>
                      <span className="font-medium">{menu.areas?.length || 0}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground">Auto-open:</span>
                      <span className="font-medium">{menu.selected ? "Yes" : "No"}</span>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex gap-2 flex-wrap">
                  {!menu.is_default && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDefaultMutation.mutate(menu.rich_menu_id)}
                      disabled={setDefaultMutation.isPending}
                      data-testid={`button-set-default-${menu.rich_menu_id}`}
                      className="flex-1"
                    >
                      <Star className="w-3 h-3 mr-1" />
                      Set Default
                    </Button>
                  )}
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      if (confirm("Are you sure you want to delete this rich menu?")) {
                        deleteMutation.mutate(menu.rich_menu_id);
                      }
                    }}
                    disabled={deleteMutation.isPending}
                    data-testid={`button-delete-${menu.rich_menu_id}`}
                    className="flex-1"
                  >
                    <Trash2 className="w-3 h-3 mr-1" />
                    Delete
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Rich Menu Guidelines</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">Image Requirements</h4>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                <li>Format: PNG or JPEG</li>
                <li>Size: 2500 × 1686 pixels (full height) or 2500 × 843 pixels (half height)</li>
                <li>Maximum 20 tappable areas per Rich Menu</li>
                <li>Maximum 1000 Rich Menus per LINE channel</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Action Types</h4>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                <li><strong>Message:</strong> Send a text message when tapped</li>
                <li><strong>URI:</strong> Open a URL when tapped</li>
                <li><strong>Postback:</strong> Send data to webhook for processing</li>
                <li><strong>Datetime Picker:</strong> Open date/time selection dialog</li>
              </ul>
            </div>
            <div>
              <Button variant="outline" size="sm" asChild data-testid="link-line-docs">
                <a
                  href="https://developers.line.biz/en/docs/messaging-api/using-rich-menus/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="w-3 h-3 mr-2" />
                  LINE Rich Menu Documentation
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}

// Create Rich Menu Form Component
function CreateRichMenuForm({ tenantId, onSuccess }: { tenantId: string; onSuccess: () => void }) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [chatBarText, setChatBarText] = useState("");
  const [imageHeight, setImageHeight] = useState<"843" | "1686">("1686");
  const [selected, setSelected] = useState(false);
  const [setAsDefault, setSetAsDefault] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [areasJson, setAreasJson] = useState(`[
  {
    "bounds": { "x": 0, "y": 0, "width": 1250, "height": 1686 },
    "action": { "type": "message", "text": "Button 1" }
  },
  {
    "bounds": { "x": 1250, "y": 0, "width": 1250, "height": 1686 },
    "action": { "type": "message", "text": "Button 2" }
  }
]`);
  const [jsonError, setJsonError] = useState<string | null>(null);

  // Update default areas when image height changes
  const handleImageHeightChange = (newHeight: "843" | "1686") => {
    setImageHeight(newHeight);
    // Update default template to match new height
    setAreasJson(`[
  {
    "bounds": { "x": 0, "y": 0, "width": 1250, "height": ${newHeight} },
    "action": { "type": "message", "text": "Button 1" }
  },
  {
    "bounds": { "x": 1250, "y": 0, "width": 1250, "height": ${newHeight} },
    "action": { "type": "message", "text": "Button 2" }
  }
]`);
    setJsonError(null);
  };

  // Validate areas JSON before creating
  const validateAreasJson = (json: string): boolean => {
    try {
      const areas = JSON.parse(json);
      if (!Array.isArray(areas)) {
        setJsonError("Areas must be an array");
        return false;
      }
      
      for (let i = 0; i < areas.length; i++) {
        const area = areas[i];
        if (!area.bounds || typeof area.bounds !== 'object') {
          setJsonError(`Area ${i + 1}: Missing or invalid bounds object`);
          return false;
        }
        if (typeof area.bounds.x !== 'number' || typeof area.bounds.y !== 'number' ||
            typeof area.bounds.width !== 'number' || typeof area.bounds.height !== 'number') {
          setJsonError(`Area ${i + 1}: bounds must have numeric x, y, width, height`);
          return false;
        }
        if (!area.action || typeof area.action !== 'object' || !area.action.type) {
          setJsonError(`Area ${i + 1}: Missing or invalid action object with type`);
          return false;
        }
      }
      
      setJsonError(null);
      return true;
    } catch (e) {
      setJsonError("Invalid JSON syntax");
      return false;
    }
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!imageFile) throw new Error("Please select an image");
      if (!validateAreasJson(areasJson)) {
        throw new Error(jsonError || "Invalid areas configuration");
      }
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const formData = new FormData();
      formData.append("tenantId", tenantId);
      formData.append("name", name);
      formData.append("chatBarText", chatBarText);
      formData.append("imageHeight", imageHeight);
      formData.append("areas", areasJson);
      formData.append("selected", String(selected));
      formData.append("setAsDefault", String(setAsDefault));
      if (imageFile) {
        formData.append("image", imageFile);
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/line-rich-menu`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${session.access_token}`,
          },
          body: formData,
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create rich menu");
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Rich menu created successfully",
      });
      onSuccess();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <>
      <DialogHeader>
        <DialogTitle>Create Rich Menu</DialogTitle>
        <DialogDescription>
          Configure your LINE Rich Menu with image and action areas
        </DialogDescription>
      </DialogHeader>
      <ScrollArea className="max-h-[60vh] pr-4">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name" data-testid="label-name">Menu Name (Internal)</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Main Menu"
              maxLength={300}
              data-testid="input-name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="chatBarText" data-testid="label-chat-bar-text">Chat Bar Text</Label>
            <Input
              id="chatBarText"
              value={chatBarText}
              onChange={(e) => setChatBarText(e.target.value)}
              placeholder="e.g., Tap to open"
              maxLength={14}
              data-testid="input-chat-bar-text"
            />
            <p className="text-xs text-muted-foreground">{chatBarText.length}/14 characters</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="imageHeight" data-testid="label-image-height">Image Height</Label>
            <Select value={imageHeight} onValueChange={(v) => handleImageHeightChange(v as "843" | "1686")}>
              <SelectTrigger data-testid="select-image-height">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="843">Half Height (2500 × 843)</SelectItem>
                <SelectItem value="1686">Full Height (2500 × 1686)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Changing height will reset areas configuration to default template
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="image" data-testid="label-image">Rich Menu Image</Label>
            <Input
              id="image"
              type="file"
              accept="image/png,image/jpeg"
              onChange={(e) => setImageFile(e.target.files?.[0] || null)}
              data-testid="input-image"
            />
            <p className="text-xs text-muted-foreground">PNG or JPEG, 2500 × {imageHeight} pixels</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="areas" data-testid="label-areas">Areas Configuration (JSON)</Label>
            <Textarea
              id="areas"
              value={areasJson}
              onChange={(e) => {
                setAreasJson(e.target.value);
                setJsonError(null);
              }}
              onBlur={() => validateAreasJson(areasJson)}
              placeholder="Enter areas JSON"
              rows={8}
              className={`font-mono text-sm ${jsonError ? 'border-destructive' : ''}`}
              data-testid="textarea-areas"
            />
            {jsonError ? (
              <p className="text-xs text-destructive">{jsonError}</p>
            ) : (
              <p className="text-xs text-muted-foreground">Define tappable areas with bounds and actions</p>
            )}
          </div>

          <div className="flex items-center gap-4 flex-wrap">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={selected}
                onChange={(e) => setSelected(e.target.checked)}
                data-testid="checkbox-selected"
              />
              <span className="text-sm">Auto-open when linked</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={setAsDefault}
                onChange={(e) => setSetAsDefault(e.target.checked)}
                data-testid="checkbox-set-default"
              />
              <span className="text-sm">Set as default menu</span>
            </label>
          </div>
        </div>
      </ScrollArea>
      <DialogFooter className="gap-2 flex-wrap">
        <Button
          variant="outline"
          onClick={onSuccess}
          data-testid="button-cancel"
        >
          Cancel
        </Button>
        <Button
          onClick={() => createMutation.mutate()}
          disabled={createMutation.isPending || !name || !chatBarText || !imageFile}
          data-testid="button-submit"
        >
          {createMutation.isPending ? "Creating..." : "Create Rich Menu"}
        </Button>
      </DialogFooter>
    </>
  );
}
