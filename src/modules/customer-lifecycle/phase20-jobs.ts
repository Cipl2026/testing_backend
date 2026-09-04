import { logger } from '@/utils/logger.js';
import { isLifecycleGrowthEnabled } from '@/modules/customer-lifecycle/lifecycle-feature.service.js';
import { calculateAllLifecycles } from '@/modules/customer-lifecycle/lifecycle.service.js';
import { calculateAllChurnRisks } from '@/modules/customer-lifecycle/churn.service.js';
import { buildSignupCohorts } from '@/modules/customer-lifecycle/retention.service.js';
import { deliverScheduledCampaigns } from '@/modules/customer-lifecycle/campaign-delivery.service.js';
import { reviewReferralFraud } from '@/modules/customer-lifecycle/referral-intelligence.service.js';
import { Booking } from '@/models/Booking.js';
import { BookingStatus } from '@ghaarfix/shared-types';
import { generateServiceRecommendations } from '@/modules/customer-lifecycle/service-recommendation.service.js';
import { LoyaltyReward } from '@/models/CustomerLifecycle.js';

export async function runPhase20Jobs() {
  if (!(await isLifecycleGrowthEnabled())) {
    return { enabled: false, lifecycles: 0, churn: 0, cohorts: 0, campaigns: 0, referrals: 0, recommendations: 0 };
  }

  const results = await Promise.allSettled([
    calculateAllLifecycles(100),
    calculateAllChurnRisks(100),
    buildSignupCohorts(6),
    deliverScheduledCampaigns(),
    reviewReferralFraud(),
    generateRecommendationsBatch(30),
  ]);

  const summary = {
    enabled: true,
    lifecycles: results[0].status === 'fulfilled' ? results[0].value : 0,
    churn: results[1].status === 'fulfilled' ? results[1].value : 0,
    cohorts: results[2].status === 'fulfilled' ? results[2].value : 0,
    campaigns: results[3].status === 'fulfilled' ? results[3].value : 0,
    referrals: results[4].status === 'fulfilled' ? results[4].value : 0,
    recommendations: results[5].status === 'fulfilled' ? results[5].value : 0,
  };

  if (Object.values(summary).some((v) => typeof v === 'number' && v > 0)) {
    logger.info('Ran Phase 20 lifecycle growth jobs', summary);
  }

  return summary;
}

async function generateRecommendationsBatch(limit: number): Promise<number> {
  const customers = await Booking.distinct('customerId', { status: BookingStatus.COMPLETED });
  let count = 0;
  for (const id of customers.slice(0, limit)) {
    await generateServiceRecommendations(id.toString());
    count += 1;
  }
  return count;
}

export async function seedDefaultLoyaltyRewards() {
  const count = await LoyaltyReward.countDocuments();
  if (count > 0) return 0;

  await LoyaltyReward.insertMany([
    {
      name: '₹50 Service Credit',
      description: 'Redeem for ₹50 off your next service booking.',
      pointsCost: 500,
      rewardType: 'SERVICE_CREDIT',
      available: true,
    },
    {
      name: '10% Discount',
      description: '10% off your next eligible service.',
      pointsCost: 1000,
      rewardType: 'DISCOUNT',
      available: true,
    },
  ]);
  return 2;
}
