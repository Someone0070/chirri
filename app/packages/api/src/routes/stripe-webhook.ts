import { Hono } from 'hono';
import Stripe from 'stripe';
import { stripe } from '../lib/stripe.js';
import { db, schema } from '@chirri/shared';
import { getPlanFromPriceId } from '@chirri/shared';
import { eq } from 'drizzle-orm';

const { users } = schema;

export const stripeWebhookRoute = new Hono();

/**
 * POST /api/webhooks/stripe
 *
 * Stripe webhook endpoint. NO auth middleware — Stripe signs requests.
 * IMPORTANT: Must use raw body (c.req.text()) for signature verification.
 */
stripeWebhookRoute.post('/', async (c) => {
  const signature = c.req.header('stripe-signature');
  if (!signature) {
    return c.json({ error: 'Missing stripe-signature header' }, 400);
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET not configured');
    return c.json({ error: 'Webhook secret not configured' }, 500);
  }

  // Get raw body BEFORE any JSON parsing
  const rawBody = await c.req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`Webhook signature verification failed: ${message}`);
    return c.json({ error: 'Invalid signature' }, 400);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case 'invoice.paid':
        await handleInvoicePaid(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      default:
        // Unhandled event type — acknowledge receipt
        break;
    }
  } catch (err) {
    console.error(`Error handling webhook event ${event.type}:`, err);
    // Return 200 anyway to prevent Stripe retries for handler errors
    // (we log the error; Stripe retrying won't help if our logic fails)
  }

  return c.json({ received: true });
});

// ---------------------------------------------------------------------------
// Event Handlers
// ---------------------------------------------------------------------------

/**
 * checkout.session.completed — User completed Stripe Checkout.
 * Provision the plan on the user record.
 */
async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.chirri_user_id;
  if (!userId) {
    console.error('checkout.session.completed: missing chirri_user_id in metadata');
    return;
  }

  const plan = session.metadata?.plan || 'personal';
  const subscriptionId =
    typeof session.subscription === 'string'
      ? session.subscription
      : session.subscription?.id;
  const customerId =
    typeof session.customer === 'string'
      ? session.customer
      : session.customer?.id;

  // Retrieve subscription to get current_period_end
  let currentPeriodEnd: Date | null = null;
  if (subscriptionId) {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    currentPeriodEnd = new Date(subscription.current_period_end * 1000);
  }

  await db
    .update(users)
    .set({
      plan,
      stripeCustomerId: customerId || undefined,
      stripeSubscriptionId: subscriptionId || undefined,
      subscriptionStatus: 'active',
      currentPeriodEnd,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));

  console.log(`User ${userId} upgraded to ${plan}`);
}

/**
 * invoice.paid — Payment succeeded.
 * Confirm subscription is active, update period end.
 */
async function handleInvoicePaid(invoice: Stripe.Invoice) {
  const subscriptionId =
    typeof invoice.subscription === 'string'
      ? invoice.subscription
      : invoice.subscription?.id;

  if (!subscriptionId) return;

  // Look up user by subscription ID
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.stripeSubscriptionId, subscriptionId))
    .limit(1);

  if (!user) {
    console.error(`invoice.paid: no user found for subscription ${subscriptionId}`);
    return;
  }

  // Retrieve subscription for current_period_end
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);

  await db
    .update(users)
    .set({
      subscriptionStatus: 'active',
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id));

  // TODO: Cancel any pending dunning jobs for this user (BullMQ)
  console.log(`Invoice paid for user ${user.id}, subscription active`);
}

/**
 * invoice.payment_failed — Payment failed.
 * Mark subscription as past_due, start grace period.
 */
async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const subscriptionId =
    typeof invoice.subscription === 'string'
      ? invoice.subscription
      : invoice.subscription?.id;

  if (!subscriptionId) return;

  const [user] = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.stripeSubscriptionId, subscriptionId))
    .limit(1);

  if (!user) {
    console.error(`invoice.payment_failed: no user found for subscription ${subscriptionId}`);
    return;
  }

  await db
    .update(users)
    .set({
      subscriptionStatus: 'past_due',
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id));

  // TODO: Enqueue dunning email #1 immediately
  // TODO: Schedule dunning emails #2 (3d), #3 (7d), #4 (14d) as delayed BullMQ jobs
  console.log(`Payment failed for user ${user.id} (${user.email}), starting dunning sequence`);
}

/**
 * customer.subscription.updated — Plan change (upgrade/downgrade).
 * Sync the plan from Stripe subscription metadata or price ID.
 */
async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const userId = subscription.metadata?.chirri_user_id;
  if (!userId) {
    // Try to find user by customer ID
    const customerId =
      typeof subscription.customer === 'string'
        ? subscription.customer
        : subscription.customer?.id;

    if (!customerId) return;

    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.stripeCustomerId, customerId))
      .limit(1);

    if (!user) {
      console.error(`subscription.updated: no user found for customer ${customerId}`);
      return;
    }

    await syncSubscription(user.id, subscription);
    return;
  }

  await syncSubscription(userId, subscription);
}

/**
 * customer.subscription.deleted — Subscription cancelled/expired.
 * Downgrade user to free plan.
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const userId = subscription.metadata?.chirri_user_id;
  const customerId =
    typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer?.id;

  let targetUserId = userId;

  if (!targetUserId && customerId) {
    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.stripeCustomerId, customerId))
      .limit(1);

    if (user) targetUserId = user.id;
  }

  if (!targetUserId) {
    console.error('subscription.deleted: could not identify user');
    return;
  }

  await db
    .update(users)
    .set({
      plan: 'free',
      subscriptionStatus: 'canceled',
      stripeSubscriptionId: null,
      currentPeriodEnd: null,
      updatedAt: new Date(),
    })
    .where(eq(users.id, targetUserId));

  // TODO: Pause excess URLs beyond free plan limit (3)
  // TODO: Send downgrade notification email
  console.log(`User ${targetUserId} downgraded to free (subscription deleted)`);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function syncSubscription(userId: string, subscription: Stripe.Subscription) {
  // Determine plan from subscription metadata or price ID
  let plan: string | null = subscription.metadata?.plan ?? null;

  if (!plan && subscription.items.data.length > 0) {
    const priceId = subscription.items.data[0].price.id;
    plan = getPlanFromPriceId(priceId);
  }

  const status = subscription.status; // active, past_due, canceled, etc.

  const updateData: Record<string, unknown> = {
    subscriptionStatus: status,
    currentPeriodEnd: new Date(subscription.current_period_end * 1000),
    updatedAt: new Date(),
  };

  if (plan) {
    updateData.plan = plan;
  }

  await db.update(users).set(updateData).where(eq(users.id, userId));

  console.log(`Synced subscription for user ${userId}: plan=${plan || 'unchanged'}, status=${status}`);
}
