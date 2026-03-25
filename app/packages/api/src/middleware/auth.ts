import type { Context, Next } from 'hono';
import { auth } from '../auth.js';
import { db, schema } from '@chirri/shared';
import { eq, and, isNull } from 'drizzle-orm';
import { createHash } from 'node:crypto';

const { apiKeys, users } = schema;

interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  plan: string;
  stripeCustomerId: string | null;
}

/**
 * Try to get user from session cookie via better-auth
 */
async function getUserFromSession(c: Context): Promise<AuthUser | null> {
  try {
    const session = await auth.api.getSession({
      headers: c.req.raw.headers,
    });
    if (!session?.user) return null;
    return {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      plan: (session.user as any).plan || 'free',
      stripeCustomerId: (session.user as any).stripeCustomerId || null,
    };
  } catch {
    return null;
  }
}

/**
 * Try to get user from API key in Authorization header
 */
async function getUserFromApiKey(c: Context): Promise<AuthUser | null> {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const key = authHeader.slice(7);
  if (!key.startsWith('ck_live_') && !key.startsWith('ck_test_')) return null;

  const keyHash = createHash('sha256').update(key).digest('hex');

  const result = await db
    .select({
      apiKey: apiKeys,
      user: users,
    })
    .from(apiKeys)
    .innerJoin(users, eq(apiKeys.userId, users.id))
    .where(and(eq(apiKeys.keyHash, keyHash), isNull(apiKeys.revokedAt)))
    .limit(1);

  if (result.length === 0) return null;

  const { user, apiKey } = result[0];

  // Check expiry
  if (apiKey.expiresAt && apiKey.expiresAt < new Date()) return null;

  // Update lastUsedAt (fire-and-forget)
  db.update(apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKeys.id, apiKey.id))
    .catch(() => {});

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    plan: user.plan,
    stripeCustomerId: user.stripeCustomerId ?? null,
  };
}

/**
 * Middleware: requires authentication (session or API key).
 * Returns 401 if neither present.
 */
export async function requireAuth(c: Context, next: Next) {
  const user = (await getUserFromSession(c)) || (await getUserFromApiKey(c));
  if (!user) {
    return c.json(
      { error: { code: 'unauthorized', message: 'Authentication required' } },
      401,
    );
  }
  c.set('user', user);
  await next();
}

/**
 * Middleware: attaches user to context if present, but doesn't require it.
 */
export async function optionalAuth(c: Context, next: Next) {
  const user = (await getUserFromSession(c)) || (await getUserFromApiKey(c));
  if (user) {
    c.set('user', user);
  }
  await next();
}
