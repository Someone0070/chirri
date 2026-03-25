import { Hono } from 'hono';
import { db, schema, apiKeyId, liveApiKey, testApiKey } from '@chirri/shared';
import { eq, and, isNull } from 'drizzle-orm';
import { createHash } from 'node:crypto';
import { requireAuth } from '../middleware/auth.js';

const { apiKeys } = schema;

type Variables = {
  user: { id: string; email: string; name: string | null; plan: string; stripeCustomerId: string | null };
};

export const apiKeysRoute = new Hono<{ Variables: Variables }>();

// All routes require auth
apiKeysRoute.use('*', requireAuth);

/**
 * POST /api/v1/api-keys — create a new API key
 * Body: { name?: string, testMode?: boolean }
 * Returns the full key ONCE; after this only the masked version is available.
 */
apiKeysRoute.post('/', async (c) => {
  const user = c.get('user');
  const body = await c.req.json().catch(() => ({}));
  const name = (body as any).name || 'Default';
  const isTestMode = (body as any).testMode === true;

  const rawKey = isTestMode ? testApiKey() : liveApiKey();
  const keyHash = createHash('sha256').update(rawKey).digest('hex');
  const keyPrefix = isTestMode ? 'ck_test_' : 'ck_live_';
  const keyLastFour = rawKey.slice(-4);

  const id = apiKeyId();

  await db.insert(apiKeys).values({
    id,
    userId: user.id,
    name,
    keyHash,
    keyPrefix,
    keyLastFour,
  });

  return c.json(
    {
      id,
      name,
      key: rawKey, // Only returned once!
      prefix: keyPrefix,
      lastFour: keyLastFour,
      createdAt: new Date().toISOString(),
    },
    201,
  );
});

/**
 * GET /api/v1/api-keys — list all API keys (masked)
 */
apiKeysRoute.get('/', async (c) => {
  const user = c.get('user');

  const keys = await db
    .select({
      id: apiKeys.id,
      name: apiKeys.name,
      keyPrefix: apiKeys.keyPrefix,
      keyLastFour: apiKeys.keyLastFour,
      lastUsedAt: apiKeys.lastUsedAt,
      expiresAt: apiKeys.expiresAt,
      revokedAt: apiKeys.revokedAt,
      createdAt: apiKeys.createdAt,
    })
    .from(apiKeys)
    .where(and(eq(apiKeys.userId, user.id), isNull(apiKeys.revokedAt)));

  const masked = keys.map((k) => ({
    ...k,
    maskedKey: `${k.keyPrefix}${'•'.repeat(8)}${k.keyLastFour}`,
  }));

  return c.json({ data: masked });
});

/**
 * DELETE /api/v1/api-keys/:id — revoke an API key
 */
apiKeysRoute.delete('/:id', async (c) => {
  const user = c.get('user');
  const keyId = c.req.param('id');

  const result = await db
    .update(apiKeys)
    .set({ revokedAt: new Date() })
    .where(and(eq(apiKeys.id, keyId), eq(apiKeys.userId, user.id), isNull(apiKeys.revokedAt)));

  if (result.rowCount === 0) {
    return c.json({ error: { code: 'not_found', message: 'API key not found' } }, 404);
  }

  return c.json({ success: true });
});

/**
 * POST /api/v1/api-keys/:id/rotate — rotate an API key
 * Revokes the old key and creates a new one with the same name.
 */
apiKeysRoute.post('/:id/rotate', async (c) => {
  const user = c.get('user');
  const keyId = c.req.param('id');

  // Find existing key
  const existing = await db
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.id, keyId), eq(apiKeys.userId, user.id), isNull(apiKeys.revokedAt)))
    .limit(1);

  if (existing.length === 0) {
    return c.json({ error: { code: 'not_found', message: 'API key not found' } }, 404);
  }

  const oldKey = existing[0];
  const isTestMode = oldKey.keyPrefix === 'ck_test_';

  // Revoke old key
  await db
    .update(apiKeys)
    .set({ revokedAt: new Date() })
    .where(eq(apiKeys.id, keyId));

  // Create new key
  const rawKey = isTestMode ? testApiKey() : liveApiKey();
  const keyHash = createHash('sha256').update(rawKey).digest('hex');
  const keyLastFour = rawKey.slice(-4);
  const newId = apiKeyId();

  await db.insert(apiKeys).values({
    id: newId,
    userId: user.id,
    name: oldKey.name,
    keyHash,
    keyPrefix: oldKey.keyPrefix,
    keyLastFour,
  });

  return c.json({
    id: newId,
    name: oldKey.name,
    key: rawKey,
    prefix: oldKey.keyPrefix,
    lastFour: keyLastFour,
    createdAt: new Date().toISOString(),
  });
});
