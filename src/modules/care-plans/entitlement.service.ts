import {
  EntitlementOwnerType,
  EntitlementStatus,
  EntitlementUsageStatus,
  ErrorCode,
  PlanBenefitType,
  PlanScopeType,
  SubscriptionStatus,
} from '@ghaarfix/shared-types';
import { Entitlement, EntitlementAdjustment, EntitlementUsage } from '@/models/Entitlement.js';
import { PlanBenefit } from '@/models/PlanBenefit.js';
import { Subscription, SubscriptionHome } from '@/models/Subscription.js';
import { Home } from '@/models/Home.js';
import { HomeMember } from '@/models/HomeMember.js';
import { HomeMemberStatus } from '@ghaarfix/shared-types';
import { AppError } from '@/utils/AppError.js';

export function availableQuantity(ent: {
  totalQuantity: number;
  usedQuantity: number;
  reservedQuantity: number;
}): number {
  return Math.max(0, ent.totalQuantity - ent.usedQuantity - ent.reservedQuantity);
}

function serializeEntitlement(ent: InstanceType<typeof Entitlement>) {
  const avail = availableQuantity(ent);
  return {
    id: ent._id.toString(),
    subscriptionId: ent.subscriptionId.toString(),
    benefitId: ent.benefitId.toString(),
    ownerType: ent.ownerType,
    ownerId: ent.ownerId.toString(),
    type: ent.type,
    totalQuantity: ent.totalQuantity,
    usedQuantity: ent.usedQuantity,
    reservedQuantity: ent.reservedQuantity,
    availableQuantity: avail,
    periodStart: ent.periodStart,
    periodEnd: ent.periodEnd,
    expiresAt: ent.expiresAt,
    status: ent.status,
    label: ent.metadata?.label as string | undefined,
  };
}

export async function assertHomeAccess(customerId: string, homeId: string) {
  const home = await Home.findOne({ _id: homeId, isArchived: false });
  if (!home) throw new AppError('Home not found.', 404, ErrorCode.NOT_FOUND);
  if (home.customerId.toString() === customerId) return home;
  const member = await HomeMember.findOne({
    homeId,
    customerId,
    status: HomeMemberStatus.ACTIVE,
  });
  if (!member) throw new AppError('You do not have access to this home.', 403, ErrorCode.FORBIDDEN);
  return home;
}

export async function generateEntitlementsForSubscription(subscriptionId: string) {
  const subscription = await Subscription.findById(subscriptionId);
  if (!subscription) throw new AppError('Subscription not found.', 404, ErrorCode.NOT_FOUND);

  const benefits = await PlanBenefit.find({
    planVersionId: subscription.planVersionId,
    isActive: true,
  });

  const periodStart = subscription.currentPeriodStart ?? new Date();
  const periodEnd = subscription.currentPeriodEnd ?? new Date();

  const homes = await SubscriptionHome.find({
    subscriptionId: subscription._id,
    status: 'ACTIVE',
  });

  const owners: Array<{ ownerType: EntitlementOwnerType; ownerId: string }> = [];

  if (subscription.scopeType === PlanScopeType.CUSTOMER) {
    owners.push({ ownerType: EntitlementOwnerType.CUSTOMER, ownerId: subscription.customerId.toString() });
  } else {
    for (const sh of homes) {
      owners.push({ ownerType: EntitlementOwnerType.HOME, ownerId: sh.homeId.toString() });
    }
    if (owners.length === 0 && subscription.scopeType === PlanScopeType.HOME) {
      throw new AppError('Subscription requires a home.', 400, ErrorCode.VALIDATION_ERROR);
    }
  }

  const created = [];
  for (const benefit of benefits) {
    for (const owner of owners) {
      const existing = await Entitlement.findOne({
        subscriptionId: subscription._id,
        benefitId: benefit._id,
        ownerId: owner.ownerId,
        periodStart,
      });
      if (existing) {
        created.push(existing);
        continue;
      }
      const ent = await Entitlement.create({
        subscriptionId: subscription._id,
        benefitId: benefit._id,
        ownerType: owner.ownerType,
        ownerId: owner.ownerId,
        type: benefit.type,
        totalQuantity: benefit.quantity,
        usedQuantity: 0,
        reservedQuantity: 0,
        periodStart,
        periodEnd,
        expiresAt: periodEnd,
        status: EntitlementStatus.ACTIVE,
        metadata: { label: benefit.label, serviceId: benefit.serviceId?.toString() },
      });
      created.push(ent);
    }
  }
  return created.map(serializeEntitlement);
}

