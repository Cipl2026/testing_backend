import {
  BillingInterval,
  ErrorCode,
  PlanScopeType,
  SubscriptionChangeType,
  SubscriptionPlanStatus,
  SubscriptionStatus,
} from '@ghaarfix/shared-types';
import { DateTime } from 'luxon';
import { Subscription, SubscriptionHome } from '@/models/Subscription.js';
import {
  SubscriptionPlan,
  SubscriptionPlanPrice,
  SubscriptionPlanVersion,
} from '@/models/SubscriptionPlan.js';
import { PlanBenefit } from '@/models/PlanBenefit.js';
import { Home } from '@/models/Home.js';
import * as entitlementService from '@/modules/care-plans/entitlement.service.js';
import * as billingService from '@/modules/care-plans/subscription-billing.service.js';
import { SubscriptionChange } from '@/models/SubscriptionBilling.js';
import { AppError } from '@/utils/AppError.js';
import { slugify } from '@/utils/catalog.js';

function periodEndFrom(start: Date, interval: BillingInterval): Date {
  const dt = DateTime.fromJSDate(start);
  return interval === BillingInterval.YEARLY
    ? dt.plus({ years: 1 }).toJSDate()
    : dt.plus({ months: 1 }).toJSDate();
}

function serializeSubscription(sub: InstanceType<typeof Subscription>, homeIds: string[] = []) {
  return {
    id: sub._id.toString(),
    customerId: sub.customerId.toString(),
    planId: sub.planId.toString(),
    planVersionId: sub.planVersionId.toString(),
    scopeType: sub.scopeType,
    status: sub.status,
    billingInterval: sub.billingInterval,
    priceSnapshot: sub.priceSnapshot,
    startedAt: sub.startedAt,
    currentPeriodStart: sub.currentPeriodStart,
    currentPeriodEnd: sub.currentPeriodEnd,
    nextBillingAt: sub.nextBillingAt,
    cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
    pausedAt: sub.pausedAt,
    homeIds,
  };
}

export async function listActiveCarePlans() {
  const plans = await SubscriptionPlan.find({ status: SubscriptionPlanStatus.ACTIVE }).sort({ name: 1 });
  const result = [];
  for (const plan of plans) {
    const prices = await SubscriptionPlanPrice.find({ planId: plan._id, isActive: true });
    const benefits = await PlanBenefit.find({
      planId: plan._id,
      planVersionId: (
        await SubscriptionPlanVersion.findOne({ planId: plan._id, version: plan.currentVersion })
      )?._id,
      isActive: true,
    });
    result.push({
      id: plan._id.toString(),
      name: plan.name,
      slug: plan.slug,
      description: plan.description,
      scopeType: plan.scopeType,
      maxHomes: plan.maxHomes,
      supportedZones: plan.supportedZones,
      prices: prices.map((p) => ({
        billingInterval: p.billingInterval,
        amount: p.amount,
        currency: p.currency,
      })),
      benefits: benefits.map((b) => ({
        type: b.type,
        quantity: b.quantity,
        period: b.period,
        label: b.label,
      })),
    });
  }
  return result;
}

export async function getCarePlanBySlug(slug: string) {
  const plan = await SubscriptionPlan.findOne({ slug, status: SubscriptionPlanStatus.ACTIVE });
  if (!plan) throw new AppError('Care plan not found.', 404, ErrorCode.NOT_FOUND);
  const [prices, version] = await Promise.all([
    SubscriptionPlanPrice.find({ planId: plan._id, isActive: true }),
    SubscriptionPlanVersion.findOne({ planId: plan._id, version: plan.currentVersion }),
  ]);
  const benefits = version
    ? await PlanBenefit.find({ planVersionId: version._id, isActive: true })
    : [];
  return {
    id: plan._id.toString(),
    name: plan.name,
    slug: plan.slug,
    description: plan.description,
    scopeType: plan.scopeType,
    maxHomes: plan.maxHomes,
    supportedZones: plan.supportedZones,
    version: plan.currentVersion,
    prices: prices.map((p) => ({
      billingInterval: p.billingInterval,
      amount: p.amount,
      currency: p.currency,
    })),
    benefits: benefits.map((b) => ({
      id: b._id.toString(),
      type: b.type,
      quantity: b.quantity,
      period: b.period,
      label: b.label,
      serviceId: b.serviceId?.toString(),
      categoryId: b.categoryId?.toString(),
    })),
  };
}

