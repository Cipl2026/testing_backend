import os from 'node:os';
import { PerformanceBaselineSnapshot } from '@/models/Performance.js';
import { metricsService } from '@/modules/reliability/metrics.service.js';
import { getQueueStats, isQueueEnabled } from '@/infra/queue.service.js';
import { getCurrentReleaseInfo } from '@/modules/reliability/release-health.service.js';
import { cacheMetrics } from '@/modules/performance/cache-metrics.service.js';
import { env } from '@/config/env.js';

function percentile(values: number[], p: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)] ?? 0;
}

export async function capturePerformanceBaseline(): Promise<void> {
  const snapshot = metricsService.getSnapshot();
  const httpDurations = snapshot.histograms
    .filter((h) => h.name === 'http_request_duration_ms')
    .flatMap((h) => Array(h.count).fill(h.p95));
  const dbDurations = snapshot.histograms
    .filter((h) => h.name === 'db_operation_duration_ms')
    .flatMap((h) => Array(h.count).fill(h.p95));

  const httpErrors = snapshot.counters
    .filter((c) => c.name === 'http_errors_total')
    .reduce((sum, c) => sum + c.value, 0);
  const httpTotal = snapshot.counters
    .filter((c) => c.name === 'http_requests_total')
    .reduce((sum, c) => sum + c.value, 0);

  const cacheStats = cacheMetrics.getSnapshot();
  const totalHits = cacheStats.reduce((s, n) => s + n.hits, 0);
  const totalMisses = cacheStats.reduce((s, n) => s + n.misses, 0);
  const cacheTotal = totalHits + totalMisses;

  let queueLagMs = 0;
  let queueThroughput = 0;
  if (isQueueEnabled()) {
    const stats = await getQueueStats();
    const waiting = stats.reduce((s, q) => s + q.waiting, 0);
    const active = stats.reduce((s, q) => s + q.active, 0);
    queueLagMs = waiting * 100;
    queueThroughput = active;
  }

  const release = await getCurrentReleaseInfo();
  const routeMetrics = snapshot.histograms
    .filter((h) => h.name === 'http_request_duration_ms')
    .map((h) => ({
      route: h.labels.route ?? 'unknown',
      p95Ms: h.p95,
      count: h.count,
    }))
    .slice(0, 50);

  const now = new Date();
  await PerformanceBaselineSnapshot.create({
    environment: env.nodeEnv,
    release: release.version,
    windowStart: new Date(now.getTime() - 5 * 60 * 1000),
    windowEnd: now,
    apiP50Ms: percentile(httpDurations, 50),
    apiP95Ms: percentile(httpDurations, 95),
    apiP99Ms: percentile(httpDurations, 99),
    errorRate: httpTotal > 0 ? httpErrors / httpTotal : 0,
    dbQueryP50Ms: percentile(dbDurations, 50),
    dbQueryP95Ms: percentile(dbDurations, 95),
    cacheHitRate: cacheTotal > 0 ? totalHits / cacheTotal : 0,
    queueLagMs,
    queueThroughput,
    socketConnections: 0,
    memoryMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    cpuPercent: Math.round(os.loadavg()[0] * 10),
    routeMetrics,
  });
}

export async function getLatestBaseline() {
  return PerformanceBaselineSnapshot.findOne().sort({ createdAt: -1 });
}

export async function listBaselines(limit = 20) {
  return PerformanceBaselineSnapshot.find().sort({ createdAt: -1 }).limit(limit);
}

export async function getBaselineComparison() {
  const baselines = await PerformanceBaselineSnapshot.find().sort({ createdAt: -1 }).limit(2);
  const current = baselines[0];
  const previous = baselines[1];
  if (!current) return null;
  return {
    current: {
      apiP95Ms: current.apiP95Ms,
      errorRate: current.errorRate,
      cacheHitRate: current.cacheHitRate,
      queueLagMs: current.queueLagMs,
      release: current.release,
      capturedAt: current.createdAt,
    },
    previous: previous
      ? {
          apiP95Ms: previous.apiP95Ms,
          errorRate: previous.errorRate,
          cacheHitRate: previous.cacheHitRate,
          queueLagMs: previous.queueLagMs,
          release: previous.release,
          capturedAt: previous.createdAt,
        }
      : null,
  };
}
