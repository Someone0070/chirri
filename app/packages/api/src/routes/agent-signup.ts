import { Hono } from 'hono';
import type { Context } from 'hono';
import {
  db,
  schema,
  userId,
  apiKeyId,
  freeApiKey,
  verificationToken,
  sendAgentSignupEmail,
} from '@chirri/shared';
import { eq } from 'drizzle-orm';
import { createHash } from 'node:crypto';

const { users, apiKeys, verifications } = schema;

const DASHBOARD_URL = process.env.DASHBOARD_URL || 'https://app.chirri.io';

// ============================================================================
// In-memory rate limiting
// ============================================================================

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const emailRateStore = new Map<string, RateLimitEntry>();
const ipRateStore = new Map<string, RateLimitEntry>();

// Cleanup every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of emailRateStore) {
    if (entry.resetAt <= now) emailRateStore.delete(key);
  }
  for (const [key, entry] of ipRateStore) {
    if (entry.resetAt <= now) ipRateStore.delete(key);
  }
}, 5 * 60 * 1000).unref();

function checkRateLimit(
  store: Map<string, RateLimitEntry>,
  key: string,
  maxAttempts: number,
  windowMs: number,
): { allowed: boolean; retryAfterSec?: number } {
  const now = Date.now();
  let entry = store.get(key);
  if (!entry || entry.resetAt <= now) {
    entry = { count: 0, resetAt: now + windowMs };
    store.set(key, entry);
  }
  entry.count++;
  if (entry.count > maxAttempts) {
    return { allowed: false, retryAfterSec: Math.ceil((entry.resetAt - now) / 1000) };
  }
  return { allowed: true };
}

function getClientIp(c: Context): string {
  return (
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ||
    c.req.header('x-real-ip') ||
    'unknown'
  );
}

function makeVerificationId(token: string): string {
  return createHash('sha256').update(token).digest('hex').slice(0, 21);
}

// ============================================================================
// Routes
// ============================================================================

export const agentSignupRoute = new Hono();

/**
 * POST /api/v1/auth/agent-signup
 *
 * Creates a new user account + API key for AI agent use.
 * No auth required — this IS the signup.
 */
agentSignupRoute.post('/agent-signup', async (c) => {
  // Parse & validate request body
  const body = await c.req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return c.json(
      { error: { code: 'bad_request', message: 'Invalid JSON body' } },
      400,
    );
  }

  const { email, source } = body as { email?: string; source?: string };

  if (!email || typeof email !== 'string') {
    return c.json(
      { error: { code: 'bad_request', message: 'email is required' } },
      400,
    );
  }

  // Basic email validation
  const emailLower = email.toLowerCase().trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailLower)) {
    return c.json(
      { error: { code: 'bad_request', message: 'Invalid email address' } },
      400,
    );
  }

  const validSources = ['mcp', 'api', 'cli'];
  const signupSource = validSources.includes(source || '') ? source! : 'api';

  // Rate limiting: 3 per email per hour
  const emailCheck = checkRateLimit(emailRateStore, emailLower, 3, 60 * 60 * 1000);
  if (!emailCheck.allowed) {
    c.header('Retry-After', String(emailCheck.retryAfterSec));
    return c.json(
      {
        error: {
          code: 'rate_limited',
          message: 'Too many signup attempts for this email. Please try again later.',
          retryAfter: emailCheck.retryAfterSec,
        },
      },
      429,
    );
  }

  // Rate limiting: 10 per IP per hour
  const ip = getClientIp(c);
  const ipCheck = checkRateLimit(ipRateStore, ip, 10, 60 * 60 * 1000);
  if (!ipCheck.allowed) {
    c.header('Retry-After', String(ipCheck.retryAfterSec));
    return c.json(
      {
        error: {
          code: 'rate_limited',
          message: 'Too many signup attempts. Please try again later.',
          retryAfter: ipCheck.retryAfterSec,
        },
      },
      429,
    );
  }

  // Check if email already has an account
  const existingUser = await db
    .select({
      id: users.id,
      email: users.email,
      emailVerified: users.emailVerified,
      plan: users.plan,
    })
    .from(users)
    .where(eq(users.email, emailLower))
    .limit(1);

  if (existingUser.length > 0) {
    const user = existingUser[0];

    if (user.emailVerified) {
      return c.json(
        {
          error: {
            code: 'conflict',
            message: 'Account exists. Use existing API key or log in at ' + DASHBOARD_URL,
          },
        },
        409,
      );
    }

    // Unverified account: return masked API key + resend verification
    const existingKeys = await db
      .select({
        keyPrefix: apiKeys.keyPrefix,
        keyLastFour: apiKeys.keyLastFour,
      })
      .from(apiKeys)
      .where(eq(apiKeys.userId, user.id))
      .limit(1);

    const maskedKey =
      existingKeys.length > 0
        ? `${existingKeys[0].keyPrefix}${'•'.repeat(24)}${existingKeys[0].keyLastFour}`
        : null;

    // Create new verification token & resend email
    const token = verificationToken();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

    await db.insert(verifications).values({
      id: makeVerificationId(token),
      identifier: emailLower,
      value: token,
      expiresAt,
    });

    const verifyUrl = `${DASHBOARD_URL}/verify/${token}`;

    // Fire-and-forget email
    sendAgentSignupEmail(emailLower, verifyUrl).catch((err: unknown) =>
      console.error('[agent-signup] Failed to send verification email:', err),
    );

    return c.json({
      api_key: maskedKey,
      user_id: user.id,
      plan: user.plan,
      limits: { max_urls: 3, min_interval: 'daily' },
      verify_url: verifyUrl,
      message:
        'Account already exists (unverified). Verification email resent. Use existing API key.',
    });
  }

  // =========================================================================
  // Create new user account
  // =========================================================================
  const newUserId = userId();
  const rawKey = freeApiKey();
  const keyHash = createHash('sha256').update(rawKey).digest('hex');
  const keyLastFour = rawKey.slice(-4);
  const newApiKeyId = apiKeyId();

  // Create user (agent-created accounts have no password yet)
  await db.insert(users).values({
    id: newUserId,
    email: emailLower,
    passwordHash: '', // No password — owner sets one via verify-claim flow
    name: null,
    plan: 'free',
    emailVerified: false,
    onboardingStep: 0,
  });

  // Create API key
  await db.insert(apiKeys).values({
    id: newApiKeyId,
    userId: newUserId,
    name: `Agent (${signupSource})`,
    keyHash,
    keyPrefix: 'ck_free_',
    keyLastFour,
  });

  // Create verification token
  const token = verificationToken();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days for new accounts

  await db.insert(verifications).values({
    id: makeVerificationId(token),
    identifier: emailLower,
    value: token,
    expiresAt,
  });

  const verifyUrl = `${DASHBOARD_URL}/verify/${token}`;

  // Send verification email (fire-and-forget)
  sendAgentSignupEmail(emailLower, verifyUrl).catch((err: unknown) =>
    console.error('[agent-signup] Failed to send verification email:', err),
  );

  return c.json(
    {
      api_key: rawKey,
      user_id: newUserId,
      plan: 'free',
      limits: { max_urls: 3, min_interval: 'daily' },
      verify_url: verifyUrl,
      message: 'API key is active. Owner can verify email to access dashboard.',
    },
    201,
  );
});

