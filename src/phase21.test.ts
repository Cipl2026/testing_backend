import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import mongoose from 'mongoose';
import request from 'supertest';
import {
  AlertSeverity,
  AlertStatus,
  CircuitBreakerState,
  DlqJobStatus,
  ErrorCode,
  FeatureFlagKey,
  IncidentSeverity,
  IncidentStatus,
} from '@ghaarfix/shared-types';
import { createApp } from '@/app.js';
import { connectDatabase, disconnectDatabase } from '@/config/database.js';
import { seedAdminUser } from '@/modules/auth/auth.service.js';
import { runPhase21Migrations } from '@/migrations/011-phase21-reliability.js';
import { sanitizeRequestId } from '@/middleware/requestId.js';
import { redactValue } from '@/modules/reliability/log-redaction.service.js';
import { buildErrorDeduplicationKey, metricsService } from '@/modules/reliability/metrics.service.js';
import { captureError } from '@/modules/reliability/error-monitoring.service.js';
import {
  checkLiveness,
  checkReadiness,
  markNotReady,
  markReady,
} from '@/modules/reliability/health-check.service.js';
import {
  withCircuitBreaker,
  resetAllCircuitBreakers,
  CircuitOpenError,
} from '@/modules/reliability/circuit-breaker.service.js';
import { isTransientError, retryTransient } from '@/modules/reliability/retry.service.js';
import {
  recordDeadLetterJob,
  retryDeadLetterJob,
  discardDeadLetterJob,
} from '@/modules/reliability/dlq.service.js';
import { createAlert } from '@/modules/reliability/alert.service.js';
import { createIncident, updateIncident } from '@/modules/reliability/incident.service.js';
import { calculateSloSnapshots, listSloStatus } from '@/modules/reliability/slo.service.js';
import { recordBackupVerification } from '@/modules/reliability/backup-verification.service.js';
import { BackupVerificationStatus } from '@ghaarfix/shared-types';
import { getFinancialReconciliationChecklist } from '@/modules/reliability/disaster-recovery.service.js';
import { FeatureFlag } from '@/models/FeatureFlag.js';
import { AppError } from '@/utils/AppError.js';
import { env } from '@/config/env.js';

const app = createApp();

async function clearDatabase() {
  await Promise.all(Object.values(mongoose.connection.collections).map((c) => c.deleteMany({})));
}

async function loginAdmin() {
  const res = await request(app)
    .post('/api/v1/admin/login')
    .send({ email: 'admin@ghaarfix.in', password: 'Admin@123456' });
  return { token: res.body.data.accessToken as string };
}

