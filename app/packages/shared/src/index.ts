// Database
export { db, pool } from './db/index.js';
export type { Database } from './db/index.js';
export * as schema from './db/schema.js';

// Types & Enums
export * from './types/index.js';

// Constants
export { PLAN_LIMITS } from './constants/plans.js';
export { PROVIDER_PROFILES } from './constants/providers.js';
export type { ProviderProfile } from './constants/providers.js';
export {
  STRIPE_PRICES,
  getStripePriceId,
  getPlanFromPriceId,
} from './constants/stripe-prices.js';
export type { PlanName, BillingPeriod, StripePriceConfig } from './constants/stripe-prices.js';

// Utilities
export * from './utils/id.js';
export { normalizeMonitorUrl, hashUrl, extractDomain, extractPath } from './utils/url.js';
export { encrypt, decrypt } from './utils/crypto.js';

// Templates
export { buildIssueBody, buildIssueTitle } from './templates/github-issue.js';

// Services
export { sendChangeAlert, sendWeeklyDigest, sendWelcome, sendDunning } from './services/email.js';
export type { ChangeInfo } from './services/email.js';
export { sendSlackNotification } from './services/slack.js';
export { sendDiscordNotification } from './services/discord.js';
export { deliverWebhook } from './services/webhook-delivery.js';
export type { WebhookPayload, DeliveryResult } from './services/webhook-delivery.js';
export { routeNotification } from './services/notification-router.js';
