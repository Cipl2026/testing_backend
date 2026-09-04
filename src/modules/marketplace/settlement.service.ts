import { PartnerSettlementStatus } from '@ghaarfix/shared-types';
import { DateTime } from 'luxon';
import { OrderItem, PartnerSettlement } from '@/models/Marketplace.js';

export async function generatePartnerSettlement(partnerId: string, periodStart: Date, periodEnd: Date) {
  const idempotencyKey = `${partnerId}:${periodStart.toISOString()}:${periodEnd.toISOString()}`;

  const existing = await PartnerSettlement.findOne({ idempotencyKey });
  if (existing) return existing;

  const items = await OrderItem.find({
    partnerId,
    createdAt: { $gte: periodStart, $lte: periodEnd },
  });

  const grossSales = items.reduce((s, i) => s + i.totalPrice, 0);
  const commission = items.reduce((s, i) => {
    const snap = i.commissionSnapshot as { amount?: number } | undefined;
    return s + (snap?.amount ?? 0);
  }, 0);

  return PartnerSettlement.create({
    partnerId,
    periodStart,
    periodEnd,
    grossSales,
    commission,
    refunds: 0,
    adjustments: 0,
    netPayable: grossSales - commission,
    status: PartnerSettlementStatus.DRAFT,
    idempotencyKey,
  });
}

export async function runMonthlySettlements() {
  const start = DateTime.now().minus({ months: 1 }).startOf('month').toJSDate();
  const end = DateTime.now().minus({ months: 1 }).endOf('month').toJSDate();

  const partnerIds = await OrderItem.distinct('partnerId');
  let created = 0;

  for (const partnerId of partnerIds) {
    const settlement = await generatePartnerSettlement(partnerId.toString(), start, end);
    if (settlement) created += 1;
  }

  return created;
}

export async function listPartnerSettlements(partnerId: string) {
  const items = await PartnerSettlement.find({ partnerId }).sort({ periodStart: -1 }).limit(24);
  return items.map((s) => ({
    id: s._id.toString(),
    periodStart: s.periodStart,
    periodEnd: s.periodEnd,
    grossSales: s.grossSales,
    commission: s.commission,
    netPayable: s.netPayable,
    status: s.status,
  }));
}
