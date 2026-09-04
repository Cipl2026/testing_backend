import {
  BookingStatus,
  IntelligenceFeature,
  OperationalAnomalySeverity,
  OperationalAnomalyStatus,
  OperationalAnomalyType,
} from '@ghaarfix/shared-types';
import { DateTime } from 'luxon';
import { Booking } from '@/models/Booking.js';
import { DemandForecast, OperationalAnomaly } from '@/models/Intelligence.js';

const THRESHOLD_PERCENT = Number(process.env.ANOMALY_THRESHOLD_PERCENT ?? 50);

async function detectRateAnomaly(input: {
  type: OperationalAnomalyType;
  scope: string;
  currentCount: number;
  baselineCount: number;
  severity: OperationalAnomalySeverity;
}) {
  if (input.baselineCount <= 0 && input.currentCount < 3) return null;

  const baseline = Math.max(input.baselineCount, 1);
  const percentChange = ((input.currentCount - baseline) / baseline) * 100;

  if (percentChange < THRESHOLD_PERCENT) return null;

  const existing = await OperationalAnomaly.findOne({
    type: input.type,
    scope: input.scope,
    status: { $in: [OperationalAnomalyStatus.OPEN, OperationalAnomalyStatus.ACKNOWLEDGED] },
    detectedAt: { $gte: DateTime.now().startOf('day').toJSDate() },
  });
  if (existing) return existing;

  return OperationalAnomaly.create({
    type: input.type,
    scope: input.scope,
    severity: input.severity,
    baseline,
    observedValue: input.currentCount,
    percentChange: Math.round(percentChange),
    status: OperationalAnomalyStatus.OPEN,
    detectedAt: new Date(),
  });
}

export async function runAnomalyDetection() {
  const now = DateTime.now();
  const currentStart = now.minus({ hours: 24 }).toJSDate();
  const baselineStart = now.minus({ days: 8 }).toJSDate();
  const baselineEnd = now.minus({ days: 1 }).toJSDate();

  const [currentCancellations, baselineCancellations, currentNoShows, baselineNoShows] =
    await Promise.all([
      Booking.countDocuments({
        status: BookingStatus.CANCELLED,
        updatedAt: { $gte: currentStart },
      }),
      Booking.countDocuments({
        status: BookingStatus.CANCELLED,
        updatedAt: { $gte: baselineStart, $lt: baselineEnd },
      }),
      Booking.countDocuments({
        status: BookingStatus.CANCELLED,
        'cancellation.cancelledBy': 'PROVIDER',
        updatedAt: { $gte: currentStart },
      }),
      Booking.countDocuments({
        status: BookingStatus.CANCELLED,
        'cancellation.cancelledBy': 'PROVIDER',
        updatedAt: { $gte: baselineStart, $lt: baselineEnd },
      }),
    ]);

  const baselineDailyCancel = baselineCancellations / 7;
  const baselineDailyNoShow = baselineNoShows / 7;

  let detected = 0;

  if (
    await detectRateAnomaly({
      type: OperationalAnomalyType.CANCELLATION_SPIKE,
      scope: 'platform',
      currentCount: currentCancellations,
      baselineCount: baselineDailyCancel,
      severity: OperationalAnomalySeverity.HIGH,
    })
  ) {
    detected += 1;
  }

  if (
    await detectRateAnomaly({
      type: OperationalAnomalyType.PROVIDER_NO_SHOW_SPIKE,
      scope: 'platform',
      currentCount: currentNoShows,
      baselineCount: baselineDailyNoShow,
      severity: OperationalAnomalySeverity.MEDIUM,
    })
  ) {
    detected += 1;
  }

  return detected;
}

export async function listAnomalies(query: { status?: string; limit?: number }) {
  const filter: Record<string, unknown> = {};
  if (query.status) filter.status = query.status;

  const items = await OperationalAnomaly.find(filter)
    .sort({ detectedAt: -1 })
    .limit(query.limit ?? 50);

  return items.map((a) => ({
    id: a._id.toString(),
    type: a.type,
    scope: a.scope,
    severity: a.severity,
    baseline: a.baseline,
    observedValue: a.observedValue,
    percentChange: a.percentChange,
    status: a.status,
    detectedAt: a.detectedAt,
    metadata: a.metadata,
  }));
}

export async function acknowledgeAnomaly(anomalyId: string) {
  return OperationalAnomaly.findByIdAndUpdate(
    anomalyId,
    { status: OperationalAnomalyStatus.ACKNOWLEDGED, acknowledgedAt: new Date() },
    { new: true },
  );
}

export async function getIntelligenceDashboard() {
  const { AIUsageMetric } = await import('@/models/Intelligence.js');
  const { getProviderMatchingAnalytics } = await import(
    '@/modules/intelligence/provider-matching/smart-matching.service.js'
  );

  const [openAnomalies, activeForecasts, usage] = await Promise.all([
    OperationalAnomaly.countDocuments({ status: OperationalAnomalyStatus.OPEN }),
    DemandForecast.countDocuments({ forecastStart: { $gte: new Date() } }),
    AIUsageMetric.aggregate([
      {
        $group: {
          _id: '$feature',
          requests: { $sum: '$requestCount' },
          failures: { $sum: '$failureCount' },
          cost: { $sum: '$costUnits' },
        },
      },
    ]),
  ]);

  return {
    openAnomalies,
    activeForecasts,
    aiUsageByFeature: usage,
    providerMatching: await getProviderMatchingAnalytics(),
    feature: IntelligenceFeature.ANOMALY_DETECTION,
  };
}
