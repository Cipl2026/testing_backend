import { Region } from '@/models/Globalization.js';
import { aggregateRegionPerformance } from '@/modules/globalization/expansion-analytics.service.js';
import { isGlobalizationEnabled } from '@/modules/globalization/globalization-feature.service.js';
import { metricsService } from '@/modules/reliability/metrics.service.js';

export async function runPhase24Jobs(): Promise<{
  enabled: boolean;
  regionsProcessed: number;
}> {
  const enabled = await isGlobalizationEnabled();
  if (!enabled) return { enabled: false, regionsProcessed: 0 };

  const activeRegions = await Region.find({ isActive: true });
  for (const region of activeRegions) {
    await aggregateRegionPerformance(region._id.toString());
  }

  metricsService.counter('phase24_jobs_run', 1);
  return { enabled: true, regionsProcessed: activeRegions.length };
}
