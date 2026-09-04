import {
  FinancialDirection,
  FinancialEventStatus,
  FinancialEventType,
} from '@ghaarfix/shared-types';
import { FinancialEvent, ProviderEarningsSnapshot } from '@/models/Finance.js';
import * as legacyEarnings from '@/modules/providers/provider-earnings.service.js';
import { fromMinor } from '@/utils/money.js';
import { isFinanceBiEnabled } from '@/modules/finance/finance-feature.service.js';

function monthStart(): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export async function getProviderFinanceEarnings(providerId: string) {
  const legacy = await legacyEarnings.getProviderEarnings(providerId);

  if (!(await isFinanceBiEnabled())) {
    return {
      source: 'booking_aggregate',
      ...legacy,
      grossEarningsMinor: legacy.month.amount * 100,
      platformDeductionsMinor: 0,
      payoutPendingMinor: legacy.pendingPayout * 100,
      payoutCompletedMinor: 0,
      adjustmentsMinor: 0,
      breakdown: legacy.recentTransactions,
    };
  }

  const start = monthStart();
  const end = new Date();

  const events = await FinancialEvent.find({
    providerId,
    status: FinancialEventStatus.POSTED,
    effectiveAt: { $gte: start, $lte: end },
  });

  const grossEarningsMinor = events
    .filter((e) => e.eventType === FinancialEventType.PROVIDER_EARNING)
    .reduce((s, e) => s + e.amountMinor, 0);

  const platformDeductionsMinor = events
    .filter((e) =>
      [FinancialEventType.PROVIDER_COMMISSION, FinancialEventType.GATEWAY_FEE].includes(e.eventType),
    )
    .reduce((s, e) => s + e.amountMinor, 0);

  const payoutCompletedMinor = events
    .filter((e) => e.eventType === FinancialEventType.PROVIDER_PAYOUT)
    .reduce((s, e) => s + e.amountMinor, 0);

  const adjustmentsMinor = events
    .filter((e) => e.eventType === FinancialEventType.ADJUSTMENT)
    .reduce((s, e) => s + (e.direction === FinancialDirection.OUTFLOW ? e.amountMinor : -e.amountMinor), 0);

  const payoutPendingMinor = Math.max(0, grossEarningsMinor - payoutCompletedMinor - adjustmentsMinor);

  await ProviderEarningsSnapshot.findOneAndUpdate(
    { providerId, periodStart: start },
    {
      providerId,
      periodStart: start,
      periodEnd: end,
      grossEarningsMinor,
      platformDeductionsMinor,
      payoutPendingMinor,
      payoutCompletedMinor,
      adjustmentsMinor,
    },
    { upsert: true },
  );

  return {
    source: 'financial_ledger',
    period: { start: start.toISOString(), end: end.toISOString() },
    grossEarningsMinor,
    platformDeductionsMinor,
    payoutPendingMinor,
    payoutCompletedMinor,
    adjustmentsMinor,
    display: {
      grossEarnings: fromMinor(grossEarningsMinor),
      platformDeductions: fromMinor(platformDeductionsMinor),
      payoutPending: fromMinor(payoutPendingMinor),
      payoutCompleted: fromMinor(payoutCompletedMinor),
      adjustments: fromMinor(adjustmentsMinor),
    },
    today: legacy.today,
    week: legacy.week,
    month: legacy.month,
    recentTransactions: legacy.recentTransactions.map((t) => ({
      ...t,
      amountMinor: t.amount * 100,
    })),
  };
}

export async function getProviderPayouts(providerId: string) {
  const events = await FinancialEvent.find({
    providerId,
    eventType: FinancialEventType.PROVIDER_PAYOUT,
    status: FinancialEventStatus.POSTED,
  })
    .sort({ effectiveAt: -1 })
    .limit(50);

  return events.map((e) => ({
    id: e._id.toString(),
    amountMinor: e.amountMinor,
    status: e.status,
    occurredAt: e.occurredAt,
    metadata: e.metadata,
  }));
}

export async function getProviderPayoutDetail(providerId: string, payoutId: string) {
  const event = await FinancialEvent.findOne({
    _id: payoutId,
    providerId,
    eventType: FinancialEventType.PROVIDER_PAYOUT,
  });
  if (!event) return null;

  const { PayoutReconciliation } = await import('@/models/Finance.js');
  const reconciliation = await PayoutReconciliation.findOne({ payoutId: event._id });

  return {
    payout: {
      id: event._id.toString(),
      amountMinor: event.amountMinor,
      occurredAt: event.occurredAt,
      metadata: event.metadata,
    },
    reconciliation,
  };
}
