import {
  PerformanceBaselineSnapshot,
  PerformanceBudget,
  SlowQueryRecord,
  IndexRecommendation,
  LoadTestScenario,
  LoadTestResult,
  CapacityPlan,
  CostUsageSnapshot,
  PerformanceRegression,
  AnalyticsReadModelSnapshot,
} from '@/models/Performance.js';
import { FeatureFlag } from '@/models/FeatureFlag.js';
import { FeatureFlagKey } from '@ghaarfix/shared-types';
import { seedPerformanceBudgets } from '@/modules/performance/budget.service.js';
import { seedLoadTestScenarios } from '@/modules/performance/load-test.service.js';
import { seedIndexRecommendations } from '@/modules/performance/index-audit.service.js';
import { seedCapacityPlan } from '@/modules/performance/capacity.service.js';
import { logger } from '@/utils/logger.js';

export async function runPhase23Migrations() {
  await Promise.all([
    PerformanceBaselineSnapshot.syncIndexes(),
    PerformanceBudget.syncIndexes(),
    SlowQueryRecord.syncIndexes(),
    IndexRecommendation.syncIndexes(),
    LoadTestScenario.syncIndexes(),
    LoadTestResult.syncIndexes(),
    CapacityPlan.syncIndexes(),
    CostUsageSnapshot.syncIndexes(),
    PerformanceRegression.syncIndexes(),
    AnalyticsReadModelSnapshot.syncIndexes(),
  ]);

  await FeatureFlag.findOneAndUpdate(
    { key: FeatureFlagKey.ENABLE_SCALE_PERFORMANCE },
    {
      key: FeatureFlagKey.ENABLE_SCALE_PERFORMANCE,
      enabled: true,
      rules: [{ type: 'global' }],
    },
    { upsert: true },
  );

  await seedPerformanceBudgets();
  await seedLoadTestScenarios();
  await seedIndexRecommendations();
  await seedCapacityPlan();

  logger.info('Phase 23 scale performance indexes ensured');
}
