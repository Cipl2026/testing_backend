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
import { Entitlement, EntitlementUsage } from '@/models/Entitlement.js';
import { Subscription, SubscriptionHome } from '@/models/Subscription.js';
import {
  SubscriptionChange,
  SubscriptionInvoice,
  SubscriptionPaymentAttempt,
} from '@/models/SubscriptionBilling.js';
import { logger } from '@/utils/logger.js';

async function ensureModelIndexes(): Promise<void> {
  await Promise.all([
    SubscriptionPlan.syncIndexes(),
    SubscriptionPlanVersion.syncIndexes(),
    SubscriptionPlanPrice.syncIndexes(),
    PlanBenefit.syncIndexes(),
    Subscription.syncIndexes(),
    SubscriptionHome.syncIndexes(),
    Entitlement.syncIndexes(),
    EntitlementUsage.syncIndexes(),
    SubscriptionInvoice.syncIndexes(),
    SubscriptionPaymentAttempt.syncIndexes(),
    SubscriptionChange.syncIndexes(),
  ]);
}

async function seedDefaultCarePlans(): Promise<number> {
  const count = await SubscriptionPlan.countDocuments();
  if (count > 0) return 0;

  const homeCarePlus = await SubscriptionPlan.create({
    name: 'Home Care Plus',
    slug: 'home-care-plus',
    description: 'Maintenance credits, repair discounts, and priority booking for one home.',
    status: SubscriptionPlanStatus.ACTIVE,
    scopeType: PlanScopeType.HOME,
    maxHomes: 1,
    supportedZones: [],
    currentVersion: 1,
  });

  const homeVersion = await SubscriptionPlanVersion.create({
    planId: homeCarePlus._id,
    version: 1,
    name: homeCarePlus.name,
    description: homeCarePlus.description,
    scopeType: homeCarePlus.scopeType,
    maxHomes: homeCarePlus.maxHomes,
    supportedZones: homeCarePlus.supportedZones,
    publishedAt: new Date(),
  });

  await PlanBenefit.create([
    {
      planId: homeCarePlus._id,
      planVersionId: homeVersion._id,
      type: PlanBenefitType.SERVICE_CREDIT,
      quantity: 2,
      period: BenefitPeriod.YEARLY,
      label: '2 AC maintenance services / year',
      isActive: true,
      priority: 1,
    },
    {
      planId: homeCarePlus._id,
      planVersionId: homeVersion._id,
      type: PlanBenefitType.DISCOUNT,
      quantity: 20,
      period: BenefitPeriod.PER_SUBSCRIPTION,
      label: '20% off eligible repairs',
      rules: { percent: 20 },
      isActive: true,
      priority: 2,
    },
    {
      planId: homeCarePlus._id,
      planVersionId: homeVersion._id,
      type: PlanBenefitType.PRIORITY_BOOKING,
      quantity: 1,
      period: BenefitPeriod.PER_SUBSCRIPTION,
      label: 'Priority booking',
      isActive: true,
      priority: 3,
    },
  ]);

  await SubscriptionPlanPrice.create([
    {
      planId: homeCarePlus._id,
      billingInterval: BillingInterval.MONTHLY,
      amount: 499,
      currency: 'INR',
      validFrom: new Date(),
      isActive: true,
    },
    {
      planId: homeCarePlus._id,
      billingInterval: BillingInterval.YEARLY,
      amount: 4999,
      currency: 'INR',
      validFrom: new Date(),
      isActive: true,
      metadata: { discountLabel: '2 months free' },
    },
  ]);

  const parentsPlan = await SubscriptionPlan.create({
    name: "Parents' Home Care",
    slug: 'parents-home-care',
    description:
      'Remote care for parents\' home — scheduled maintenance, family notifications, and priority support.',
    status: SubscriptionPlanStatus.ACTIVE,
    scopeType: PlanScopeType.FAMILY,
    maxHomes: 1,
    supportedZones: [],
    currentVersion: 1,
  });

  const parentsVersion = await SubscriptionPlanVersion.create({
    planId: parentsPlan._id,
    version: 1,
    name: parentsPlan.name,
    description: parentsPlan.description,
    scopeType: parentsPlan.scopeType,
    maxHomes: parentsPlan.maxHomes,
    supportedZones: parentsPlan.supportedZones,
    publishedAt: new Date(),
  });

  await PlanBenefit.create([
    {
      planId: parentsPlan._id,
      planVersionId: parentsVersion._id,
      type: PlanBenefitType.MAINTENANCE_COVERAGE,
      quantity: 4,
      period: BenefitPeriod.YEARLY,
      label: 'Scheduled maintenance visits',
      isActive: true,
      priority: 1,
    },
    {
      planId: parentsPlan._id,
      planVersionId: parentsVersion._id,
      type: PlanBenefitType.SUPPORT_PRIORITY,
      quantity: 1,
      period: BenefitPeriod.PER_SUBSCRIPTION,
      label: 'Priority family support',
      isActive: true,
      priority: 2,
    },
  ]);

  await SubscriptionPlanPrice.create([
    {
      planId: parentsPlan._id,
      billingInterval: BillingInterval.MONTHLY,
      amount: 699,
      currency: 'INR',
      validFrom: new Date(),
      isActive: true,
    },
    {
      planId: parentsPlan._id,
      billingInterval: BillingInterval.YEARLY,
      amount: 6999,
      currency: 'INR',
      validFrom: new Date(),
      isActive: true,
    },
  ]);

  const multiHome = await SubscriptionPlan.create({
    name: 'Multi-Home Care',
    slug: 'multi-home-care',
    description: 'Care benefits across up to 3 homes.',
    status: SubscriptionPlanStatus.ACTIVE,
    scopeType: PlanScopeType.MULTI_HOME,
    maxHomes: 3,
    supportedZones: [],
    currentVersion: 1,
  });

  const multiVersion = await SubscriptionPlanVersion.create({
    planId: multiHome._id,
    version: 1,
    name: multiHome.name,
    description: multiHome.description,
    scopeType: multiHome.scopeType,
    maxHomes: multiHome.maxHomes,
    supportedZones: multiHome.supportedZones,
    publishedAt: new Date(),
  });

  await PlanBenefit.create({
    planId: multiHome._id,
    planVersionId: multiVersion._id,
    type: PlanBenefitType.FREE_VISIT,
    quantity: 1,
    period: BenefitPeriod.YEARLY,
    label: '1 free visit per home / year',
    isActive: true,
    priority: 1,
  });

  await SubscriptionPlanPrice.create({
    planId: multiHome._id,
    billingInterval: BillingInterval.YEARLY,
    amount: 9999,
    currency: 'INR',
    validFrom: new Date(),
    isActive: true,
  });

  return 3;
}

export async function runPhase12Migrations(): Promise<void> {
  await ensureModelIndexes();
  const seeded = await seedDefaultCarePlans();
  if (seeded > 0) {
    logger.info('Phase 12 migration seeded default care plans', { count: seeded });
  }
}
