import { BookingStatus, CustomerLifecycleState, DEFAULT_LIFECYCLE_THRESHOLDS } from '@ghaarfix/shared-types';
import { Booking } from '@/models/Booking.js';
import { Subscription } from '@/models/Subscription.js';
import { SubscriptionStatus } from '@ghaarfix/shared-types';
import {
  CustomerLifecycleSnapshot,
  LifecycleThresholdConfig,
} from '@/models/CustomerLifecycle.js';

export async function getLifecycleThresholds(): Promise<typeof DEFAULT_LIFECYCLE_THRESHOLDS> {
  const config = await LifecycleThresholdConfig.findOne({ key: 'global' });
  return (config?.thresholds as typeof DEFAULT_LIFECYCLE_THRESHOLDS) ?? DEFAULT_LIFECYCLE_THRESHOLDS;
}

export async function calculateCustomerLifecycle(customerId: string) {
  const thresholds = await getLifecycleThresholds();
  const completedBookings = await Booking.find({
    customerId,
    status: BookingStatus.COMPLETED,
  }).sort({ updatedAt: -1 });

  const count = completedBookings.length;
  const lastBooking = completedBookings[0];
  const daysSinceLast =
    lastBooking != null
      ? Math.floor((Date.now() - lastBooking.updatedAt.getTime()) / (24 * 60 * 60 * 1000))
      : null;

  const hasSubscription = await Subscription.exists({
    customerId,
    status: { $in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.PAST_DUE] },
  });

  let state = CustomerLifecycleState.NEW;
  let reason = 'Registered but no completed booking yet.';
  let confidence = 0.9;

  if (count === 0) {
    state = CustomerLifecycleState.NEW;
  } else if (count === 1) {
    state = CustomerLifecycleState.ACTIVATED;
    reason = 'First successful service completed.';
  } else if (
    daysSinceLast != null &&
    daysSinceLast >= thresholds.churnInactiveDays
  ) {
    state = CustomerLifecycleState.CHURNED;
    reason = `No activity for ${daysSinceLast} days (threshold: ${thresholds.churnInactiveDays}).`;
  } else if (
    daysSinceLast != null &&
    daysSinceLast >= thresholds.atRiskDaysSinceLastBooking
  ) {
    state = CustomerLifecycleState.AT_RISK;
    reason = `No booking in ${daysSinceLast} days; retention may be declining.`;
    confidence = 0.75;
  } else if (count >= thresholds.loyalBookingCount || hasSubscription) {
    state = CustomerLifecycleState.LOYAL;
    reason = hasSubscription
      ? 'Active subscription member with repeat engagement.'
      : `Completed ${count} services (loyal threshold: ${thresholds.loyalBookingCount}).`;
  } else if (count >= thresholds.repeatBookingCount) {
    state = CustomerLifecycleState.REPEAT;
    reason = `Completed ${count} services.`;
  } else {
    state = CustomerLifecycleState.ACTIVATED;
    reason = 'Early-stage customer with completed service.';
  }

  const existing = await CustomerLifecycleSnapshot.findOne({ customerId });
  const previousState = existing?.state;

  if (existing?.state === CustomerLifecycleState.CHURNED && count > 0 && daysSinceLast != null && daysSinceLast < thresholds.atRiskDaysSinceLastBooking) {
    state = CustomerLifecycleState.REACTIVATED;
    reason = 'Customer returned after churn period.';
  }

  return CustomerLifecycleSnapshot.findOneAndUpdate(
    { customerId },
    {
      customerId,
      state,
      previousState: previousState !== state ? previousState : existing?.previousState,
      reason,
      confidence,
      metadata: { completedBookings: count, daysSinceLastBooking: daysSinceLast },
      calculatedAt: new Date(),
    },
    { upsert: true, new: true },
  );
}

export async function calculateAllLifecycles(limit = 100): Promise<number> {
  const customerIds = await Booking.distinct('customerId', { status: BookingStatus.COMPLETED });
  let count = 0;
  for (const id of customerIds.slice(0, limit)) {
    await calculateCustomerLifecycle(id.toString());
    count += 1;
  }
  return count;
}

export async function getCustomerLifecycle(customerId: string) {
  const snap = await CustomerLifecycleSnapshot.findOne({ customerId });
  if (snap) return snap;
  return calculateCustomerLifecycle(customerId);
}

export async function getLifecycleOverview() {
  const rows = await CustomerLifecycleSnapshot.aggregate([
    { $group: { _id: '$state', count: { $sum: 1 } } },
  ]);
  return Object.fromEntries(rows.map((r) => [r._id, r.count]));
}
