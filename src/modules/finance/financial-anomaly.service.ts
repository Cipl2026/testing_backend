import {
  FinancialAlertSeverity,
  FinancialAlertStatus,
  FinancialEventStatus,
  FinancialEventType,
  ForecastConfidence,
} from '@ghaarfix/shared-types';
import { FinancialAlert, FinancialEvent, CashFlowForecast } from '@/models/Finance.js';
import { BookingFinancialSnapshot } from '@/models/Finance.js';
import { FinancialEvent as FinancialEventModel } from '@/models/Finance.js';

export async function detectFinancialAnomalies(): Promise<number> {
  let created = 0;
  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const duplicateKeys = await FinancialEvent.aggregate([
    { $match: { createdAt: { $gte: dayAgo }, status: FinancialEventStatus.POSTED } },
    { $group: { _id: { sourceType: '$sourceType', sourceId: '$sourceId', eventType: '$eventType' }, count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
  ]);

  for (const dup of duplicateKeys) {
    const dedupeKey = `duplicate:${dup._id.sourceType}:${dup._id.sourceId}:${dup._id.eventType}`;
    const alert = await upsertAlert({
      dedupeKey,
      scope: 'ledger',
      severity: FinancialAlertSeverity.HIGH,
      metric: 'duplicate_payment',
      actualValue: dup.count,
      anomalyScore: 0.9,
      explanation: `Potential duplicate ${dup._id.eventType} for source ${dup._id.sourceId}`,
    });
    if (alert) created += 1;
  }

  const refundSpike = await FinancialEvent.countDocuments({
    eventType: FinancialEventType.REFUND,
    status: FinancialEventStatus.POSTED,
    createdAt: { $gte: dayAgo },
  });
  if (refundSpike > 20) {
    const alert = await upsertAlert({
      dedupeKey: `refund-spike:${dayAgo.toISOString().slice(0, 10)}`,
      scope: 'refunds',
      severity: FinancialAlertSeverity.MEDIUM,
      metric: 'refund_spike',
      actualValue: refundSpike,
      expectedValue: 10,
      anomalyScore: 0.7,
      explanation: `Unusual refund volume: ${refundSpike} in 24h`,
    });
    if (alert) created += 1;
  }

  const negativeMargins = await BookingFinancialSnapshot.find({
    contributionMarginMinor: { $lt: 0 },
    updatedAt: { $gte: dayAgo },
  }).limit(5);

  for (const snap of negativeMargins) {
    const alert = await upsertAlert({
      dedupeKey: `negative-margin:${snap.bookingId.toString()}`,
      scope: 'booking',
      severity: FinancialAlertSeverity.MEDIUM,
      metric: 'negative_contribution_margin',
      actualValue: snap.contributionMarginMinor,
      anomalyScore: 0.6,
      explanation: `Booking ${snap.bookingId} has negative contribution margin`,
    });
    if (alert) created += 1;
  }

  return created;
}

async function upsertAlert(input: {
  dedupeKey: string;
  scope: string;
  severity: FinancialAlertSeverity;
  metric: string;
  expectedValue?: number;
  actualValue?: number;
  anomalyScore: number;
  explanation: string;
}) {
  const existing = await FinancialAlert.findOne({
    dedupeKey: input.dedupeKey,
    status: { $in: [FinancialAlertStatus.OPEN, FinancialAlertStatus.INVESTIGATING] },
  });
  if (existing) return null;

  return FinancialAlert.create({
    ...input,
    status: FinancialAlertStatus.OPEN,
  });
}

export async function acknowledgeAlert(alertId: string) {
  return FinancialAlert.findByIdAndUpdate(
    alertId,
    { status: FinancialAlertStatus.ACKNOWLEDGED },
    { new: true },
  );
}

export async function listAlerts(query: {
  status?: FinancialAlertStatus;
  severity?: FinancialAlertSeverity;
  page?: number;
  limit?: number;
}) {
  const filter: Record<string, unknown> = {};
  if (query.status) filter.status = query.status;
  if (query.severity) filter.severity = query.severity;
  const page = query.page ?? 1;
  const limit = Math.min(query.limit ?? 50, 100);
  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    FinancialAlert.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    FinancialAlert.countDocuments(filter),
  ]);

  return { items, total, page, limit };
}

export async function buildCashFlowForecast(days = 30) {
  const start = new Date();
  const end = new Date(start);
  end.setDate(end.getDate() + days);

  const inflowRows = await FinancialEventModel.aggregate([
    {
      $match: {
        direction: 'INFLOW',
        status: FinancialEventStatus.POSTED,
        effectiveAt: { $gte: new Date(start.getTime() - 30 * 86400000) },
      },
    },
    { $group: { _id: null, total: { $sum: '$amountMinor' } } },
  ]);
  const outflowRows = await FinancialEventModel.aggregate([
    {
      $match: {
        direction: 'OUTFLOW',
        status: FinancialEventStatus.POSTED,
        effectiveAt: { $gte: new Date(start.getTime() - 30 * 86400000) },
      },
    },
    { $group: { _id: null, total: { $sum: '$amountMinor' } } },
  ]);

  const avgInflow = Math.round((inflowRows[0]?.total ?? 0) / 30);
  const avgOutflow = Math.round((outflowRows[0]?.total ?? 0) / 30);
  const expectedInflowMinor = avgInflow * days;
  const expectedOutflowMinor = avgOutflow * days;
  const netCashMinor = expectedInflowMinor - expectedOutflowMinor;
  const variance = Math.round(netCashMinor * 0.15);

  return CashFlowForecast.create({
    periodStart: start,
    periodEnd: end,
    expectedInflowMinor,
    expectedOutflowMinor,
    netCashMinor,
    confidence: ForecastConfidence.MEDIUM,
    rangeLowMinor: netCashMinor - variance,
    rangeHighMinor: netCashMinor + variance,
    inputs: { avgDailyInflow: avgInflow, avgDailyOutflow: avgOutflow, horizonDays: days },
  });
}
