import {
  ErrorCode,
  SubscriptionInvoiceStatus,
  SubscriptionPaymentAttemptStatus,
  SubscriptionStatus,
} from '@ghaarfix/shared-types';
import { DateTime } from 'luxon';
import { Subscription } from '@/models/Subscription.js';
import {
  SubscriptionInvoice,
  SubscriptionPaymentAttempt,
} from '@/models/SubscriptionBilling.js';
import { getPaymentGateway } from '@/modules/payments/payment-gateway.js';
import * as subscriptionService from '@/modules/care-plans/subscription.service.js';
import { env } from '@/config/env.js';
import { AppError } from '@/utils/AppError.js';

const GRACE_PERIOD_DAYS = 7;
const MAX_PAYMENT_RETRIES = 3;

function generateInvoiceNumber(): string {
  return `SUB-${DateTime.now().toFormat('yyyyMMdd')}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

export async function createInitialInvoiceAndPayment(
  subscriptionId: string,
  customerId: string,
  idempotencyKey?: string,
) {
  const subscription = await Subscription.findById(subscriptionId);
  if (!subscription) throw new Error('Subscription not found');

  const now = new Date();
  const periodEnd =
    subscription.billingInterval === 'YEARLY'
      ? DateTime.fromJSDate(now).plus({ years: 1 }).toJSDate()
      : DateTime.fromJSDate(now).plus({ months: 1 }).toJSDate();

  const invoice = await SubscriptionInvoice.create({
    subscriptionId,
    invoiceNumber: generateInvoiceNumber(),
    periodStart: now,
    periodEnd,
    amount: subscription.priceSnapshot.amount,
    currency: subscription.priceSnapshot.currency,
    status: SubscriptionInvoiceStatus.OPEN,
    dueAt: now,
  });

  if (idempotencyKey) {
    const existing = await SubscriptionPaymentAttempt.findOne({ idempotencyKey });
    if (existing) {
      return { invoiceId: invoice._id.toString(), orderId: existing.providerOrderId, amount: existing.amount };
    }
  }

  const gateway = getPaymentGateway();
  const order = await gateway.createPayment({
    amount: invoice.amount,
    currency: invoice.currency,
    bookingId: subscriptionId,
    customerId,
  });

  const attempt = await SubscriptionPaymentAttempt.create({
    subscriptionId,
    invoiceId: invoice._id,
    amount: invoice.amount,
    currency: invoice.currency,
    status: SubscriptionPaymentAttemptStatus.PENDING,
    providerOrderId: order.orderId,
    attemptNumber: 1,
    idempotencyKey,
    metadata: { order },
  });

  if (!env.isProd) {
    await confirmSubscriptionPayment(subscriptionId, order.orderId);
  }

  return {
    invoiceId: invoice._id.toString(),
    attemptId: attempt._id.toString(),
    orderId: order.orderId,
    amount: invoice.amount,
    currency: invoice.currency,
    keyId: order.keyId,
  };
}

export async function confirmSubscriptionPayment(subscriptionId: string, providerOrderId: string) {
  const attempt = await SubscriptionPaymentAttempt.findOneAndUpdate(
    { subscriptionId, providerOrderId, status: SubscriptionPaymentAttemptStatus.PENDING },
    {
      status: SubscriptionPaymentAttemptStatus.SUCCEEDED,
      providerPaymentId: `pay_${providerOrderId}`,
    },
    { new: true },
  );
  if (!attempt) return null;

  await markInvoicePaid(subscriptionId, providerOrderId);
  return subscriptionService.activateSubscription(subscriptionId, providerOrderId);
}

export async function confirmCustomerSubscriptionPayment(
  customerId: string,
  subscriptionId: string,
  payload: Record<string, unknown>,
) {
  const subscription = await Subscription.findOne({ _id: subscriptionId, customerId });
  if (!subscription) throw new AppError('Subscription not found.', 404, ErrorCode.NOT_FOUND);
  if (subscription.status === SubscriptionStatus.ACTIVE) {
    return subscriptionService.getSubscriptionDetail(customerId, subscriptionId);
  }

  const gateway = getPaymentGateway();
  const verified = await gateway.verifyPayment(payload);
  if (!verified.valid) {
    throw new AppError('Payment verification failed.', 400, ErrorCode.PAYMENT_ERROR);
  }

  const orderId = String(payload.razorpay_order_id ?? '');
  const activated = await confirmSubscriptionPayment(subscriptionId, orderId);
  if (!activated) {
    throw new AppError('Payment could not be confirmed.', 400, ErrorCode.PAYMENT_ERROR);
  }
  return subscriptionService.getSubscriptionDetail(customerId, subscriptionId);
}

export async function markInvoicePaid(subscriptionId: string, paymentReference?: string) {
  const invoice = await SubscriptionInvoice.findOneAndUpdate(
    { subscriptionId, status: SubscriptionInvoiceStatus.OPEN },
    {
      status: SubscriptionInvoiceStatus.PAID,
      paidAt: new Date(),
      paymentReference,
    },
    { new: true },
  );
  return invoice;
}

export async function handlePaymentFailure(subscriptionId: string, errorMessage: string) {
  const subscription = await Subscription.findById(subscriptionId);
  if (!subscription) return;

  const attempts = await SubscriptionPaymentAttempt.countDocuments({
    subscriptionId,
    status: SubscriptionPaymentAttemptStatus.FAILED,
  });

  await SubscriptionPaymentAttempt.create({
    subscriptionId,
    invoiceId: (
      await SubscriptionInvoice.findOne({ subscriptionId, status: SubscriptionInvoiceStatus.OPEN })
    )?._id,
    amount: subscription.priceSnapshot.amount,
    currency: subscription.priceSnapshot.currency,
    status: SubscriptionPaymentAttemptStatus.FAILED,
    attemptNumber: attempts + 1,
    errorMessage,
  });

  if (attempts + 1 >= MAX_PAYMENT_RETRIES) {
    subscription.status = SubscriptionStatus.PAST_DUE;
    subscription.gracePeriodEndsAt = DateTime.now().plus({ days: GRACE_PERIOD_DAYS }).toJSDate();
    await subscription.save();
  }
}

export async function processRenewals() {
  const due = await Subscription.find({
    status: SubscriptionStatus.ACTIVE,
    nextBillingAt: { $lte: new Date() },
    cancelAtPeriodEnd: false,
  });

  let renewed = 0;
  for (const sub of due) {
    const invoice = await SubscriptionInvoice.create({
      subscriptionId: sub._id,
      invoiceNumber: generateInvoiceNumber(),
      periodStart: sub.currentPeriodEnd!,
      periodEnd:
        sub.billingInterval === 'YEARLY'
          ? DateTime.fromJSDate(sub.currentPeriodEnd!).plus({ years: 1 }).toJSDate()
          : DateTime.fromJSDate(sub.currentPeriodEnd!).plus({ months: 1 }).toJSDate(),
      amount: sub.priceSnapshot.amount,
      currency: sub.priceSnapshot.currency,
      status: SubscriptionInvoiceStatus.OPEN,
      dueAt: new Date(),
    });

    const gateway = getPaymentGateway();
    const order = await gateway.createPayment({
      amount: invoice.amount,
      currency: invoice.currency,
      bookingId: sub._id.toString(),
      customerId: sub.customerId.toString(),
    });

    if (!env.isProd) {
      sub.currentPeriodStart = invoice.periodStart;
      sub.currentPeriodEnd = invoice.periodEnd;
      sub.nextBillingAt = invoice.periodEnd;
      await sub.save();
      invoice.status = SubscriptionInvoiceStatus.PAID;
      invoice.paidAt = new Date();
      await invoice.save();
      await subscriptionService.activateSubscription(sub._id.toString(), order.orderId);
      renewed += 1;
    }
  }
  return renewed;
}

export async function processGracePeriodExpiry() {
  const expired = await Subscription.find({
    status: SubscriptionStatus.PAST_DUE,
    gracePeriodEndsAt: { $lte: new Date() },
  });

  let suspended = 0;
  for (const sub of expired) {
    sub.status = SubscriptionStatus.EXPIRED;
    await sub.save();
    const { suspendEntitlements } = await import('@/modules/care-plans/entitlement.service.js');
    await suspendEntitlements(sub._id.toString());
    suspended += 1;
  }
  return suspended;
}

export async function listSubscriptionInvoices(customerId: string, subscriptionId: string) {
  const sub = await Subscription.findOne({ _id: subscriptionId, customerId });
  if (!sub) return [];
  const invoices = await SubscriptionInvoice.find({ subscriptionId }).sort({ periodStart: -1 });
  return invoices.map((i) => ({
    id: i._id.toString(),
    invoiceNumber: i.invoiceNumber,
    amount: i.amount,
    currency: i.currency,
    status: i.status,
    periodStart: i.periodStart,
    periodEnd: i.periodEnd,
    paidAt: i.paidAt,
  }));
}

export { GRACE_PERIOD_DAYS, MAX_PAYMENT_RETRIES };