export async function recommendCarePlan(customerId: string, homeId?: string) {
  const plans = await listActiveCarePlans();
  if (plans.length === 0) return { recommended: null, reason: 'No plans available' };

  let reason = 'Popular plan for home maintenance in your area.';
  if (homeId) {
    const home = await Home.findOne({ _id: homeId, customerId });
    if (home) reason = `Recommended because ${home.name} has recurring maintenance needs.`;
  }

  const parentsPlan = plans.find((p) => p.slug.includes('parents'));
  const homePlan = plans.find((p) => p.scopeType === PlanScopeType.HOME);
  const recommended = parentsPlan ?? homePlan ?? plans[0];

  return { recommended, reason };
}

async function validateHomesForPlan(
  customerId: string,
  plan: InstanceType<typeof SubscriptionPlan>,
  homeIds: string[],
) {
  if (plan.scopeType === PlanScopeType.CUSTOMER) return;

  if (plan.scopeType === PlanScopeType.HOME && homeIds.length !== 1) {
    throw new AppError('This plan requires exactly one home.', 400, ErrorCode.VALIDATION_ERROR);
  }

  const max = plan.maxHomes ?? (plan.scopeType === PlanScopeType.MULTI_HOME ? 3 : 1);
  if (homeIds.length === 0 || homeIds.length > max) {
    throw new AppError(`Select between 1 and ${max} homes for this plan.`, 400, ErrorCode.VALIDATION_ERROR);
  }

  for (const homeId of homeIds) {
    const home = await Home.findOne({ _id: homeId, customerId, isArchived: false });
    if (!home) throw new AppError('Invalid home selection.', 400, ErrorCode.VALIDATION_ERROR);
  }
}

export async function createSubscription(
  customerId: string,
  input: {
    planSlug: string;
    billingInterval: BillingInterval;
    homeIds?: string[];
    idempotencyKey?: string;
  },
) {
  const plan = await SubscriptionPlan.findOne({
    slug: input.planSlug,
    status: SubscriptionPlanStatus.ACTIVE,
  });
  if (!plan) throw new AppError('Care plan not found.', 404, ErrorCode.NOT_FOUND);

  const version = await SubscriptionPlanVersion.findOne({
    planId: plan._id,
    version: plan.currentVersion,
  });
  if (!version) throw new AppError('Plan version not found.', 500, ErrorCode.INTERNAL_ERROR);

  const price = await SubscriptionPlanPrice.findOne({
    planId: plan._id,
    billingInterval: input.billingInterval,
    isActive: true,
  });
  if (!price) throw new AppError('Price not configured for billing interval.', 400, ErrorCode.VALIDATION_ERROR);

  const homeIds = input.homeIds ?? [];
  await validateHomesForPlan(customerId, plan, homeIds);

  const existingActive = await Subscription.findOne({
    customerId,
    planId: plan._id,
    status: { $in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.PENDING, SubscriptionStatus.PAST_DUE] },
  });
  if (existingActive) {
    throw new AppError('You already have an active subscription for this plan.', 409, ErrorCode.CONFLICT);
  }

  const subscription = await Subscription.create({
    customerId,
    planId: plan._id,
    planVersionId: version._id,
    scopeType: plan.scopeType,
    status: SubscriptionStatus.PENDING,
    billingInterval: input.billingInterval,
    priceSnapshot: { amount: price.amount, currency: price.currency },
    cancelAtPeriodEnd: false,
    pauseCount: 0,
  });

  for (const homeId of homeIds) {
    await SubscriptionHome.create({ subscriptionId: subscription._id, homeId });
  }

  const payment = await billingService.createInitialInvoiceAndPayment(
    subscription._id.toString(),
    customerId,
    input.idempotencyKey,
  );

  const refreshed = await Subscription.findById(subscription._id);
  const activeHomes = await SubscriptionHome.find({ subscriptionId: subscription._id, status: 'ACTIVE' });

  return {
    subscription: serializeSubscription(
      refreshed ?? subscription,
      activeHomes.map((h) => h.homeId.toString()),
    ),
    payment,
  };
}

