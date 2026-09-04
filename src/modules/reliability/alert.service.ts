import { AlertSeverity, AlertStatus } from '@ghaarfix/shared-types';
import { OperationalAlert } from '@/models/Reliability.js';
import { AppError } from '@/utils/AppError.js';
import { ErrorCode } from '@ghaarfix/shared-types';
import { metricsService } from '@/modules/reliability/metrics.service.js';

export async function createAlert(input: {
  source: string;
  severity: AlertSeverity;
  title: string;
  description: string;
  metric?: string;
  threshold?: number;
  currentValue?: number;
  deduplicationKey: string;
}): Promise<{ created: boolean; alertId?: string }> {
  const existing = await OperationalAlert.findOne({
    deduplicationKey: input.deduplicationKey,
    status: { $in: [AlertStatus.OPEN, AlertStatus.ACKNOWLEDGED] },
  });
  if (existing) {
    metricsService.counter('alert_deduplicated_total', 1, { source: input.source });
    return { created: false, alertId: existing._id.toString() };
  }

  const alert = await OperationalAlert.create({
    ...input,
    status: AlertStatus.OPEN,
  });
  metricsService.counter('alert_created_total', 1, { severity: input.severity });
  return { created: true, alertId: alert._id.toString() };
}

export async function acknowledgeAlert(id: string, userId: string) {
  const alert = await OperationalAlert.findById(id);
  if (!alert) throw new AppError('Alert not found', 404, ErrorCode.NOT_FOUND);
  alert.status = AlertStatus.ACKNOWLEDGED;
  alert.acknowledgedAt = new Date();
  alert.acknowledgedBy = userId as never;
  await alert.save();
  return { id: alert._id.toString(), status: alert.status };
}

export async function listAlerts(status?: AlertStatus, limit = 50) {
  const query = status ? { status } : {};
  const rows = await OperationalAlert.find(query).sort({ createdAt: -1 }).limit(limit);
  return rows.map((r) => ({
    id: r._id.toString(),
    source: r.source,
    severity: r.severity,
    title: r.title,
    description: r.description,
    metric: r.metric,
    threshold: r.threshold,
    currentValue: r.currentValue,
    status: r.status,
    deduplicationKey: r.deduplicationKey,
    createdAt: r.createdAt,
    acknowledgedAt: r.acknowledgedAt,
  }));
}

export async function evaluateAlerts(): Promise<number> {
  const openCount = await OperationalAlert.countDocuments({
    status: { $in: [AlertStatus.OPEN, AlertStatus.ACKNOWLEDGED] },
  });
  const metrics = metricsService.getSnapshot();
  const errorRate =
    metrics.counters.filter((c) => c.name === 'http_errors_total').reduce((s, c) => s + c.value, 0) /
    Math.max(
      1,
      metrics.counters.filter((c) => c.name === 'http_requests_total').reduce((s, c) => s + c.value, 0),
    );

  if (errorRate > 0.05) {
    await createAlert({
      source: 'metrics',
      severity: AlertSeverity.CRITICAL,
      title: 'Elevated API error rate',
      description: `Error rate ${(errorRate * 100).toFixed(2)}% exceeds threshold`,
      metric: 'http_error_rate',
      threshold: 0.05,
      currentValue: errorRate,
      deduplicationKey: 'alert:http_error_rate_elevated',
    });
  }

  return openCount;
}
