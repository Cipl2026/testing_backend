import { PaymentStatus } from '@ghaarfix/shared-types';
import type { Booking } from '@/models/Booking.js';
import type { Payment } from '@/models/Payment.js';
import { tryCreateProviderSettlement } from '@/modules/settlements/provider-settlement.service.js';

export async function markBookingPaidForSettlement(
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

  await tryCreateProviderSettlement(booking._id.toString());
}

export async function onBookingCompletedAndPaid(bookingId: string) {
  await tryCreateProviderSettlement(bookingId);
}