export async function listSubscriptionEntitlements(customerId: string, subscriptionId: string) {
  const subscription = await Subscription.findOne({ _id: subscriptionId, customerId });
  if (!subscription) throw new AppError('Subscription not found.', 404, ErrorCode.NOT_FOUND);
  const items = await Entitlement.find({ subscriptionId, status: { $ne: EntitlementStatus.EXPIRED } });
  return items.map(serializeEntitlement);
}

export async function listEligibleEntitlements(input: {
  customerId: string;
  serviceId: string;
  homeId?: string;
  categoryId?: string;
}) {
  const subs = await Subscription.find({
    customerId: input.customerId,
    status: { $in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.PAST_DUE] },
  });

  if (subs.length === 0) return [];

  const subIds = subs.map((s) => s._id);
  const entitlements = await Entitlement.find({
    subscriptionId: { $in: subIds },
    status: EntitlementStatus.ACTIVE,
    periodEnd: { $gte: new Date() },
  });

  const eligible = [];
  for (const ent of entitlements) {
    if (availableQuantity(ent) <= 0) continue;

    if (ent.ownerType === EntitlementOwnerType.HOME && input.homeId) {
      if (ent.ownerId.toString() !== input.homeId) continue;
      try {
        await assertHomeAccess(input.customerId, input.homeId);
      } catch {
        continue;
      }
    }

    const benefit = await PlanBenefit.findById(ent.benefitId);
    if (!benefit) continue;

    if (benefit.serviceId && benefit.serviceId.toString() !== input.serviceId) continue;
    if (benefit.categoryId && input.categoryId && benefit.categoryId.toString() !== input.categoryId) continue;

    if (
      ent.type === PlanBenefitType.SERVICE_CREDIT ||
      ent.type === PlanBenefitType.FREE_VISIT ||
      ent.type === PlanBenefitType.MAINTENANCE_COVERAGE
    ) {
      eligible.push(serializeEntitlement(ent));
    } else if (ent.type === PlanBenefitType.DISCOUNT) {
      eligible.push(serializeEntitlement(ent));
    }
  }
  return eligible;
}

export async function reserveEntitlement(
  customerId: string,
  entitlementId: string,
  bookingId: string,
  amountApplied?: number,
) {
  const ent = await Entitlement.findById(entitlementId);
  if (!ent) throw new AppError('Entitlement not found.', 404, ErrorCode.NOT_FOUND);

  const subscription = await Subscription.findOne({
    _id: ent.subscriptionId,
    customerId,
    status: { $in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.PAST_DUE] },
  });
  if (!subscription) throw new AppError('Subscription not active.', 409, ErrorCode.CONFLICT);

  if (ent.status !== EntitlementStatus.ACTIVE) {
    throw new AppError('Entitlement is not available.', 409, ErrorCode.CONFLICT);
  }
  if (availableQuantity(ent) < 1) {
    throw new AppError('No entitlement quantity remaining.', 409, ErrorCode.CONFLICT);
  }

  const existingUsage = await EntitlementUsage.findOne({ entitlementId, bookingId });
  if (existingUsage?.status === EntitlementUsageStatus.RESERVED) return existingUsage;
  if (existingUsage?.status === EntitlementUsageStatus.CONSUMED) return existingUsage;

  const updated = await Entitlement.findOneAndUpdate(
    {
      _id: entitlementId,
      status: EntitlementStatus.ACTIVE,
      $expr: {
        $gte: [
          { $subtract: ['$totalQuantity', { $add: ['$usedQuantity', '$reservedQuantity'] }] },
          1,
        ],
      },
    },
    { $inc: { reservedQuantity: 1 } },
    { new: true },
  );
  if (!updated) throw new AppError('Entitlement was just used by another booking.', 409, ErrorCode.CONFLICT);

  try {
    return await EntitlementUsage.create({
      entitlementId,
      bookingId,
      customerId,
      status: EntitlementUsageStatus.RESERVED,
      reservedAt: new Date(),
      amountApplied,
    });
  } catch (error) {
    await Entitlement.findOneAndUpdate(
      { _id: entitlementId, reservedQuantity: { $gte: 1 } },
      { $inc: { reservedQuantity: -1 } },
    );
    const raced = await EntitlementUsage.findOne({ entitlementId, bookingId });
    if (raced) return raced;
    throw error;
  }
}

