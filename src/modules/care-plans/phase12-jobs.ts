import { Subscription } from '@/models/Subscription.js';
import { SubscriptionInvoice } from '@/models/SubscriptionBilling.js';
import * as billingService from '@/modules/care-plans/subscription-billing.service.js';
import * as entitlementService from '@/modules/care-plans/entitlement.service.js';
import { Entitlement } from '@/models/Entitlement.js';
import { logger } from '@/utils/logger.js';

export async function runSubscriptionRenewalJob(): Promise<number> {
  return billingService.processRenewals();
}

export async function runSubscriptionPaymentRetryJob(): Promise<number> {
  const pastDue = await Subscription.find({ status: 'PAST_DUE' });
  let retried = 0;
  for (const sub of pastDue) {
    const openInvoice = await SubscriptionInvoice.findOne({
      subscriptionId: sub._id,
      status: 'OPEN',
    });
    if (!openInvoice) continue;
    await billingService.handlePaymentFailure(sub._id.toString(), 'Scheduled retry');
    retried += 1;
  }
  return retried;
}

export async function runSubscriptionExpiryJob(): Promise<number> {
  return billingService.processGracePeriodExpiry();
}

export async function runEntitlementExpiryJob(): Promise<number> {
  const now = new Date();
  const result = await Entitlement.updateMany(
    { status: 'ACTIVE', expiresAt: { $lte: now } },
    { status: 'EXPIRED' },
  );
  return result.modifiedCount;
}

export async function runEntitlementReservationCleanupJob(): Promise<number> {
  return entitlementService.expireStaleReservations(15);
}

export async function runPhase12Jobs(): Promise<{
  renewals: number;
  paymentRetries: number;
  subscriptionExpiry: number;
  entitlementExpiry: number;
  reservationCleanup: number;
}> {
  const [renewals, paymentRetries, subscriptionExpiry, entitlementExpiry, reservationCleanup] =
    await Promise.all([
      runSubscriptionRenewalJob(),
      runSubscriptionPaymentRetryJob(),
      runSubscriptionExpiryJob(),
      runEntitlementExpiryJob(),
      runEntitlementReservationCleanupJob(),
    ]);

  if (
    renewals > 0 ||
    paymentRetries > 0 ||
    subscriptionExpiry > 0 ||
    entitlementExpiry > 0 ||
    reservationCleanup > 0
  ) {
    logger.info('Phase 12 care plan jobs completed', {
      renewals,
      paymentRetries,
      subscriptionExpiry,
      entitlementExpiry,
      reservationCleanup,
    });
  }

  return { renewals, paymentRetries, subscriptionExpiry, entitlementExpiry, reservationCleanup };
}
