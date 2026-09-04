import { PaymentStatus } from '@ghaarfix/shared-types';
import { Payment } from '@/models/Payment.js';
import { Booking } from '@/models/Booking.js';
import { BookingRefund } from '@/models/TrustProtection.js';
import { Subscription } from '@/models/Subscription.js';
import { listSubscriptionInvoices } from '@/modules/care-plans/subscription-billing.service.js';
import {
  bookingDiscountMajor,
  bookingGrossMinor,
  bookingTaxMajor,
} from '@/modules/finance/booking-finance.helpers.js';
import { fromMinor, toMinor } from '@/utils/money.js';

export async function getCustomerPaymentHistory(customerId: string) {
  const bookings = await Booking.find({ customerId })
    .sort({ createdAt: -1 })
    .limit(50)
    .select('bookingNumber price payment serviceSnapshot createdAt');

  const bookingIds = bookings.map((b) => b._id);
  const payments = await Payment.find({ bookingId: { $in: bookingIds } });

  const paymentMap = new Map(payments.map((p) => [p.bookingId.toString(), p]));

  return bookings.map((b) => {
    const payment = paymentMap.get(b._id.toString());
    const amountMinor = toMinor(b.price?.finalAmount ?? 0);
    return {
      bookingId: b._id.toString(),
      bookingNumber: b.bookingNumber,
      serviceName: b.serviceSnapshot?.name,
      amountMinor,
      amount: fromMinor(amountMinor),
      currency: b.price?.currency ?? 'INR',
      method: b.payment?.method,
      status: b.payment?.status ?? PaymentStatus.PENDING,
      paidAt: payment?.updatedAt?.toISOString(),
      gatewayReference: payment?.providerPaymentId,
    };
  });
}

export async function getCustomerRefunds(customerId: string) {
  const bookings = await Booking.find({ customerId }).select('_id bookingNumber');
  const bookingIds = bookings.map((b) => b._id);
  const refunds = await BookingRefund.find({ bookingId: { $in: bookingIds } }).sort({ createdAt: -1 });

  const bookingMap = new Map(bookings.map((b) => [b._id.toString(), b.bookingNumber]));

  return refunds.map((r) => ({
    id: r._id.toString(),
    bookingId: r.bookingId.toString(),
    bookingNumber: bookingMap.get(r.bookingId.toString()),
    amountMinor: toMinor(r.amount),
    amount: r.amount,
    currency: r.currency,
    status: r.status,
    createdAt: r.createdAt,
  }));
}

export async function getCustomerSubscriptionBilling(customerId: string) {
  const subscriptions = await Subscription.find({ customerId }).select('_id planId status');
  const items = [];
  for (const sub of subscriptions) {
    const invoices = await listSubscriptionInvoices(customerId, sub._id.toString());
    items.push({
      subscriptionId: sub._id.toString(),
      status: sub.status,
      invoices,
    });
  }
  return items;
}

export async function getCustomerChargeBreakdown(bookingId: string, customerId: string) {
  const booking = await Booking.findOne({ _id: bookingId, customerId });
  if (!booking) return null;

  const grossMinor = bookingGrossMinor(booking.price);
  const discountMinor = toMinor(bookingDiscountMajor(booking.price));
  const taxMinor = toMinor(bookingTaxMajor(booking.price));

  return {
    bookingNumber: booking.bookingNumber,
    serviceName: booking.serviceSnapshot?.name,
    currency: booking.price?.currency ?? 'INR',
    lines: [
      { label: 'Service charge', amountMinor: grossMinor + discountMinor - taxMinor },
      { label: 'Discount', amountMinor: -discountMinor },
      { label: 'Tax', amountMinor: taxMinor },
      { label: 'Total', amountMinor: grossMinor },
    ].map((l) => ({
      ...l,
      amount: fromMinor(Math.abs(l.amountMinor)) * (l.amountMinor < 0 ? -1 : 1),
    })),
    paymentStatus: booking.payment?.status,
    paymentMethod: booking.payment?.method,
  };
}
