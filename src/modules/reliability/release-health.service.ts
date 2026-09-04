import { env } from '@/config/env.js';
import { ReleaseHealthSnapshot } from '@/models/Reliability.js';
import { countActiveIncidents } from '@/modules/reliability/incident.service.js';
import { listAlerts } from '@/modules/reliability/alert.service.js';
import { metricsService } from '@/modules/reliability/metrics.service.js';
import { getQueueStats } from '@/infra/queue.service.js';
import { AlertStatus } from '@ghaarfix/shared-types';

export async function captureReleaseHealthSnapshot(): Promise<void> {
  const metrics = metricsService.getSnapshot();
  const httpTotal = metrics.counters
    .filter((c) => c.name === 'http_requests_total')
    .reduce((s, c) => s + c.value, 0);
  const httpErrors = metrics.counters
    .filter((c) => c.name === 'http_errors_total')
    .reduce((s, c) => s + c.value, 0);
  const latency = metrics.histograms.find((h) => h.name === 'http_request_duration_ms');
  const queueStats = await getQueueStats();
  const queueDepth = queueStats.reduce((s, q) => s + q.waiting + q.active, 0);
  const [activeIncidents, alerts] = await Promise.all([
    countActiveIncidents(),
    listAlerts(AlertStatus.OPEN, 100),
  ]);

  await ReleaseHealthSnapshot.create({
    releaseVersion: env.release.version,
    gitCommit: env.release.commit,
    environment: env.nodeEnv,
    errorRate: httpTotal > 0 ? httpErrors / httpTotal : 0,
    p95LatencyMs: latency?.p95 ?? 0,
    queueDepth,
    activeIncidents,
    openAlerts: alerts.length,
  });
}

export async function listReleaseHealth(limit = 20) {
  const rows = await ReleaseHealthSnapshot.find().sort({ createdAt: -1 }).limit(limit);
  return rows.map((r) => ({
    id: r._id.toString(),
    releaseVersion: r.releaseVersion,
    gitCommit: r.gitCommit,
    environment: r.environment,
    errorRate: r.errorRate,
    p95LatencyMs: r.p95LatencyMs,
    queueDepth: r.queueDepth,
    activeIncidents: r.activeIncidents,
    openAlerts: r.openAlerts,
    createdAt: r.createdAt,
  }));
}

export function getCurrentReleaseInfo() {
  return {
    version: env.release.version,
    commit: env.release.commit,
    buildTimestamp: env.release.buildTimestamp,
    environment: env.nodeEnv,
  };
}
