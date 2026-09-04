import { AlertStatus } from '@ghaarfix/shared-types';
import { getDetailedHealth, checkReadiness } from '@/modules/reliability/health-check.service.js';
import { listMonitoredErrors } from '@/modules/reliability/error-monitoring.service.js';
import { getQueueStats, isQueueEnabled } from '@/infra/queue.service.js';
import { getDlqStats, listDeadLetterJobs } from '@/modules/reliability/dlq.service.js';
import { listSloStatus } from '@/modules/reliability/slo.service.js';
import { listAlerts } from '@/modules/reliability/alert.service.js';
import { listIncidents, countActiveIncidents } from '@/modules/reliability/incident.service.js';
import { listBackupVerifications } from '@/modules/reliability/backup-verification.service.js';
import { listReleaseHealth, getCurrentReleaseInfo } from '@/modules/reliability/release-health.service.js';
import { listDisasterRecoveryPlans } from '@/modules/reliability/disaster-recovery.service.js';
import { getMaintenanceMode } from '@/modules/reliability/maintenance-mode.service.js';
import { getCircuitBreakerStates } from '@/modules/reliability/circuit-breaker.service.js';
import { metricsService } from '@/modules/reliability/metrics.service.js';
import * as operationsAdminService from '@/modules/operations/operations-admin.service.js';

export async function getOperationsOverview() {
  const [
    health,
    readiness,
    dlqStats,
    slo,
    alerts,
    activeIncidents,
    maintenance,
    release,
    legacyHealth,
  ] = await Promise.all([
    getDetailedHealth(),
    checkReadiness(),
    getDlqStats(),
    listSloStatus(),
    listAlerts(AlertStatus.OPEN, 10),
    countActiveIncidents(),
    getMaintenanceMode(),
    getCurrentReleaseInfo(),
    operationsAdminService.getSystemHealth(),
  ]);

  const metrics = metricsService.getSnapshot();

  return {
    status: health.status,
    ready: readiness.ready,
    release,
    maintenance,
    dependencies: { ...health.dependencies, legacy: legacyHealth },
    metrics: health.metrics,
    queues: {
      enabled: isQueueEnabled(),
      stats: await getQueueStats(),
      dlq: dlqStats,
    },
    slo: slo.filter((s) => s.status !== 'HEALTHY'),
    activeAlerts: alerts,
    activeIncidents,
    circuitBreakers: getCircuitBreakerStates().filter((b) => b.state !== 'CLOSED'),
    businessMetrics: metrics.counters.filter((c) => c.name.startsWith('business_')),
  };
}

export async function getServiceHealth() {
  return getDetailedHealth();
}

export async function getErrorExplorer(limit = 50) {
  return listMonitoredErrors(limit);
}

export async function getQueueHealth() {
  const [stats, dlq, dlqStats] = await Promise.all([
    getQueueStats(),
    listDeadLetterJobs(20),
    getDlqStats(),
  ]);
  return { stats, recentDlq: dlq, summary: dlqStats };
}

export async function getSloDashboard() {
  return listSloStatus();
}

export async function getAlertsDashboard() {
  return listAlerts();
}

export async function getIncidentsDashboard() {
  return listIncidents();
}

export async function getBackupsDashboard() {
  return listBackupVerifications();
}

export async function getReleasesDashboard() {
  return listReleaseHealth();
}

export async function getDrPlans() {
  return listDisasterRecoveryPlans();
}
