import { getLifecycleOverview } from '@/modules/customer-lifecycle/lifecycle.service.js';
import { getRetentionOverview, getTimeToSecondBooking } from '@/modules/customer-lifecycle/retention.service.js';
import { listChurnPredictions } from '@/modules/customer-lifecycle/churn.service.js';
import { listCampaigns } from '@/modules/customer-lifecycle/campaign-delivery.service.js';
import { listReferralReviews } from '@/modules/customer-lifecycle/referral-intelligence.service.js';
import { LoyaltyAccount, ServiceRecommendation } from '@/models/CustomerLifecycle.js';
import { CustomerLifecycleSnapshot } from '@/models/CustomerLifecycle.js';
import { getOrCreateReferralCode } from '@/modules/discovery-growth/growth.service.js';
import { Subscription } from '@/models/Subscription.js';
import { SubscriptionStatus } from '@ghaarfix/shared-types';

export async function getGrowthOverview() {
  const [lifecycle, retention, churn, campaigns, referrals, loyaltyCount, activeRecs, subscriptions] =
    await Promise.all([
      getLifecycleOverview(),
      getRetentionOverview(),
      listChurnPredictions({ riskLevel: 'HIGH' as never, limit: 5 }),
      listCampaigns({ status: 'ACTIVE' as never, limit: 5 }),
      listReferralReviews(),
      LoyaltyAccount.countDocuments(),
      ServiceRecommendation.countDocuments({ status: 'ACTIVE', expiresAt: { $gt: new Date() } }),
      Subscription.countDocuments({ status: SubscriptionStatus.ACTIVE }),
    ]);

  const totalCustomers = await CustomerLifecycleSnapshot.countDocuments();

  return {
    totalCustomers,
    lifecycle,
    retention: retention.averages,
    cohorts: retention.cohorts.slice(0, 6),
    highChurnRisk: churn.items,
    activeCampaigns: campaigns.items,
    flaggedReferrals: referrals.length,
    loyaltyMembers: loyaltyCount,
    activeRecommendations: activeRecs,
    activeSubscriptions: subscriptions,
    timeToSecondBooking: await getTimeToSecondBooking(),
  };
}

export async function getReferralIntelligence() {
  const reviews = await listReferralReviews();
  return { flaggedReviews: reviews };
}

export async function getLoyaltyAdminSummary() {
  const tiers = await LoyaltyAccount.aggregate([
    { $group: { _id: '$tier', count: { $sum: 1 }, totalPoints: { $sum: '$points' } } },
  ]);
  return { tiers };
}

export async function getCustomerReferralSummary(customerId: string) {
  return getOrCreateReferralCode(customerId);
}