export async function activateSubscription(subscriptionId: string, paymentReference?: string) {
  const subscription = await Subscription.findById(subscriptionId);
  if (!subscription) throw new AppError('Subscription not found.', 404, ErrorCode.NOT_FOUND);
  if (subscription.status === SubscriptionStatus.ACTIVE) return serializeSubscription(subscription);

  const now = new Date();
  const periodEnd = periodEndFrom(now, subscription.billingInterval);

  subscription.status = SubscriptionStatus.ACTIVE;
  subscription.startedAt = now;
  subscription.currentPeriodStart = now;
  subscription.currentPeriodEnd = periodEnd;
  subscription.nextBillingAt = periodEnd;
  await subscription.save();

  await billingService.markInvoicePaid(subscriptionId, paymentReference);
  await entitlementService.generateEntitlementsForSubscription(subscriptionId);

  const homes = await SubscriptionHome.find({ subscriptionId, status: 'ACTIVE' });
  return serializeSubscription(
    subscription,
    homes.map((h) => h.homeId.toString()),
  );
}

export async function getCustomerSubscriptions(customerId: string) {
  const subs = await Subscription.find({ customerId }).sort({ createdAt: -1 });
  const result = [];
  for (const sub of subs) {
    const homes = await SubscriptionHome.find({ subscriptionId: sub._id, status: 'ACTIVE' });
    result.push(serializeSubscription(sub, homes.map((h) => h.homeId.toString())));
  }
  return result;
}

export async function getSubscriptionDetail(customerId: string, subscriptionId: string) {
  const sub = await Subscription.findOne({ _id: subscriptionId, customerId });
  if (!sub) throw new AppError('Subscription not found.', 404, ErrorCode.NOT_FOUND);
  const homes = await SubscriptionHome.find({ subscriptionId: sub._id, status: 'ACTIVE' });
  const entitlements = await entitlementService.listSubscriptionEntitlements(customerId, subscriptionId);
  const plan = await SubscriptionPlan.findById(sub.planId);
  return {
    ...serializeSubscription(sub, homes.map((h) => h.homeId.toString())),
    planName: plan?.name,
    planSlug: plan?.slug,
    entitlements,
  };
}

export async function cancelSubscription(
  customerId: string,
  subscriptionId: string,
  immediate = false,
) {
  const sub = await Subscription.findOne({ _id: subscriptionId, customerId });
  if (!sub) throw new AppError('Subscription not found.', 404, ErrorCode.NOT_FOUND);

  if (immediate) {
    sub.status = SubscriptionStatus.CANCELLED;
    sub.cancelledAt = new Date();
    await sub.save();
    await entitlementService.suspendEntitlements(subscriptionId);
  } else {
    sub.cancelAtPeriodEnd = true;
    await sub.save();
  }

  await SubscriptionChange.create({
    subscriptionId: sub._id,
    type: SubscriptionChangeType.CANCEL,
    effectiveAt: immediate ? new Date() : (sub.currentPeriodEnd ?? new Date()),
    reason: immediate ? 'Immediate cancellation' : 'Cancel at period end',
    createdBy: customerId,
  });

  return serializeSubscription(sub);
}

export async function pauseSubscription(customerId: string, subscriptionId: string) {
  const sub = await Subscription.findOne({ _id: subscriptionId, customerId, status: SubscriptionStatus.ACTIVE });
  if (!sub) throw new AppError('Subscription not active.', 409, ErrorCode.CONFLICT);
  if (sub.pauseCount >= 2) {
    throw new AppError('Pause limit reached for this subscription.', 409, ErrorCode.CONFLICT);
  }

  sub.status = SubscriptionStatus.PAUSED;
  sub.pausedAt = new Date();
  sub.pauseCount += 1;
  await sub.save();
  await entitlementService.suspendEntitlements(subscriptionId);

  await SubscriptionChange.create({
    subscriptionId: sub._id,
    type: SubscriptionChangeType.PAUSE,
    effectiveAt: new Date(),
    createdBy: customerId,
  });

  return serializeSubscription(sub);
}

export async function resumeSubscription(customerId: string, subscriptionId: string) {
  const sub = await Subscription.findOne({ _id: subscriptionId, customerId, status: SubscriptionStatus.PAUSED });
  if (!sub) throw new AppError('Subscription is not paused.', 409, ErrorCode.CONFLICT);

  sub.status = SubscriptionStatus.ACTIVE;
  sub.resumeAt = new Date();
  sub.pausedAt = undefined;
  await sub.save();
  await entitlementService.reactivateEntitlements(subscriptionId);

  await SubscriptionChange.create({
    subscriptionId: sub._id,
    type: SubscriptionChangeType.RESUME,
    effectiveAt: new Date(),
    createdBy: customerId,
  });

  return serializeSubscription(sub);
}

export { slugify };
