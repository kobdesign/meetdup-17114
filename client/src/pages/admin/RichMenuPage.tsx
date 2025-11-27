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
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, Star, StarOff, Image as ImageIcon, ExternalLink, Edit, Link, Unlink, Copy, Check, RefreshCw, AlertTriangle, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import SelectTenantPrompt from "@/components/SelectTenantPrompt";

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
  alias_id: string | null;
}

interface LineStatusData {
  success: boolean;
  defaultRichMenuId: string | null;
  totalMenus: number;
  totalAliases: number;
  menus: Array<{
    richMenuId: string;
    name: string;
    chatBarText: string;
    isDefault: boolean;
    aliases: string[];
    switchActions: Array<{ targetAlias: string; data: string }>;
  }>;
  aliases: Array<{ richMenuAliasId: string; richMenuId: string }>;
}

export default function RichMenuPage() {
  const { effectiveTenantId, isSuperAdmin } = useTenantContext();
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingMenu, setEditingMenu] = useState<RichMenu | null>(null);
  const [aliasDialogMenu, setAliasDialogMenu] = useState<RichMenu | null>(null);
  const [aliasInput, setAliasInput] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [lineStatus, setLineStatus] = useState<LineStatusData | null>(null);
  const [isLoadingLineStatus, setIsLoadingLineStatus] = useState(false);
  const [showLineStatus, setShowLineStatus] = useState(false);

  // Fetch rich menus
  const { data: richMenusData, isLoading } = useQuery<{ richMenus: RichMenu[] }>({
    queryKey: ["/api/line/rich-menu", effectiveTenantId],
    enabled: !!effectiveTenantId,
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await fetch(
        `/api/line/rich-menu?tenantId=${effectiveTenantId}`,
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
        `/api/line/rich-menu/${richMenuId}?tenantId=${effectiveTenantId}`,
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
      queryClient.invalidateQueries({ queryKey: ["/api/line/rich-menu", effectiveTenantId] });
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
        `/api/line/rich-menu/set-default`,
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
      queryClient.invalidateQueries({ queryKey: ["/api/line/rich-menu", effectiveTenantId] });
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

  // Create alias mutation
  const createAliasMutation = useMutation({
    mutationFn: async ({ richMenuId, aliasId }: { richMenuId: string; aliasId: string }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await fetch(`/api/line/rich-menu/alias`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tenantId: effectiveTenantId,
          richMenuId,
          richMenuAliasId: aliasId,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create alias");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/line/rich-menu", effectiveTenantId] });
      toast({
        title: "Success",
        description: "Rich Menu Alias created successfully",
      });
      setAliasDialogMenu(null);
      setAliasInput("");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete alias mutation
  const deleteAliasMutation = useMutation({
    mutationFn: async (aliasId: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await fetch(
        `/api/line/rich-menu/alias/${aliasId}?tenantId=${effectiveTenantId}`,
        {
          method: "DELETE",
          headers: {
            "Authorization": `Bearer ${session.access_token}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete alias");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/line/rich-menu", effectiveTenantId] });
      toast({
        title: "Success",
        description: "Rich Menu Alias deleted",
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

  const handleCopyId = (id: string, type: "menu" | "alias") => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    toast({
      title: "Copied!",
      description: `${type === "alias" ? "Alias" : "Rich Menu"} ID copied to clipboard`,
    });
    setTimeout(() => setCopiedId(null), 2000);
  };

  const fetchLineStatus = async () => {
    setIsLoadingLineStatus(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await fetch(
        `/api/line/rich-menu/line-status?tenantId=${effectiveTenantId}`,
        {
          headers: {
            "Authorization": `Bearer ${session.access_token}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to fetch LINE status");
      }

      const data = await response.json();
      setLineStatus(data);
      setShowLineStatus(true);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoadingLineStatus(false);
    }
  };

  const richMenus = richMenusData?.richMenus || [];

  if (!effectiveTenantId && isSuperAdmin) {
    return (
      <AdminLayout>
        <SelectTenantPrompt />
      </AdminLayout>
    );
  }

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
          <div className="flex gap-2 flex-wrap">
            <Button 
              variant="outline" 
              onClick={fetchLineStatus}
              disabled={isLoadingLineStatus}
              data-testid="button-check-line-status"
            >
              {isLoadingLineStatus ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              Check LINE Status
            </Button>
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
                  queryClient.invalidateQueries({ queryKey: ["/api/line/rich-menu", effectiveTenantId] });
                }}
              />
            </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* LINE Status Dialog */}
        <Dialog open={showLineStatus} onOpenChange={setShowLineStatus}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-auto">
            <DialogHeader>
              <DialogTitle>LINE Rich Menu Status</DialogTitle>
              <DialogDescription>
                Current status of Rich Menus and Aliases in LINE
              </DialogDescription>
            </DialogHeader>
            {lineStatus && (
              <div className="space-y-4">
                <div className="flex gap-4 flex-wrap">
                  <Badge variant="outline">
                    Total Menus: {lineStatus.totalMenus}
                  </Badge>
                  <Badge variant="outline">
                    Total Aliases: {lineStatus.totalAliases}
                  </Badge>
                </div>

                {lineStatus.menus.length > 0 ? (
                  <div className="space-y-3">
                    <h4 className="font-semibold">Rich Menus in LINE:</h4>
                    {lineStatus.menus.map((menu) => (
                      <Card key={menu.richMenuId} className="p-3">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium">{menu.name}</span>
                            {menu.isDefault && (
                              <Badge variant="default">Default</Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Chat Bar: {menu.chatBarText}
                          </p>
                          <div className="text-xs text-muted-foreground font-mono">
                            ID: {menu.richMenuId}
                          </div>
                          
                          {menu.aliases.length > 0 ? (
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm">Aliases:</span>
                              {menu.aliases.map((alias) => (
                                <Badge key={alias} variant="secondary">{alias}</Badge>
                              ))}
                            </div>
                          ) : (
                            <div className="text-sm text-orange-600 dark:text-orange-400 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              No alias set
                            </div>
                          )}

                          {menu.switchActions.length > 0 && (
                            <div className="space-y-1">
                              <span className="text-sm font-medium">Switch Actions:</span>
                              {menu.switchActions.map((action, idx) => {
                                const aliasExists = lineStatus.aliases.some(
                                  a => a.richMenuAliasId === action.targetAlias
                                );
                                return (
                                  <div key={idx} className="flex items-center gap-2 text-sm">
                                    <span>Target: {action.targetAlias}</span>
                                    {aliasExists ? (
                                      <Badge variant="outline" className="text-green-600">Valid</Badge>
                                    ) : (
                                      <Badge variant="destructive">Missing Alias!</Badge>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground">No Rich Menus found in LINE</p>
                )}

                {lineStatus.aliases.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-semibold">All Aliases (Alias → Rich Menu):</h4>
                    <div className="space-y-2">
                      {lineStatus.aliases.map((alias) => {
                        const targetMenu = lineStatus.menus.find(m => m.richMenuId === alias.richMenuId);
                        return (
                          <div key={alias.richMenuAliasId} className="flex items-center gap-2 p-2 bg-muted rounded-md">
                            <Badge variant="secondary" className="font-mono">{alias.richMenuAliasId}</Badge>
                            <ArrowRight className="h-4 w-4 text-muted-foreground" />
                            {targetMenu ? (
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{targetMenu.name}</span>
                                <span className="text-xs text-muted-foreground font-mono">
                                  ({alias.richMenuId.slice(-8)})
                                </span>
                                {targetMenu.isDefault && (
                                  <Badge variant="default" className="text-xs">Default</Badge>
                                )}
                              </div>
                            ) : (
                              <span className="text-destructive">Rich Menu not found!</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
            <DialogFooter>
              <Button onClick={() => setShowLineStatus(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Dialog */}
        <Dialog open={!!editingMenu} onOpenChange={(open) => !open && setEditingMenu(null)}>
          <DialogContent className="max-w-2xl">
            {editingMenu && (
              <EditRichMenuForm
                menu={editingMenu}
                tenantId={effectiveTenantId || ""}
                onSuccess={() => {
                  setEditingMenu(null);
                  queryClient.invalidateQueries({ queryKey: ["/api/line/rich-menu", effectiveTenantId] });
                }}
                onCancel={() => setEditingMenu(null)}
              />
            )}
          </DialogContent>
        </Dialog>

        {/* Create Alias Dialog */}
        <Dialog open={!!aliasDialogMenu} onOpenChange={(open) => {
          if (!open) {
            setAliasDialogMenu(null);
            setAliasInput("");
          }
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Rich Menu Alias</DialogTitle>
              <DialogDescription>
                Create an alias to use with richmenuswitch action for menu switching
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="alias-id">Alias ID</Label>
                <Input
                  id="alias-id"
                  value={aliasInput}
                  onChange={(e) => setAliasInput(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))}
                  placeholder="e.g., main-menu, more-menu"
                  maxLength={32}
                  data-testid="input-alias-id"
                />
                <p className="text-xs text-muted-foreground">
                  1-32 characters: lowercase letters, numbers, dash, underscore only
                </p>
              </div>
              {aliasDialogMenu && (
                <div className="bg-muted/50 p-3 rounded-md space-y-1">
                  <p className="text-sm font-medium">Menu: {aliasDialogMenu.name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    LINE ID: {aliasDialogMenu.line_rich_menu_id}
                  </p>
                </div>
              )}
              <div className="bg-muted/50 p-3 rounded-md">
                <p className="text-xs text-muted-foreground">
                  After creating, use this alias in your richmenuswitch action:
                </p>
                <pre className="text-xs bg-background p-2 rounded mt-1 overflow-x-auto">
{`{
  "type": "richmenuswitch",
  "richMenuAliasId": "${aliasInput || "your-alias-id"}",
  "data": "switch-menu"
}`}
                </pre>
              </div>
            </div>
            <DialogFooter className="gap-2 flex-wrap">
              <Button
                variant="outline"
                onClick={() => {
                  setAliasDialogMenu(null);
                  setAliasInput("");
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={() => aliasDialogMenu && createAliasMutation.mutate({
                  richMenuId: aliasDialogMenu.rich_menu_id,
                  aliasId: aliasInput,
                })}
                disabled={createAliasMutation.isPending || !aliasInput || aliasInput.length < 1}
                data-testid="button-create-alias"
              >
                {createAliasMutation.isPending ? "Creating..." : "Create Alias"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

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
                  <div className="aspect-video bg-muted rounded-md flex items-center justify-center overflow-hidden">
                    {menu.image_url ? (
                      <img
                        src={menu.image_url}
                        alt={menu.name}
                        className="w-full h-full object-cover"
                        data-testid={`img-preview-${menu.rich_menu_id}`}
                      />
                    ) : (
                      <ImageIcon className="w-8 h-8 text-muted-foreground" />
                    )}
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
                  <div className="pt-2 border-t space-y-2">
                    {/* Alias Section */}
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">
                        Alias (for richmenuswitch):
                      </p>
                      {menu.alias_id ? (
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="font-mono text-xs">
                            {menu.alias_id}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => handleCopyId(menu.alias_id!, "alias")}
                            data-testid={`button-copy-alias-${menu.rich_menu_id}`}
                          >
                            {copiedId === menu.alias_id ? (
                              <Check className="w-3 h-3 text-green-500" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-destructive"
                            onClick={() => {
                              if (confirm("Delete this alias? Menu switching using this alias will stop working.")) {
                                deleteAliasMutation.mutate(menu.alias_id!);
                              }
                            }}
                            disabled={deleteAliasMutation.isPending}
                            data-testid={`button-delete-alias-${menu.rich_menu_id}`}
                          >
                            <Unlink className="w-3 h-3" />
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => setAliasDialogMenu(menu)}
                          data-testid={`button-create-alias-${menu.rich_menu_id}`}
                        >
                          <Link className="w-3 h-3 mr-1" />
                          Create Alias
                        </Button>
                      )}
                    </div>
                    {/* LINE Rich Menu ID */}
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">LINE Rich Menu ID:</p>
                      <div className="flex items-center gap-2">
                        <code className="text-xs bg-muted px-2 py-1 rounded flex-1 truncate" title={menu.line_rich_menu_id}>
                          {menu.line_rich_menu_id}
                        </code>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => handleCopyId(menu.line_rich_menu_id, "menu")}
                          data-testid={`button-copy-id-${menu.rich_menu_id}`}
                        >
                          {copiedId === menu.line_rich_menu_id ? (
                            <Check className="w-3 h-3 text-green-500" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex gap-2 flex-wrap">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditingMenu(menu)}
                    data-testid={`button-edit-${menu.rich_menu_id}`}
                    className="flex-1"
                  >
                    <Edit className="w-3 h-3 mr-1" />
                    Edit
                  </Button>
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
                <li><strong>Richmenuswitch:</strong> Switch to another Rich Menu (use richMenuAliasId)</li>
                <li><strong>Datetime Picker:</strong> Open date/time selection dialog</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Rich Menu Switching</h4>
              <p className="text-sm text-muted-foreground mb-2">
                To switch between menus, you need to:
              </p>
              <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground mb-3">
                <li>Create an Alias for the target menu (click "Create Alias" on the menu card)</li>
                <li>Use that alias in your richmenuswitch action</li>
              </ol>
              <pre className="text-xs bg-muted p-3 rounded-md overflow-x-auto">
{`{
  "type": "richmenuswitch",
  "richMenuAliasId": "your-alias-id",
  "data": "switch-to-menu-2"
}`}
              </pre>
              <p className="text-xs text-muted-foreground mt-2">
                The <code className="bg-muted px-1">richMenuAliasId</code> must be an Alias you created, not the LINE Rich Menu ID directly.
              </p>
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
        `/api/line/rich-menu`,
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

// Edit Rich Menu Form Component
function EditRichMenuForm({ 
  menu, 
  tenantId, 
  onSuccess, 
  onCancel 
}: { 
  menu: RichMenu; 
  tenantId: string; 
  onSuccess: () => void; 
  onCancel: () => void;
}) {
  const { toast } = useToast();
  const [name, setName] = useState(menu.name);
  const [chatBarText, setChatBarText] = useState(menu.chat_bar_text);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [areasJson, setAreasJson] = useState(JSON.stringify(menu.areas, null, 2));
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [selected, setSelected] = useState(menu.selected);
  const [setAsDefault, setSetAsDefault] = useState(menu.is_default);

  // Validate areas JSON before updating
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

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!validateAreasJson(areasJson)) {
        throw new Error(jsonError || "Invalid areas configuration");
      }
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const formData = new FormData();
      formData.append("tenantId", tenantId);
      formData.append("name", name);
      formData.append("chatBarText", chatBarText);
      formData.append("areas", areasJson);
      formData.append("selected", selected.toString());
      formData.append("setAsDefault", setAsDefault.toString());
      if (imageFile) {
        formData.append("image", imageFile);
      }

      const response = await fetch(
        `/api/line/rich-menu/${menu.rich_menu_id}`,
        {
          method: "PATCH",
          headers: {
            "Authorization": `Bearer ${session.access_token}`,
          },
          body: formData,
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update rich menu");
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Rich menu updated successfully",
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
        <DialogTitle>Edit Rich Menu</DialogTitle>
        <DialogDescription>
          Update your LINE Rich Menu configuration
        </DialogDescription>
      </DialogHeader>
      <ScrollArea className="max-h-[60vh] pr-4">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-name" data-testid="label-edit-name">Menu Name (Internal)</Label>
            <Input
              id="edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Main Menu"
              maxLength={300}
              data-testid="input-edit-name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-chatBarText" data-testid="label-edit-chat-bar-text">Chat Bar Text</Label>
            <Input
              id="edit-chatBarText"
              value={chatBarText}
              onChange={(e) => setChatBarText(e.target.value)}
              placeholder="e.g., Tap to open"
              maxLength={14}
              data-testid="input-edit-chat-bar-text"
            />
            <p className="text-xs text-muted-foreground">{chatBarText.length}/14 characters</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-image" data-testid="label-edit-image">Rich Menu Image (Optional)</Label>
            <Input
              id="edit-image"
              type="file"
              accept="image/png,image/jpeg"
              onChange={(e) => setImageFile(e.target.files?.[0] || null)}
              data-testid="input-edit-image"
            />
            <p className="text-xs text-muted-foreground">
              {imageFile ? "New image will be uploaded" : "Leave empty to keep current image"}
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="edit-selected"
                checked={selected}
                onCheckedChange={(checked) => setSelected(checked as boolean)}
                data-testid="checkbox-edit-selected"
              />
              <Label
                htmlFor="edit-selected"
                className="text-sm font-normal cursor-pointer"
                data-testid="label-edit-selected"
              >
                Auto-open when linked to user
              </Label>
            </div>
            <p className="text-xs text-muted-foreground ml-6">
              Automatically display this menu when linked to a user
            </p>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="edit-default"
                checked={setAsDefault}
                onCheckedChange={(checked) => setSetAsDefault(checked as boolean)}
                data-testid="checkbox-edit-default"
              />
              <Label
                htmlFor="edit-default"
                className="text-sm font-normal cursor-pointer"
                data-testid="label-edit-default"
              >
                Set as default menu
              </Label>
            </div>
            <p className="text-xs text-muted-foreground ml-6">
              Automatically display to all users in this channel
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-areas" data-testid="label-edit-areas">Areas Configuration (JSON)</Label>
            <Textarea
              id="edit-areas"
              value={areasJson}
              onChange={(e) => {
                setAreasJson(e.target.value);
                setJsonError(null);
              }}
              onBlur={() => validateAreasJson(areasJson)}
              placeholder="Enter areas JSON"
              rows={10}
              className={`font-mono text-sm ${jsonError ? 'border-destructive' : ''}`}
              data-testid="textarea-edit-areas"
            />
            {jsonError ? (
              <p className="text-xs text-destructive">{jsonError}</p>
            ) : (
              <p className="text-xs text-muted-foreground">Define tappable areas with bounds and actions</p>
            )}
          </div>

          <div className="bg-muted/50 p-3 rounded-md">
            <p className="text-xs text-muted-foreground">
              <strong>💡 Tip:</strong> Adjust bounds to match icon positions. For icons at the bottom half, use:
              <code className="block mt-1 bg-background p-2 rounded text-[10px]">
                {`"bounds": { "x": 0, "y": 400, "width": 833, "height": 443 }`}
              </code>
            </p>
          </div>
        </div>
      </ScrollArea>
      <DialogFooter className="gap-2 flex-wrap">
        <Button
          variant="outline"
          onClick={onCancel}
          data-testid="button-edit-cancel"
        >
          Cancel
        </Button>
        <Button
          onClick={() => updateMutation.mutate()}
          disabled={updateMutation.isPending || !name || !chatBarText}
          data-testid="button-edit-submit"
        >
          {updateMutation.isPending ? "Updating..." : "Update Rich Menu"}
        </Button>
      </DialogFooter>
    </>
  );
}
