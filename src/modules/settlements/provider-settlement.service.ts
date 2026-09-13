import { Types } from 'mongoose';
import {
  BookingStatus,
  ErrorCode,
  FinancialDirection,
  FinancialEventType,
  FinancialSourceType,
  PaymentMethod,
  PaymentStatus,
  ProviderSettlementKind,
  ProviderSettlementPaymentChannel,
  ProviderSettlementStatus,
} from '@ghaarfix/shared-types';
import { Booking } from '@/models/Booking.js';
import { Payment } from '@/models/Payment.js';
import {
  ProviderSettlementRecord,
  type IProviderSettlementRecord,
} from '@/models/ProviderSettlementRecord.js';
import { AdminAuditLog } from '@/models/AdminAuditLog.js';
import { createFinancialEvent } from '@/modules/finance/financial-ledger.service.js';
import { reconcilePayout } from '@/modules/finance/reconciliation.service.js';
import { isFinanceBiEnabled } from '@/modules/finance/finance-feature.service.js';
import { toMinor } from '@/utils/money.js';
import { AppError } from '@/utils/AppError.js';
import type { IPayment } from '@/models/Payment.js';

function resolvePaymentChannel(payment: IPayment): ProviderSettlementPaymentChannel {
  const confirmation = payment.metadata?.confirmation as Record<string, unknown> | undefined;
  if (confirmation?.method === 'CASH') {
    return ProviderSettlementPaymentChannel.CASH;
  }
  if (payment.providerPaymentId || payment.provider === 'razorpay') {
    return ProviderSettlementPaymentChannel.ONLINE;
  }
  if (payment.method === PaymentMethod.ONLINE) {
    return ProviderSettlementPaymentChannel.ONLINE;
  }
  if (payment.method === PaymentMethod.PAY_ON_SERVICE) {
    return ProviderSettlementPaymentChannel.CASH;
  }
  return ProviderSettlementPaymentChannel.ONLINE;
}

