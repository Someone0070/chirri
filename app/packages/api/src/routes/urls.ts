import { Hono } from 'hono';
import { z, type ZodIssue } from 'zod';
import {
  db,
  schema,
  urlId,
  sharedUrlId,
  normalizeMonitorUrl,
  hashUrl,
  extractDomain,
  extractPath,
  PLAN_LIMITS,
} from '@chirri/shared';
import { eq, and, desc, asc, lt, gt, count, isNull, sql } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth.js';

const { urls, sharedUrls, users } = schema;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Variables = {
  user: {
    id: string;
    email: string;
    name: string | null;
    plan: string;
    stripeCustomerId: string | null;
  };
};

// ---------------------------------------------------------------------------
// Interval ordering (for plan limit checks)
// ---------------------------------------------------------------------------

const INTERVAL_ORDER: Record<string, number> = {
  '1m': 1,
  '5m': 2,
  '15m': 3,
  '1h': 4,
  '6h': 5,
  '24h': 6,
};

function isIntervalAllowed(requested: string, minInterval: string): boolean {
  const reqOrder = INTERVAL_ORDER[requested] ?? 99;
  const minOrder = INTERVAL_ORDER[minInterval] ?? 99;
  return reqOrder >= minOrder; // higher order = less frequent = always ok
}

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const CheckIntervalEnum = z.enum(['1m', '5m', '15m', '1h', '6h', '24h']);

const CreateUrlSchema = z.object({
  url: z.string().url().max(2048),
  name: z.string().max(200).optional(),
  method: z.enum(['GET', 'POST']).default('GET'),
  headers: z.record(z.string()).optional(),
  body: z.string().optional(),
  check_interval: CheckIntervalEnum.default('24h'),
  tags: z.array(z.string().max(50)).max(10).optional(),
  notification_config: z
    .object({
      email: z.boolean().optional(),
      webhook_ids: z.array(z.string()).optional(),
      min_severity: z.enum(['critical', 'high', 'medium', 'low']).optional(),
      slack_enabled: z.boolean().optional(),
      discord_enabled: z.boolean().optional(),
      digest_mode: z.enum(['daily', 'weekly']).nullable().optional(),
    })
    .optional(),
  post_consent: z.boolean().optional(),
});

const UpdateUrlSchema = z.object({
  name: z.string().max(200).optional(),
  check_interval: CheckIntervalEnum.optional(),
  status: z.enum(['active', 'paused']).optional(),
  confidence_threshold: z.number().int().min(50).max(100).optional(),
  tags: z.array(z.string().max(50)).max(10).optional(),
  notification_config: z
    .object({
      email: z.boolean().nullable().optional(),
      webhook_ids: z.array(z.string()).optional(),
      min_severity: z.enum(['critical', 'high', 'medium', 'low']).nullable().optional(),
      slack_enabled: z.boolean().nullable().optional(),
      discord_enabled: z.boolean().nullable().optional(),
      digest_mode: z.enum(['daily', 'weekly']).nullable().optional(),
    })
    .optional(),
});

const BulkCreateSchema = z.object({
  urls: z
    .array(
      z.object({
        url: z.string().url().max(2048),
        name: z.string().max(200).optional(),
        check_interval: CheckIntervalEnum.optional(),
        tags: z.array(z.string().max(50)).max(10).optional(),
      }),
    )
    .min(1)
    .max(100),
});

const ListUrlsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
  status: z
    .enum([
      'learning',
      'calibrating',
      'active',
      'paused',
      'error',
      'degraded',
      'auth_required',
      'redirect_detected',
      'limited',
      'monitoring_empty',
    ])
    .optional(),
  tag: z.string().optional(),
  search: z.string().max(200).optional(),
  order: z.enum(['asc', 'desc']).default('desc'),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function errorResponse(
  code: string,
  message: string,
  status: number,
  details?: Array<{ field?: string; message: string }>,
) {
  return {
    error: { code, message, status, ...(details ? { details } : {}) },
  };
}

function validateUrl(rawUrl: string): { ok: true; normalized: string } | { ok: false; code: string; message: string } {
  try {
    const parsed = new URL(rawUrl);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { ok: false, code: 'invalid_url', message: 'URL must use http or https' };
    }
    // Block chirri.io self-referential
    if (parsed.hostname.endsWith('chirri.io')) {
      return { ok: false, code: 'self_referential', message: 'Cannot monitor chirri.io URLs' };
    }
    // Block private IPs (basic SSRF check)
    const host = parsed.hostname;
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host.startsWith('10.') ||
      host.startsWith('192.168.') ||
      host.startsWith('172.') ||
      host === '0.0.0.0' ||
      host === '::1'
    ) {
      return { ok: false, code: 'ssrf_blocked', message: 'URL resolves to private/internal IP' };
    }
    const normalized = normalizeMonitorUrl(rawUrl);
    return { ok: true, normalized };
  } catch {
    return { ok: false, code: 'invalid_url', message: 'Invalid URL format' };
  }
}

