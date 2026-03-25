import { db, schema, PLAN_LIMITS } from '@chirri/shared';
import type { PlanLimits } from '@chirri/shared';
import { eq, count } from 'drizzle-orm';

const { users, urls } = schema;

/**
 * Parse interval string to minutes for comparison.
 * Supports: '5m', '15m', '1h', '24h'
 */
function intervalToMinutes(interval: string): number {
  const match = interval.match(/^(\d+)(m|h)$/);
  if (!match) return Infinity;
  const value = parseInt(match[1], 10);
  const unit = match[2];
  return unit === 'h' ? value * 60 : value;
}

/**
 * Get plan limits for a given plan name.
 * Returns free tier limits if plan is unknown.
 */
export function getPlanLimits(plan: string): PlanLimits {
  return PLAN_LIMITS[plan] || PLAN_LIMITS.free;
}

/**
 * Check if a user has reached their URL slot limit.
 * Returns { allowed: true } or { allowed: false, limit, current }.
 */
export async function checkUrlLimit(
  userId: string,
): Promise<{ allowed: boolean; limit: number; current: number }> {
  // Get user's plan
  const [user] = await db
    .select({ plan: users.plan })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    return { allowed: false, limit: 0, current: 0 };
  }

  const limits = getPlanLimits(user.plan);

  // Count current active URLs
  const [result] = await db
    .select({ count: count() })
    .from(urls)
    .where(eq(urls.userId, userId));

  const current = result?.count ?? 0;

  return {
    allowed: current < limits.maxUrls,
    limit: limits.maxUrls,
    current,
  };
}

/**
 * Check if a requested check interval is allowed for the user's plan.
 * Returns { allowed: true } or { allowed: false, minInterval }.
 */
export async function checkIntervalLimit(
  userId: string,
  requestedInterval: string,
): Promise<{ allowed: boolean; minInterval: string }> {
  const [user] = await db
    .select({ plan: users.plan })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    return { allowed: false, minInterval: '24h' };
  }

  const limits = getPlanLimits(user.plan);
  const requestedMinutes = intervalToMinutes(requestedInterval);
  const minMinutes = intervalToMinutes(limits.minInterval);

  return {
    allowed: requestedMinutes >= minMinutes,
    minInterval: limits.minInterval,
  };
}

/**
 * Check if a user has reached their webhook limit.
 */
export async function checkWebhookLimit(
  userId: string,
): Promise<{ allowed: boolean; limit: number; current: number }> {
  const [user] = await db
    .select({ plan: users.plan })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    return { allowed: false, limit: 0, current: 0 };
  }

  const limits = getPlanLimits(user.plan);

  // Infinity means unlimited
  if (limits.maxWebhooks === Infinity) {
    return { allowed: true, limit: Infinity, current: 0 };
  }

  const [result] = await db
    .select({ count: count() })
    .from(schema.webhooks)
    .where(eq(schema.webhooks.userId, userId));

  const current = result?.count ?? 0;

  return {
    allowed: current < limits.maxWebhooks,
    limit: limits.maxWebhooks,
    current,
  };
}

/**
 * Check if a specific feature is available on the user's plan.
 */
export function checkFeature(plan: string, feature: keyof PlanLimits['features']): boolean {
  const limits = getPlanLimits(plan);
  return limits.features[feature] ?? false;
}
