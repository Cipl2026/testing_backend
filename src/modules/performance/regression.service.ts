import { PerformanceRegression } from '@/models/Performance.js';
import {
  PerformanceRegressionSeverity,
  PerformanceRegressionStatus,
} from '@ghaarfix/shared-types';
import { getBaselineComparison } from '@/modules/performance/baseline.service.js';
import { getCurrentReleaseInfo } from '@/modules/reliability/release-health.service.js';

const REGRESSION_THRESHOLD_PERCENT = 20;

export async function detectPerformanceRegressions(): Promise<number> {
  const comparison = await getBaselineComparison();
  if (!comparison?.previous) return 0;

  const release = await getCurrentReleaseInfo();
  let created = 0;

  const checks: Array<{
    metric: string;
    resource: string;
    previous: number;
    current: number;
    higherIsBetter?: boolean;
  }> = [
    {
      metric: 'api_p95_ms',
      resource: 'api',
      previous: comparison.previous.apiP95Ms,
      current: comparison.current.apiP95Ms,
    },
    {
      metric: 'error_rate',
      resource: 'api',
      previous: comparison.previous.errorRate,
      current: comparison.current.errorRate,
    },
    {
      metric: 'cache_hit_rate',
      resource: 'cache',
      previous: comparison.previous.cacheHitRate,
      current: comparison.current.cacheHitRate,
      higherIsBetter: true,
    },
    {
      metric: 'queue_lag_ms',
      resource: 'queue',
      previous: comparison.previous.queueLagMs,
      current: comparison.current.queueLagMs,
    },
  ];

  for (const check of checks) {
    if (check.previous === 0) continue;
    const changePercent = check.higherIsBetter
      ? ((check.previous - check.current) / check.previous) * 100
      : ((check.current - check.previous) / check.previous) * 100;

    if (changePercent < REGRESSION_THRESHOLD_PERCENT) continue;

    const severity =
      changePercent >= 50
        ? PerformanceRegressionSeverity.CRITICAL
        : PerformanceRegressionSeverity.WARNING;

    const existing = await PerformanceRegression.findOne({
      release: release.version,
      metric: check.metric,
      status: PerformanceRegressionStatus.OPEN,
    });
    if (existing) continue;

    await PerformanceRegression.create({
      release: release.version,
      previousRelease: comparison.previous.release,
      metric: check.metric,
      resource: check.resource,
      previousValue: check.previous,
      currentValue: check.current,
      changePercent,
      severity,
      status: PerformanceRegressionStatus.OPEN,
    });
    created += 1;
  }

  return created;
}

export async function listPerformanceRegressions(status?: PerformanceRegressionStatus) {
  const query = status ? { status } : {};
  return PerformanceRegression.find(query).sort({ detectedAt: -1 }).limit(50);
}

export async function acknowledgeRegression(id: string) {
  return PerformanceRegression.findByIdAndUpdate(
    id,
    { status: PerformanceRegressionStatus.ACKNOWLEDGED },
    { new: true },
  );
}