/** Decode cursor: base64 of JSON { created_at, id } */
function decodeCursor(cursor: string): { created_at: string; id: string } | null {
  try {
    const decoded = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf-8'));
    if (decoded.created_at && decoded.id) return decoded;
    return null;
  } catch {
    return null;
  }
}

function encodeCursor(createdAt: Date | string, id: string): string {
  const ts = typeof createdAt === 'string' ? createdAt : createdAt.toISOString();
  return Buffer.from(JSON.stringify({ created_at: ts, id })).toString('base64url');
}

/** Count user's active (non-deleted) URLs */
async function countUserUrls(userId: string): Promise<number> {
  const result = await db
    .select({ value: count() })
    .from(urls)
    .where(eq(urls.userId, userId));
  return result[0]?.value ?? 0;
}

/** Format a URL row for API response */
function formatUrlResponse(row: typeof urls.$inferSelect) {
  return {
    id: row.id,
    url: row.url,
    name: row.name,
    status: row.status,
    status_reason: row.statusReason,
    method: row.method,
    check_interval: row.checkInterval,
    content_type: row.contentType,
    monitoring_method: row.monitoringMethod,
    classification_confidence: row.classificationConfidence,
    confidence_threshold: row.confidenceThreshold,
    volatile_fields: row.volatileFields ?? [],
    tags: row.tags ?? [],
    notification_config: row.notificationConfig ?? {
      email: true,
      webhook_ids: [],
      min_severity: 'medium',
    },
    parsed_domain: row.parsedDomain,
    parsed_path: row.parsedPath,
    last_check_at: row.lastCheckAt?.toISOString() ?? null,
    next_check_at: row.nextCheckAt?.toISOString() ?? null,
    paused_at: row.pausedAt?.toISOString() ?? null,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const urlsRoute = new Hono<{ Variables: Variables }>();

// All routes require auth
urlsRoute.use('*', requireAuth);

// =========================================================================
// POST / — Add URL to monitor
// =========================================================================
urlsRoute.post('/', async (c) => {
  const user = c.get('user');
  const body = await c.req.json().catch(() => ({}));

  // Validate request body
  const parsed = CreateUrlSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      errorResponse('invalid_input', 'Invalid request body', 422, 
        parsed.error.issues.map((i: ZodIssue) => ({ field: i.path.join('.'), message: i.message }))),
      422,
    );
  }
  const data = parsed.data;

  // Validate URL
  const urlCheck = validateUrl(data.url);
  if (!urlCheck.ok) {
    return c.json(errorResponse(urlCheck.code, urlCheck.message, 422), 422);
  }
  const normalizedUrl = urlCheck.normalized;

  // Check plan limits
  const planLimits = PLAN_LIMITS[user.plan] ?? PLAN_LIMITS.free;
  const currentCount = await countUserUrls(user.id);
  if (currentCount >= planLimits.maxUrls) {
    return c.json(
      errorResponse(
        'plan_limit_reached',
        `Your ${user.plan} plan allows ${planLimits.maxUrls} URLs. Upgrade to add more.`,
        403,
      ),
      403,
    );
  }

  // Check interval vs plan
  if (!isIntervalAllowed(data.check_interval, planLimits.minInterval)) {
    return c.json(
      errorResponse(
        'interval_not_available',
        `Check interval ${data.check_interval} requires a higher plan. Your plan minimum is ${planLimits.minInterval}.`,
        403,
      ),
      403,
    );
  }

  // Check for duplicate
  const urlHashValue = hashUrl(normalizedUrl);
  const existing = await db
    .select({ id: urls.id })
    .from(urls)
    .where(and(eq(urls.userId, user.id), eq(urls.urlHash, urlHashValue)))
    .limit(1);

  if (existing.length > 0) {
    return c.json(errorResponse('duplicate_url', 'You are already monitoring this URL', 409), 409);
  }

  // Get or create shared URL record
  let sharedUrlRecord = await db
    .select()
    .from(sharedUrls)
    .where(eq(sharedUrls.urlHash, urlHashValue))
    .limit(1);

  if (sharedUrlRecord.length === 0) {
    const newSharedId = sharedUrlId();
    await db.insert(sharedUrls).values({
      id: newSharedId,
      urlHash: urlHashValue,
      url: normalizedUrl,
      domain: extractDomain(normalizedUrl),
      effectiveInterval: data.check_interval,
    });
    sharedUrlRecord = [{ id: newSharedId } as any];
  } else {
    // Bump subscriber count
    await db
      .update(sharedUrls)
      .set({ subscriberCount: sql`${sharedUrls.subscriberCount} + 1` })
      .where(eq(sharedUrls.id, sharedUrlRecord[0].id));
  }

  // Create URL record
  const newId = urlId();
  const now = new Date();
  const domain = extractDomain(normalizedUrl);
  const path = extractPath(normalizedUrl);

  const notifConfig = data.notification_config
    ? {
        email: data.notification_config.email ?? true,
        webhook_ids: data.notification_config.webhook_ids ?? [],
        min_severity: data.notification_config.min_severity ?? 'medium',
        slack_enabled: data.notification_config.slack_enabled,
        discord_enabled: data.notification_config.discord_enabled,
        digest_mode: data.notification_config.digest_mode,
      }
    : { email: true, webhook_ids: [], min_severity: 'medium' };

  await db.insert(urls).values({
    id: newId,
    userId: user.id,
    url: normalizedUrl,
    urlHash: urlHashValue,
    name: data.name ?? null,
    method: data.method,
    postConsent: data.post_consent ?? false,
    postConsentAt: data.post_consent ? now : null,
    headers: data.headers ?? {},
    body: data.body ?? null,
    checkInterval: data.check_interval,
    status: 'learning',
    tags: data.tags ?? [],
    sharedUrlId: sharedUrlRecord[0].id,
    parsedDomain: domain,
    parsedPath: path,
    notificationConfig: notifConfig,
    learningStartedAt: now,
    createdAt: now,
    updatedAt: now,
  });

  // Fetch back the created row
  const created = await db.select().from(urls).where(eq(urls.id, newId)).limit(1);

  return c.json(formatUrlResponse(created[0]), 201);
});

