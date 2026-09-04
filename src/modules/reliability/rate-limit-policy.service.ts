import { RateLimitCategory } from '@ghaarfix/shared-types';

export interface RateLimitPolicy {
  category: RateLimitCategory;
  windowMs: number;
  max: number;
}

export const RATE_LIMIT_POLICIES: Record<RateLimitCategory, RateLimitPolicy> = {
  [RateLimitCategory.AUTH]: { category: RateLimitCategory.AUTH, windowMs: 15 * 60_000, max: 20 },
  [RateLimitCategory.OTP]: { category: RateLimitCategory.OTP, windowMs: 15 * 60_000, max: 5 },
  [RateLimitCategory.PAYMENT]: { category: RateLimitCategory.PAYMENT, windowMs: 15 * 60_000, max: 10 },
  [RateLimitCategory.BOOKING]: { category: RateLimitCategory.BOOKING, windowMs: 15 * 60_000, max: 30 },
  [RateLimitCategory.URGENT_BOOKING]: {
    category: RateLimitCategory.URGENT_BOOKING,
    windowMs: 15 * 60_000,
    max: 10,
  },
  [RateLimitCategory.WEBHOOK]: { category: RateLimitCategory.WEBHOOK, windowMs: 60_000, max: 200 },
  [RateLimitCategory.GENERAL_API]: {
    category: RateLimitCategory.GENERAL_API,
    windowMs: 15 * 60_000,
    max: 100,
  },
};

export function getRateLimitPolicy(category: RateLimitCategory): RateLimitPolicy {
  return RATE_LIMIT_POLICIES[category];
}
