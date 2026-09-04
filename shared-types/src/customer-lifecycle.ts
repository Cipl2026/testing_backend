/** Phase 20 — Growth, Retention & Customer Lifecycle Intelligence */

export enum CustomerLifecycleState {
  NEW = 'NEW',
  ACTIVATED = 'ACTIVATED',
  REPEAT = 'REPEAT',
  LOYAL = 'LOYAL',
  AT_RISK = 'AT_RISK',
  CHURNED = 'CHURNED',
  REACTIVATED = 'REACTIVATED',
}

export enum ChurnRiskLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
}

export enum MaintenanceReminderType {
  DUE_SOON = 'DUE_SOON',
  OVERDUE = 'OVERDUE',
  SEASONAL = 'SEASONAL',
  SAFETY = 'SAFETY',
  WARRANTY = 'WARRANTY',
}

export enum ServiceRecommendationSource {
  RULE_BASED = 'RULE_BASED',
  ASSET_BASED = 'ASSET_BASED',
  SEASONAL = 'SEASONAL',
  BEHAVIORAL = 'BEHAVIORAL',
  AI_ASSISTED = 'AI_ASSISTED',
}

export enum ServiceRecommendationStatus {
  ACTIVE = 'ACTIVE',
  DISMISSED = 'DISMISSED',
  EXPIRED = 'EXPIRED',
  CONVERTED = 'CONVERTED',
}

export enum LoyaltyTier {
  BRONZE = 'BRONZE',
  SILVER = 'SILVER',
  GOLD = 'GOLD',
  PLATINUM = 'PLATINUM',
}

export enum LoyaltyEventType {
  BOOKING_COMPLETED = 'BOOKING_COMPLETED',
  REFERRAL_COMPLETED = 'REFERRAL_COMPLETED',
  SUBSCRIPTION_RENEWED = 'SUBSCRIPTION_RENEWED',
  BONUS = 'BONUS',
  REDEEMED = 'REDEEMED',
  REVERSED = 'REVERSED',
  EXPIRED = 'EXPIRED',
}

export enum LifecycleCampaignObjective {
  ACTIVATION = 'ACTIVATION',
  RETENTION = 'RETENTION',
  REACTIVATION = 'REACTIVATION',
  REFERRAL = 'REFERRAL',
  LOYALTY = 'LOYALTY',
  SUBSCRIPTION = 'SUBSCRIPTION',
  SEASONAL = 'SEASONAL',
}

export enum LifecycleCampaignStatus {
  DRAFT = 'DRAFT',
  SCHEDULED = 'SCHEDULED',
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  COMPLETED = 'COMPLETED',
  ARCHIVED = 'ARCHIVED',
}

export enum MessagePriority {
  CRITICAL = 'CRITICAL',
  TRANSACTIONAL = 'TRANSACTIONAL',
  SERVICE_REMINDER = 'SERVICE_REMINDER',
  MARKETING = 'MARKETING',
}

export enum MarketingChannel {
  PUSH = 'PUSH',
  EMAIL = 'EMAIL',
  SMS = 'SMS',
  IN_APP = 'IN_APP',
}

export enum AttributionModel {
  FIRST_TOUCH = 'FIRST_TOUCH',
  LAST_TOUCH = 'LAST_TOUCH',
  ASSISTED = 'ASSISTED',
}

export enum ReferralReviewStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  FLAGGED = 'FLAGGED',
}

export enum ReactivationTrigger {
  CUSTOMER_INACTIVE = 'CUSTOMER_INACTIVE',
  SUBSCRIPTION_EXPIRED = 'SUBSCRIPTION_EXPIRED',
  MAINTENANCE_OVERDUE = 'MAINTENANCE_OVERDUE',
  SEASON_APPROACHING = 'SEASON_APPROACHING',
  ISSUE_RESOLVED = 'ISSUE_RESOLVED',
}

export interface LifecycleThresholds {
  repeatBookingCount: number;
  loyalBookingCount: number;
  churnInactiveDays: number;
  atRiskDaysSinceLastBooking: number;
}

export const DEFAULT_LIFECYCLE_THRESHOLDS: LifecycleThresholds = {
  repeatBookingCount: 2,
  loyalBookingCount: 5,
  churnInactiveDays: 180,
  atRiskDaysSinceLastBooking: 90,
};
