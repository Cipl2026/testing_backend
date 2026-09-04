import { ReconciliationStatus } from '@ghaarfix/shared-types';
import { PaymentReconciliation, PayoutReconciliation } from '@/models/Finance.js';

export async function reconcilePayment(
  paymentId: string,
  expectedAmountMinor: number,
  gatewayReference?: string,
  receivedAmountMinor?: number,
) {
  const received = receivedAmountMinor ?? expectedAmountMinor;
  const difference = received - expectedAmountMinor;

  let status = ReconciliationStatus.MATCHED;
  if (difference !== 0 && received > 0 && received < expectedAmountMinor) {
    status = ReconciliationStatus.PARTIAL;
  } else if (difference !== 0) {
    status = ReconciliationStatus.MISMATCH;
  }

  return PaymentReconciliation.findOneAndUpdate(
    { paymentId },
    {
      paymentId,
      gatewayReference,
      expectedAmountMinor,
      receivedAmountMinor: received,
      status,
    },
    { upsert: true, new: true },
  );
}

export async function reconcilePayout(input: {
  providerId: string;
  payoutId: string;
  expectedAmountMinor: number;
  actualAmountMinor: number;
  reason?: string;
}) {
  const differenceMinor = input.actualAmountMinor - input.expectedAmountMinor;

  let status = ReconciliationStatus.MATCHED;
  if (differenceMinor !== 0 && input.actualAmountMinor > 0) {
    status =
      input.actualAmountMinor < input.expectedAmountMinor
        ? ReconciliationStatus.PARTIAL
        : ReconciliationStatus.MISMATCH;
  } else if (input.actualAmountMinor === 0) {
    status = ReconciliationStatus.PENDING;
  }

  return PayoutReconciliation.findOneAndUpdate(
    { payoutId: input.payoutId },
    {
      providerId: input.providerId,
      payoutId: input.payoutId,
      expectedAmountMinor: input.expectedAmountMinor,
      actualAmountMinor: input.actualAmountMinor,
      differenceMinor,
      status,
      reason: input.reason,
    },
    { upsert: true, new: true },
  );
}

export async function listReconciliation(query: {
  type?: 'payment' | 'payout';
  status?: ReconciliationStatus;
  page?: number;
  limit?: number;
}) {
  const page = query.page ?? 1;
  const limit = Math.min(query.limit ?? 50, 100);
  const skip = (page - 1) * limit;
  const filter: Record<string, unknown> = {};
  if (query.status) filter.status = query.status;

  if (query.type === 'payout') {
    const [items, total] = await Promise.all([
      PayoutReconciliation.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(limit),
      PayoutReconciliation.countDocuments(filter),
    ]);
    return { type: 'payout', items, total, page, limit };
  }

  const [items, total] = await Promise.all([
    PaymentReconciliation.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(limit),
    PaymentReconciliation.countDocuments(filter),
  ]);
  return { type: 'payment', items, total, page, limit };
}