/**
 * POST /api/v1/auth/verify-claim
 *
 * Verifies email via token. Optionally sets a password so the owner
 * can log into the dashboard.
 *
 * Body: { token: string, password?: string }
 */
agentSignupRoute.post('/verify-claim', async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return c.json(
      { error: { code: 'bad_request', message: 'Invalid JSON body' } },
      400,
    );
  }

  const { token, password } = body as { token?: string; password?: string };

  if (!token || typeof token !== 'string') {
    return c.json(
      { error: { code: 'bad_request', message: 'token is required' } },
      400,
    );
  }

  // Find verification record by token value
  const verificationRecords = await db
    .select()
    .from(verifications)
    .where(eq(verifications.value, token))
    .limit(1);

  if (verificationRecords.length === 0) {
    return c.json(
      { error: { code: 'not_found', message: 'Invalid or expired verification token' } },
      404,
    );
  }

  const verification = verificationRecords[0];

  // Check expiry
  if (verification.expiresAt < new Date()) {
    await db.delete(verifications).where(eq(verifications.id, verification.id));
    return c.json(
      {
        error: {
          code: 'expired',
          message: 'Verification token has expired. Request a new one.',
        },
      },
      410,
    );
  }

  const emailLower = verification.identifier.toLowerCase();

  // Find the user
  const userRecords = await db
    .select()
    .from(users)
    .where(eq(users.email, emailLower))
    .limit(1);

  if (userRecords.length === 0) {
    return c.json(
      { error: { code: 'not_found', message: 'User not found' } },
      404,
    );
  }

  const user = userRecords[0];

  // Build update payload
  const updateData: Record<string, unknown> = {
    emailVerified: true,
    updatedAt: new Date(),
  };

  let passwordWasSet = false;

  // Set password if provided and user doesn't have one yet (agent-created accounts)
  if (password && typeof password === 'string' && password.length >= 8) {
    if (!user.passwordHash) {
      const { scryptSync, randomBytes } = await import('node:crypto');
      const salt = randomBytes(16).toString('hex');
      const hash = scryptSync(password, salt, 64).toString('hex');
      updateData.passwordHash = `${salt}:${hash}`;
      passwordWasSet = true;
    }
  }

  // Mark email as verified
  await db.update(users).set(updateData).where(eq(users.id, user.id));

  // Delete the used verification token
  await db.delete(verifications).where(eq(verifications.id, verification.id));

  const hasPassword = !!(user.passwordHash || passwordWasSet);

  return c.json({
    success: true,
    email_verified: true,
    user_id: user.id,
    has_password: hasPassword,
    message: user.passwordHash
      ? 'Email verified. You can log in with your existing password.'
      : passwordWasSet
        ? 'Email verified and password set. You can now log in.'
        : 'Email verified. Set a password to access your dashboard.',
    dashboard_url: DASHBOARD_URL,
  });
});
