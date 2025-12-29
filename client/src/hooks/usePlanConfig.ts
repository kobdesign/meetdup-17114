import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useTenantContext } from "@/contexts/TenantContext";

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

export interface PlanConfig {
  plans: PlanDefinition[];
  features: FeatureCatalogItem[];
  limits: LimitCatalogItem[];
  planFeatures: PlanFeature[];
  planLimits: PlanLimit[];
}

export function usePlanConfig() {
  return useQuery<PlanConfig>({
    queryKey: ["/api/plan-config"],
    queryFn: () => apiRequest("/api/plan-config"),
    staleTime: 1000 * 60 * 10, // Cache for 10 minutes
  });
}

export function usePlanFeature(featureKey: string, planId?: string) {
  const { data: config, isLoading } = usePlanConfig();
  
  if (isLoading || !config) {
    return { hasFeature: false, isLoading: true };
  }

  const targetPlanId = planId || "free";
  const planFeature = config.planFeatures.find(
    pf => pf.plan_id === targetPlanId && pf.feature_key === featureKey
  );

  return {
    hasFeature: planFeature?.enabled ?? false,
    isLoading: false,
  };
}

export function usePlanLimit(limitKey: string, planId?: string) {
  const { data: config, isLoading } = usePlanConfig();
  
  if (isLoading || !config) {
    return { limit: 0, isUnlimited: false, isLoading: true };
  }

  const targetPlanId = planId || "free";
  const planLimit = config.planLimits.find(
    pl => pl.plan_id === targetPlanId && pl.limit_key === limitKey
  );

  const limitValue = planLimit?.limit_value ?? 0;

  return {
    limit: limitValue,
    isUnlimited: limitValue === -1,
    isLoading: false,
  };
}

export function useTenantPlanFeature(featureKey: string) {
  const { data: config, isLoading: configLoading } = usePlanConfig();
  const { effectiveTenantId } = useTenantContext();
  
  const { data: subscriptionData, isLoading: subLoading } = useQuery({
    queryKey: ["/api/subscriptions", effectiveTenantId],
    queryFn: () => apiRequest(`/api/subscriptions/${effectiveTenantId}`),
    enabled: !!effectiveTenantId,
  });

  const isLoading = configLoading || subLoading;

  if (isLoading || !config) {
    return { hasFeature: false, isLoading: true, planId: null };
  }

  const planId = subscriptionData?.subscription?.plan_id || "free";
  const planFeature = config.planFeatures.find(
    pf => pf.plan_id === planId && pf.feature_key === featureKey
  );

  return {
    hasFeature: planFeature?.enabled ?? false,
    isLoading: false,
    planId,
  };
}

export function useTenantPlanLimit(limitKey: string) {
  const { data: config, isLoading: configLoading } = usePlanConfig();
  const { effectiveTenantId } = useTenantContext();
  
  const { data: subscriptionData, isLoading: subLoading } = useQuery({
    queryKey: ["/api/subscriptions", effectiveTenantId],
    queryFn: () => apiRequest(`/api/subscriptions/${effectiveTenantId}`),
    enabled: !!effectiveTenantId,
  });

  const isLoading = configLoading || subLoading;

  if (isLoading || !config) {
    return { limit: 0, isUnlimited: false, isLoading: true, planId: null };
  }

  const planId = subscriptionData?.subscription?.plan_id || "free";
  const planLimit = config.planLimits.find(
    pl => pl.plan_id === planId && pl.limit_key === limitKey
  );

  const limitValue = planLimit?.limit_value ?? 0;

  return {
    limit: limitValue,
    isUnlimited: limitValue === -1,
    isLoading: false,
    planId,
  };
}

export function useAllPlanFeatures(planId?: string) {
  const { data: config, isLoading } = usePlanConfig();
  
  if (isLoading || !config) {
    return { features: [], isLoading: true };
  }

  const targetPlanId = planId || "free";
  const enabledFeatures = config.planFeatures
    .filter(pf => pf.plan_id === targetPlanId && pf.enabled)
    .map(pf => pf.feature_key);

  return {
    features: enabledFeatures,
    isLoading: false,
  };
}

export function useAllPlanLimits(planId?: string) {
  const { data: config, isLoading } = usePlanConfig();
  
  if (isLoading || !config) {
    return { limits: {}, isLoading: true };
  }

  const targetPlanId = planId || "free";
  const limits: Record<string, number> = {};
  
  config.planLimits
    .filter(pl => pl.plan_id === targetPlanId)
    .forEach(pl => {
      limits[pl.limit_key] = pl.limit_value;
    });

  return {
    limits,
    isLoading: false,
  };
}

interface UsageWarning {
  type: 'members' | 'meetings' | 'ai_queries';
  level: 'warning' | 'critical' | 'exceeded';
  message: string;
  current: number;
  limit: number;
}

interface UsageWarningsResponse {
  warnings: UsageWarning[];
}

export function useUsageWarnings(tenantId?: string) {
  const { effectiveTenantId: contextTenantId } = useTenantContext();
  const effectiveTenantId = tenantId || contextTenantId;

  return useQuery<UsageWarningsResponse>({
    queryKey: ["/api/subscriptions/warnings", effectiveTenantId],
    queryFn: () => apiRequest(`/api/subscriptions/warnings/${effectiveTenantId}`),
    enabled: !!effectiveTenantId,
    staleTime: 1000 * 60 * 2, // Cache for 2 minutes
  });
}

interface LimitCheckResult {
  exceeded: boolean;
  current: number;
  limit: number;
  percentage: number;
}

export function useCheckLimit(limitType: 'members' | 'meetings' | 'ai_queries', tenantId?: string) {
  const { effectiveTenantId: contextTenantId } = useTenantContext();
  const effectiveTenantId = tenantId || contextTenantId;

  return useQuery<LimitCheckResult>({
    queryKey: ["/api/subscriptions/check-limit", effectiveTenantId, limitType],
    queryFn: () => apiRequest(`/api/subscriptions/check-limit/${effectiveTenantId}/${limitType}`),
    enabled: !!effectiveTenantId,
    staleTime: 1000 * 60, // Cache for 1 minute
  });
}
