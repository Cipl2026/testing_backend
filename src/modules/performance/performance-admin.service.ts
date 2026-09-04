import { metricsService } from '@/modules/reliability/metrics.service.js';
import { listSloStatus } from '@/modules/reliability/slo.service.js';
import { getQueueStats, isQueueEnabled } from '@/infra/queue.service.js';
import { getDlqStats } from '@/modules/reliability/dlq.service.js';
import { pingRedis, isRedisEnabled } from '@/infra/redis.js';
import { getBaselineComparison, listBaselines } from '@/modules/performance/baseline.service.js';
import { listPerformanceBudgets, evaluateBudget } from '@/modules/performance/budget.service.js';
import { listSlowQueries, aggregateSlowQueryFingerprints } from '@/modules/performance/slow-query.service.js';
import { listIndexRecommendations, auditExistingIndexes } from '@/modules/performance/index-audit.service.js';
import { cacheMetrics } from '@/modules/performance/cache-metrics.service.js';
import {
  listLoadTestScenarios,
  listLoadTestResults,
} from '@/modules/performance/load-test.service.js';
import { getCapacityPlan } from '@/modules/performance/capacity.service.js';
import { getLatestCostSnapshot, detectCostAnomalies } from '@/modules/performance/cost.service.js';
import { listPerformanceRegressions } from '@/modules/performance/regression.service.js';
import { getAdminAnalyticsSnapshot } from '@/modules/performance/analytics-read-model.service.js';
import {
  PerformanceBudgetMetric,
  PerformanceRegressionStatus,
  SloStatus,
} from '@ghaarfix/shared-types';

export async function getPerformanceOverview() {
  const [
    baseline,
    budgets,
    slo,
    regressions,
    costAnomalies,
    analyticsSnapshot,
  ] = await Promise.all([
    getBaselineComparison(),
    listPerformanceBudgets(),
    listSloStatus(),
    listPerformanceRegressions(PerformanceRegressionStatus.OPEN),
    detectCostAnomalies(),
    getAdminAnalyticsSnapshot(),
  ]);

  const cacheStats = cacheMetrics.getSnapshot();
  const totalHits = cacheStats.reduce((s, n) => s + n.hits, 0);
  const totalMisses = cacheStats.reduce((s, n) => s + n.misses, 0);
  const cacheHitRate = totalHits + totalMisses > 0 ? totalHits / (totalHits + totalMisses) : 0;

  const budgetStatus = budgets.map((b) => {
    let currentValue = 0;
    if (baseline?.current) {
      if (b.metric === PerformanceBudgetMetric.API_P95_MS) currentValue = baseline.current.apiP95Ms;
      else if (b.metric === PerformanceBudgetMetric.ERROR_RATE) currentValue = baseline.current.errorRate;
      else if (b.metric === PerformanceBudgetMetric.CACHE_HIT_RATE) currentValue = cacheHitRate;
      else if (b.metric === PerformanceBudgetMetric.QUEUE_LAG_MS) currentValue = baseline.current.queueLagMs;
    }
    return {
      resource: b.resource,
      metric: b.metric,
      target: b.target,
      currentValue,
      status: evaluateBudget(b.metric, currentValue, b),
    };
  });

  return {
    status: regressions.some((r) => r.severity === 'CRITICAL') ? 'degraded' : 'healthy',
    baseline: baseline?.current ?? null,
    baselineDelta: baseline?.previous ?? null,
    slo: slo.filter((s) => s.status !== SloStatus.HEALTHY).slice(0, 5),
    cacheHitRate,
    queueLagMs: baseline?.current?.queueLagMs ?? 0,
    activeRegressions: regressions.length,
    budgetStatus,
    costAnomalies,
    analyticsSnapshot,
    redisEnabled: isRedisEnabled(),
  };
}

export async function getApiPerformance() {
  const snapshot = metricsService.getSnapshot();
  const baselines = await listBaselines(10);
  return {
    histograms: snapshot.histograms.filter((h) => h.name.includes('http')),
    counters: snapshot.counters.filter((c) => c.name.includes('http')),
    baselines: baselines.map((b) => ({
      release: b.release,
      apiP50Ms: b.apiP50Ms,
      apiP95Ms: b.apiP95Ms,
      apiP99Ms: b.apiP99Ms,
      errorRate: b.errorRate,
      capturedAt: b.createdAt,
      routeMetrics: b.routeMetrics,
    })),
  };
}

export async function getDatabasePerformance() {
  const snapshot = metricsService.getSnapshot();
  const slowFingerprints = await aggregateSlowQueryFingerprints(15);
  return {
    dbHistograms: snapshot.histograms.filter((h) => h.name.includes('db')),
    slowFingerprints: slowFingerprints.map((f) => ({
      collection: f._id.collection,
      fingerprint: f._id.fingerprint,
      count: f.count,
      avgDurationMs: Math.round(f.avgDurationMs),
      maxDurationMs: f.maxDurationMs,
    })),
  };
}

export async function getSlowQueries(limit = 50, collection?: string) {
  return listSlowQueries(limit, collection);
}

export async function getIndexAudit() {
  const [recommendations, existing] = await Promise.all([
    listIndexRecommendations(),
    auditExistingIndexes(),
  ]);
  return { recommendations, existingIndexes: existing };
}

export async function getCachePerformance() {
  const stats = cacheMetrics.getSnapshot();
  const redisUp = isRedisEnabled() ? await pingRedis() : false;
  return {
    namespaces: stats,
    redisEnabled: isRedisEnabled(),
    redisUp,
  };
}

export async function getQueuePerformance() {
  if (!isQueueEnabled()) {
    return { enabled: false, queues: [], dlq: await getDlqStats() };
  }
  const [queues, dlq] = await Promise.all([getQueueStats(), getDlqStats()]);
  return { enabled: true, queues, dlq };
}

export async function getRealtimePerformance() {
  const snapshot = metricsService.getSnapshot();
  return {
    socketMetrics: snapshot.counters.filter((c) => c.name.includes('socket')),
    redisAdapter: isRedisEnabled(),
    note: 'Socket connections tracked via Redis adapter when enabled',
  };
}

export async function getMobilePerformance() {
  return {
    targets: {
      coldStartMs: 3000,
      screenTransitionMs: 300,
      bundleSizeKb: 5000,
    },
    note: 'Mobile metrics reported via client telemetry in future phase',
  };
}

export async function getLoadTests() {
  const [scenarios, results] = await Promise.all([
    listLoadTestScenarios(),
    listLoadTestResults(undefined, 20),
  ]);
  return { scenarios, results };
}

export async function getCapacityPlanning() {
  return getCapacityPlan();
}

export async function getCostEfficiency() {
  const [snapshot, anomalies] = await Promise.all([
    getLatestCostSnapshot(),
    detectCostAnomalies(),
  ]);
  return { snapshot, anomalies };
}

export async function getRegressions() {
  return listPerformanceRegressions();
}
