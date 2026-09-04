import * as capacityService from '@/modules/network/capacity-snapshot.service.js';
import * as coverageGapService from '@/modules/network/coverage-gap.service.js';
import * as recruitmentService from '@/modules/network/recruitment.service.js';
import * as qualityService from '@/modules/network/quality-heatmap.service.js';
import * as launchService from '@/modules/network/launch-readiness.service.js';
import * as expansionService from '@/modules/network/expansion.service.js';
import * as shiftService from '@/modules/network/shift.service.js';
import { ServiceZone } from '@/models/ServiceZone.js';
import { ServiceZoneAvailability } from '@/models/ServiceZoneAvailability.js';
import { createSupplyAlertIfNeeded } from '@/modules/network/network-overview.service.js';
import { logger } from '@/utils/logger.js';

export async function runPhase17Jobs() {
  const results = await Promise.allSettled([
    capacityService.captureAllZoneSnapshots(),
    coverageGapService.detectAllCoverageGaps(),
    recruitmentService.generateAllRecruitmentSignals(),
    qualityService.aggregateAllZoneQuality(),
    launchService.computeAllLaunchReadiness(),
    expansionService.analyzeExpansionOpportunities(),
    runShiftRecommendations(),
    runSupplyAlerts(),
  ]);

  const summary = {
    capacitySnapshots:
      results[0].status === 'fulfilled' ? results[0].value : 0,
    coverageGaps: results[1].status === 'fulfilled' ? results[1].value : 0,
    recruitmentSignals: results[2].status === 'fulfilled' ? results[2].value : 0,
    qualityAggregates: results[3].status === 'fulfilled' ? results[3].value : 0,
    launchReadiness: results[4].status === 'fulfilled' ? results[4].value : 0,
    expansionRecommendations: results[5].status === 'fulfilled' ? results[5].value : 0,
    shiftRecommendations: results[6].status === 'fulfilled' ? results[6].value : 0,
    supplyAlerts: results[7].status === 'fulfilled' ? results[7].value : 0,
  };

  if (Object.values(summary).some((v) => v > 0)) {
    logger.info('Ran Phase 17 network intelligence jobs', summary);
  }

  return summary;
}

async function runShiftRecommendations(): Promise<number> {
  const { ProviderSkill } = await import('@/models/ProviderSkill.js');
  const { ProviderSkillStatus } = await import('@ghaarfix/shared-types');
  const providers = await ProviderSkill.distinct('providerId', {
    status: ProviderSkillStatus.VERIFIED,
  });
  let total = 0;
  for (const providerId of providers.slice(0, 20)) {
    total += await shiftService.generateShiftRecommendations(providerId.toString());
  }
  return total;
}

async function runSupplyAlerts(): Promise<number> {
  const zones = await ServiceZone.find({ isActive: true }).limit(10);
  let count = 0;
  for (const zone of zones) {
    const serviceIds = await ServiceZoneAvailability.distinct('serviceId', {
      serviceZoneId: zone._id,
    });
    for (const serviceId of serviceIds.slice(0, 3)) {
      const alert = await createSupplyAlertIfNeeded(zone._id.toString(), serviceId.toString());
      if (alert) count += 1;
    }
  }
  return count;
}
