/**
 * MCP Server Monitoring API Routes
 *
 * POST /api/urls/mcp — Add an MCP server for monitoring
 */

import { Hono } from 'hono';
import { z } from 'zod';
import {
  db,
  schema,
  urlId,
  sharedUrlId,
  hashUrl,
  extractDomain,
  PLAN_LIMITS,
} from '@chirri/shared';
import { eq, and, count } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth.js';

const { urls, sharedUrls, users } = schema;

// ─── Types ──────────────────────────────────────────────────────────────────

type Variables = {
  user: {
    id: string;
    email: string;
    name: string | null;
    plan: string;
    stripeCustomerId: string | null;
  };
};

// ─── Validation ─────────────────────────────────────────────────────────────

const AddMcpServerSchema = z.object({
  endpoint: z
    .string()
    .url()
    .max(2048)
    .refine(
      (url) => {
        try {
          const parsed = new URL(url);
          return parsed.protocol === 'https:' || parsed.protocol === 'http:';
        } catch {
          return false;
        }
      },
      { message: 'Endpoint must be an HTTP(S) URL' },
    ),
  name: z.string().max(200).optional(),
  checkInterval: z.enum(['1h', '6h', '24h']).optional().default('6h'),
  transport: z.enum(['http', 'sse']).optional().default('http'),
});

// ─── Router ─────────────────────────────────────────────────────────────────

export const mcpRoute = new Hono<{ Variables: Variables }>();

mcpRoute.use('*', requireAuth);

/**
 * POST / — Add an MCP server for monitoring
 *
 * Body: { endpoint, name?, checkInterval?, transport? }
 * Returns: { id, endpoint, name, serverInfo?, toolCount? }
 */
mcpRoute.post('/', async (c) => {
  const user = c.get('user');
  const body = await c.req.json().catch(() => ({}));

  // Validate
  const parsed = AddMcpServerSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      {
        error: 'invalid_input',
        message: 'Invalid request body',
        details: parsed.error.issues.map((i) => ({
          field: i.path.join('.'),
          message: i.message,
        })),
      },
      422,
    );
  }

  const { endpoint, name, checkInterval, transport } = parsed.data;

  // Check plan limits (url count)
  const planLimits = PLAN_LIMITS[user.plan as keyof typeof PLAN_LIMITS] || PLAN_LIMITS.free;
  const [urlCount] = await db
    .select({ count: count() })
    .from(urls)
    .where(eq(urls.userId, user.id));

  if (urlCount.count >= planLimits.maxUrls) {
    return c.json(
      {
        error: 'limit_reached',
        message: `URL limit reached (${planLimits.maxUrls} for ${user.plan} plan)`,
      },
      429,
    );
  }

  // Check for duplicate
  const endpointHash = hashUrl(endpoint);
  const existing = await db
    .select({ id: urls.id })
    .from(urls)
    .where(and(eq(urls.userId, user.id), eq(urls.urlHash, endpointHash)))
    .limit(1);

  if (existing.length > 0) {
    return c.json(
      {
        error: 'duplicate',
        message: 'This MCP server is already being monitored',
        existingId: existing[0].id,
      },
      409,
    );
  }

  // Create shared URL
  const sUrlId = sharedUrlId();
  const domain = extractDomain(endpoint);
  const newUrlId = urlId();

  const mcpConfig = {
    transport,
    endpoint,
  };

  await db.transaction(async (tx) => {
    // Check if shared URL already exists
    const existingShared = await tx
      .select({ id: sharedUrls.id })
      .from(sharedUrls)
      .where(eq(sharedUrls.urlHash, endpointHash))
      .limit(1);

    let finalSharedUrlId: string;

    if (existingShared.length > 0) {
      finalSharedUrlId = existingShared[0].id;
      // Increment subscriber count
      await tx
        .update(sharedUrls)
        .set({
          subscriberCount: schema.sharedUrls.subscriberCount,
          updatedAt: new Date(),
        })
        .where(eq(sharedUrls.id, finalSharedUrlId));
    } else {
      finalSharedUrlId = sUrlId;
      await tx.insert(sharedUrls).values({
        id: sUrlId,
        urlHash: endpointHash,
        url: endpoint,
        domain,
        effectiveInterval: checkInterval,
        subscriberCount: 1,
        contentType: 'mcp/tools-list',
        monitoringMethod: 'mcp',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    // Create user URL with MCP source type
    await tx.insert(urls).values({
      id: newUrlId,
      userId: user.id,
      url: endpoint,
      urlHash: endpointHash,
      name: name || `MCP: ${domain}`,
      sourceType: 'mcp_server',
      mcpConfig,
      method: 'POST',
      checkInterval,
      status: 'active',
      sharedUrlId: finalSharedUrlId,
      parsedDomain: domain,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  return c.json(
    {
      id: newUrlId,
      endpoint,
      name: name || `MCP: ${domain}`,
      sourceType: 'mcp_server',
      checkInterval,
      message: 'MCP server added for monitoring. First check will run shortly.',
    },
    201,
  );
});

/**
 * GET / — List MCP servers being monitored
 */
mcpRoute.get('/', async (c) => {
  const user = c.get('user');

  const results = await db
    .select()
    .from(urls)
    .where(and(eq(urls.userId, user.id), eq(urls.sourceType, 'mcp_server')));

  return c.json({
    data: results.map((row) => ({
      id: row.id,
      endpoint: row.url,
      name: row.name,
      status: row.status,
      checkInterval: row.checkInterval,
      mcpConfig: row.mcpConfig,
      lastCheckAt: row.lastCheckAt?.toISOString() ?? null,
      nextCheckAt: row.nextCheckAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    })),
    total: results.length,
  });
});
