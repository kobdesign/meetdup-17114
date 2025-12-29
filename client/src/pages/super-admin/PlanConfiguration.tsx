import { useEffect, useState } from "react";
import AdminLayout from "@/components/layout/AdminLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { apiRequest } from "@/lib/queryClient";
import { 
  Save, 
  RefreshCw, 
  Package, 
  Zap, 
  Gauge, 
  Check, 
  X,
  Loader2,
  DollarSign
} from "lucide-react";

interface FeatureCatalogItem {
  id: number;
  feature_key: string;
  display_name: string;
  description: string | null;
  category: string;
  display_order: number;
  is_active: boolean;
}

interface LimitCatalogItem {
  id: number;
  limit_key: string;
  display_name: string;
  description: string | null;
  unit: string;
  display_order: number;
  is_active: boolean;
}

interface PlanDefinition {
  id: string;
  name: string;
  description: string | null;
  display_order: number;
  is_active: boolean;
  stripe_monthly_price_id: string | null;
  stripe_yearly_price_id: string | null;
  monthly_price_cents: number;
  yearly_price_cents: number;
}

interface PlanFeature {
  plan_id: string;
  feature_key: string;
  enabled: boolean;
}

interface PlanLimit {
  plan_id: string;
  limit_key: string;
  limit_value: number;
}

interface PlanConfig {
  plans: PlanDefinition[];
  features: FeatureCatalogItem[];
  limits: LimitCatalogItem[];
  planFeatures: PlanFeature[];
  planLimits: PlanLimit[];
}

