/**
 * Stripe Price ID mapping.
 * Uses environment variables so price IDs are never hardcoded.
 * Create products/prices in Stripe Dashboard first, then set these env vars.
 */

export type PlanName = 'personal' | 'team' | 'business';
export type BillingPeriod = 'monthly' | 'annual';

export interface StripePriceConfig {
  monthly: string;
  annual: string;
}

/**
 * Map of plan name → { monthly, annual } Stripe Price IDs.
 * Returns empty strings if env vars are not set (will fail at checkout time with clear error).
 */
export const STRIPE_PRICES: Record<PlanName, StripePriceConfig> = {
  personal: {
    monthly: process.env.STRIPE_PRICE_PERSONAL_MONTHLY || '',
    annual: process.env.STRIPE_PRICE_PERSONAL_ANNUAL || '',
  },
  team: {
    monthly: process.env.STRIPE_PRICE_TEAM_MONTHLY || '',
    annual: process.env.STRIPE_PRICE_TEAM_ANNUAL || '',
  },
  business: {
    monthly: process.env.STRIPE_PRICE_BUSINESS_MONTHLY || '',
    annual: process.env.STRIPE_PRICE_BUSINESS_ANNUAL || '',
  },
};

/**
 * Reverse lookup: Stripe Price ID → plan name.
 */
export function getPlanFromPriceId(priceId: string): PlanName | null {
  for (const [plan, prices] of Object.entries(STRIPE_PRICES)) {
    if (prices.monthly === priceId || prices.annual === priceId) {
      return plan as PlanName;
    }
  }
  return null;
}

/**
 * Get the Stripe Price ID for a given plan and billing period.
 */
export function getStripePriceId(plan: PlanName, period: BillingPeriod): string {
  const prices = STRIPE_PRICES[plan];
  if (!prices) {
    throw new Error(`Unknown plan: ${plan}`);
  }
  const priceId = prices[period];
  if (!priceId) {
    throw new Error(
      `Stripe Price ID not configured for ${plan}/${period}. Set STRIPE_PRICE_${plan.toUpperCase()}_${period.toUpperCase()} env var.`,
    );
  }
  return priceId;
}
