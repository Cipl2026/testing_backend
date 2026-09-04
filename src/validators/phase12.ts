import { z } from 'zod';
import { objectIdSchema, paginationQuerySchema } from '@ghaarfix/validation';
import {
  BenefitPeriod,
  BillingInterval,
  PlanBenefitType,
  PlanScopeType,
  SubscriptionStatus,
} from '@ghaarfix/shared-types';

export const planSlugParamSchema = z.object({ slug: z.string().trim().min(2).max(80) });
export const subscriptionIdParamSchema = z.object({ id: objectIdSchema });
export const entitlementIdParamSchema = z.object({ id: objectIdSchema });

export const carePlanRecommendationQuerySchema = z.object({
  homeId: objectIdSchema.optional(),
});

export const createSubscriptionBodySchema = z.object({
  planSlug: z.string().trim().min(2).max(80),
  billingInterval: z.nativeEnum(BillingInterval),
  homeIds: z.array(objectIdSchema).optional(),
});

export const cancelSubscriptionBodySchema = z.object({
  immediate: z.boolean().optional().default(false),
});

export const confirmSubscriptionPaymentBodySchema = z.object({
  razorpay_order_id: z.string().min(1),
  razorpay_payment_id: z.string().min(1),
  razorpay_signature: z.string().min(1),
});

export const changePlanBodySchema = z.object({
  newPlanSlug: z.string().trim().min(2).max(80),
  effectiveAtRenewal: z.boolean().optional().default(true),
});

export const eligibleEntitlementsQuerySchema = z.object({
  serviceId: objectIdSchema,
  homeId: objectIdSchema.optional(),
  categoryId: objectIdSchema.optional(),
});

export const reserveEntitlementBodySchema = z.object({
  bookingId: objectIdSchema,
  amountApplied: z.number().min(0).optional(),
});

export const createPlanBodySchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(2000).optional(),
  scopeType: z.nativeEnum(PlanScopeType),
  maxHomes: z.number().int().min(1).max(10).optional(),
  supportedZones: z.array(z.string()).optional(),
});

export const planPriceBodySchema = z.object({
  billingInterval: z.nativeEnum(BillingInterval),
  amount: z.number().min(0),
  currency: z.string().trim().min(3).max(3).default('INR'),
});

export const planBenefitBodySchema = z.object({
  type: z.nativeEnum(PlanBenefitType),
  quantity: z.number().min(0),
  period: z.nativeEnum(BenefitPeriod),
  label: z.string().trim().max(200).optional(),
  serviceId: objectIdSchema.optional(),
  categoryId: objectIdSchema.optional(),
  rules: z.record(z.unknown()).optional(),
});

export const adjustEntitlementBodySchema = z.object({
  entitlementId: objectIdSchema,
  delta: z.number().int(),
  reason: z.string().trim().min(3).max(500),
});

export const adminSubscriptionStatusBodySchema = z.object({
  status: z.nativeEnum(SubscriptionStatus),
  reason: z.string().trim().min(3).max(500),
});

export const adminSubscriptionsQuerySchema = paginationQuerySchema.extend({
  status: z.nativeEnum(SubscriptionStatus).optional(),
});