// =========================================================================
// POST /bulk — Bulk import URLs
// =========================================================================
urlsRoute.post('/bulk', async (c) => {
  const user = c.get('user');
  const body = await c.req.json().catch(() => ({}));

  const parsed = BulkCreateSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      errorResponse('invalid_input', 'Invalid request body', 422,
        parsed.error.issues.map((i: ZodIssue) => ({ field: i.path.join('.'), message: i.message }))),
      422,
    );
  }

  const planLimits = PLAN_LIMITS[user.plan] ?? PLAN_LIMITS.free;
  const currentCount = await countUserUrls(user.id);
  const available = planLimits.maxUrls - currentCount;

  const results: Array<{
    url: string;
    status: number;
    id?: string;
    error?: string;
  }> = [];
  let createdCount = 0;
  let limitReached = false;

  for (const item of parsed.data.urls) {
    // If we already hit the plan limit, skip remaining
    if (limitReached) {
      results.push({ url: item.url, status: 400, error: 'skipped_after_limit' });
      continue;
    }

    // Validate URL
    const urlCheck = validateUrl(item.url);
    if (!urlCheck.ok) {
      results.push({ url: item.url, status: 422, error: urlCheck.code });
      continue;
    }
    const normalizedUrl = urlCheck.normalized;

    // Check interval
    const interval = item.check_interval ?? '24h';
    if (!isIntervalAllowed(interval, planLimits.minInterval)) {
      results.push({ url: item.url, status: 403, error: 'interval_not_available' });
      continue;
    }

    // Check plan limit
    if (createdCount >= available) {
      limitReached = true;
      results.push({ url: item.url, status: 403, error: 'plan_limit_reached' });
      continue;
    }

    // Check duplicate
    const urlHashValue = hashUrl(normalizedUrl);
    const existing = await db
      .select({ id: urls.id })
      .from(urls)
      .where(and(eq(urls.userId, user.id), eq(urls.urlHash, urlHashValue)))
      .limit(1);

    if (existing.length > 0) {
      results.push({ url: item.url, status: 409, error: 'duplicate_url' });
      continue;
    }

    // Get or create shared URL
    let sharedUrlRecord = await db
      .select({ id: sharedUrls.id })
      .from(sharedUrls)
      .where(eq(sharedUrls.urlHash, urlHashValue))
      .limit(1);

    if (sharedUrlRecord.length === 0) {
      const newSharedId = sharedUrlId();
      await db.insert(sharedUrls).values({
        id: newSharedId,
        urlHash: urlHashValue,
        url: normalizedUrl,
        domain: extractDomain(normalizedUrl),
        effectiveInterval: interval,
      });
      sharedUrlRecord = [{ id: newSharedId }];
    } else {
      await db
        .update(sharedUrls)
        .set({ subscriberCount: sql`${sharedUrls.subscriberCount} + 1` })
        .where(eq(sharedUrls.id, sharedUrlRecord[0].id));
    }

    // Create
    const newId = urlId();
    const now = new Date();
    await db.insert(urls).values({
      id: newId,
      userId: user.id,
      url: normalizedUrl,
      urlHash: urlHashValue,
      name: item.name ?? null,
      method: 'GET',
      checkInterval: interval,
      status: 'learning',
      tags: item.tags ?? [],
      sharedUrlId: sharedUrlRecord[0].id,
      parsedDomain: extractDomain(normalizedUrl),
      parsedPath: extractPath(normalizedUrl),
      notificationConfig: { email: true, webhook_ids: [], min_severity: 'medium' },
      learningStartedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    results.push({ url: item.url, status: 201, id: newId });
    createdCount++;
  }

  return c.json(
    {
      results,
      summary: {
        created: createdCount,
        failed: results.length - createdCount,
      },
    },
    207,
  );
});