function serializeSettlement(record: IProviderSettlementRecord) {
  return {
    id: record._id.toString(),
    bookingId: record.bookingId.toString(),
    bookingNumber: record.bookingNumber,
    providerId: record.providerId.toString(),
    customerId: record.customerId.toString(),
    kind: record.kind,
    paymentChannel: record.paymentChannel,
    status: record.status,
    settleAmount: record.settleAmount,
    providerPayoutAmount: record.providerPayoutAmount,
    platformFeeAmount: record.platformFeeAmount,
    customerPaidAmount: record.customerPaidAmount,
    currency: record.currency,
    serviceName: record.serviceName,
    settledAt: record.settledAt?.toISOString(),
    settlementReference: record.settlementReference,
    adminNotes: record.adminNotes,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

/**
 * Creates a settlement row when a booking is COMPLETED and PAID.
 * Online → platform owes provider (payout). Cash → provider owes platform (commission).
 */
export async function tryCreateProviderSettlement(
  bookingId: string,
): Promise<IProviderSettlementRecord | null> {
  const booking = await Booking.findById(bookingId);
  if (!booking || booking.status !== BookingStatus.COMPLETED) return null;
  if (booking.payment.status !== PaymentStatus.PAID) return null;
  if (!booking.providerId) return null;

  const existing = await ProviderSettlementRecord.findOne({ bookingId: booking._id });
  if (existing) return existing;

  const payment = await Payment.findOne({ bookingId: booking._id });
  if (!payment) return null;

  const channel = resolvePaymentChannel(payment);
  const providerPayoutAmount = Math.round(
    booking.price?.providerPayoutAmount ??
      booking.price?.finalAmount ??
      payment.amount,
  );
  const platformFeeAmount = Math.round(
    booking.price?.platformFeeAmount ??
      Math.max(0, (booking.price?.finalAmount ?? payment.amount) - providerPayoutAmount),
  );
  const customerPaidAmount = Math.round(booking.price?.finalAmount ?? payment.amount);

  const kind =
    channel === ProviderSettlementPaymentChannel.CASH
      ? ProviderSettlementKind.COMMISSION_FROM_PROVIDER
      : ProviderSettlementKind.PAYOUT_TO_PROVIDER;

  const settleAmount =
    kind === ProviderSettlementKind.PAYOUT_TO_PROVIDER
      ? providerPayoutAmount
      : platformFeeAmount;

  if (settleAmount < 1) return null;

  try {
    const [record] = await ProviderSettlementRecord.create([
      {
        bookingId: booking._id,
        bookingNumber: booking.bookingNumber,
        providerId: booking.providerId,
        customerId: booking.customerId,
        kind,
        paymentChannel: channel,
        status: ProviderSettlementStatus.PENDING,
        settleAmount,
        providerPayoutAmount,
        platformFeeAmount,
        customerPaidAmount,
        currency: booking.price?.currency ?? payment.currency ?? 'INR',
        serviceName: booking.serviceSnapshot?.name,
        idempotencyKey: `settlement:${booking._id.toString()}`,
      },
    ]);
    return record;
  } catch (err) {
    if (err instanceof Error && 'code' in err && (err as { code?: number }).code === 11000) {
      return ProviderSettlementRecord.findOne({ bookingId: booking._id });
    }
    throw err;
  }
}

export async function listAdminSettlements(query: {
  page?: number;
  limit?: number;
  status?: ProviderSettlementStatus;
  kind?: ProviderSettlementKind;
  providerId?: string;
}) {
  const page = query.page ?? 1;
  const limit = Math.min(query.limit ?? 50, 100);
  const skip = (page - 1) * limit;
  const filter: Record<string, unknown> = {};
  if (query.status) filter.status = query.status;
  if (query.kind) filter.kind = query.kind;
  if (query.providerId) filter.providerId = query.providerId;

  const [items, total, pendingPayoutAgg, pendingCommissionAgg] = await Promise.all([
    ProviderSettlementRecord.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    ProviderSettlementRecord.countDocuments(filter),
    ProviderSettlementRecord.aggregate([
      {
        $match: {
          status: ProviderSettlementStatus.PENDING,
          kind: ProviderSettlementKind.PAYOUT_TO_PROVIDER,
        },
      },
      { $group: { _id: null, total: { $sum: '$settleAmount' }, count: { $sum: 1 } } },
    ]),
    ProviderSettlementRecord.aggregate([
      {
        $match: {
          status: ProviderSettlementStatus.PENDING,
          kind: ProviderSettlementKind.COMMISSION_FROM_PROVIDER,
        },
      },
      { $group: { _id: null, total: { $sum: '$settleAmount' }, count: { $sum: 1 } } },
    ]),
  ]);

  return {
    items: items.map(serializeSettlement),
    total,
    page,
    limit,
    summary: {
      pendingPayoutTotal: Math.round(pendingPayoutAgg[0]?.total ?? 0),
      pendingPayoutCount: pendingPayoutAgg[0]?.count ?? 0,
      pendingCommissionTotal: Math.round(pendingCommissionAgg[0]?.total ?? 0),
      pendingCommissionCount: pendingCommissionAgg[0]?.count ?? 0,
    },
  };
}

export async function settleProviderRecord(
  adminId: string,
  settlementId: string,
  input: { reference?: string; notes?: string },
) {
  const record = await ProviderSettlementRecord.findById(settlementId);
  if (!record) {
    throw new AppError('Settlement not found.', 404, ErrorCode.NOT_FOUND);
  }
  if (record.status === ProviderSettlementStatus.SETTLED) {
    return serializeSettlement(record);
  }
  if (record.status !== ProviderSettlementStatus.PENDING) {
    throw new AppError('Only pending settlements can be settled.', 400, ErrorCode.VALIDATION_ERROR);
  }

  record.status = ProviderSettlementStatus.SETTLED;
  record.settledAt = new Date();
  record.settledBy = new Types.ObjectId(adminId);
  record.settlementReference = input.reference?.trim() || undefined;
  record.adminNotes = input.notes?.trim() || undefined;
  await record.save();

  if (record.kind === ProviderSettlementKind.PAYOUT_TO_PROVIDER && (await isFinanceBiEnabled())) {
    const amountMinor = toMinor(record.settleAmount);
    const payoutEvent = await createFinancialEvent({
      eventType: FinancialEventType.PROVIDER_PAYOUT,
      sourceType: FinancialSourceType.BOOKING,
      sourceId: record.bookingId,
      bookingId: record.bookingId,
      providerId: record.providerId,
      amountMinor,
      direction: FinancialDirection.OUTFLOW,
      idempotencyKey: `provider-payout:${record._id.toString()}`,
      metadata: {
        settlementId: record._id.toString(),
        bookingNumber: record.bookingNumber,
        reference: record.settlementReference,
      },
    });

    await reconcilePayout({
      providerId: record.providerId.toString(),
      payoutId: payoutEvent._id.toString(),
      expectedAmountMinor: amountMinor,
      actualAmountMinor: amountMinor,
      reason: record.settlementReference,
    });
  }

  await AdminAuditLog.create({
    adminId,
    action: 'SETTLE_PROVIDER_RECORD',
    entityType: 'ProviderSettlementRecord',
    entityId: record._id,
    reason: `Settled ${record.kind} for booking ${record.bookingNumber}`,
    after: {
      kind: record.kind,
      settleAmount: record.settleAmount,
      reference: record.settlementReference,
    },
  });

  return serializeSettlement(record);
}

export async function listProviderSettlements(
  providerId: string,
  query: { page?: number; limit?: number; status?: ProviderSettlementStatus },
) {
  const page = query.page ?? 1;
  const limit = Math.min(query.limit ?? 30, 50);
  const skip = (page - 1) * limit;
  const filter: Record<string, unknown> = { providerId };
  if (query.status) filter.status = query.status;

  const [items, total] = await Promise.all([
    ProviderSettlementRecord.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    ProviderSettlementRecord.countDocuments(filter),
  ]);

  return {
    items: items.map(serializeSettlement),
    total,
    page,
    limit,
  };
}

export async function getProviderSettlementSummary(providerId: string) {
  const [pendingPayout, pendingCommission, settledPayout, settledCommission, customerUnpaid] =
    await Promise.all([
      ProviderSettlementRecord.aggregate([
        {
          $match: {
            providerId,
            status: ProviderSettlementStatus.PENDING,
            kind: ProviderSettlementKind.PAYOUT_TO_PROVIDER,
          },
        },
        { $group: { _id: null, total: { $sum: '$settleAmount' }, count: { $sum: 1 } } },
      ]),
      ProviderSettlementRecord.aggregate([
        {
          $match: {
            providerId,
            status: ProviderSettlementStatus.PENDING,
            kind: ProviderSettlementKind.COMMISSION_FROM_PROVIDER,
          },
        },
        { $group: { _id: null, total: { $sum: '$settleAmount' }, count: { $sum: 1 } } },
      ]),
      ProviderSettlementRecord.aggregate([
        {
          $match: {
            providerId,
            status: ProviderSettlementStatus.SETTLED,
            kind: ProviderSettlementKind.PAYOUT_TO_PROVIDER,
          },
        },
        { $group: { _id: null, total: { $sum: '$settleAmount' } } },
      ]),
      ProviderSettlementRecord.aggregate([
        {
          $match: {
            providerId,
            status: ProviderSettlementStatus.SETTLED,
            kind: ProviderSettlementKind.COMMISSION_FROM_PROVIDER,
          },
        },
        { $group: { _id: null, total: { $sum: '$settleAmount' } } },
      ]),
      Booking.aggregate([
        {
          $match: {
            providerId,
            status: BookingStatus.COMPLETED,
            'payment.status': { $ne: PaymentStatus.PAID },
          },
        },
        {
          $group: {
            _id: null,
            total: {
              $sum: {
                $ifNull: ['$price.finalAmount', 0],
              },
            },
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

  return {
    pendingPayout: Math.round(pendingPayout[0]?.total ?? 0),
    pendingPayoutJobs: pendingPayout[0]?.count ?? 0,
    pendingCommission: Math.round(pendingCommission[0]?.total ?? 0),
    pendingCommissionJobs: pendingCommission[0]?.count ?? 0,
    settledPayout: Math.round(settledPayout[0]?.total ?? 0),
    settledCommission: Math.round(settledCommission[0]?.total ?? 0),
    customerPaymentPending: Math.round(customerUnpaid[0]?.total ?? 0),
    customerPaymentPendingJobs: customerUnpaid[0]?.count ?? 0,
  };
}

export async function confirmCashReceivedByProvider(providerId: string, bookingId: string) {
  const booking = await Booking.findOne({ _id: bookingId, providerId });
  if (!booking) {
    throw new AppError('Booking not found.', 404, ErrorCode.NOT_FOUND);
  }
  if (booking.status !== BookingStatus.COMPLETED) {
    throw new AppError('Cash can only be confirmed after service completion.', 400, ErrorCode.VALIDATION_ERROR);
  }
  if (booking.payment.status === PaymentStatus.PAID) {
    return { alreadyPaid: true, bookingId };
  }

  const allowed = new Set([
    PaymentStatus.PENDING,
    PaymentStatus.PAY_ON_SERVICE,
    PaymentStatus.FAILED,
  ]);
  if (!allowed.has(booking.payment.status)) {
    throw new AppError('Cash payment cannot be recorded for this booking.', 400, ErrorCode.VALIDATION_ERROR);
  }

  const payment = await Payment.findOne({ bookingId: booking._id });
  if (!payment) {
    throw new AppError('Payment record not found.', 404, ErrorCode.NOT_FOUND);
  }

  const { markBookingPaidForSettlement } = await import(
    '@/modules/settlements/provider-settlement.hooks.js'
  );
  await markBookingPaidForSettlement(booking, payment, {
    method: 'CASH',
    confirmedBy: 'PROVIDER',
    confirmedAt: new Date().toISOString(),
  });

  return { alreadyPaid: false, bookingId };
}
