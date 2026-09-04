import { ErrorCode } from '@ghaarfix/shared-types';
import { Payment } from '@/models/Payment.js';
import { BookingRefund } from '@/models/TrustProtection.js';
import { Booking } from '@/models/Booking.js';
import { AppError } from '@/utils/AppError.js';
import { getPaymentGateway } from '@/modules/payments/payment-gateway.js';
import { AdminAuditLog } from '@/models/AdminAuditLog.js';

export async function processBookingRefund(input: {
  bookingId: string;
  claimId?: string;
  amount: number;
  idempotencyKey: string;
  processedBy: string;
}) {
  const existing = await BookingRefund.findOne({ idempotencyKey: input.idempotencyKey });
  if (existing) return existing;

  const booking = await Booking.findById(input.bookingId);
  if (!booking) throw new AppError('Booking not found.', 404, ErrorCode.NOT_FOUND);

  if (input.amount > booking.price.finalAmount) {
    throw new AppError('Refund amount exceeds booking total.', 400, ErrorCode.VALIDATION_ERROR);
  }

  const payment = await Payment.findOne({ bookingId: input.bookingId }).sort({ createdAt: -1 });
  let providerRefundId: string | undefined;
  let status = 'PENDING';

  if (payment?.providerPaymentId && input.amount > 0) {
    try {
      const gateway = getPaymentGateway();
      await gateway.refundPayment(payment.providerPaymentId, input.amount);
      providerRefundId = payment.providerPaymentId;
      status = 'COMPLETED';
    } catch {
      status = 'FAILED';
    }
  } else if (input.amount === 0) {
    status = 'COMPLETED';
  }

  const refund = await BookingRefund.create({
    bookingId: input.bookingId,
    claimId: input.claimId,
    amount: input.amount,
    currency: booking.price?.currency ?? 'INR',
    idempotencyKey: input.idempotencyKey,
    providerRefundId,
    status,
    processedBy: input.processedBy,
  });

  await AdminAuditLog.create({
    adminId: input.processedBy,
    action: 'BOOKING_REFUND',
    entityType: 'BookingRefund',
    entityId: refund._id,
    after: { amount: input.amount, status },
    reason: `Refund for booking ${input.bookingId}`,
  });

  void import('@/modules/finance/finance-integration.service.js').then((m) =>
    m.enqueueFinanceOutbox(
      'REFUND',
      { refundId: refund._id.toString() },
      `outbox:refund:${refund.idempotencyKey}`,
    ),
  );

  return refund;
}
