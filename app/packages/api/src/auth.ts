import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from '@chirri/shared/db';
import * as schema from '@chirri/shared/db/schema';

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    usePlural: true,
    schema,
  }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL || 'http://localhost:3000',
  basePath: '/api/auth',
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false, // set to true once email is wired
    sendResetPassword: async ({ user, url }) => {
      // Stub: log to console for now
      console.log(`[EMAIL STUB] Password reset for ${user.email}: ${url}`);
    },
  },
  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      // Stub: log to console for now
      console.log(`[EMAIL STUB] Verify email for ${user.email}: ${url}`);
    },
    sendOnSignUp: true,
  },
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // 5 min cache
    },
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // update session every 24h
  },
  user: {
    additionalFields: {
      plan: {
        type: 'string',
        defaultValue: 'free',
        required: false,
      },
      stripeCustomerId: {
        type: 'string',
        required: false,
        fieldName: 'stripe_customer_id',
      },
    },
  },
  trustedOrigins: [process.env.DASHBOARD_ORIGIN || 'http://localhost:5173'],
  advanced: {
    // better-auth handles its own ID generation
  },
});

export type Auth = typeof auth;
