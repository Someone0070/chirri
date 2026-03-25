import { Hono } from 'hono';
import { db, schema } from '@chirri/shared';
import { eq } from 'drizzle-orm';
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

export const notificationsRoute = new Hono<{ Variables: Variables }>();

notificationsRoute.use('*', requireAuth);

// ============================================================================
// GET /api/v1/notifications/settings
// ============================================================================

notificationsRoute.get('/settings', async (c) => {
  const user = c.get('user');

  const rows = await db
    .select({
      notificationDefaults: schema.users.notificationDefaults,
    })
    .from(schema.users)
    .where(eq(schema.users.id, user.id))
    .limit(1);

  if (rows.length === 0) {
    return c.json({ error: { code: 'not_found', message: 'User not found' } }, 404);
  }

  const defaults = (rows[0].notificationDefaults || {}) as Record<string, unknown>;

  return c.json({
    data: {
      email: defaults.email !== false, // default true
      min_severity: defaults.min_severity || 'medium',
      slack_webhook_url: defaults.slack_webhook_url || null,
      discord_webhook_url: defaults.discord_webhook_url || null,
      quiet_hours: defaults.quiet_hours || null,
      digest_mode: defaults.digest_mode || null,
    },
  });
});

// ============================================================================
// PATCH /api/v1/notifications/settings
// ============================================================================

notificationsRoute.patch('/settings', async (c) => {
  const user = c.get('user');
  const body = await c.req.json().catch(() => ({}));

  // Fetch current defaults
  const rows = await db
    .select({
      notificationDefaults: schema.users.notificationDefaults,
    })
    .from(schema.users)
    .where(eq(schema.users.id, user.id))
    .limit(1);

  if (rows.length === 0) {
    return c.json({ error: { code: 'not_found', message: 'User not found' } }, 404);
  }

  const current = (rows[0].notificationDefaults || {}) as Record<string, unknown>;

  // Merge updates
  const allowedFields = [
    'email',
    'min_severity',
    'slack_webhook_url',
    'discord_webhook_url',
    'quiet_hours',
    'digest_mode',
  ] as const;

  const updates: Record<string, unknown> = { ...current };
  for (const field of allowedFields) {
    if (field in (body as Record<string, unknown>)) {
      updates[field] = (body as Record<string, unknown>)[field];
    }
  }

  // Validate min_severity
  if (updates.min_severity) {
    const validSeverities = ['critical', 'high', 'medium', 'low'];
    if (!validSeverities.includes(updates.min_severity as string)) {
      return c.json(
        {
          error: {
            code: 'validation_error',
            message: `min_severity must be one of: ${validSeverities.join(', ')}`,
          },
        },
        400,
      );
    }
  }

  // Validate URLs
  for (const urlField of ['slack_webhook_url', 'discord_webhook_url'] as const) {
    const val = updates[urlField];
    if (val !== null && val !== undefined && typeof val === 'string') {
      try {
        const parsed = new URL(val);
        if (!['http:', 'https:'].includes(parsed.protocol)) {
          return c.json(
            {
              error: {
                code: 'validation_error',
                message: `${urlField} must be an HTTP(S) URL`,
              },
            },
            400,
          );
        }
      } catch {
        return c.json(
          {
            error: {
              code: 'validation_error',
              message: `${urlField} is not a valid URL`,
            },
          },
          400,
        );
      }
    }
  }

  await db
    .update(schema.users)
    .set({
      notificationDefaults: updates,
      updatedAt: new Date(),
    })
    .where(eq(schema.users.id, user.id));

  return c.json({
    data: {
      email: updates.email !== false,
      min_severity: updates.min_severity || 'medium',
      slack_webhook_url: updates.slack_webhook_url || null,
      discord_webhook_url: updates.discord_webhook_url || null,
      quiet_hours: updates.quiet_hours || null,
      digest_mode: updates.digest_mode || null,
    },
  });
});

// ============================================================================
// POST /api/v1/notifications/test
// ============================================================================

notificationsRoute.post('/test', async (c) => {
  const user = c.get('user');
  const body = await c.req.json().catch(() => ({}));
  const channel = (body as Record<string, unknown>).channel as string | undefined;

  // Build a fake change for testing
  const testChange = {
    id: 'test_' + Date.now(),
    summary: 'Test notification from Chirri',
    severity: 'medium',
    changeType: 'schema',
    url: 'https://api.example.com/v1/test',
    detectedAt: new Date().toISOString(),
  };

  const results: Array<{ channel: string; success: boolean; error?: string }> = [];

  // Fetch prefs
  const rows = await db
    .select({
      email: schema.users.email,
      notificationDefaults: schema.users.notificationDefaults,
    })
    .from(schema.users)
    .where(eq(schema.users.id, user.id))
    .limit(1);

  if (rows.length === 0) {
    return c.json({ error: { code: 'not_found', message: 'User not found' } }, 404);
  }

  const prefs = (rows[0].notificationDefaults || {}) as Record<string, unknown>;

  // Dynamically import to avoid circular deps at module level
  if (!channel || channel === 'email') {
    const { sendChangeAlert } = await import('@chirri/shared/src/services/email.js');
    const result = await sendChangeAlert(rows[0].email, testChange);
    results.push({ channel: 'email', ...result });
  }

  if (!channel || channel === 'slack') {
    const slackUrl = prefs.slack_webhook_url as string | undefined;
    if (slackUrl) {
      const { sendSlackNotification } = await import('@chirri/shared/src/services/slack.js');
      const result = await sendSlackNotification(slackUrl, testChange);
      results.push({ channel: 'slack', ...result });
    } else if (channel === 'slack') {
      results.push({
        channel: 'slack',
        success: false,
        error: 'No Slack webhook URL configured',
      });
    }
  }

  if (!channel || channel === 'discord') {
    const discordUrl = prefs.discord_webhook_url as string | undefined;
    if (discordUrl) {
      const { sendDiscordNotification } = await import('@chirri/shared/src/services/discord.js');
      const result = await sendDiscordNotification(discordUrl, testChange);
      results.push({ channel: 'discord', ...result });
    } else if (channel === 'discord') {
      results.push({
        channel: 'discord',
        success: false,
        error: 'No Discord webhook URL configured',
      });
    }
  }

  return c.json({ data: results });
});