// =========================================================================
// GET / — List monitored URLs
// =========================================================================
urlsRoute.get('/', async (c) => {
  const user = c.get('user');
  const query = ListUrlsQuerySchema.safeParse(c.req.query());

  if (!query.success) {
    return c.json(
      errorResponse('invalid_input', 'Invalid query parameters', 422,
        query.error.issues.map((i: ZodIssue) => ({ field: i.path.join('.'), message: i.message }))),
      422,
    );
  }

  const { limit, cursor, status, tag, search, order } = query.data;
  const conditions: any[] = [eq(urls.userId, user.id)];

  // Status filter
  if (status) {
    conditions.push(eq(urls.status, status));
  }

  // Tag filter
  if (tag) {
    conditions.push(sql`${tag} = ANY(${urls.tags})`);
  }

  // Search filter
  if (search) {
    const pattern = `%${search}%`;
    conditions.push(
      sql`(${urls.url} ILIKE ${pattern} OR ${urls.name} ILIKE ${pattern})`,
    );
  }

  // Cursor-based pagination
  if (cursor) {
    const decoded = decodeCursor(cursor);
    if (!decoded) {
      return c.json(errorResponse('invalid_cursor', 'Invalid pagination cursor', 422), 422);
    }
    if (order === 'desc') {
      conditions.push(
        sql`(${urls.createdAt} < ${decoded.created_at} OR (${urls.createdAt} = ${decoded.created_at} AND ${urls.id} < ${decoded.id}))`,
      );
    } else {
      conditions.push(
        sql`(${urls.createdAt} > ${decoded.created_at} OR (${urls.createdAt} = ${decoded.created_at} AND ${urls.id} > ${decoded.id}))`,
      );
    }
  }

  // Fetch limit + 1 to determine has_more
  const rows = await db
    .select()
    .from(urls)
    .where(and(...conditions))
    .orderBy(order === 'desc' ? desc(urls.createdAt) : asc(urls.createdAt), order === 'desc' ? desc(urls.id) : asc(urls.id))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const data = rows.slice(0, limit);

  const nextCursor =
    hasMore && data.length > 0
      ? encodeCursor(data[data.length - 1].createdAt, data[data.length - 1].id)
      : null;

  return c.json({
    data: data.map(formatUrlResponse),
    has_more: hasMore,
    next_cursor: nextCursor,
  });
});

// =========================================================================
// GET /:id — Get single URL with details
// =========================================================================
urlsRoute.get('/:id', async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');

  const row = await db
    .select()
    .from(urls)
    .where(and(eq(urls.id, id), eq(urls.userId, user.id)))
    .limit(1);

  if (row.length === 0) {
    return c.json(errorResponse('not_found', 'URL not found', 404), 404);
  }

  return c.json(formatUrlResponse(row[0]));
});