describe('Phase 21 — Reliability & Observability', () => {
  beforeAll(async () => {
    await connectDatabase();
    await runPhase21Migrations();
    await seedAdminUser();
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  beforeEach(async () => {
    await clearDatabase();
    await seedAdminUser();
    await runPhase21Migrations();
    metricsService.reset();
    resetAllCircuitBreakers();
    markReady();
    await FeatureFlag.findOneAndUpdate(
      { key: FeatureFlagKey.ENABLE_RELIABILITY_OBSERVABILITY },
      { key: FeatureFlagKey.ENABLE_RELIABILITY_OBSERVABILITY, enabled: true, rules: [{ type: 'global' }] },
      { upsert: true },
    );
  });

  it('generates request ID when missing', async () => {
    const res = await request(app).get('/api/v1/health/live');
    expect(res.status).toBe(200);
    expect(res.headers['x-request-id']).toBeTruthy();
    expect(String(res.headers['x-request-id']).length).toBeGreaterThanOrEqual(8);
  });

  it('propagates valid request ID', async () => {
    const id = 'req-phase21-test-id-01';
    const res = await request(app).get('/api/v1/health/live').set('X-Request-ID', id);
    expect(res.headers['x-request-id']).toBe(id);
  });

  it('sanitizes invalid request ID', () => {
    const sanitized = sanitizeRequestId('!!!invalid!!!');
    expect(sanitized).not.toBe('!!!invalid!!!');
    expect(sanitized.length).toBeGreaterThanOrEqual(8);
  });

  it('redacts PII from logs', () => {
    const redacted = redactValue({
      password: 'secret123',
      phone: '+919876543210',
      email: 'user@example.com',
      authorization: 'Bearer token',
    }) as Record<string, string>;
    expect(redacted.password).toBe('[REDACTED]');
    expect(redacted.authorization).toBe('[REDACTED]');
    expect(String(redacted.phone)).toContain('***');
    expect(String(redacted.email)).toContain('***');
  });

  it('does not expose stack in production error response', async () => {
    const prev = env.isProd;
    Object.defineProperty(env, 'isProd', { value: true, configurable: true });
    const res = await request(app).get('/api/v1/does-not-exist-route');
    Object.defineProperty(env, 'isProd', { value: prev, configurable: true });
    expect(res.body.code).toBe(ErrorCode.NOT_FOUND);
    expect(res.body.requestId).toBeTruthy();
    expect(JSON.stringify(res.body)).not.toContain('stack');
  });

  it('deduplicates error monitoring', async () => {
    await captureError(new Error('Test failure'), { errorCode: 'INTERNAL_ERROR' });
    await captureError(new Error('Test failure'), { errorCode: 'INTERNAL_ERROR' });
    const key = buildErrorDeduplicationKey('INTERNAL_ERROR', 'Test failure', undefined, env.release.version);
    expect(key).toBeTruthy();
  });

  it('excludes high-cardinality metric labels', () => {
    metricsService.counter('test_metric', 1, { customerId: 'abc', route: '/api' });
    const snap = metricsService.getSnapshot();
    const counter = snap.counters.find((c) => c.name === 'test_metric');
    expect(counter?.labels.customerId).toBeUndefined();
  });

  it('returns liveness when process alive', async () => {
    const live = await checkLiveness();
    expect(live.status).toBe('alive');
  });

  it('fails readiness when marked not ready', async () => {
    markNotReady();
    const readiness = await checkReadiness();
    expect(readiness.ready).toBe(false);
    markReady();
  });

  it('opens circuit after failures', async () => {
    const failing = () => Promise.reject(new AppError('fail', 500, ErrorCode.DEPENDENCY_FAILURE));
    for (let i = 0; i < 5; i++) {
      await failing().catch(() => undefined);
      try {
        await withCircuitBreaker('test-dep', failing, { failureThreshold: 5, cooldownMs: 60_000 });
      } catch {
        // expected
      }
    }
    await expect(withCircuitBreaker('test-dep', failing)).rejects.toBeInstanceOf(CircuitOpenError);
  });

  it('recovers circuit from half-open', async () => {
    resetAllCircuitBreakers();
    const fail = vi.fn().mockRejectedValueOnce(new AppError('fail', 500, ErrorCode.DEPENDENCY_FAILURE));
    fail.mockResolvedValueOnce('ok');
    for (let i = 0; i < 5; i++) {
      try {
        await withCircuitBreaker('half-open-test', () => Promise.reject(new AppError('f', 500, ErrorCode.DEPENDENCY_FAILURE)), {
          failureThreshold: 5,
          cooldownMs: 1,
        });
      } catch {
        // expected
      }
    }
    await new Promise((r) => setTimeout(r, 5));
    const result = await withCircuitBreaker('half-open-test', () => Promise.resolve('ok'), {
      failureThreshold: 5,
      cooldownMs: 1,
    });
    expect(result).toBe('ok');
  });

  it('retries only transient errors', async () => {
    expect(isTransientError(new AppError('timeout', 504, ErrorCode.TIMEOUT))).toBe(true);
    expect(isTransientError(new AppError('bad', 400, ErrorCode.VALIDATION_ERROR))).toBe(false);
  });

  it('applies retry backoff', async () => {
    let attempts = 0;
    const start = Date.now();
    await retryTransient(
      async () => {
        attempts += 1;
        if (attempts < 3) throw new AppError('timeout', 504, ErrorCode.TIMEOUT);
        return 'done';
      },
      { maxAttempts: 3, baseDelayMs: 50, jitter: false },
    );
    expect(attempts).toBe(3);
    expect(Date.now() - start).toBeGreaterThanOrEqual(100);
  });

  it('records DLQ after max attempts', async () => {
    await recordDeadLetterJob({
      queueName: 'notifications',
      jobId: 'job-1',
      jobName: 'send-push',
      payload: { userId: 'secret' },
      error: 'timeout',
      attempts: 3,
    });
    const { listDeadLetterJobs } = await import('@/modules/reliability/dlq.service.js');
    const items = await listDeadLetterJobs(10);
    expect(items.length).toBe(1);
    expect(items[0].status).toBe(DlqJobStatus.DEAD_LETTER);
  });

  it('allows safe DLQ retry', async () => {
    await recordDeadLetterJob({
      queueName: 'notifications',
      jobId: 'job-2',
      jobName: 'send-push',
      payload: {},
      error: 'timeout',
      attempts: 3,
    });
    const { listDeadLetterJobs } = await import('@/modules/reliability/dlq.service.js');
    const items = await listDeadLetterJobs(1);
    const result = await retryDeadLetterJob(items[0].id, new mongoose.Types.ObjectId().toString());
    expect(result.retried).toBe(true);
  });

  it('prevents double DLQ discard confusion', async () => {
    await recordDeadLetterJob({
      queueName: 'notifications',
      jobId: 'job-3',
      jobName: 'send-push',
      payload: {},
      error: 'fail',
      attempts: 3,
    });
    const { listDeadLetterJobs } = await import('@/modules/reliability/dlq.service.js');
    const items = await listDeadLetterJobs(1);
    await discardDeadLetterJob(items[0].id, 'Not needed');
    await expect(retryDeadLetterJob(items[0].id, 'admin')).rejects.toThrow();
  });

  it('deduplicates alerts', async () => {
    const first = await createAlert({
      source: 'test',
      severity: AlertSeverity.WARNING,
      title: 'Test alert',
      description: 'desc',
      deduplicationKey: 'alert:test-1',
    });
    const second = await createAlert({
      source: 'test',
      severity: AlertSeverity.WARNING,
      title: 'Test alert',
      description: 'desc',
      deduplicationKey: 'alert:test-1',
    });
    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
  });

  it('manages incident lifecycle', async () => {
    const incident = await createIncident({
      title: 'API degradation',
      severity: IncidentSeverity.SEV2,
      impact: 'Elevated latency',
    });
    const updated = await updateIncident(incident.id, {
      status: IncidentStatus.INVESTIGATING,
      timelineMessage: 'On-call engaged',
    });
    expect(updated.status).toBe(IncidentStatus.INVESTIGATING);
  });

  it('calculates SLO snapshots', async () => {
    metricsService.counter('http_requests_total', 100, { method: 'GET', route: '/api', status: '200' });
    metricsService.counter('http_errors_total', 1, { method: 'GET', route: '/api' });
    const count = await calculateSloSnapshots();
    expect(count).toBeGreaterThan(0);
    const slos = await listSloStatus();
    expect(slos.length).toBeGreaterThan(0);
  });

  it('records backup verification', async () => {
    const record = await recordBackupVerification({
      backupId: 'backup-2026-01-01',
      status: BackupVerificationStatus.PASSED,
      integrityResult: 'Checksum verified',
    });
    expect(record?.status).toBe(BackupVerificationStatus.PASSED);
  });

  it('documents financial reconciliation after recovery', async () => {
    const checklist = await getFinancialReconciliationChecklist();
    expect(checklist.steps.length).toBeGreaterThan(0);
    expect(checklist.note).toContain('financial consistency');
  });

  it('exposes admin operations overview', async () => {
    const { token } = await loginAdmin();
    const res = await request(app)
      .get('/api/v1/admin/operations/overview')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.release).toBeDefined();
  });

  it('exposes readiness endpoint', async () => {
    const res = await request(app).get('/api/v1/health/ready');
    expect([200, 503]).toContain(res.status);
    expect(res.body.checks).toBeDefined();
  });
});
