import {
  AlertSeverity,
  AlertStatus,
  DEFAULT_SLO_DEFINITIONS,
  SloStatus,
} from '@ghaarfix/shared-types';
import { OperationalAlert, ServiceLevelObjective, ServiceLevelSnapshot } from '@/models/Reliability.js';
import { metricsService } from '@/modules/reliability/metrics.service.js';
import { createHash } from 'node:crypto';

export async function seedDefaultSlos(): Promise<void> {
  for (const slo of DEFAULT_SLO_DEFINITIONS) {
    await ServiceLevelObjective.findOneAndUpdate(
      { key: slo.key },
      {
        key: slo.key,
        name: slo.name,
        service: slo.service,
        metric: slo.metric,
        target: slo.target,
        windowDays: slo.windowDays,
        severity: slo.severity,
        isLatency: 'isLatency' in slo ? slo.isLatency : false,
      },
      { upsert: true },
    );
  }
}

export async function calculateSloSnapshots(): Promise<number> {
  const slos = await ServiceLevelObjective.find();
  const metrics = metricsService.getSnapshot();
  let count = 0;
  const windowEnd = new Date();
  const windowStart = new Date(windowEnd.getTime() - 24 * 60 * 60 * 1000);

  for (const slo of slos) {
    let actualValue = 0;
    let status = SloStatus.HEALTHY;

    if (slo.metric === 'http_success_rate') {
      const total = metrics.counters
        .filter((c) => c.name === 'http_requests_total')
        .reduce((s, c) => s + c.value, 0);
      const errors = metrics.counters
        .filter((c) => c.name === 'http_errors_total')
        .reduce((s, c) => s + c.value, 0);
      actualValue = total > 0 ? (total - errors) / total : 1;
    } else if (slo.metric === 'booking_created_success_rate') {
      const created = metrics.counters
        .filter((c) => c.name === 'business_booking_created')
        .reduce((s, c) => s + c.value, 0);
      const failed = metrics.counters
        .filter((c) => c.name === 'business_booking_failed')
        .reduce((s, c) => s + c.value, 0);
      const total = created + failed;
      actualValue = total > 0 ? created / total : 1;
    } else if (slo.metric === 'payment_webhook_success_rate') {
      const success = metrics.counters
        .filter((c) => c.name === 'business_payment_success')
        .reduce((s, c) => s + c.value, 0);
      const failed = metrics.counters
        .filter((c) => c.name === 'business_payment_failure')
        .reduce((s, c) => s + c.value, 0);
      const total = success + failed;
      actualValue = total > 0 ? success / total : 1;
    } else if (slo.metric === 'http_latency_p95_ms') {
      const hist = metrics.histograms.find((h) => h.name === 'http_request_duration_ms');
      actualValue = hist?.p95 ?? 0;
    }

    if (slo.isLatency) {
      status = actualValue <= slo.target ? SloStatus.HEALTHY : SloStatus.BREACHED;
    } else {
      status = actualValue >= slo.target ? SloStatus.HEALTHY : actualValue >= slo.target * 0.99 ? SloStatus.AT_RISK : SloStatus.BREACHED;
    }

    const errorBudgetRemaining = slo.isLatency
      ? Math.max(0, 1 - actualValue / slo.target)
      : Math.max(0, (actualValue - slo.target) / (1 - slo.target + 0.0001));

    const burnRate = slo.isLatency
      ? actualValue / slo.target
      : (1 - actualValue) / (1 - slo.target + 0.0001);

    await ServiceLevelSnapshot.create({
      sloId: slo._id,
      windowStart,
      windowEnd,
      actualValue,
      target: slo.target,
      errorBudgetRemaining,
      burnRate,
      status,
    });

    slo.status = status;
    await slo.save();
    count += 1;
  }

  return count;
}

export async function listSloStatus() {
  const slos = await ServiceLevelObjective.find().sort({ service: 1 });
  const snapshots = await ServiceLevelSnapshot.aggregate([
    { $sort: { createdAt: -1 } },
    { $group: { _id: '$sloId', latest: { $first: '$$ROOT' } } },
  ]);
  const snapMap = new Map(snapshots.map((s) => [s._id.toString(), s.latest]));

  return slos.map((slo) => {
    const snap = snapMap.get(slo._id.toString());
    return {
      id: slo._id.toString(),
      key: slo.key,
      name: slo.name,
      service: slo.service,
      metric: slo.metric,
      target: slo.target,
      windowDays: slo.windowDays,
      status: slo.status,
      actualValue: snap?.actualValue,
      errorBudgetRemaining: snap?.errorBudgetRemaining,
      burnRate: snap?.burnRate,
      snapshotAt: snap?.createdAt,
    };
  });
}

export async function createSloAlert(
  slo: { key: string; name: string; severity: AlertSeverity },
  actualValue: number,
  target: number,
): Promise<void> {
  const deduplicationKey = createHash('sha256')
    .update(`slo:${slo.key}:${slo.name}`)
    .digest('hex');

  const existing = await OperationalAlert.findOne({
    deduplicationKey,
    status: { $in: [AlertStatus.OPEN, AlertStatus.ACKNOWLEDGED] },
  });
  if (existing) return;

  await OperationalAlert.create({
    source: 'slo',
    severity: slo.severity,
    title: `SLO at risk: ${slo.name}`,
    description: `${slo.name} actual ${actualValue.toFixed(4)} vs target ${target}`,
    metric: slo.key,
    threshold: target,
    currentValue: actualValue,
    status: AlertStatus.OPEN,
    deduplicationKey,
  });
}
