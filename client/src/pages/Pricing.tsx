import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Check, Zap, Building2, Sparkles, ArrowLeft, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useTenantContext } from "@/contexts/TenantContext";

interface PlanPrice {
  id: string;
  amount: number;
}

interface PlanLimits {
  members: number;
  meetings_per_month: number;
  ai_queries_per_month: number;
  storage_gb: number;
}

interface SubscriptionPlan {
  id: string;
  name: string;
  description: string;
  features: string[];
  prices: {
    monthly: PlanPrice;
    yearly: PlanPrice;
  };
  limits: PlanLimits;
}

export default function Pricing() {
  const [isYearly, setIsYearly] = useState(false);
  const [canGoBack, setCanGoBack] = useState(false);
  const navigate = useNavigate();
  const { isReady, userRole, selectedTenant } = useTenantContext();
  
  const isAuthenticated = isReady && !!userRole;
  const isAdmin = userRole === "chapter_admin" || userRole === "super_admin";
  
  useEffect(() => {
    setCanGoBack(window.history.length > 1);
  }, []);

  const { data: plansData, isLoading } = useQuery<{ plans: SubscriptionPlan[] }>({
    queryKey: ["/api/subscriptions/plans"],
    queryFn: async () => {
      const response = await fetch("/api/subscriptions/plans");
      if (!response.ok) {
        throw new Error("Failed to fetch plans");
      }
      return response.json();
    },
  });

  const plans = plansData?.plans || [];

  const formatPrice = (amount: number) => {
    if (amount === 0) return "Free";
    return `$${(amount / 100).toFixed(2)}`;
  };

  const getPlanIcon = (planId: string) => {
    switch (planId) {
      case "free":
        return <Zap className="h-6 w-6" />;
      case "starter":
        return <Building2 className="h-6 w-6" />;
      case "pro":
        return <Sparkles className="h-6 w-6" />;
      default:
        return <Zap className="h-6 w-6" />;
    }
  };

  const getPlanHighlight = (planId: string) => {
    return planId === "starter";
  };

  const handleSelectPlan = (plan: SubscriptionPlan) => {
    if (plan.id === "free") {
      navigate("/auth?register=true");
    } else {
      navigate(`/auth?register=true&plan=${plan.id}&billing=${isYearly ? "yearly" : "monthly"}`);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading plans...</div>
      </div>
    );
  }

  const handleBack = () => {
    if (canGoBack) {
      navigate(-1);
    } else if (isAdmin) {
      navigate("/admin/billing");
    } else if (isAuthenticated) {
      navigate("/admin");
    } else {
      navigate("/");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-16">
        <div className="flex items-center justify-between mb-8">
          <Button 
            variant="ghost" 
            onClick={handleBack}
            data-testid="button-back"
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            {canGoBack ? "ย้อนกลับ" : isAdmin ? "จัดการ Billing" : "หน้าแรก"}
          </Button>
          
          {isAdmin && selectedTenant && (
            <Button 
              variant="outline" 
              onClick={() => navigate("/admin/billing")}
              data-testid="button-manage-billing"
              className="gap-2"
            >
              <Settings className="h-4 w-4" />
              จัดการ Billing
            </Button>
          )}
        </div>
        
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold tracking-tight mb-4" data-testid="heading-pricing">
            Simple, Transparent Pricing
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
            Start free, upgrade when you need. All plans include a 30-day free trial.
          </p>

          <div className="flex items-center justify-center gap-3 mb-8">
            <Label htmlFor="billing-toggle" className={!isYearly ? "font-semibold" : "text-muted-foreground"}>
              Monthly
            </Label>
            <Switch
              id="billing-toggle"
              checked={isYearly}
              onCheckedChange={setIsYearly}
              data-testid="switch-billing-toggle"
            />
            <Label htmlFor="billing-toggle" className={isYearly ? "font-semibold" : "text-muted-foreground"}>
              Yearly
            </Label>
            {isYearly && (
              <Badge variant="secondary" className="ml-2">
                Save 2 months
              </Badge>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {plans.map((plan) => {
            const price = isYearly ? plan.prices.yearly : plan.prices.monthly;
            const isHighlighted = getPlanHighlight(plan.id);

            return (
              <Card
                key={plan.id}
                className={`relative flex flex-col ${isHighlighted ? "border-primary shadow-lg scale-105" : ""}`}
                data-testid={`card-plan-${plan.id}`}
              >
                {isHighlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground">Most Popular</Badge>
                  </div>
                )}

                <CardHeader className="text-center pb-2">
                  <div className="mx-auto mb-4 p-3 rounded-full bg-primary/10 text-primary">
                    {getPlanIcon(plan.id)}
                  </div>
                  <CardTitle className="text-2xl">{plan.name}</CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                </CardHeader>

                <CardContent className="flex-1">
                  <div className="text-center mb-6">
                    <span className="text-4xl font-bold" data-testid={`text-price-${plan.id}`}>
                      {formatPrice(price.amount)}
                    </span>
                    {price.amount > 0 && (
                      <span className="text-muted-foreground">
                        /{isYearly ? "year" : "month"}
                      </span>
                    )}
                  </div>

                  <ul className="space-y-3">
                    {plan.features.map((feature, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-6 pt-4 border-t space-y-2 text-sm text-muted-foreground">
                    <div className="flex justify-between">
                      <span>Members</span>
                      <span className="font-medium text-foreground">
                        {plan.limits.members === -1 ? "Unlimited" : `Up to ${plan.limits.members}`}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Meetings/month</span>
                      <span className="font-medium text-foreground">
                        {plan.limits.meetings_per_month === -1 ? "Unlimited" : plan.limits.meetings_per_month}
                      </span>
                    </div>
                    {plan.limits.ai_queries_per_month > 0 && (
                      <div className="flex justify-between">
                        <span>AI queries/month</span>
                        <span className="font-medium text-foreground">{plan.limits.ai_queries_per_month}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span>Storage</span>
                      <span className="font-medium text-foreground">{plan.limits.storage_gb} GB</span>
                    </div>
                  </div>
                </CardContent>

                <CardFooter>
                  <Button
                    className="w-full"
                    variant={isHighlighted ? "default" : "outline"}
                    onClick={() => handleSelectPlan(plan)}
                    data-testid={`button-select-${plan.id}`}
                  >
                    {plan.id === "free" ? "Get Started Free" : "Start Free Trial"}
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>

        <div className="mt-16 text-center">
          <h2 className="text-2xl font-bold mb-4">Trusted by Business Chapters Worldwide</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Join hundreds of networking chapters using Meetdup to streamline their operations,
            grow membership, and boost referral success.
          </p>
        </div>

        <div className="mt-12 text-center">
          <h3 className="text-lg font-semibold mb-4">Questions?</h3>
          <p className="text-muted-foreground">
            Contact us at support@meetdup.app for custom enterprise plans or volume discounts.
          </p>
        </div>
      </div>
    </div>
  );
}
