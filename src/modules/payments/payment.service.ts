import { ErrorCode, PaymentStatus } from '@ghaarfix/shared-types';
import { env } from '@/config/env.js';
import { Booking } from '@/models/Booking.js';
import { Payment } from '@/models/Payment.js';
import { findBookingForCustomer } from '@/modules/booking-participants/booking-participant.service.js';
import { listTimelineEvents } from '@/modules/bookings/timeline.service.js';
import { getPaymentGateway, type PaymentOrderResult } from '@/modules/payments/payment-gateway.js';
import { AppError } from '@/utils/AppError.js';
import { serializeBookingDetail } from '@/utils/bookingSerializers.js';

const UNPAID_STATUSES = new Set<PaymentStatus>([
  PaymentStatus.PENDING,
  PaymentStatus.FAILED,
  PaymentStatus.PAY_ON_SERVICE,
  PaymentStatus.CREATED,
]);

function assertRazorpayConfigured() {
  if (!env.razorpay.keyId || !env.razorpay.keySecret) {
    throw new AppError(
      'Online payments are not configured. Add Razorpay keys on the server or pay the professional directly.',
      503,
      ErrorCode.PAYMENT_ERROR,
    );
  }
}

async function markBookingPaid(
  booking: InstanceType<typeof Booking>,
  payment: InstanceType<typeof Payment>,
  payload: Record<string, unknown>,
  paymentId?: string,
) {
  payment.status = PaymentStatus.PAID;
  if (paymentId) payment.providerPaymentId = paymentId;
  payment.metadata = { ...payment.metadata, confirmation: payload };
  await payment.save();

  booking.payment.status = PaymentStatus.PAID;
  await booking.save();

  void import('@/modules/finance/finance-integration.service.js').then((m) =>
    m.enqueueFinanceOutbox(
      'PAYMENT_COLLECTED',
      {
        paymentId: payment._id.toString(),
        amountMajor: payment.amount,
      },
      `outbox:payment:${payment._id.toString()}`,
    ),
  );
}

export async function initiateBookingPayment(
  customerId: string,
  bookingId: string,
): Promise<PaymentOrderResult> {
  const booking = await findBookingForCustomer(customerId, bookingId);

  if (booking.payment.status === PaymentStatus.PAID) {
    throw new AppError('This booking is already paid.', 400, ErrorCode.VALIDATION_ERROR);
  }

  if (!UNPAID_STATUSES.has(booking.payment.status)) {
    throw new AppError('Payment cannot be initiated for this booking.', 400, ErrorCode.VALIDATION_ERROR);
  }

  const amount = booking.price.finalAmount;
  if (amount < 1) {
    const payment = await Payment.findOne({ bookingId: booking._id });
    if (!payment) {
      throw new AppError('Payment record not found.', 404, ErrorCode.NOT_FOUND);
    }
    await markBookingPaid(booking, payment, { waived: true, reason: 'zero_amount' });
    return {
      provider: 'internal',
      orderId: `free_${bookingId}`,
      amount: 0,
      currency: booking.price.currency,
    };
  }

  assertRazorpayConfigured();

  const payment = await Payment.findOne({ bookingId: booking._id });
  if (!payment) {
    throw new AppError('Payment record not found.', 404, ErrorCode.NOT_FOUND);
  }

  const gateway = getPaymentGateway();
  const order = await gateway.createPayment({
    amount,
    currency: booking.price.currency,
    bookingId: booking._id.toString(),
    customerId,
  });

  payment.provider = 'razorpay';
  payment.providerOrderId = order.orderId;
  payment.status = PaymentStatus.PENDING;
  payment.metadata = { ...(payment.metadata ?? {}), order };
  await payment.save();

  if (booking.payment.status === PaymentStatus.PAY_ON_SERVICE) {
    booking.payment.status = PaymentStatus.PENDING;
    await booking.save();
  }

  return order;
}

export async function confirmBookingPayment(
  customerId: string,
  bookingId: string,
  payload: Record<string, unknown>,
) {
  const booking = await findBookingForCustomer(customerId, bookingId);

  if (booking.payment.status === PaymentStatus.PAID) {
    const timeline = await listTimelineEvents(booking._id.toString());
    return serializeBookingDetail(booking, timeline);
  }

  if (!UNPAID_STATUSES.has(booking.payment.status)) {
    throw new AppError('This booking cannot be paid online.', 400, ErrorCode.VALIDATION_ERROR);
  }

  const payment = await Payment.findOne({ bookingId: booking._id });
  if (!payment) {
    throw new AppError('Payment record not found.', 404, ErrorCode.NOT_FOUND);
  }

  if (payload.dev === true || payload.provider === 'dev') {
    await markBookingPaid(booking, payment, payload, `dev_pay_${Date.now()}`);
    const timeline = await listTimelineEvents(booking._id.toString());
    return serializeBookingDetail(booking, timeline);
  }

  const gateway = getPaymentGateway();
  const verification = await gateway.verifyPayment(payload);
  if (!verification.valid) {
    payment.status = PaymentStatus.FAILED;
    await payment.save();
    booking.payment.status = PaymentStatus.FAILED;
    await booking.save();
    throw new AppError('Payment verification failed. Please try again.', 400, ErrorCode.PAYMENT_ERROR);
  }

  await markBookingPaid(booking, payment, payload, verification.paymentId);

  const timeline = await listTimelineEvents(booking._id.toString());
  return serializeBookingDetail(booking, timeline);
}

export async function confirmCashPayment(customerId: string, bookingId: string) {
  const booking = await findBookingForCustomer(customerId, bookingId);

  if (booking.payment.status === PaymentStatus.PAID) {
    const timeline = await listTimelineEvents(booking._id.toString());
    return serializeBookingDetail(booking, timeline);
  }

  const allowedStatuses = new Set([
    PaymentStatus.PENDING,
    PaymentStatus.PAY_ON_SERVICE,
    PaymentStatus.FAILED,
  ]);
  if (!allowedStatuses.has(booking.payment.status)) {
    throw new AppError('Cash payment cannot be recorded for this booking.', 400, ErrorCode.VALIDATION_ERROR);
  }

  const payment = await Payment.findOne({ bookingId: booking._id });
  if (!payment) {
    throw new AppError('Payment record not found.', 404, ErrorCode.NOT_FOUND);
  }

  await markBookingPaid(booking, payment, {
    method: 'CASH',
    confirmedBy: 'CUSTOMER',
    confirmedAt: new Date().toISOString(),
  });

  const timeline = await listTimelineEvents(booking._id.toString());
  return serializeBookingDetail(booking, timeline);
}

export async function handlePaymentWebhook(payload: Record<string, unknown>, signature: string) {
  const gateway = getPaymentGateway();
  const result = await gateway.handleWebhook(payload, signature);
  if (!result.orderId || result.status !== PaymentStatus.PAID) {
    return { handled: false };
  }

  const payment = await Payment.findOne({ providerOrderId: result.orderId });
  if (!payment) return { handled: false };

  if (payment.status === PaymentStatus.PAID) {
    return { handled: true, duplicate: true };
  }

  const booking = await Booking.findById(payment.bookingId);
  if (!booking) return { handled: false };

  await markBookingPaid(
    booking,
    payment,
    { webhook: true },
    result.paymentId,
  );

  return { handled: true, bookingId: payment.bookingId.toString() };
}
