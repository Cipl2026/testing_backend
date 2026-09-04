import { z } from 'zod';
import { objectIdSchema, paginationQuerySchema } from '@ghaarfix/validation';
import {
  BundlePricingMode,
  CampaignChannel,
  CampaignStatus,
  ExperimentStatus,
  ExperimentVariant,
  PromotionStatus,
  PromotionType,
  SeasonName,
} from '@ghaarfix/shared-types';

export const recommendationIdParamSchema = z.object({ id: objectIdSchema });
export const serviceIdParamSchema = z.object({ serviceId: objectIdSchema });
export const bookingIdParamSchema = z.object({ bookingId: objectIdSchema });
export const bundleIdParamSchema = z.object({ id: objectIdSchema });

export const searchQuerySchema = z.object({
  q: z.string().trim().min(1).max(120),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

export const searchSuggestionsQuerySchema = z.object({
  q: z.string().trim().min(1).max(120),
  limit: z.coerce.number().int().min(1).max(20).optional(),
});

export const recommendationsQuerySchema = z.object({
  homeId: objectIdSchema.optional(),
});

export const featuresQuerySchema = z.object({
  region: z.string().trim().max(80).optional(),
});

export const discoveryHomeQuerySchema = z.object({
  homeId: objectIdSchema.optional(),
  region: z.string().trim().max(80).optional(),
});

export const validatePromotionBodySchema = z.object({
  code: z.string().trim().min(2).max(40),
  orderAmount: z.number().min(0),
  serviceId: objectIdSchema.optional(),
  categoryId: objectIdSchema.optional(),
  region: z.string().trim().max(80).optional(),
});

export const redeemReferralBodySchema = z.object({
  code: z.string().trim().min(4).max(20),
});

export const promotionBodySchema = z.object({
  code: z.string().trim().min(2).max(40),
  type: z.nativeEnum(PromotionType),
  value: z.number().min(0),
  minimumOrder: z.number().min(0).optional(),
  maximumDiscount: z.number().min(0).optional(),
  serviceIds: z.array(objectIdSchema).optional(),
  categoryIds: z.array(objectIdSchema).optional(),
  regions: z.array(z.string()).optional(),
  usageLimit: z.number().int().min(1).optional(),
  perCustomerLimit: z.number().int().min(1).optional(),
  validFrom: z.coerce.date(),
  validTo: z.coerce.date(),
  status: z.nativeEnum(PromotionStatus).optional(),
});

export const serviceBundleBodySchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).optional(),
  serviceIds: z.array(objectIdSchema).min(1),
  pricingMode: z.nativeEnum(BundlePricingMode),
  discount: z.number().min(0).max(100).optional(),
  fixedPrice: z.number().min(0).optional(),
  isActive: z.boolean().optional(),
  validFrom: z.coerce.date(),
  validTo: z.coerce.date(),
});

export const featureFlagBodySchema = z.object({
  key: z.string().trim().min(2).max(80),
  description: z.string().trim().max(200).optional(),
  enabled: z.boolean().optional(),
  rules: z
    .array(
      z.object({
        type: z.enum(['global', 'percentage', 'whitelist', 'region']),
        percentage: z.number().min(0).max(100).optional(),
        customerIds: z.array(objectIdSchema).optional(),
        regions: z.array(z.string()).optional(),
      }),
    )
    .optional(),
});

export const experimentBodySchema = z.object({
  key: z.string().trim().min(2).max(80),
  name: z.string().trim().min(2).max(120),
  status: z.nativeEnum(ExperimentStatus).optional(),
  variants: z.array(z.nativeEnum(ExperimentVariant)).optional(),
  targeting: z
    .object({
      percentage: z.number().min(0).max(100).optional(),
      whitelist: z.array(objectIdSchema).optional(),
    })
    .optional(),
  startAt: z.coerce.date().optional(),
  endAt: z.coerce.date().optional(),
});

export const campaignBodySchema = z.object({
  name: z.string().trim().min(2).max(120),
  status: z.nativeEnum(CampaignStatus).optional(),
  channel: z.nativeEnum(CampaignChannel),
  serviceIds: z.array(objectIdSchema).optional(),
  regions: z.array(z.string()).optional(),
  audienceSegment: z.string().trim().min(2).max(80),
  startAt: z.coerce.date(),
  endAt: z.coerce.date(),
  message: z.string().trim().min(2).max(500),
});

export const searchSynonymBodySchema = z.object({
  term: z.string().trim().min(1).max(80),
  synonyms: z.array(z.string().trim().min(1).max(80)),
  isActive: z.boolean().optional(),
});

export const seasonalRuleBodySchema = z.object({
  name: z.string().trim().min(2).max(120),
  season: z.nativeEnum(SeasonName).optional(),
  serviceIds: z.array(objectIdSchema).optional(),
  regions: z.array(z.string()).optional(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  priority: z.number().int().optional(),
  message: z.string().trim().min(2).max(500),
  isActive: z.boolean().optional(),
});

export const adminGrowthListQuerySchema = paginationQuerySchema;
