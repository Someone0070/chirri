import type { Context, Next } from 'hono';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Cleanup stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.resetAt <= now) store.delete(key);
  }
}, 5 * 60 * 1000).unref();

function getClientIp(c: Context): string {
  return (
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ||
    c.req.header('x-real-ip') ||
    'unknown'
  );
}

function createRateLimiter(opts: { maxAttempts: number; windowMs: number; prefix: string }) {
  return async (c: Context, next: Next) => {
    const ip = getClientIp(c);
    const key = `${opts.prefix}:${ip}`;
    const now = Date.now();

    let entry = store.get(key);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + opts.windowMs };
      store.set(key, entry);
    }

    entry.count++;

    if (entry.count > opts.maxAttempts) {
      const retryAfterSec = Math.ceil((entry.resetAt - now) / 1000);
      c.header('Retry-After', String(retryAfterSec));
      return c.json(
        {
          error: {
            code: 'rate_limited',
            message: 'Too many requests. Please try again later.',
            retryAfter: retryAfterSec,
          },
        },
        429,
      );
    }

    await next();
  };
}

/**
 * Rate limit for login: 5 attempts per IP per 15 minutes
 */
export const loginRateLimit = createRateLimiter({
  maxAttempts: 5,
  windowMs: 15 * 60 * 1000,
  prefix: 'rl:login',
});

/**
 * Rate limit for signup: 3 attempts per IP per hour
 */
export const signupRateLimit = createRateLimiter({
  maxAttempts: 3,
  windowMs: 60 * 60 * 1000,
  prefix: 'rl:signup',
});
