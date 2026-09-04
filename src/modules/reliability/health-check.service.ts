import mongoose from 'mongoose';
import { env } from '@/config/env.js';
import { isRedisEnabled, pingRedis } from '@/infra/redis.js';
import { getQueueStats, isQueueEnabled } from '@/infra/queue.service.js';
import { metricsService } from '@/modules/reliability/metrics.service.js';

let isReady = true;
let isShuttingDown = false;

export function markShuttingDown(): void {
  isShuttingDown = true;
  isReady = false;
}

export function markNotReady(): void {
  isReady = false;
}

export function markReady(): void {
  if (!isShuttingDown) isReady = true;
}

export async function checkLiveness() {
  return {
    status: 'alive' as const,
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  };
}

export async function checkReadiness() {
  const mongoOk =
    mongoose.connection.readyState === 1 &&
    (await mongoose.connection.db!.admin().ping().then(() => true).catch(() => false));
  const redisStatus = isRedisEnabled() ? await pingRedis() : null;
  const configOk = Boolean(env.mongodbUri && env.jwt.accessSecret);

  const ready = !isShuttingDown && isReady && mongoOk && configOk && (redisStatus === null || redisStatus === true);

  return {
    ready,
    checks: {
      process: isShuttingDown ? 'shutting_down' : 'up',
      mongo: mongoOk ? 'up' : 'down',
      redis: redisStatus === null ? 'disabled' : redisStatus ? 'up' : 'down',
      config: configOk ? 'valid' : 'invalid',
    },
  };
}

export async function getDetailedHealth() {
  const [readiness, queueStats] = await Promise.all([checkReadiness(), getQueueStats()]);
  const metrics = metricsService.getSnapshot();

  const httpLatency = metrics.histograms.find((h) => h.name === 'http_request_duration_ms');
  const httpErrors = metrics.counters
    .filter((c) => c.name === 'http_errors_total')
    .reduce((sum, c) => sum + c.value, 0);
  const httpTotal = metrics.counters
    .filter((c) => c.name === 'http_requests_total')
    .reduce((sum, c) => sum + c.value, 0);

  return {
    status: readiness.ready ? 'healthy' : 'degraded',
    version: env.release.version,
    commit: env.release.commit,
    buildTimestamp: env.release.buildTimestamp,
    environment: env.nodeEnv,
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    dependencies: readiness.checks,
    queues: {
      enabled: isQueueEnabled(),
      stats: queueStats,
    },
    metrics: {
      httpRequestCount: httpTotal,
      httpErrorCount: httpErrors,
      httpErrorRate: httpTotal > 0 ? httpErrors / httpTotal : 0,
      p50LatencyMs: httpLatency?.p50 ?? 0,
      p95LatencyMs: httpLatency?.p95 ?? 0,
      p99LatencyMs: httpLatency?.p99 ?? 0,
    },
  };
}
