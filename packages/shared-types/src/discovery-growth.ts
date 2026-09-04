/** Phase 10 â Discovery & Growth shared enums */

export enum RecommendationType {
  MAINTENANCE = 'MAINTENANCE',
  REBOOK = 'REBOOK',
  SEASONAL = 'SEASONAL',
  ASSET = 'ASSET',
  POPULAR = 'POPULAR',
  SERVICE_BUNDLE = 'SERVICE_BUNDLE',
}

export enum RecommendationSource {
  HOME_HEALTH = 'HOME_HEALTH',
  BOOKING_HISTORY = 'BOOKING_HISTORY',
  SEASON = 'SEASON',
  POPULARITY = 'POPULARITY',
  CAMPAIGN = 'CAMPAIGN',
  MANUAL = 'MANUAL',
}

export enum SearchResultType {
  SERVICE = 'SERVICE',
  CATEGORY = 'CATEGORY',
  SUGGESTION = 'SUGGESTION',
}

export enum BundlePricingMode {
  FIXED = 'FIXED',
  DISCOUNTED = 'DISCOUNTED',
  CONFIGURABLE = 'CONFIGURABLE',
}

export enum PromotionType {
  PERCENTAGE = 'PERCENTAGE',
  FIXED_AMOUNT = 'FIXED_AMOUNT',
}

export enum PromotionStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  EXPIRED = 'EXPIRED',
  DISABLED = 'DISABLED',
}

export enum ReferralCodeStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  REVOKED = 'REVOKED',
}

export enum ReferralRedemptionStatus {
  PENDING = 'PENDING',
  QUALIFIED = 'QUALIFIED',
  REWARDED = 'REWARDED',
  REJECTED = 'REJECTED',
}

export enum RewardLedgerType {
  CREDIT = 'CREDIT',
  DEBIT = 'DEBIT',
  EXPIRATION = 'EXPIRATION',
  ADJUSTMENT = 'ADJUSTMENT',
}

export enum RewardLedgerStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  REVERSED = 'REVERSED',
}

export enum RewardSourceType {
  REFERRAL = 'REFERRAL',
  PROMOTION = 'PROMOTION',
  LOYALTY = 'LOYALTY',
  SUPPORT_ADJUSTMENT = 'SUPPORT_ADJUSTMENT',
}

export enum FeatureFlagKey {
  ENABLE_REFERRALS = 'ENABLE_REFERRALS',
  ENABLE_REWARDS = 'ENABLE_REWARDS',
  ENABLE_BUNDLES = 'ENABLE_BUNDLES',
  ENABLE_SEASONAL_CAMPAIGNS = 'ENABLE_SEASONAL_CAMPAIGNS',
  ENABLE_EXPERIMENTS = 'ENABLE_EXPERIMENTS',
  ENABLE_SMART_SEARCH = 'ENABLE_SMART_SEARCH',
}

export enum ExperimentStatus {
  DRAFT = 'DRAFT',
  RUNNING = 'RUNNING',
  PAUSED = 'PAUSED',
  COMPLETED = 'COMPLETED',
}

export enum ExperimentVariant {
  CONTROL = 'CONTROL',
  VARIANT_A = 'VARIANT_A',
  VARIANT_B = 'VARIANT_B',
}

export enum CampaignStatus {
  DRAFT = 'DRAFT',
  SCHEDULED = 'SCHEDULED',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  PAUSED = 'PAUSED',
}

export enum CampaignChannel {
  NOTIFICATION = 'NOTIFICATION',
  HOME_BANNER = 'HOME_BANNER',
  RECOMMENDATION = 'RECOMMENDATION',
}

export enum ProviderPreferenceType {
  PREFERRED = 'PREFERRED',
  RECENT = 'RECENT',
}

export enum SeasonName {
  SUMMER = 'SUMMER',
  MONSOON = 'MONSOON',
  WINTER = 'WINTER',
}

export enum AnalyticsEventName {
  HOME_VIEWED = 'HOME_VIEWED',
  SERVICE_VIEWED = 'SERVICE_VIEWED',
  SERVICE_SEARCHED = 'SERVICE_SEARCHED',
  SEARCH_RESULT_SELECTED = 'SEARCH_RESULT_SELECTED',
  BOOKING_STARTED = 'BOOKING_STARTED',
  BOOKING_COMPLETED = 'BOOKING_COMPLETED',
  BOOKING_CANCELLED = 'BOOKING_CANCELLED',
  RECOMMENDATION_VIEWED = 'RECOMMENDATION_VIEWED',
  RECOMMENDATION_CLICKED = 'RECOMMENDATION_CLICKED',
  RECOMMENDATION_DISMISSED = 'RECOMMENDATION_DISMISSED',
  PROMO_APPLIED = 'PROMO_APPLIED',
  REFERRAL_SHARED = 'REFERRAL_SHARED',
  REFERRAL_QUALIFIED = 'REFERRAL_QUALIFIED',
  EXPERIMENT_EXPOSED = 'EXPERIMENT_EXPOSED',
  EXPERIMENT_CONVERTED = 'EXPERIMENT_CONVERTED',
}

/** Properties that must never be stored in analytics event payloads */
export const BLOCKED_ANALYTICS_PROPERTIES = [
  'phone',
  'email',
  'address',
  'addressLine1',
  'addressLine2',
  'postalCode',
  'governmentId',
  'aadhaar',
  'pan',
  'paymentDetails',
  'cardNumber',
  'otp',
] as const;

export type BlockedAnalyticsProperty = (typeof BLOCKED_ANALYTICS_PROPERTIES)[number];
","path":"/Users/deependrakumar/Downloads/Ghaarfix/server/shared-types/src/discovery-growth.ts"}},{"type":"tool_use","name":"Write","input":{"contents":"