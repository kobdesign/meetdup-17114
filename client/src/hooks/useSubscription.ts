import { useQuery } from "@tanstack/react-query";
import { useTenantContext } from "@/contexts/TenantContext";

interface SubscriptionStatus {
  subscription: {
    tenant_id: string;
    plan_id: string;
    status: string;
    trial_end: string | null;
    cancel_at_period_end: boolean;
  } | null;
  plan: string;
  status: string;
  trialDaysRemaining: number | null;
}

interface FeatureAccess {
  hasAccess: boolean;
}

interface UsageData {
  plan: {
    id: string;
    name: string;
    limits: {
      members: number;
      meetings_per_month: number;
      ai_queries_per_month: number;
      storage_gb: number;
    };
  };
  usage: {
    members: number;
    meetings_this_month: number;
    ai_queries_this_month: number;
  };
}

const FEATURE_MAP: Record<string, string[]> = {
  free: ["basic_meetings", "member_checkin", "basic_reports"],
  starter: [
    "basic_meetings", "member_checkin", "basic_reports",
    "visitor_management", "payment_tracking", "line_integration",
    "basic_analytics"
  ],
  pro: [
    "basic_meetings", "member_checkin", "basic_reports",
    "visitor_management", "payment_tracking", "line_integration",
    "basic_analytics", "ai_copilot", "advanced_analytics",
    "custom_branding", "rsvp_notifications", "apps_marketplace",
    "api_access"
  ]
};

export function useSubscription() {
  const { selectedTenant } = useTenantContext();
  const tenantId = selectedTenant?.tenant_id;

  const { data: statusData, isLoading: isLoadingStatus } = useQuery<SubscriptionStatus>({
    queryKey: ["/api/subscriptions/status", tenantId],
    enabled: !!tenantId,
    staleTime: 1000 * 60 * 5,
  });

  const { data: usageData, isLoading: isLoadingUsage } = useQuery<UsageData>({
    queryKey: ["/api/subscriptions/usage", tenantId],
    enabled: !!tenantId,
    staleTime: 1000 * 60 * 5,
  });

  const plan = statusData?.plan || "free";
  const status = statusData?.status || "active";
  const trialDaysRemaining = statusData?.trialDaysRemaining;
  const isTrialing = status === "trialing";
  const isActive = status === "active" || status === "trialing";
  const isPastDue = status === "past_due";
  const isCanceled = status === "canceled";

  const hasFeature = (feature: string): boolean => {
    if (!isActive && !isPastDue) return false;
    
    const effectivePlan = isPastDue ? "free" : plan;
    return FEATURE_MAP[effectivePlan]?.includes(feature) || false;
  };

  const checkFeatureAccess = async (feature: string): Promise<boolean> => {
    if (!tenantId) return false;
    
    try {
      const response = await fetch(`/api/subscriptions/feature/${tenantId}/${feature}`);
      const data: FeatureAccess = await response.json();
      return data.hasAccess;
    } catch {
      return hasFeature(feature);
    }
  };

  const canAddMoreMembers = (): boolean => {
    if (!usageData) return true;
    const limit = usageData.plan.limits.members;
    if (limit === -1) return true;
    return usageData.usage.members < limit;
  };

  const canCreateMoreMeetings = (): boolean => {
    if (!usageData) return true;
    const limit = usageData.plan.limits.meetings_per_month;
    if (limit === -1) return true;
    return usageData.usage.meetings_this_month < limit;
  };

  const getMemberLimit = (): number | null => {
    if (!usageData) return null;
    return usageData.plan.limits.members === -1 ? null : usageData.plan.limits.members;
  };

  const getMemberCount = (): number => {
    return usageData?.usage.members || 0;
  };

  return {
    plan,
    planName: usageData?.plan.name || "Free",
    status,
    isTrialing,
    isActive,
    isPastDue,
    isCanceled,
    trialDaysRemaining,
    isLoading: isLoadingStatus || isLoadingUsage,
    hasFeature,
    checkFeatureAccess,
    canAddMoreMembers,
    canCreateMoreMeetings,
    getMemberLimit,
    getMemberCount,
    usage: usageData?.usage,
    limits: usageData?.plan.limits,
  };
}