export async function consumeEntitlement(entitlementId: string, bookingId: string) {
  const usage = await EntitlementUsage.findOne({ entitlementId, bookingId });
  if (!usage) return null;
  if (usage.status === EntitlementUsageStatus.CONSUMED) return usage;

  const ent = await Entitlement.findOneAndUpdate(
    {
      _id: entitlementId,
      reservedQuantity: { $gte: 1 },
    },
    { $inc: { reservedQuantity: -1, usedQuantity: 1 } },
    { new: true },
  );
  if (!ent) throw new AppError('Failed to consume entitlement.', 409, ErrorCode.CONFLICT);

  if (availableQuantity(ent) <= 0 && ent.usedQuantity >= ent.totalQuantity) {
    ent.status = EntitlementStatus.EXHAUSTED;
    await ent.save();
  }

  usage.status = EntitlementUsageStatus.CONSUMED;
  usage.consumedAt = new Date();
  await usage.save();
  return usage;
}

export async function releaseEntitlementReservation(entitlementId: string, bookingId: string) {
  const usage = await EntitlementUsage.findOne({
    entitlementId,
    bookingId,
    status: EntitlementUsageStatus.RESERVED,
  });
  if (!usage) return null;

  await Entitlement.findOneAndUpdate(
    { _id: entitlementId, reservedQuantity: { $gte: 1 } },
    { $inc: { reservedQuantity: -1 } },
  );

  usage.status = EntitlementUsageStatus.RELEASED;
  usage.releasedAt = new Date();
  await usage.save();
  return usage;
}

export async function adminAdjustEntitlement(
  adminId: string,
  entitlementId: string,
  delta: number,
  reason: string,
) {
  const ent = await Entitlement.findById(entitlementId);
  if (!ent) throw new AppError('Entitlement not found.', 404, ErrorCode.NOT_FOUND);

  const previous = ent.usedQuantity;
  const nextUsed = Math.max(0, Math.min(ent.totalQuantity, previous + delta));
  ent.usedQuantity = nextUsed;
  if (availableQuantity(ent) <= 0) ent.status = EntitlementStatus.EXHAUSTED;
  else if (ent.status === EntitlementStatus.EXHAUSTED) ent.status = EntitlementStatus.ACTIVE;
  await ent.save();

  await EntitlementAdjustment.create({
    entitlementId,
    adminId,
    delta,
    reason,
    previousUsedQuantity: previous,
    newUsedQuantity: nextUsed,
  });

  return serializeEntitlement(ent);
}

export async function expireStaleReservations(maxAgeMinutes = 15) {
  const cutoff = new Date(Date.now() - maxAgeMinutes * 60 * 1000);
  const stale = await EntitlementUsage.find({
    status: EntitlementUsageStatus.RESERVED,
    reservedAt: { $lt: cutoff },
  });
  let released = 0;
  for (const usage of stale) {
    await releaseEntitlementReservation(usage.entitlementId.toString(), usage.bookingId.toString());
    released += 1;
  }
  return released;
}

export async function suspendEntitlements(subscriptionId: string) {
  await Entitlement.updateMany(
    { subscriptionId, status: EntitlementStatus.ACTIVE },
    { status: EntitlementStatus.SUSPENDED },
  );
}

export async function reactivateEntitlements(subscriptionId: string) {
  await Entitlement.updateMany(
    { subscriptionId, status: EntitlementStatus.SUSPENDED },
    { status: EntitlementStatus.ACTIVE },
  );
}