// =========================================================================
// PATCH /:id — Update URL settings
// =========================================================================
urlsRoute.patch('/:id', async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));

  const parsed = UpdateUrlSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      errorResponse('invalid_input', 'Invalid request body', 422,
        parsed.error.issues.map((i: ZodIssue) => ({ field: i.path.join('.'), message: i.message }))),
      422,
    );
  }

  // Check ownership
  const existing = await db
    .select()
    .from(urls)
    .where(and(eq(urls.id, id), eq(urls.userId, user.id)))
    .limit(1);

  if (existing.length === 0) {
    return c.json(errorResponse('not_found', 'URL not found', 404), 404);
  }

  const data = parsed.data;
  const planLimits = PLAN_LIMITS[user.plan] ?? PLAN_LIMITS.free;

  // Validate check_interval against plan
  if (data.check_interval && !isIntervalAllowed(data.check_interval, planLimits.minInterval)) {
    return c.json(
      errorResponse(
        'interval_not_available',
        `Check interval ${data.check_interval} requires a higher plan.`,
        403,
      ),
      403,
    );
  }

  // Build update set
  const updateSet: Record<string, any> = { updatedAt: new Date() };

  if (data.name !== undefined) updateSet.name = data.name;
  if (data.check_interval !== undefined) updateSet.checkInterval = data.check_interval;
  if (data.confidence_threshold !== undefined) updateSet.confidenceThreshold = data.confidence_threshold;
  if (data.tags !== undefined) updateSet.tags = data.tags;

  // Handle status transitions (active <-> paused)
  if (data.status !== undefined) {
    const currentStatus = existing[0].status;
    if (data.status === 'paused') {
      if (currentStatus === 'paused') {
        return c.json(
          errorResponse('invalid_status_transition', 'URL is already paused', 409),
          409,
        );
      }
      updateSet.status = 'paused';
      updateSet.pausedAt = new Date();
    } else if (data.status === 'active') {
      if (currentStatus !== 'paused') {
        return c.json(
          errorResponse(
            'invalid_status_transition',
            `Cannot transition from ${currentStatus} to active via PATCH`,
            409,
          ),
          409,
        );
      }
      updateSet.status = 'active';
      updateSet.pausedAt = null;
    }
  }

  // Handle notification_config merge
  if (data.notification_config !== undefined) {
    const currentConfig = (existing[0].notificationConfig as Record<string, any>) ?? {
      email: true,
      webhook_ids: [],
      min_severity: 'medium',
    };
    updateSet.notificationConfig = { ...currentConfig, ...data.notification_config };
  }

  await db.update(urls).set(updateSet).where(eq(urls.id, id));

  // Fetch updated row
  const updated = await db.select().from(urls).where(eq(urls.id, id)).limit(1);

  return c.json(formatUrlResponse(updated[0]));
});

// =========================================================================
// DELETE /:id — Remove URL (soft delete via actual delete for now)
// =========================================================================
urlsRoute.delete('/:id', async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');

  // Check ownership
  const existing = await db
    .select({ id: urls.id, sharedUrlId: urls.sharedUrlId })
    .from(urls)
    .where(and(eq(urls.id, id), eq(urls.userId, user.id)))
    .limit(1);

  if (existing.length === 0) {
    return c.json(errorResponse('not_found', 'URL not found', 404), 404);
  }

  // Delete the URL record
  await db.delete(urls).where(eq(urls.id, id));

  // Decrement shared URL subscriber count
  if (existing[0].sharedUrlId) {
    await db
      .update(sharedUrls)
      .set({ subscriberCount: sql`GREATEST(${sharedUrls.subscriberCount} - 1, 0)` })
      .where(eq(sharedUrls.id, existing[0].sharedUrlId));
  }

  return c.body(null, 204);
});

// =========================================================================
// POST /:id/check — Trigger immediate check
// =========================================================================
urlsRoute.post('/:id/check', async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');

  // Check ownership
  const existing = await db
    .select()
    .from(urls)
    .where(and(eq(urls.id, id), eq(urls.userId, user.id)))
    .limit(1);

  if (existing.length === 0) {
    return c.json(errorResponse('not_found', 'URL not found', 404), 404);
  }

  // Rate limit: 1 manual check per 5 minutes per URL
  // Use lastCheckAt as a simple rate limit proxy for now
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  if (existing[0].lastCheckAt && existing[0].lastCheckAt > fiveMinutesAgo) {
    const retryAfter = Math.ceil(
      (existing[0].lastCheckAt.getTime() + 5 * 60 * 1000 - Date.now()) / 1000,
    );
    return c.json(
      {
        error: {
          code: 'rate_limited',
          message: 'Manual check rate limit: 1 per 5 minutes per URL',
          status: 429,
          retry_after: retryAfter,
        },
      },
      429,
    );
  }

  // Stub: In production this would queue a BullMQ job
  // For now just update lastCheckAt and return 202
  await db
    .update(urls)
    .set({ lastCheckAt: new Date(), updatedAt: new Date() })
    .where(eq(urls.id, id));

  return c.json(
    {
      job_id: `job_${id}`,
      message: 'Check queued',
    },
    202,
  );
});
