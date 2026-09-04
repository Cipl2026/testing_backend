import { capturePerformanceBaseline } from '@/modules/performance/baseline.service.js';
import { aggregateSlowQueryFingerprints } from '@/modules/performance/slow-query.service.js';
import { seedIndexRecommendations } from '@/modules/performance/index-audit.service.js';
import { captureCostSnapshot } from '@/modules/performance/cost.service.js';
import { forecastCapacity } from '@/modules/performance/capacity.service.js';
import { detectPerformanceRegressions } from '@/modules/performance/regression.service.js';
import { refreshAdminAnalyticsSnapshot } from '@/modules/performance/analytics-read-model.service.js';
import { isScalePerformanceEnabled } from '@/modules/performance/performance-feature.service.js';
import { metricsService } from '@/modules/reliability/metrics.service.js';

export async function runPhase23Jobs(): Promise<{
  enabled: boolean;
  baseline: number;
  regressions: number;
  analytics: number;
}> {
  const enabled = await isScalePerformanceEnabled();
  if (!enabled) return { enabled: false, baseline: 0, regressions: 0, analytics: 0 };

  await capturePerformanceBaseline();
  const regressions = await detectPerformanceRegressions();
  await refreshAdminAnalyticsSnapshot();
  await aggregateSlowQueryFingerprints(20);
  await seedIndexRecommendations();
  await captureCostSnapshot();
  await forecastCapacity();

  metricsService.counter('phase23_jobs_run', 1);

  return { enabled: true, baseline: 1, regressions, analytics: 1 };
}
