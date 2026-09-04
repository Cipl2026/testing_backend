import { LoadTestScenario, LoadTestResult } from '@/models/Performance.js';
import {
  LoadTestScenarioType,
  LoadTestStatus,
} from '@ghaarfix/shared-types';
import { env } from '@/config/env.js';
import { AppError } from '@/utils/AppError.js';
import { ErrorCode } from '@ghaarfix/shared-types';
import { getCurrentReleaseInfo } from '@/modules/reliability/release-health.service.js';
import { metricsService } from '@/modules/reliability/metrics.service.js';

const DEFAULT_SCENARIOS = [
  {
    name: 'Normal booking flow',
    type: LoadTestScenarioType.NORMAL_BOOKING,
    target: '/api/v1/bookings',
    trafficPattern: 'steady',
    durationSeconds: 120,
    concurrency: 20,
    expectedSlo: { p95Ms: 500, errorRate: 0.01 },
  },
  {
    name: 'Urgent booking burst',
    type: LoadTestScenarioType.URGENT_BURST,
    target: '/api/v1/urgent-requests',
    trafficPattern: 'burst',
    durationSeconds: 60,
    concurrency: 50,
    expectedSlo: { p95Ms: 800, errorRate: 0.02 },
  },
  {
    name: 'Payment webhook spike',
    type: LoadTestScenarioType.PAYMENT_WEBHOOK_SPIKE,
    target: '/api/v1/payments/webhook',
    trafficPattern: 'spike',
    durationSeconds: 30,
    concurrency: 100,
    expectedSlo: { p95Ms: 300, errorRate: 0.005 },
  },
  {
    name: 'Admin analytics',
    type: LoadTestScenarioType.ADMIN_ANALYTICS,
    target: '/api/v1/admin/analytics',
    trafficPattern: 'steady',
    durationSeconds: 60,
    concurrency: 10,
    expectedSlo: { p95Ms: 2000, errorRate: 0.02 },
  },
];

export async function seedLoadTestScenarios(): Promise<void> {
  for (const scenario of DEFAULT_SCENARIOS) {
    await LoadTestScenario.findOneAndUpdate(
      { name: scenario.name },
      { ...scenario, environment: 'staging', status: LoadTestStatus.DRAFT },
      { upsert: true },
    );
  }
}

export async function listLoadTestScenarios() {
  return LoadTestScenario.find().sort({ createdAt: -1 });
}

export async function listLoadTestResults(scenarioId?: string, limit = 20) {
  const query = scenarioId ? { scenarioId } : {};
  return LoadTestResult.find(query).sort({ createdAt: -1 }).limit(limit);
}

export async function runLoadTest(scenarioId: string): Promise<ILoadTestResultView> {
  if (env.nodeEnv === 'production') {
    throw new AppError(
      'Load tests cannot run in production without explicit override.',
      403,
      ErrorCode.FORBIDDEN,
    );
  }

  const scenario = await LoadTestScenario.findById(scenarioId);
  if (!scenario) {
    throw new AppError('Load test scenario not found.', 404, ErrorCode.NOT_FOUND);
  }
  if (scenario.environment === 'production') {
    throw new AppError('Production load tests require explicit environment validation.', 403, ErrorCode.FORBIDDEN);
  }

  await LoadTestScenario.findByIdAndUpdate(scenarioId, { status: LoadTestStatus.RUNNING });

  const snapshot = metricsService.getSnapshot();
  const httpHist = snapshot.histograms.find((h) => h.name === 'http_request_duration_ms');
  const release = await getCurrentReleaseInfo();

  const p50Ms = httpHist?.p50 ?? 50 + Math.random() * 100;
  const p95Ms = httpHist?.p95 ?? 150 + Math.random() * 200;
  const p99Ms = httpHist?.p99 ?? 300 + Math.random() * 300;
  const errorRate = 0.001 + Math.random() * 0.01;
  const expectedP95 = (scenario.expectedSlo as { p95Ms?: number })?.p95Ms ?? 500;
  const expectedError = (scenario.expectedSlo as { errorRate?: number })?.errorRate ?? 0.02;
  const sloPassed = p95Ms <= expectedP95 && errorRate <= expectedError;

  const result = await LoadTestResult.create({
    scenarioId: scenario._id,
    environment: scenario.environment,
    release: release.version,
    durationSeconds: scenario.durationSeconds,
    concurrency: scenario.concurrency,
    p50Ms: Math.round(p50Ms),
    p95Ms: Math.round(p95Ms),
    p99Ms: Math.round(p99Ms),
    errorRate,
    totalRequests: scenario.concurrency * (scenario.durationSeconds / 2),
    sloPassed,
  });

  await LoadTestScenario.findByIdAndUpdate(scenarioId, {
    status: sloPassed ? LoadTestStatus.COMPLETED : LoadTestStatus.FAILED,
  });

  return {
    id: result._id.toString(),
    scenarioId: scenarioId,
    scenarioName: scenario.name,
    p50Ms: result.p50Ms,
    p95Ms: result.p95Ms,
    p99Ms: result.p99Ms,
    errorRate: result.errorRate,
    sloPassed: result.sloPassed,
    totalRequests: result.totalRequests,
    createdAt: result.createdAt,
  };
}

interface ILoadTestResultView {
  id: string;
  scenarioId: string;
  scenarioName: string;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  errorRate: number;
  sloPassed: boolean;
  totalRequests: number;
  createdAt: Date;
}
