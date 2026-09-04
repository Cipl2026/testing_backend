import {
  ZoneCapacitySnapshot,
  CoverageGap,
  ProviderRecruitmentSignal,
  ProviderShift,
  ShiftRecommendation,
  CoverageOpportunity,
  SupplyAlert,
  CityLaunchReadiness,
  ExpansionRecommendation,
  NetworkCapacityPlan,
  ZoneQualityMetric,
} from '@/models/Network.js';
import { FeatureFlag } from '@/models/FeatureFlag.js';
import { FeatureFlagKey } from '@ghaarfix/shared-types';
import { logger } from '@/utils/logger.js';

export async function runPhase17Migrations() {
  await Promise.all([
    ZoneCapacitySnapshot.syncIndexes(),
    CoverageGap.syncIndexes(),
    ProviderRecruitmentSignal.syncIndexes(),
    ProviderShift.syncIndexes(),
    ShiftRecommendation.syncIndexes(),
    CoverageOpportunity.syncIndexes(),
    SupplyAlert.syncIndexes(),
    CityLaunchReadiness.syncIndexes(),
    ExpansionRecommendation.syncIndexes(),
    NetworkCapacityPlan.syncIndexes(),
    ZoneQualityMetric.syncIndexes(),
  ]);

  await FeatureFlag.findOneAndUpdate(
    { key: FeatureFlagKey.ENABLE_NETWORK_INTELLIGENCE },
    { key: FeatureFlagKey.ENABLE_NETWORK_INTELLIGENCE, enabled: true, rules: [{ type: 'global' }] },
    { upsert: true },
  );

  logger.info('Phase 17 network intelligence indexes ensured');
}
