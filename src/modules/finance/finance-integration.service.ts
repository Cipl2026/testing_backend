import { BookingStatus } from '@ghaarfix/shared-types';
import {
  FinancialDirection,
  FinancialEventType,
  FinancialSourceType,
} from '@ghaarfix/shared-types';
import { Booking } from '@/models/Booking.js';
import { Payment } from '@/models/Payment.js';
import { BookingRefund } from '@/models/TrustProtection.js';
import { createFinancialEvent } from '@/modules/finance/financial-ledger.service.js';
import { gatewayFeeMinor, toMinor } from '@/utils/money.js';
import { reconcilePayment } from '@/modules/finance/reconciliation.service.js';
import { rebuildBookingFinancialSnapshot } from '@/modules/finance/booking-economics.service.js';
import {
  bookingDiscountMajor,
  bookingGrossMinor,
  bookingProviderCostMinor,
} from '@/modules/finance/booking-finance.helpers.js';
import { isFinanceBiEnabled } from '@/modules/finance/finance-feature.service.js';

export async function postPaymentCollectedLedger(paymentId: string, amountMajor: number): Promise<void> {
  if (!(await isFinanceBiEnabled())) return;

  const payment = await Payment.findById(paymentId);
  if (!payment) return;

  const booking = await Booking.findById(payment.bookingId);
  const amountMinor = toMinor(amountMajor);

  await createFinancialEvent({
    eventType: FinancialEventType.PAYMENT_COLLECTED,
    sourceType: FinancialSourceType.PAYMENT,
    sourceId: payment._id,
    bookingId: payment.bookingId,
    customerId: booking?.customerId,
    providerId: booking?.providerId,
    serviceId: booking?.serviceId,
    amountMinor,
    direction: FinancialDirection.INFLOW,
    idempotencyKey: `payment-collected:${payment._id.toString()}`,
    metadata: { providerPaymentId: payment.providerPaymentId },
  });

  const feeMinor = gatewayFeeMinor(amountMinor);
  if (feeMinor > 0) {
    await createFinancialEvent({
      eventType: FinancialEventType.GATEWAY_FEE,
      sourceType: FinancialSourceType.PAYMENT,
      sourceId: payment._id,
      bookingId: payment.bookingId,
      amountMinor: feeMinor,
      direction: FinancialDirection.OUTFLOW,
      idempotencyKey: `gateway-fee:${payment._id.toString()}`,
    });
  }

  await reconcilePayment(payment._id.toString(), amountMinor, payment.providerPaymentId);
}

export async function postBookingServiceRevenue(bookingId: string): Promise<void> {
  if (!(await isFinanceBiEnabled())) return;

  const booking = await Booking.findById(bookingId);
  if (!booking || booking.status !== BookingStatus.COMPLETED) return;

  const grossMinor = bookingGrossMinor(booking.price);
  const discountMinor = toMinor(bookingDiscountMajor(booking.price));
  const providerCostMinor = bookingProviderCostMinor(booking.price);

  await createFinancialEvent({
    eventType: FinancialEventType.SERVICE_REVENUE,
    sourceType: FinancialSourceType.BOOKING,
    sourceId: booking._id,
    bookingId: booking._id,
    customerId: booking.customerId,
    providerId: booking.providerId,
    serviceId: booking.serviceId,
    amountMinor: grossMinor,
    direction: FinancialDirection.INFLOW,
    idempotencyKey: `service-revenue:${booking._id.toString()}`,
  });

  if (discountMinor > 0) {
    await createFinancialEvent({
      eventType: FinancialEventType.DISCOUNT,
      sourceType: FinancialSourceType.BOOKING,
      sourceId: booking._id,
      bookingId: booking._id,
      amountMinor: discountMinor,
      direction: FinancialDirection.OUTFLOW,
      idempotencyKey: `discount:${booking._id.toString()}`,
    });
  }

  if (providerCostMinor > 0) {
    await createFinancialEvent({
      eventType: FinancialEventType.PROVIDER_EARNING,
      sourceType: FinancialSourceType.BOOKING,
      sourceId: booking._id,
      bookingId: booking._id,
      providerId: booking.providerId,
      amountMinor: providerCostMinor,
      direction: FinancialDirection.OUTFLOW,
      idempotencyKey: `provider-earning:${booking._id.toString()}`,
    });

    const commissionMinor = Math.max(0, grossMinor - discountMinor - providerCostMinor);
    if (commissionMinor > 0) {
      await createFinancialEvent({
        eventType: FinancialEventType.PROVIDER_COMMISSION,
        sourceType: FinancialSourceType.BOOKING,
        sourceId: booking._id,
        bookingId: booking._id,
        providerId: booking.providerId,
        amountMinor: commissionMinor,
        direction: FinancialDirection.INFLOW,
        idempotencyKey: `provider-commission:${booking._id.toString()}`,
        metadata: {
          grossMinor,
          discountMinor,
          providerCostMinor,
          commissionSnapshot: true,
        },
      });
    }
  }

  await rebuildBookingFinancialSnapshot(bookingId);
}

export async function postRefundLedger(refundId: string): Promise<void> {
  if (!(await isFinanceBiEnabled())) return;

  const refund = await BookingRefund.findById(refundId);
  if (!refund || refund.status !== 'COMPLETED') return;

  const amountMinor = toMinor(refund.amount);

  await createFinancialEvent({
    eventType: FinancialEventType.REFUND,
    sourceType: FinancialSourceType.REFUND,
    sourceId: refund._id,
    bookingId: refund.bookingId,
    amountMinor,
    direction: FinancialDirection.OUTFLOW,
    idempotencyKey: `refund:${refund.idempotencyKey}`,
    metadata: { claimId: refund.claimId?.toString() },
  });

  if (refund.bookingId) {
    await rebuildBookingFinancialSnapshot(refund.bookingId.toString());
  }
}

export async function enqueueFinanceOutbox(
  eventType: string,
  payload: Record<string, unknown>,
  idempotencyKey: string,
): Promise<void> {
  const { FinanceOutbox } = await import('@/models/Finance.js');
  try {
    await FinanceOutbox.create({ eventType, payload, idempotencyKey, status: 'PENDING' });
  } catch (err) {
    if (err instanceof Error && 'code' in err && (err as { code?: number }).code === 11000) {
      return;
    }
    throw err;
  }
}

export async function processFinanceOutbox(limit = 50): Promise<number> {
  const { FinanceOutbox } = await import('@/models/Finance.js');
  const pending = await FinanceOutbox.find({ status: 'PENDING' }).sort({ createdAt: 1 }).limit(limit);

  let processed = 0;
  for (const item of pending) {
    try {
      if (item.eventType === 'PAYMENT_COLLECTED') {
        await postPaymentCollectedLedger(
          item.payload.paymentId as string,
          item.payload.amountMajor as number,
        );
      } else if (item.eventType === 'SERVICE_REVENUE') {
        await postBookingServiceRevenue(item.payload.bookingId as string);
      } else if (item.eventType === 'REFUND') {
        await postRefundLedger(item.payload.refundId as string);
      }

      item.status = 'PROCESSED';
      item.processedAt = new Date();
      await item.save();
      processed += 1;
    } catch (err) {
      item.attempts += 1;
      item.lastError = err instanceof Error ? err.message : 'Unknown error';
      if (item.attempts >= 5) item.status = 'FAILED';
      await item.save();
    }
  }

  return processed;
}
