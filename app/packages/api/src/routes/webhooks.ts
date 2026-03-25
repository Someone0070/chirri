import { Hono } from 'hono';
import { db, schema, webhookId } from '@chirri/shared';
import { eq, and } from 'drizzle-orm';
import { randomBytes } from 'node:crypto';
import { requireAuth } from '../middleware/auth.js';

type Variables = {
  user: {
    id: string;
    email: string;
    name: string | null;
    plan: string;
    stripeCustomerId: string | null;
  };
};

export const webhooksRoute = new Hono<{ Variables: Variables }>();

webhooksRoute.use('*', requireAuth);

// ============================================================================
// POST /api/v1/webhooks — create webhook endpoint
// ============================================================================

webhooksRoute.post('/', async (c) => {
  const user = c.get('user');
  const body = await c.req.json().catch(() => ({}));
  const { url, name, events } = body as {
    url?: string;
    name?: string;
    events?: string[];
  };

  if (!url || typeof url !== 'string') {
    return c.json(
      { error: { code: 'validation_error', message: 'url is required' } },
      400,
    );
  }

  // Validate URL
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return c.json(
        { error: { code: 'validation_error', message: 'url must be HTTP(S)' } },
        400,
      );
    }
  } catch {
    return c.json(
      { error: { code: 'validation_error', message: 'url is not valid' } },
      400,
    );
  }

  // Check webhook limit (from plan)
  const existingCount = await db
    .select({ id: schema.webhooks.id })
    .from(schema.webhooks)
    .where(eq(schema.webhooks.userId, user.id));

  // Plan limits: free=2, personal=5, team=10, business=25
  const limits: Record<string, number> = {
    free: 2,
    personal: 5,
    team: 10,
    business: 25,
  };
  const maxWebhooks = limits[user.plan] || 2;

  if (existingCount.length >= maxWebhooks) {
    return c.json(
      {
        error: {
          code: 'limit_exceeded',
          message: `Webhook limit reached (${maxWebhooks} for ${user.plan} plan)`,
        },
      },
      403,
    );
  }

  const id = webhookId();
  const signingSecret = `whsec_${randomBytes(24).toString('hex')}`;

  const validEvents = ['change.detected', 'change.confirmed', 'forecast.created'];
  const webhookEvents = events?.filter((e) => validEvents.includes(e)) || ['change.confirmed'];

  await db.insert(schema.webhooks).values({
    id,
    userId: user.id,
    url,
    name: name || 'Default Webhook',
    signingSecret,
    events: webhookEvents,
    isActive: true,
    consecutiveFailures: 0,
  });

  return c.json(
    {
      id,
      url,
      name: name || 'Default Webhook',
      signing_secret: signingSecret, // Only shown once at creation
      events: webhookEvents,
      is_active: true,
      created_at: new Date().toISOString(),
    },
    201,
  );
});

// ============================================================================
// GET /api/v1/webhooks — list webhooks
// ============================================================================

webhooksRoute.get('/', async (c) => {
  const user = c.get('user');

  const rows = await db
    .select({
      id: schema.webhooks.id,
      url: schema.webhooks.url,
      name: schema.webhooks.name,
      events: schema.webhooks.events,
      isActive: schema.webhooks.isActive,
      consecutiveFailures: schema.webhooks.consecutiveFailures,
      lastSuccessAt: schema.webhooks.lastSuccessAt,
      lastFailureAt: schema.webhooks.lastFailureAt,
      lastFailureReason: schema.webhooks.lastFailureReason,
      disabledAt: schema.webhooks.disabledAt,
      createdAt: schema.webhooks.createdAt,
    })
    .from(schema.webhooks)
    .where(eq(schema.webhooks.userId, user.id));

  const data = rows.map((r) => ({
    id: r.id,
    url: r.url,
    name: r.name,
    events: r.events,
    is_active: r.isActive,
    consecutive_failures: r.consecutiveFailures,
    last_success_at: r.lastSuccessAt?.toISOString() || null,
    last_failure_at: r.lastFailureAt?.toISOString() || null,
    last_failure_reason: r.lastFailureReason,
    disabled_at: r.disabledAt?.toISOString() || null,
    created_at: r.createdAt.toISOString(),
  }));

  return c.json({ data });
});

// ============================================================================
// DELETE /api/v1/webhooks/:id — delete webhook
// ============================================================================

webhooksRoute.delete('/:id', async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');

  const result = await db
    .delete(schema.webhooks)
    .where(and(eq(schema.webhooks.id, id), eq(schema.webhooks.userId, user.id)));

  if (result.rowCount === 0) {
    return c.json({ error: { code: 'not_found', message: 'Webhook not found' } }, 404);
  }

  return c.json({ success: true });
});

// ============================================================================
// POST /api/v1/webhooks/:id/test — send test event
// ============================================================================

webhooksRoute.post('/:id/test', async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');

  const rows = await db
    .select()
    .from(schema.webhooks)
    .where(and(eq(schema.webhooks.id, id), eq(schema.webhooks.userId, user.id)))
    .limit(1);

  if (rows.length === 0) {
    return c.json({ error: { code: 'not_found', message: 'Webhook not found' } }, 404);
  }

  const webhook = rows[0];

  const { deliverWebhook } = await import('@chirri/shared/src/services/webhook-delivery.js');

  const result = await deliverWebhook(
    webhook.url,
    {
      event: 'test',
      data: {
        message: 'This is a test webhook from Chirri',
        webhook_id: webhook.id,
        timestamp: new Date().toISOString(),
      },
      timestamp: new Date().toISOString(),
    },
    webhook.signingSecret,
  );

  return c.json({
    data: {
      delivery_id: result.deliveryId,
      success: result.success,
      status_code: result.statusCode,
      attempts: result.attempts,
      error: result.error || null,
    },
  });
});
