import {
  CustomerLifecycleSnapshot,
  CustomerSegment,
  CustomerChurnPrediction,
  MarketingConsent,
  CommunicationLog,
  RecommendationFrequencyPolicy,
  ServiceRecommendation,
  LoyaltyAccount,
  LoyaltyTransaction,
  LoyaltyReward,
  LifecycleCampaign,
  ReactivationCampaign,
  ExperimentAssignment,
  MarketingTouchpoint,
  ReferralReview,
  CohortSnapshot,
  LifecycleThresholdConfig,
} from '@/models/CustomerLifecycle.js';
import { FeatureFlag } from '@/models/FeatureFlag.js';
import { FeatureFlagKey } from '@ghaarfix/shared-types';
import { seedDefaultLoyaltyRewards } from '@/modules/customer-lifecycle/phase20-jobs.js';
import { logger } from '@/utils/logger.js';

export async function runPhase20Migrations() {
  await Promise.all([
    CustomerLifecycleSnapshot.syncIndexes(),
    LifecycleThresholdConfig.syncIndexes(),
    CustomerSegment.syncIndexes(),
    CustomerChurnPrediction.syncIndexes(),
    MarketingConsent.syncIndexes(),
    CommunicationLog.syncIndexes(),
    RecommendationFrequencyPolicy.syncIndexes(),
    ServiceRecommendation.syncIndexes(),
    LoyaltyAccount.syncIndexes(),
    LoyaltyTransaction.syncIndexes(),
    LoyaltyReward.syncIndexes(),
    LifecycleCampaign.syncIndexes(),
    ReactivationCampaign.syncIndexes(),
    ExperimentAssignment.syncIndexes(),
    MarketingTouchpoint.syncIndexes(),
    ReferralReview.syncIndexes(),
    CohortSnapshot.syncIndexes(),
  ]);

  await FeatureFlag.findOneAndUpdate(
    { key: FeatureFlagKey.ENABLE_LIFECYCLE_GROWTH },
    { key: FeatureFlagKey.ENABLE_LIFECYCLE_GROWTH, enabled: true, rules: [{ type: 'global' }] },
    { upsert: true },
  );

  await RecommendationFrequencyPolicy.findOneAndUpdate(
    { key: 'global' },
    { key: 'global', maxPerDay: 5, maxPerWeek: 15, maxMarketingPerDay: 1, maxMarketingPerWeek: 3 },
    { upsert: true },
  );

  await LifecycleThresholdConfig.findOneAndUpdate(
    { key: 'global' },
    { key: 'global' },
    { upsert: true },
  );

  await seedDefaultLoyaltyRewards();

  logger.info('Phase 20 lifecycle growth indexes ensured');
}
