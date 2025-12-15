import Stripe from "stripe";

// Initialize Stripe client
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripePriceId = process.env.STRIPE_PRO_PRICE_ID;

let stripe: Stripe | null = null;

if (stripeSecretKey) {
  stripe = new Stripe(stripeSecretKey);
  console.log(`[Stripe] Initialized with key: ${stripeSecretKey.substring(0, 7)}...`);
  
  if (stripePriceId) {
    console.log(`[Stripe] Pro price ID configured: ${stripePriceId.substring(0, 10)}...`);
  } else {
    console.log("[Stripe] WARNING: STRIPE_PRO_PRICE_ID is not set - checkout will not work");
  }
} else {
  console.log("[Stripe] Not configured - add STRIPE_SECRET_KEY to enable payments");
}

/**
 * Check if Stripe is configured
 */
export function isStripeConfigured(): boolean {
  return !!stripeSecretKey && !!stripe && !!process.env.STRIPE_PRO_PRICE_ID;
}

/**
 * Get Stripe configuration status for debugging
 */
export function getStripeConfigStatus(): { 
  hasSecretKey: boolean; 
  hasPriceId: boolean;
  secretKeyPrefix?: string;
} {
  return {
    hasSecretKey: !!stripeSecretKey,
    hasPriceId: !!process.env.STRIPE_PRO_PRICE_ID,
    secretKeyPrefix: stripeSecretKey ? stripeSecretKey.substring(0, 7) : undefined,
  };
}

/**
 * Get the Stripe instance (throws if not configured)
 */
function getStripe(): Stripe {
  if (!stripe) {
    throw new Error("Stripe is not configured. Please set STRIPE_SECRET_KEY.");
  }
  return stripe;
}

/**
 * Get or create a Stripe customer for a user
 */
export async function getOrCreateCustomer(
  userId: string,
  email: string,
  existingCustomerId?: string | null
): Promise<string> {
  const stripeClient = getStripe();

  // If we already have a customer ID, verify it exists
  if (existingCustomerId) {
    try {
      await stripeClient.customers.retrieve(existingCustomerId);
      return existingCustomerId;
    } catch {
      // Customer doesn't exist, create a new one
    }
  }

  // Create a new customer
  const customer = await stripeClient.customers.create({
    email,
    metadata: {
      userId,
    },
  });

  return customer.id;
}

/**
 * Create a Stripe Checkout session for subscription
 */
export async function createCheckoutSession(params: {
  userId: string;
  userEmail: string;
  customerId?: string | null;
  successUrl: string;
  cancelUrl: string;
}): Promise<{ url: string; customerId: string }> {
  const stripeClient = getStripe();
  const proPriceId = process.env.STRIPE_PRO_PRICE_ID;

  if (!proPriceId) {
    throw new Error("STRIPE_PRO_PRICE_ID is not configured.");
  }

  // Get or create customer
  const customerId = await getOrCreateCustomer(
    params.userId,
    params.userEmail,
    params.customerId
  );

  // Create checkout session
  const session = await stripeClient.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [
      {
        price: proPriceId,
        quantity: 1,
      },
    ],
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    metadata: {
      userId: params.userId,
    },
    subscription_data: {
      metadata: {
        userId: params.userId,
      },
    },
  });

  if (!session.url) {
    throw new Error("Failed to create checkout session URL");
  }

  return {
    url: session.url,
    customerId,
  };
}

/**
 * Create a Stripe Customer Portal session for subscription management
 */
export async function createPortalSession(params: {
  customerId: string;
  returnUrl: string;
}): Promise<string> {
  const stripeClient = getStripe();

  const session = await stripeClient.billingPortal.sessions.create({
    customer: params.customerId,
    return_url: params.returnUrl,
  });

  return session.url;
}

/**
 * Construct and verify a webhook event
 */
export function constructWebhookEvent(
  payload: string | Buffer,
  signature: string
): Stripe.Event {
  const stripeClient = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    throw new Error("STRIPE_WEBHOOK_SECRET is not configured.");
  }

  return stripeClient.webhooks.constructEvent(payload, signature, webhookSecret);
}

/**
 * Handle Stripe webhook events
 */
export interface WebhookResult {
  userId?: string;
  action: "subscription_created" | "subscription_updated" | "subscription_deleted" | "payment_failed" | "ignored";
  subscriptionId?: string;
  customerId?: string;
  tier?: "free" | "pro" | "enterprise";
  currentPeriodEnd?: Date;
}

export async function handleWebhookEvent(event: Stripe.Event): Promise<WebhookResult> {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      
      // Only process subscription checkouts
      if (session.mode !== "subscription") {
        return { action: "ignored" };
      }

      const userId = session.metadata?.userId;
      const customerId = session.customer as string;
      const subscriptionId = session.subscription as string;

      if (!userId) {
        console.error("Webhook: checkout.session.completed missing userId in metadata");
        return { action: "ignored" };
      }

      return {
        action: "subscription_created",
        userId,
        customerId,
        subscriptionId,
        tier: "pro",
      };
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      const userId = subscription.metadata?.userId;
      const customerId = subscription.customer as string;

      if (!userId) {
        console.error("Webhook: customer.subscription.updated missing userId in metadata");
        return { action: "ignored" };
      }

      // Determine tier based on subscription status
      let tier: "free" | "pro" = "pro";
      if (subscription.status === "canceled" || subscription.status === "unpaid") {
        tier = "free";
      }

      // Get the current period end from the subscription
      const periodEnd = (subscription as any).current_period_end;
      
      return {
        action: "subscription_updated",
        userId,
        customerId,
        subscriptionId: subscription.id,
        tier,
        currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : undefined,
      };
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const userId = subscription.metadata?.userId;
      const customerId = subscription.customer as string;

      if (!userId) {
        console.error("Webhook: customer.subscription.deleted missing userId in metadata");
        return { action: "ignored" };
      }

      return {
        action: "subscription_deleted",
        userId,
        customerId,
        subscriptionId: subscription.id,
        tier: "free",
      };
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = invoice.customer as string;
      // Get subscription ID - handle different invoice structures
      const subscriptionId = (invoice as any).subscription as string | null;

      // Get userId from subscription metadata
      let userId: string | undefined;
      if (subscriptionId) {
        try {
          const stripeClient = getStripe();
          const subscription = await stripeClient.subscriptions.retrieve(subscriptionId);
          userId = subscription.metadata?.userId;
        } catch {
          console.error("Webhook: Could not retrieve subscription for failed payment");
        }
      }

      return {
        action: "payment_failed",
        userId,
        customerId,
        subscriptionId: subscriptionId || undefined,
      };
    }

    default:
      return { action: "ignored" };
  }
}

/**
 * Cancel a subscription
 */
export async function cancelSubscription(subscriptionId: string): Promise<void> {
  const stripeClient = getStripe();
  await stripeClient.subscriptions.cancel(subscriptionId);
}

/**
 * Get subscription details
 */
export async function getSubscription(subscriptionId: string): Promise<Stripe.Subscription | null> {
  const stripeClient = getStripe();
  try {
    return await stripeClient.subscriptions.retrieve(subscriptionId);
  } catch {
    return null;
  }
}
