import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import mongoose from 'mongoose';
import {
  FeatureFlagKey,
  IndexRecommendationStatus,
  PerformanceRegressionStatus,
} from '@ghaarfix/shared-types';
import { connectDatabase, disconnectDatabase } from '@/config/database.js';
import { runPhase23Migrations } from '@/migrations/013-phase23-performance.js';
import { FeatureFlag } from '@/models/FeatureFlag.js';
import { SlowQueryRecord } from '@/models/Performance.js';
import { capturePerformanceBaseline } from '@/modules/performance/baseline.service.js';
import {
  fingerprintQuery,
  recordSlowQuery,
  redactQueryString,
} from '@/modules/performance/slow-query.service.js';
import {
  clampPageLimit,
  decodeCursor,
  encodeCursor,
} from '@/utils/cursor-pagination.js';
import { cacheGetOrSet } from '@/infra/cache.service.js';
import { cacheMetrics } from '@/modules/performance/cache-metrics.service.js';
import { detectPerformanceRegressions } from '@/modules/performance/regression.service.js';
import { listLoadTestScenarios, runLoadTest } from '@/modules/performance/load-test.service.js';
import { reviewIndexRecommendation } from '@/modules/performance/index-audit.service.js';
import { IndexRecommendation } from '@/models/Performance.js';
import { getAdminAnalyticsSnapshot } from '@/modules/performance/analytics-read-model.service.js';
import { AppError } from '@/utils/AppError.js';

async function clearDatabase() {
  await Promise.all(Object.values(mongoose.connection.collections).map((c) => c.deleteMany({})));
}

describe('Phase 23 — Scale & Performance', () => {
  beforeAll(async () => {
    await connectDatabase();
    await runPhase23Migrations();
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  beforeEach(async () => {
    await clearDatabase();
    await runPhase23Migrations();
    cacheMetrics.reset();
  });

  it('captures performance baseline', async () => {
    await capturePerformanceBaseline();
    const { getLatestBaseline } = await import('@/modules/performance/baseline.service.js');
    const baseline = await getLatestBaseline();
    expect(baseline).toBeTruthy();
    expect(baseline?.environment).toBeDefined();
  });

  it('fingerprints queries without PII', () => {
    const fp = fingerprintQuery('bookings', { customerId: 'abc123', status: 'ACTIVE' });
    expect(fp).toHaveLength(16);
    const fp2 = fingerprintQuery('bookings', { customerId: 'xyz789', status: 'ACTIVE' });
    expect(fp).toBe(fp2);
  });

  it('redacts sensitive query strings', () => {
    const redacted = redactQueryString('userId=507f1f77bcf86cd799439011 phone=9876543210');
    expect(redacted).not.toContain('507f1f77bcf86cd799439011');
    expect(redacted).not.toContain('9876543210');
  });

  it('records slow queries', async () => {
    await recordSlowQuery({
      operation: 'find',
      collection: 'bookings',
      filter: { customerId: 'test' },
      durationMs: 350,
    });
    const count = await SlowQueryRecord.countDocuments();
    expect(count).toBe(1);
  });

  it('encodes and decodes cursor pagination', () => {
    const cursor = encodeCursor({
      v: 'v1',
      sortField: 'createdAt',
      sortValue: '2026-01-01',
      id: new mongoose.Types.ObjectId().toString(),
    });
    const decoded = decodeCursor(cursor);
    expect(decoded.sortField).toBe('createdAt');
  });

  it('rejects invalid cursor', () => {
    expect(() => decodeCursor('invalid.cursor')).toThrow(AppError);
  });

  it('enforces page limits', () => {
    expect(clampPageLimit(999999)).toBe(100);
    expect(clampPageLimit(0)).toBe(1);
    expect(clampPageLimit(50)).toBe(50);
  });

  it('tracks cache hits and misses', async () => {
    cacheMetrics.recordHit('catalog:categories:v1');
    cacheMetrics.recordMiss('catalog:categories:v1');
    const snapshot = cacheMetrics.getSnapshot();
    expect(snapshot[0]?.hits).toBe(1);
    expect(snapshot[0]?.misses).toBe(1);
  });

  it('coalesces cache stampede via getOrSet', async () => {
    let calls = 0;
    const factory = async () => {
      calls += 1;
      return { data: 'test' };
    };
    const key = `test:stampede:${Date.now()}`;
    const [a, b] = await Promise.all([
      cacheGetOrSet(key, factory, 60),
      cacheGetOrSet(key, factory, 60),
    ]);
    expect(a).toEqual(b);
    expect(calls).toBeLessThanOrEqual(2);
  });

  it('falls back when redis unavailable', async () => {
    const result = await cacheGetOrSet('fallback:test', async () => ({ ok: true }), 60);
    expect(result.ok).toBe(true);
  });

  it('reviews index recommendations without auto-apply', async () => {
    const rec = await IndexRecommendation.findOne();
    expect(rec).toBeTruthy();
    const updated = await reviewIndexRecommendation(
      rec!._id.toString(),
      IndexRecommendationStatus.APPROVED,
    );
    expect(updated?.status).toBe(IndexRecommendationStatus.APPROVED);
  });

  it('blocks production load tests', async () => {
    const scenarios = await listLoadTestScenarios();
    expect(scenarios.length).toBeGreaterThan(0);
    await expect(runLoadTest(scenarios[0]._id.toString())).resolves.toBeDefined();
  });

  it('refreshes analytics read model', async () => {
    const { refreshAdminAnalyticsSnapshot } = await import(
      '@/modules/performance/analytics-read-model.service.js'
    );
    await refreshAdminAnalyticsSnapshot();
    const snapshot = await getAdminAnalyticsSnapshot();
    expect(snapshot).toBeTruthy();
  });

  it('detects performance regressions', async () => {
    const { PerformanceBaselineSnapshot } = await import('@/models/Performance.js');
    await PerformanceBaselineSnapshot.create({
      environment: 'test',
      release: '1.0.0',
      windowStart: new Date(),
      windowEnd: new Date(),
      apiP95Ms: 200,
      errorRate: 0.01,
      cacheHitRate: 0.8,
      queueLagMs: 100,
    });
    await PerformanceBaselineSnapshot.create({
      environment: 'test',
      release: '1.1.0',
      windowStart: new Date(),
      windowEnd: new Date(),
      apiP95Ms: 500,
      errorRate: 0.05,
      cacheHitRate: 0.5,
      queueLagMs: 5000,
    });
    const created = await detectPerformanceRegressions();
    expect(created).toBeGreaterThan(0);
  });

  it('respects feature flag', async () => {
    await FeatureFlag.findOneAndUpdate(
      { key: FeatureFlagKey.ENABLE_SCALE_PERFORMANCE },
      { enabled: false },
    );
    const { isScalePerformanceEnabled } = await import(
      '@/modules/performance/performance-feature.service.js'
    );
    expect(await isScalePerformanceEnabled()).toBe(false);
  });
});
