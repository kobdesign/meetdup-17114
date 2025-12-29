import { useQuery, useMutation } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { CreditCard, CheckCircle2, AlertCircle, ExternalLink, Calendar, Users, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { useTenantContext } from "@/contexts/TenantContext";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface TenantSubscription {
  tenant_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  plan_id: string;
  status: string;
  current_period_start: string | null;
  current_period_end: string | null;
  trial_end: string | null;
  cancel_at_period_end: boolean;
}

interface SubscriptionStatus {
  subscription: TenantSubscription | null;
  plan: string;
  status: string;
  trialDaysRemaining: number | null;
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

export default function BillingSettings() {
  const { selectedTenant } = useTenantContext();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  const success = searchParams.get("success") === "true";
  const canceled = searchParams.get("canceled") === "true";

  const tenantId = selectedTenant?.tenant_id;

  const { data: subscriptionData, isLoading: isLoadingSubscription } = useQuery<SubscriptionStatus>({
    queryKey: ["/api/subscriptions/status", tenantId],
    queryFn: () => apiRequest(`/api/subscriptions/status/${tenantId}`),
    enabled: !!tenantId,
  });

  const { data: usageData, isLoading: isLoadingUsage } = useQuery<UsageData>({
    queryKey: ["/api/subscriptions/usage", tenantId],
    queryFn: () => apiRequest(`/api/subscriptions/usage/${tenantId}`),
    enabled: !!tenantId,
  });

  const portalMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("/api/subscriptions/portal", "POST", { tenantId });
    },
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to open billing portal",
        variant: "destructive",
      });
    },
  });

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "N/A";
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-500/10 text-green-600 border-green-500/20">Active</Badge>;
      case "trialing":
        return <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20">Trial</Badge>;
      case "past_due":
        return <Badge variant="destructive">Past Due</Badge>;
      case "canceled":
        return <Badge variant="secondary">Canceled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getUsagePercent = (used: number, limit: number) => {
    if (limit === -1) return 0;
    return Math.min((used / limit) * 100, 100);
  };

  if (!tenantId) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>No Chapter Selected</AlertTitle>
          <AlertDescription>Please select a chapter to view billing settings.</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="heading-billing">Billing & Subscription</h1>
          <p className="text-muted-foreground">Manage your subscription and billing details</p>
        </div>
      </div>

      {success && (
        <Alert className="bg-green-500/10 border-green-500/20">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertTitle>Payment Successful!</AlertTitle>
          <AlertDescription>
            Your subscription has been activated. You now have access to all features.
          </AlertDescription>
        </Alert>
      )}

      {canceled && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Checkout Canceled</AlertTitle>
          <AlertDescription>
            Your checkout was canceled. You can try again anytime.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2" data-testid="card-subscription">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Current Plan
            </CardTitle>
            <CardDescription>Your subscription details and billing information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {isLoadingSubscription ? (
              <div className="animate-pulse space-y-4">
                <div className="h-8 bg-muted rounded w-1/3"></div>
                <div className="h-4 bg-muted rounded w-1/2"></div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div>
                    <h3 className="text-2xl font-bold" data-testid="text-current-plan">
                      {usageData?.plan.name || "Free"} Plan
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      {getStatusBadge(subscriptionData?.status || "active")}
                      {subscriptionData?.trialDaysRemaining && subscriptionData.trialDaysRemaining > 0 && (
                        <span className="text-sm text-muted-foreground">
                          {subscriptionData.trialDaysRemaining} days remaining in trial
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {subscriptionData?.subscription?.stripe_customer_id ? (
                    <Button
                      onClick={() => portalMutation.mutate()}
                      disabled={portalMutation.isPending}
                      data-testid="button-manage-billing"
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      {portalMutation.isPending ? "Opening..." : "Manage Billing"}
                    </Button>
                  ) : (
                    <Button onClick={() => window.location.href = "/pricing"} data-testid="button-upgrade">
                      Upgrade Plan
                    </Button>
                  )}
                </div>

                <Separator />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Current Period</p>
                    <p className="font-medium">
                      {formatDate(subscriptionData?.subscription?.current_period_start || null)} -{" "}
                      {formatDate(subscriptionData?.subscription?.current_period_end || null)}
                    </p>
                  </div>
                  
                  {subscriptionData?.subscription?.cancel_at_period_end && (
                    <div>
                      <p className="text-sm text-muted-foreground">Cancellation</p>
                      <p className="font-medium text-destructive">
                        Cancels on {formatDate(subscriptionData?.subscription?.current_period_end)}
                      </p>
                    </div>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-quick-actions">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => window.location.href = "/pricing"}
              data-testid="button-view-plans"
            >
              View All Plans
            </Button>
            
            {subscriptionData?.subscription?.stripe_customer_id && (
              <>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => portalMutation.mutate()}
                  disabled={portalMutation.isPending}
                  data-testid="button-update-payment"
                >
                  Update Payment Method
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => portalMutation.mutate()}
                  disabled={portalMutation.isPending}
                  data-testid="button-view-invoices"
                >
                  View Invoices
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card data-testid="card-usage">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Usage & Limits
          </CardTitle>
          <CardDescription>Track your current usage against plan limits</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingUsage ? (
            <div className="animate-pulse space-y-4">
              <div className="h-4 bg-muted rounded w-full"></div>
              <div className="h-4 bg-muted rounded w-full"></div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Members</span>
                  <span className="font-medium">
                    {usageData?.usage.members || 0} / {usageData?.plan.limits.members === -1 ? "Unlimited" : usageData?.plan.limits.members}
                  </span>
                </div>
                {usageData?.plan.limits.members !== -1 && (
                  <Progress 
                    value={getUsagePercent(usageData?.usage.members || 0, usageData?.plan.limits.members || 1)} 
                    className="h-2"
                  />
                )}
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Meetings this month</span>
                  <span className="font-medium">
                    {usageData?.usage.meetings_this_month || 0} / {usageData?.plan.limits.meetings_per_month === -1 ? "Unlimited" : usageData?.plan.limits.meetings_per_month}
                  </span>
                </div>
                {usageData?.plan.limits.meetings_per_month !== -1 && (
                  <Progress 
                    value={getUsagePercent(usageData?.usage.meetings_this_month || 0, usageData?.plan.limits.meetings_per_month || 1)} 
                    className="h-2"
                  />
                )}
              </div>

              {usageData?.plan.limits.ai_queries_per_month && usageData.plan.limits.ai_queries_per_month > 0 && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>AI Queries this month</span>
                    <span className="font-medium">
                      {usageData?.usage.ai_queries_this_month || 0} / {usageData?.plan.limits.ai_queries_per_month}
                    </span>
                  </div>
                  <Progress 
                    value={getUsagePercent(usageData?.usage.ai_queries_this_month || 0, usageData.plan.limits.ai_queries_per_month)} 
                    className="h-2"
                  />
                </div>
              )}

              <div className="flex justify-between text-sm">
                <span>Storage</span>
                <span className="font-medium">
                  {usageData?.plan.limits.storage_gb} GB included
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {subscriptionData?.trialDaysRemaining && subscriptionData.trialDaysRemaining <= 7 && subscriptionData.trialDaysRemaining > 0 && (
        <Alert className="bg-amber-500/10 border-amber-500/20">
          <Calendar className="h-4 w-4 text-amber-600" />
          <AlertTitle>Trial Ending Soon</AlertTitle>
          <AlertDescription>
            Your free trial ends in {subscriptionData.trialDaysRemaining} days. Upgrade now to keep access to all features.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