export default function PlanConfiguration() {
  const [config, setConfig] = useState<PlanConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pendingFeatureChanges, setPendingFeatureChanges] = useState<PlanFeature[]>([]);
  const [pendingLimitChanges, setPendingLimitChanges] = useState<PlanLimit[]>([]);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const data = await apiRequest("/api/plan-config/admin");
      setConfig(data);
      setPendingFeatureChanges([]);
      setPendingLimitChanges([]);
    } catch (error: any) {
      console.error("Failed to load plan config:", error);
      toast.error("Failed to load plan configuration");
    } finally {
      setLoading(false);
    }
  };

  const getFeatureEnabled = (planId: string, featureKey: string): boolean => {
    const pending = pendingFeatureChanges.find(
      p => p.plan_id === planId && p.feature_key === featureKey
    );
    if (pending) return pending.enabled;
    
    const existing = config?.planFeatures.find(
      pf => pf.plan_id === planId && pf.feature_key === featureKey
    );
    return existing?.enabled ?? false;
  };

  const getLimitValue = (planId: string, limitKey: string): number => {
    const pending = pendingLimitChanges.find(
      p => p.plan_id === planId && p.limit_key === limitKey
    );
    if (pending) return pending.limit_value;
    
    const existing = config?.planLimits.find(
      pl => pl.plan_id === planId && pl.limit_key === limitKey
    );
    return existing?.limit_value ?? 0;
  };

  const handleFeatureToggle = (planId: string, featureKey: string, enabled: boolean) => {
    setPendingFeatureChanges(prev => {
      const filtered = prev.filter(p => !(p.plan_id === planId && p.feature_key === featureKey));
      return [...filtered, { plan_id: planId, feature_key: featureKey, enabled }];
    });
  };

  const handleLimitChange = (planId: string, limitKey: string, value: number) => {
    setPendingLimitChanges(prev => {
      const filtered = prev.filter(p => !(p.plan_id === planId && p.limit_key === limitKey));
      return [...filtered, { plan_id: planId, limit_key: limitKey, limit_value: value }];
    });
  };

  const saveChanges = async () => {
    try {
      setSaving(true);

      if (pendingFeatureChanges.length > 0) {
        await apiRequest("/api/plan-config/plan-features", "PUT", { updates: pendingFeatureChanges });
      }

      if (pendingLimitChanges.length > 0) {
        await apiRequest("/api/plan-config/plan-limits", "PUT", { updates: pendingLimitChanges });
      }

      toast.success("Plan configuration saved successfully");
      await fetchConfig();
    } catch (error: any) {
      console.error("Failed to save config:", error);
      toast.error("Failed to save configuration");
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = pendingFeatureChanges.length > 0 || pendingLimitChanges.length > 0;

  const formatPrice = (cents: number) => {
    if (cents === 0) return "Free";
    return `$${(cents / 100).toFixed(2)}`;
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </AdminLayout>
    );
  }

  if (!config) {
    return (
      <AdminLayout>
        <div className="p-6">
          <p className="text-muted-foreground">Failed to load configuration</p>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold" data-testid="heading-plan-config">
              Plan Configuration
            </h1>
            <p className="text-muted-foreground">
              Manage subscription plans, features, and limits
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={fetchConfig}
              disabled={loading}
              data-testid="button-refresh-config"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
            <Button
              onClick={saveChanges}
              disabled={!hasChanges || saving}
              data-testid="button-save-config"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Save Changes
              {hasChanges && (
                <Badge variant="secondary" className="ml-2">
                  {pendingFeatureChanges.length + pendingLimitChanges.length}
                </Badge>
              )}
            </Button>
          </div>
        </div>

        <Tabs defaultValue="features" className="space-y-4">
          <TabsList>
            <TabsTrigger value="features" data-testid="tab-features">
              <Zap className="w-4 h-4 mr-2" />
              Features
            </TabsTrigger>
            <TabsTrigger value="limits" data-testid="tab-limits">
              <Gauge className="w-4 h-4 mr-2" />
              Limits
            </TabsTrigger>
            <TabsTrigger value="plans" data-testid="tab-plans">
              <Package className="w-4 h-4 mr-2" />
              Plans
            </TabsTrigger>
          </TabsList>

          <TabsContent value="features" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Feature Access by Plan</CardTitle>
                <CardDescription>
                  Toggle which features are available for each subscription plan
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[200px]">Feature</TableHead>
                        {config.plans.map(plan => (
                          <TableHead key={plan.id} className="text-center min-w-[100px]">
                            <div className="flex flex-col items-center gap-1">
                              <span className="font-semibold">{plan.name}</span>
                              <span className="text-xs text-muted-foreground">
                                {formatPrice(plan.monthly_price_cents)}/mo
                              </span>
                            </div>
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {config.features.map(feature => (
                        <TableRow key={feature.feature_key}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{feature.display_name}</div>
                              {feature.description && (
                                <div className="text-xs text-muted-foreground">
                                  {feature.description}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          {config.plans.map(plan => {
                            const enabled = getFeatureEnabled(plan.id, feature.feature_key);
                            const isPending = pendingFeatureChanges.some(
                              p => p.plan_id === plan.id && p.feature_key === feature.feature_key
                            );
                            return (
                              <TableCell key={plan.id} className="text-center">
                                <div className="flex items-center justify-center">
                                  <Switch
                                    checked={enabled}
                                    onCheckedChange={(checked) => 
                                      handleFeatureToggle(plan.id, feature.feature_key, checked)
                                    }
                                    data-testid={`switch-feature-${plan.id}-${feature.feature_key}`}
                                  />
                                  {isPending && (
                                    <Badge variant="outline" className="ml-2 text-xs">
                                      Changed
                                    </Badge>
                                  )}
                                </div>
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="limits" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Usage Limits by Plan</CardTitle>
                <CardDescription>
                  Set numeric limits for each plan. Use -1 for unlimited.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[200px]">Limit</TableHead>
                        {config.plans.map(plan => (
                          <TableHead key={plan.id} className="text-center min-w-[120px]">
                            <div className="flex flex-col items-center gap-1">
                              <span className="font-semibold">{plan.name}</span>
                              <span className="text-xs text-muted-foreground">
                                {formatPrice(plan.monthly_price_cents)}/mo
                              </span>
                            </div>
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {config.limits.map(limit => (
                        <TableRow key={limit.limit_key}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{limit.display_name}</div>
                              {limit.description && (
                                <div className="text-xs text-muted-foreground">
                                  {limit.description}
                                </div>
                              )}
                              <Badge variant="outline" className="mt-1 text-xs">
                                {limit.unit}
                              </Badge>
                            </div>
                          </TableCell>
                          {config.plans.map(plan => {
                            const value = getLimitValue(plan.id, limit.limit_key);
                            const isPending = pendingLimitChanges.some(
                              p => p.plan_id === plan.id && p.limit_key === limit.limit_key
                            );
                            return (
                              <TableCell key={plan.id} className="text-center">
                                <div className="flex items-center justify-center gap-2">
                                  <Input
                                    type="number"
                                    value={value}
                                    onChange={(e) => 
                                      handleLimitChange(plan.id, limit.limit_key, parseInt(e.target.value) || 0)
                                    }
                                    className="w-24 text-center"
                                    data-testid={`input-limit-${plan.id}-${limit.limit_key}`}
                                  />
                                  {value === -1 && (
                                    <Badge variant="secondary" className="text-xs">
                                      Unlimited
                                    </Badge>
                                  )}
                                  {isPending && (
                                    <Badge variant="outline" className="text-xs">
                                      Changed
                                    </Badge>
                                  )}
                                </div>
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="plans" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              {config.plans.map(plan => (
                <Card key={plan.id} className={!plan.is_active ? "opacity-60" : ""}>
                  <CardHeader>
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="flex items-center gap-2">
                        <Package className="w-5 h-5" />
                        {plan.name}
                      </CardTitle>
                      <Badge variant={plan.is_active ? "default" : "secondary"}>
                        {plan.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <CardDescription>{plan.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Monthly</span>
                        <span className="font-semibold text-lg">
                          {formatPrice(plan.monthly_price_cents)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Yearly</span>
                        <span className="font-semibold">
                          {formatPrice(plan.yearly_price_cents)}
                        </span>
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-2">
                      <div className="text-sm font-medium">Features Included</div>
                      <div className="space-y-1">
                        {config.features
                          .filter(f => getFeatureEnabled(plan.id, f.feature_key))
                          .map(feature => (
                            <div key={feature.feature_key} className="flex items-center gap-2 text-sm">
                              <Check className="w-4 h-4 text-green-500" />
                              {feature.display_name}
                            </div>
                          ))}
                        {config.features
                          .filter(f => !getFeatureEnabled(plan.id, f.feature_key))
                          .slice(0, 3)
                          .map(feature => (
                            <div key={feature.feature_key} className="flex items-center gap-2 text-sm text-muted-foreground">
                              <X className="w-4 h-4 text-muted-foreground" />
                              {feature.display_name}
                            </div>
                          ))}
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-2">
                      <div className="text-sm font-medium">Limits</div>
                      <div className="space-y-1">
                        {config.limits.map(limit => {
                          const value = getLimitValue(plan.id, limit.limit_key);
                          return (
                            <div key={limit.limit_key} className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">{limit.display_name}</span>
                              <span className="font-medium">
                                {value === -1 ? "Unlimited" : `${value} ${limit.unit}`}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
