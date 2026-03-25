import { db } from '../db/index.js';
import * as schema from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { sendChangeAlert, type ChangeInfo } from './email.js';
import { sendSlackNotification } from './slack.js';
import { sendDiscordNotification } from './discord.js';
import { deliverWebhook, type WebhookPayload } from './webhook-delivery.js';
import { notificationId } from '../utils/id.js';

// ============================================================================
// Types
// ============================================================================

export interface RoutedChange {
  id: string;
  summary: string;
  severity: string;
  changeType: string;
  url: string;
  detectedAt: string;
  diff?: Record<string, unknown>;
}

interface DispatchResult {
  channel: string;
  success: boolean;
  error?: string;
}

// ============================================================================
// Public API
// ============================================================================

export async function routeNotification(
  userId: string,
  change: RoutedChange,
): Promise<DispatchResult[]> {
  // Dedup: check if we already notified this user about this change
  const existing = await db
    .select({ id: schema.notifications.id })
    .from(schema.notifications)
    .where(
      and(
        eq(schema.notifications.userId, userId),
        eq(schema.notifications.changeId, change.id),
      ),
    )
    .limit(1);

  if (existing.length > 0) {
    return [{ channel: 'all', success: true, error: 'Already notified (dedup)' }];
  }

  // Fetch user with notification preferences
  const userRows = await db
    .select({
      id: schema.users.id,
      email: schema.users.email,
      notificationDefaults: schema.users.notificationDefaults,
    })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);

  if (userRows.length === 0) {
    return [{ channel: 'all', success: false, error: 'User not found' }];
  }

  const user = userRows[0];
  const prefs = (user.notificationDefaults || {}) as Record<string, unknown>;
  const results: DispatchResult[] = [];

  const changeInfo: ChangeInfo = {
    id: change.id,
    summary: change.summary,
    severity: change.severity,
    changeType: change.changeType,
    url: change.url,
    detectedAt: change.detectedAt,
    diff: change.diff,
  };

  // Email notification (default: enabled)
  if (prefs.email !== false) {
    const result = await sendChangeAlert(user.email, changeInfo);
    results.push({ channel: 'email', ...result });

    await recordNotification(userId, change.id, 'email', user.email, result.success, result.error);
  }

  // Slack notification
  const slackUrl = prefs.slack_webhook_url as string | undefined;
  if (slackUrl) {
    const result = await sendSlackNotification(slackUrl, changeInfo);
    results.push({ channel: 'slack', ...result });

    await recordNotification(userId, change.id, 'slack', slackUrl, result.success, result.error);
  }

  // Discord notification
  const discordUrl = prefs.discord_webhook_url as string | undefined;
  if (discordUrl) {
    const result = await sendDiscordNotification(discordUrl, changeInfo);
    results.push({ channel: 'discord', ...result });

    await recordNotification(
      userId,
      change.id,
      'discord',
      discordUrl,
      result.success,
      result.error,
    );
  }

  // Webhook notifications — fetch active webhooks for this user
  const activeWebhooks = await db
    .select()
    .from(schema.webhooks)
    .where(and(eq(schema.webhooks.userId, userId), eq(schema.webhooks.isActive, true)));

  for (const webhook of activeWebhooks) {
    const payload: WebhookPayload = {
      event: 'change.detected',
      data: {
        change_id: change.id,
        summary: change.summary,
        severity: change.severity,
        change_type: change.changeType,
        url: change.url,
        detected_at: change.detectedAt,
      },
      timestamp: new Date().toISOString(),
    };

    const result = await deliverWebhook(webhook.url, payload, webhook.signingSecret);
    results.push({
      channel: 'webhook',
      success: result.success,
      error: result.error,
    });

    // Update webhook status
    if (result.success) {
      await db
        .update(schema.webhooks)
        .set({ lastSuccessAt: new Date(), consecutiveFailures: 0 })
        .where(eq(schema.webhooks.id, webhook.id));
    } else {
      const newFailures = webhook.consecutiveFailures + 1;
      const updates: Record<string, unknown> = {
        lastFailureAt: new Date(),
        lastFailureReason: result.error,
        consecutiveFailures: newFailures,
      };
      // Auto-disable after 10 consecutive failures
      if (newFailures >= 10) {
        updates.isActive = false;
        updates.disabledAt = new Date();
      }
      await db.update(schema.webhooks).set(updates).where(eq(schema.webhooks.id, webhook.id));
    }

    await recordNotification(
      userId,
      change.id,
      'webhook',
      webhook.url,
      result.success,
      result.error,
    );
  }

  return results;
}

// ============================================================================
// Helpers
// ============================================================================

async function recordNotification(
  userId: string,
  changeId: string,
  channel: string,
  recipient: string,
  success: boolean,
  error?: string,
): Promise<void> {
  try {
    await db.insert(schema.notifications).values({
      id: notificationId(),
      userId,
      changeId,
      channel,
      recipient,
      status: success ? 'sent' : 'failed',
      error: error || null,
      sentAt: success ? new Date() : null,
    });
  } catch (err) {
    console.error('[notification-router] Failed to record notification:', err);
  }
}
