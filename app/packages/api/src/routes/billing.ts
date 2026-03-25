import { Hono } from 'hono';
import { stripe } from '../lib/stripe.js';
import { requireAuth } from '../middleware/auth.js';
import { db, schema, getStripePriceId } from '@chirri/shared';
import type { PlanName, BillingPeriod } from '@chirri/shared';
import { eq } from 'drizzle-orm';

const { users } = schema;

type Variables = {
  user: {
    id: string;
    email: string;
    name: string | null;
    plan: string;
    stripeCustomerId: string | null;
  };
};

const VALID_PLANS: PlanName[] = ['personal', 'team', 'business'];
const VALID_PERIODS: BillingPeriod[] = ['monthly', 'annual'];

export const billingRoute = new Hono<{ Variables: Variables }>();

// All billing routes require auth
billingRoute.use('*', requireAuth);

/**
 * POST /api/v1/billing/checkout
 * Create a Stripe Checkout session for a new subscription or plan change.
 */
billingRoute.post('/checkout', async (c) => {
  const user = c.get('user');
  const body = await c.req.json();

  const plan = body.plan as PlanName;
  const period = (body.period || 'monthly') as BillingPeriod;

  if (!VALID_PLANS.includes(plan)) {
    return c.json(
      { error: { code: 'invalid_plan', message: `Plan must be one of: ${VALID_PLANS.join(', ')}` } },
      400,
    );
  }
  if (!VALID_PERIODS.includes(period)) {
    return c.json(
      { error: { code: 'invalid_period', message: `Period must be one of: ${VALID_PERIODS.join(', ')}` } },
      400,
    );
  }

  const priceId = getStripePriceId(plan, period);

  // Get or create Stripe customer
  let customerId = user.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      metadata: { chirri_user_id: user.id },
    });
    customerId = customer.id;

    // Store stripe_customer_id on user
    await db
      .update(users)
      .set({ stripeCustomerId: customerId, updatedAt: new Date() })
      .where(eq(users.id, user.id));
  }

  const dashboardOrigin = process.env.DASHBOARD_ORIGIN || 'http://localhost:5173';

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${dashboardOrigin}/settings/billing?success=true`,
    cancel_url: `${dashboardOrigin}/settings/billing?canceled=true`,
    metadata: {
      chirri_user_id: user.id,
      plan,
      period,
    },
    subscription_data: {
      metadata: {
        chirri_user_id: user.id,
        plan,
      },
    },
  });

  return c.json({ url: session.url });
});

/**
 * GET /api/v1/billing/portal
 * Create a Stripe Customer Portal session for managing subscription.
 */
billingRoute.get('/portal', async (c) => {
  const user = c.get('user');

  if (!user.stripeCustomerId) {
    return c.json(
      { error: { code: 'no_subscription', message: 'No billing account found. Subscribe to a plan first.' } },
      400,
    );
  }

  const dashboardOrigin = process.env.DASHBOARD_ORIGIN || 'http://localhost:5173';

  const session = await stripe.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: `${dashboardOrigin}/settings/billing`,
  });

  return c.json({ url: session.url });
});

/**
 * GET /api/v1/billing/subscription
 * Get current subscription details.
 */
billingRoute.get('/subscription', async (c) => {
  const user = c.get('user');

  // Fetch fresh user data from DB for subscription fields
  const [dbUser] = await db
    .select({
      plan: users.plan,
      subscriptionStatus: users.subscriptionStatus,
      currentPeriodEnd: users.currentPeriodEnd,
      stripeSubscriptionId: users.stripeSubscriptionId,
    })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);

  if (!dbUser) {
    return c.json({ error: { code: 'not_found', message: 'User not found' } }, 404);
  }

  // If user has a Stripe subscription, fetch cancel_at from Stripe
  let cancelAt: string | null = null;
  if (dbUser.stripeSubscriptionId) {
    try {
      const subscription = await stripe.subscriptions.retrieve(dbUser.stripeSubscriptionId);
      cancelAt = subscription.cancel_at ? new Date(subscription.cancel_at * 1000).toISOString() : null;
    } catch {
      // Subscription may have been deleted; ignore
    }
  }

  return c.json({
    plan: dbUser.plan,
    status: dbUser.subscriptionStatus || 'active',
    current_period_end: dbUser.currentPeriodEnd?.toISOString() || null,
    cancel_at: cancelAt,
  });
});
