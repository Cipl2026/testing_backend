import {
  BenefitPeriod,
  BillingInterval,
  PlanBenefitType,
  PlanScopeType,
  SubscriptionPlanStatus,
} from '@ghaarfix/shared-types';
import {
  SubscriptionPlan,
  SubscriptionPlanPrice,
  SubscriptionPlanVersion,
} from '@/models/SubscriptionPlan.js';
import { PlanBenefit } from '@/models/PlanBenefit.js';
import { Subscription } from '@/models/Subscription.js';
import { Entitlement, EntitlementUsage } from '@/models/Entitlement.js';
import { SubscriptionInvoice, SubscriptionPaymentAttempt } from '@/models/SubscriptionBilling.js';
import * as entitlementService from '@/modules/care-plans/entitlement.service.js';
import { slugify } from '@/utils/catalog.js';

export async function listAllPlans() {
  return SubscriptionPlan.find().sort({ createdAt: -1 });
}

export async function createPlan(input: {
  name: string;
  description?: string;
  scopeType: PlanScopeType;
  maxHomes?: number;
  supportedZones?: string[];
}) {
  const slug = slugify(input.name);
  const plan = await SubscriptionPlan.create({
    name: input.name,
    slug,
    description: input.description,
    scopeType: input.scopeType,
    maxHomes: input.maxHomes,
    supportedZones: input.supportedZones ?? [],
    status: SubscriptionPlanStatus.DRAFT,
    currentVersion: 1,
  });

  const version = await SubscriptionPlanVersion.create({
    planId: plan._id,
    version: 1,
    name: plan.name,
    description: plan.description,
    scopeType: plan.scopeType,
    maxHomes: plan.maxHomes,
    supportedZones: plan.supportedZones,
    publishedAt: new Date(),
  });

  return { plan, version };
}

export async function publishPlanVersion(planId: string) {
  const plan = await SubscriptionPlan.findById(planId);
  if (!plan) throw new Error('Plan not found');

  const nextVersion = plan.currentVersion + 1;
  const version = await SubscriptionPlanVersion.create({
    planId: plan._id,
    version: nextVersion,
    name: plan.name,
    description: plan.description,
    scopeType: plan.scopeType,
    maxHomes: plan.maxHomes,
    supportedZones: plan.supportedZones,
    publishedAt: new Date(),
  });

  const prevBenefits = await PlanBenefit.find({
    planId: plan._id,
    planVersionId: (
      await SubscriptionPlanVersion.findOne({ planId: plan._id, version: plan.currentVersion })
    )?._id,
  });

  for (const b of prevBenefits) {
    await PlanBenefit.create({
      planId: plan._id,
      planVersionId: version._id,
      type: b.type,
      serviceId: b.serviceId,
      categoryId: b.categoryId,
      assetTypeId: b.assetTypeId,
      quantity: b.quantity,
      period: b.period,
      rules: b.rules,
      priority: b.priority,
      isActive: b.isActive,
      label: b.label,
    });
  }

  plan.currentVersion = nextVersion;
  await plan.save();
  return version;
}

export async function upsertPlanPrice(input: {
  planId: string;
  billingInterval: BillingInterval;
  amount: number;
  currency: string;
}) {
  await SubscriptionPlanPrice.updateMany(
    { planId: input.planId, billingInterval: input.billingInterval, isActive: true },
    { isActive: false, validTo: new Date() },
  );
  return SubscriptionPlanPrice.create({
    planId: input.planId,
    billingInterval: input.billingInterval,
    amount: input.amount,
    currency: input.currency,
    validFrom: new Date(),
    isActive: true,
  });
}

export async function addPlanBenefit(input: {
  planId: string;
  type: PlanBenefitType;
  quantity: number;
  period: BenefitPeriod;
  label?: string;
  serviceId?: string;
  categoryId?: string;
  rules?: Record<string, unknown>;
}) {
  const plan = await SubscriptionPlan.findById(input.planId);
  if (!plan) throw new Error('Plan not found');
  const version = await SubscriptionPlanVersion.findOne({
    planId: plan._id,
    version: plan.currentVersion,
  });
  if (!version) throw new Error('Plan version not found');

  return PlanBenefit.create({
    planId: plan._id,
    planVersionId: version._id,
    type: input.type,
    quantity: input.quantity,
    period: input.period,
    label: input.label,
    serviceId: input.serviceId,
    categoryId: input.categoryId,
    rules: input.rules,
    priority: 0,
    isActive: true,
  });
}

export async function activatePlan(planId: string) {
  return SubscriptionPlan.findByIdAndUpdate(
    planId,
    { status: SubscriptionPlanStatus.ACTIVE },
    { new: true },
  );
}

export async function listAdminSubscriptions(filters?: { status?: string }) {
  const query: Record<string, unknown> = {};
  if (filters?.status) query.status = filters.status;
  return Subscription.find(query).sort({ createdAt: -1 }).limit(200);
}

export async function getAdminSubscriptionDetail(subscriptionId: string) {
  const sub = await Subscription.findById(subscriptionId);
  if (!sub) return null;
  const [plan, entitlements, invoices, attempts, usage] = await Promise.all([
    SubscriptionPlan.findById(sub.planId),
    Entitlement.find({ subscriptionId }),
    SubscriptionInvoice.find({ subscriptionId }).sort({ periodStart: -1 }),
    SubscriptionPaymentAttempt.find({ subscriptionId }).sort({ createdAt: -1 }),
    EntitlementUsage.find({ entitlementId: { $in: (await Entitlement.find({ subscriptionId })).map((e) => e._id) } }),
  ]);
  return { subscription: sub, plan, entitlements, invoices, attempts, usage };
}

export async function getSubscriptionAnalytics() {
  const [activeCount, pastDue, mrrAgg] = await Promise.all([
    Subscription.countDocuments({ status: 'ACTIVE' }),
    Subscription.countDocuments({ status: 'PAST_DUE' }),
    Subscription.aggregate([
      { $match: { status: 'ACTIVE' } },
      {
        $group: {
          _id: null,
          mrr: {
            $sum: {
              $cond: [
                { $eq: ['$billingInterval', 'YEARLY'] },
                { $divide: ['$priceSnapshot.amount', 12] },
                '$priceSnapshot.amount',
              ],
            },
          },
        },
      },
    ]),
  ]);

  const mrr = mrrAgg[0]?.mrr ?? 0;
  return {
    activeSubscribers: activeCount,
    pastDue,
    mrr: Math.round(mrr),
    arr: Math.round(mrr * 12),
    entitlementUtilization: await Entitlement.aggregate([
      { $match: { status: 'ACTIVE' } },
      {
        $group: {
          _id: null,
          total: { $sum: '$totalQuantity' },
          used: { $sum: '$usedQuantity' },
        },
      },
    ]).then((r) => {
      const row = r[0];
      if (!row || row.total === 0) return 0;
      return Math.round((row.used / row.total) * 100);
    }),
  };
}

export { entitlementService };
