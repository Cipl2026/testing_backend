import { logger } from '@/utils/logger.js';
import { isReliabilityObservabilityEnabled } from '@/modules/reliability/reliability-feature.service.js';
import { calculateSloSnapshots } from '@/modules/reliability/slo.service.js';
import { evaluateAlerts } from '@/modules/reliability/alert.service.js';
import { captureReleaseHealthSnapshot } from '@/modules/reliability/release-health.service.js';
import { runBackupVerificationCheck } from '@/modules/reliability/backup-verification.service.js';
import { getDlqStats } from '@/modules/reliability/dlq.service.js';
import { checkReadiness } from '@/modules/reliability/health-check.service.js';
import { countActiveIncidents } from '@/modules/reliability/incident.service.js';
import { metricsService } from '@/modules/reliability/metrics.service.js';
import { createAlert } from '@/modules/reliability/alert.service.js';
import { AlertSeverity } from '@ghaarfix/shared-types';

export async function runPhase21Jobs() {
  if (!(await isReliabilityObservabilityEnabled())) {
    return { enabled: false };
  }

  const results = await Promise.allSettled([
    calculateSloSnapshots(),
    evaluateAlerts(),
    captureReleaseHealthSnapshot(),
    runBackupVerificationCheck(),
    monitorQueueLag(),
    monitorDependencyHealth(),
    monitorSecurityAnomalies(),
  ]);

  const summary = {
    enabled: true,
    sloSnapshots: results[0].status === 'fulfilled' ? results[0].value : 0,
    alertsEvaluated: results[1].status === 'fulfilled' ? results[1].value : 0,
    releaseHealth: results[2].status === 'fulfilled' ? 1 : 0,
    backupPending: results[3].status === 'fulfilled' ? results[3].value : 0,
    queueLag: results[4].status === 'fulfilled' ? results[4].value : 0,
    dependencyHealth: results[5].status === 'fulfilled' ? results[5].value : 0,
    securityAnomalies: results[6].status === 'fulfilled' ? results[6].value : 0,
  };

  if (Object.values(summary).some((v) => typeof v === 'number' && v > 0)) {
    logger.info('Ran Phase 21 reliability jobs', summary);
  }

  return summary;
}

async function monitorQueueLag(): Promise<number> {
  const stats = await getDlqStats();
  if (stats.deadLetter > 10) {
    await createAlert({
      source: 'queue',
      severity: AlertSeverity.WARNING,
      title: 'Elevated dead-letter queue depth',
      description: `${stats.deadLetter} jobs in dead-letter state`,
      metric: 'dlq_depth',
      threshold: 10,
      currentValue: stats.deadLetter,
      deduplicationKey: 'alert:dlq_depth_elevated',
    });
  }
  return stats.deadLetter;
}

async function monitorDependencyHealth(): Promise<number> {
  const readiness = await checkReadiness();
  if (!readiness.ready) {
    await createAlert({
      source: 'health',
      severity: AlertSeverity.CRITICAL,
      title: 'Instance not ready',
      description: `Readiness check failed: ${JSON.stringify(readiness.checks)}`,
      deduplicationKey: 'alert:readiness_failed',
    });
    return 1;
  }
  return 0;
}

async function monitorSecurityAnomalies(): Promise<number> {
  const authFailures = metricsService
    .getSnapshot()
    .counters.filter((c) => c.name === 'business_auth_failure')
    .reduce((s, c) => s + c.value, 0);

  if (authFailures > 50) {
    await createAlert({
      source: 'security',
      severity: AlertSeverity.WARNING,
      title: 'Auth failure spike detected',
      description: `${authFailures} authentication failures recorded`,
      metric: 'auth_failures',
      threshold: 50,
      currentValue: authFailures,
      deduplicationKey: 'alert:auth_failure_spike',
    });
    return 1;
  }

  const incidents = await countActiveIncidents();
  return incidents;
}
