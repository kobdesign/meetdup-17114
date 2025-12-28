// Subscription Routes - /api/subscriptions
// Handles subscription management for tenants

import { Router, Request, Response } from "express";
import { subscriptionService } from "../stripe/subscriptionService";

const router = Router();

// Get available subscription plans
router.get("/plans", async (req: Request, res: Response) => {
  try {
    const plans = await subscriptionService.getPlans();
    res.json({ plans });
  } catch (error: any) {
    console.error("[subscriptions] Error fetching plans:", error);
    res.status(500).json({ error: "Failed to fetch plans" });
  }
});

// Get Stripe publishable key for frontend
router.get("/stripe-key", async (req: Request, res: Response) => {
  try {
    const publishableKey = await subscriptionService.getPublishableKey();
    res.json({ publishableKey });
  } catch (error: any) {
    console.error("[subscriptions] Error fetching Stripe key:", error);
    res.status(500).json({ error: "Failed to fetch Stripe key" });
  }
});

// Get current subscription status for a tenant
router.get("/status/:tenantId", async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const subscription = await subscriptionService.getTenantSubscription(tenantId);
    
    if (!subscription) {
      return res.json({
        subscription: null,
        plan: 'free',
        status: 'active',
        trialDaysRemaining: null
      });
    }

    const trialDaysRemaining = subscriptionService.getTrialDaysRemaining(subscription);
    
    res.json({
      subscription,
      plan: subscription.plan_id,
      status: subscription.status,
      trialDaysRemaining
    });
  } catch (error: any) {
    console.error("[subscriptions] Error fetching status:", error);
    res.status(500).json({ error: "Failed to fetch subscription status" });
  }
});

// Get usage limits for a tenant
router.get("/usage/:tenantId", async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const usage = await subscriptionService.getUsageLimits(tenantId);
    res.json(usage);
  } catch (error: any) {
    console.error("[subscriptions] Error fetching usage:", error);
    res.status(500).json({ error: "Failed to fetch usage" });
  }
});

// Create checkout session
router.post("/checkout", async (req: Request, res: Response) => {
  try {
    const { tenantId, priceId } = req.body;
    
    if (!tenantId || !priceId) {
      return res.status(400).json({ error: "Missing tenantId or priceId" });
    }

    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.headers.host;
    const baseUrl = `${protocol}://${host}`;

    const session = await subscriptionService.createCheckoutSession(
      tenantId,
      priceId,
      `${baseUrl}/admin/billing?success=true`,
      `${baseUrl}/admin/billing?canceled=true`
    );

    res.json(session);
  } catch (error: any) {
    console.error("[subscriptions] Error creating checkout:", error);
    res.status(500).json({ error: error.message || "Failed to create checkout" });
  }
});

// Create customer portal session
router.post("/portal", async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.body;
    
    if (!tenantId) {
      return res.status(400).json({ error: "Missing tenantId" });
    }

    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.headers.host;
    const returnUrl = `${protocol}://${host}/admin/billing`;

    const session = await subscriptionService.createCustomerPortalSession(
      tenantId,
      returnUrl
    );

    res.json(session);
  } catch (error: any) {
    console.error("[subscriptions] Error creating portal:", error);
    res.status(500).json({ error: error.message || "Failed to create portal session" });
  }
});

// Check feature access
router.get("/feature/:tenantId/:feature", async (req: Request, res: Response) => {
  try {
    const { tenantId, feature } = req.params;
    const hasAccess = await subscriptionService.checkFeatureAccess(tenantId, feature);
    res.json({ hasAccess });
  } catch (error: any) {
    console.error("[subscriptions] Error checking feature:", error);
    res.status(500).json({ error: "Failed to check feature access" });
  }
});

export default router;
