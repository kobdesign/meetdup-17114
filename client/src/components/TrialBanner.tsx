import { useQuery } from "@tanstack/react-query";
import { X, Clock, Sparkles } from "lucide-react";
import { useState, useEffect } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useTenantContext } from "@/contexts/TenantContext";

interface SubscriptionStatus {
  subscription: {
    tenant_id: string;
    plan_id: string;
    status: string;
    trial_end: string | null;
  } | null;
  plan: string;
  status: string;
  trialDaysRemaining: number | null;
}

export function TrialBanner() {
  const { selectedTenant } = useTenantContext();
  const [dismissed, setDismissed] = useState(false);
  const tenantId = selectedTenant?.tenant_id;

  const { data: subscriptionData } = useQuery<SubscriptionStatus>({
    queryKey: ["/api/subscriptions/status", tenantId],
    enabled: !!tenantId,
    staleTime: 1000 * 60 * 5,
  });

  useEffect(() => {
    if (!tenantId) return;
    const dismissedKey = `trial-banner-dismissed-${tenantId}`;
    const wasDismissed = sessionStorage.getItem(dismissedKey);
    if (wasDismissed) {
      setDismissed(true);
    } else {
      setDismissed(false);
    }
  }, [tenantId]);

  const handleDismiss = () => {
    setDismissed(true);
    if (tenantId) {
      sessionStorage.setItem(`trial-banner-dismissed-${tenantId}`, "true");
    }
  };

  if (!subscriptionData || dismissed) {
    return null;
  }

  const { trialDaysRemaining, status } = subscriptionData;

  if (status !== "trialing" || trialDaysRemaining === null) {
    return null;
  }

  const isUrgent = trialDaysRemaining <= 7;
  const isCritical = trialDaysRemaining <= 3;

  return (
    <Alert
      className={`relative border-0 rounded-none ${
        isCritical
          ? "bg-destructive/10 text-destructive"
          : isUrgent
            ? "bg-amber-500/10 text-amber-600"
            : "bg-primary/10 text-primary"
      }`}
      data-testid="banner-trial"
    >
      <div className="container mx-auto flex items-center justify-between gap-4 py-1">
        <div className="flex items-center gap-2">
          {isCritical ? (
            <Clock className="h-4 w-4" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          <AlertDescription className="text-sm font-medium">
            {trialDaysRemaining === 0
              ? "Your trial ends today! "
              : trialDaysRemaining === 1
                ? "Your trial ends tomorrow! "
                : `${trialDaysRemaining} days left in your free trial. `}
            <span className="hidden sm:inline">
              {isUrgent
                ? "Upgrade now to keep all your data and features."
                : "Enjoying Meetdup? Upgrade anytime to unlock more."}
            </span>
          </AlertDescription>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={isUrgent ? "default" : "outline"}
            onClick={() => (window.location.href = "/admin/billing")}
            data-testid="button-trial-upgrade"
          >
            Upgrade Now
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6"
            onClick={handleDismiss}
            data-testid="button-trial-dismiss"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Alert>
  );
}
