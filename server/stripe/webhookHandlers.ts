// Stripe Integration - webhookHandlers.ts
// Handles Stripe webhook events for subscription management

import { getStripeSync, getUncachableStripeClient, getWebhookSecret } from './stripeClient';
import { subscriptionService } from './subscriptionService';
import Stripe from 'stripe';

export class WebhookHandlers {
  static async processWebhook(payload: Buffer, signature: string): Promise<void> {
    if (!Buffer.isBuffer(payload)) {
      throw new Error(
        'STRIPE WEBHOOK ERROR: Payload must be a Buffer. ' +
        'Received type: ' + typeof payload + '. ' +
        'This usually means express.json() parsed the body before reaching this handler. ' +
        'FIX: Ensure webhook route is registered BEFORE app.use(express.json()).'
      );
    }

    const stripe = await getUncachableStripeClient();
    const webhookSecret = await getWebhookSecret();

    let event: Stripe.Event;

    try {
      // CRITICAL: Verify webhook signature using Stripe SDK
      event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    } catch (err: any) {
      console.error('[webhook] Signature verification failed:', err.message);
      throw new Error(`Webhook signature verification failed: ${err.message}`);
    }

    console.log(`[webhook] Verified event: ${event.type} (${event.id})`);

    // Process the verified event
    await WebhookHandlers.handleEvent(event);
  }

  static async handleEvent(event: Stripe.Event): Promise<void> {
    console.log(`[webhook] Processing event: ${event.type}`);

    switch (event.type) {
      case 'checkout.session.completed':
        await WebhookHandlers.handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await WebhookHandlers.handleSubscriptionUpdate(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await WebhookHandlers.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case 'invoice.payment_succeeded':
        await WebhookHandlers.handlePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.payment_failed':
        await WebhookHandlers.handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      default:
        console.log(`[webhook] Unhandled event type: ${event.type}`);
    }
  }

  static async handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
    const tenantId = session.metadata?.tenant_id;
    
    if (!tenantId) {
      console.error('[webhook] checkout.session.completed: missing tenant_id in metadata');
      return;
    }

    console.log(`[webhook] Checkout completed for tenant: ${tenantId}`);
    
    // Subscription details will be updated via subscription.created event
  }

  static async handleSubscriptionUpdate(subscription: Stripe.Subscription): Promise<void> {
    const tenantId = subscription.metadata?.tenant_id;
    
    if (!tenantId) {
      console.error('[webhook] subscription update: missing tenant_id in metadata');
      return;
    }

    const priceId = subscription.items.data[0]?.price.id || '';

    await subscriptionService.updateSubscriptionFromWebhook(
      subscription.id,
      subscription.status,
      subscription.current_period_start,
      subscription.current_period_end,
      subscription.trial_end,
      subscription.cancel_at_period_end,
      priceId
    );

    console.log(`[webhook] Subscription updated for tenant: ${tenantId}, status: ${subscription.status}`);
  }

  static async handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
    const tenantId = subscription.metadata?.tenant_id;
    
    if (!tenantId) {
      console.error('[webhook] subscription deleted: missing tenant_id in metadata');
      return;
    }

    // For cancellations, we mark as canceled but preserve the plan_id
    // by calling a specialized method that only updates status
    await subscriptionService.cancelSubscription(subscription.id);

    console.log(`[webhook] Subscription canceled for tenant: ${tenantId}`);
  }

  static async handlePaymentSucceeded(invoice: Stripe.Invoice): Promise<void> {
    const subscriptionId = invoice.subscription as string;
    
    if (subscriptionId) {
      console.log(`[webhook] Payment succeeded for subscription: ${subscriptionId}`);
    }
  }

  static async handlePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    const subscriptionId = invoice.subscription as string;
    
    if (subscriptionId) {
      console.log(`[webhook] Payment failed for subscription: ${subscriptionId}`);
      // Could send notification to tenant admin here
    }
  }
}
