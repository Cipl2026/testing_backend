import * as recommendationService from '@/modules/discovery-growth/recommendation.service.js';
import * as growthService from '@/modules/discovery-growth/growth.service.js';
import * as analyticsService from '@/modules/discovery-growth/analytics.service.js';
import * as campaignAdminService from '@/modules/discovery-growth/campaign-admin.service.js';

export async function runPhase10Jobs() {
  const results = await Promise.allSettled([
    recommendationService.generateRecommendationsForCustomers(),
    growthService.refreshServicePopularity(),
    growthService.expireRewards(),
    campaignAdminService.runScheduledCampaigns(),
    analyticsService.aggregateGrowthAnalytics(),
    recommendationService.expireRecommendations(),
  ]);

  return {
    recommendations: results[0].status === 'fulfilled' ? results[0].value : 0,
    popularity: results[1].status === 'fulfilled' ? results[1].value : 0,
    expiredRewards: results[2].status === 'fulfilled' ? results[2].value : 0,
    campaigns: results[3].status === 'fulfilled' ? results[3].value : { processed: 0, completed: 0 },
    analytics: results[4].status === 'fulfilled' ? true : false,
    expiredRecommendations: results[5].status === 'fulfilled' ? results[5].value : 0,
  };
}

export {
  recommendationService,
  growthService,
  analyticsService,
  campaignAdminService,
};
