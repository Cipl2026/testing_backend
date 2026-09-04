import { z } from 'zod';
import { objectIdSchema } from '@ghaarfix/validation';
import { PaymentMethod, ProviderRecommendationType } from '@ghaarfix/shared-types';

export const productSlugParamSchema = z.object({ slug: z.string().min(1) });
export const orderIdParamSchema = z.object({ id: objectIdSchema });
export const partnerIdParamSchema = z.object({ partnerId: objectIdSchema });

export const addToCartBodySchema = z.object({
  variantId: objectIdSchema,
  partnerId: objectIdSchema,
  quantity: z.number().int().min(1).max(10),
  includeInstallation: z.boolean().optional(),
  assetId: objectIdSchema.optional(),
});

export const createOrderBodySchema = z.object({
  addressId: objectIdSchema,
  paymentMethod: z.nativeEnum(PaymentMethod),
  idempotencyKey: z.string().min(8).max(100).optional(),
  assetId: objectIdSchema.optional(),
});

export const compatibilityCheckBodySchema = z.object({
  variantId: objectIdSchema,
  assetId: objectIdSchema.optional(),
  homeId: objectIdSchema.optional(),
});

export const createReturnBodySchema = z.object({
  orderId: objectIdSchema,
  items: z.array(z.object({ orderItemId: objectIdSchema, quantity: z.number().int().min(1) })),
  reason: z.string().min(3).max(500),
  description: z.string().max(2000).optional(),
});

export const providerRecommendationBodySchema = z.object({
  bookingId: objectIdSchema,
  recommendationType: z.nativeEnum(ProviderRecommendationType),
  categoryId: objectIdSchema.optional(),
  productId: objectIdSchema.optional(),
  variantId: objectIdSchema.optional(),
  sparePartId: objectIdSchema.optional(),
  diagnosisSummary: z.string().min(5).max(1000),
  reason: z.string().min(5).max(500),
  assetId: objectIdSchema.optional(),
});

export const createProductBodySchema = z.object({
  name: z.string().min(2).max(200),
  brandId: objectIdSchema,
  categoryId: objectIdSchema.optional(),
  description: z.string().max(5000).optional(),
  isInstallable: z.boolean().optional(),
  requiresProfessionalInstallation: z.boolean().optional(),
  variants: z
    .array(
      z.object({
        sku: z.string().min(2).max(50),
        name: z.string().min(1).max(200),
        price: z.number().positive(),
        attributes: z.record(z.unknown()).optional(),
      }),
    )
    .min(1),
});

export const upsertInventoryBodySchema = z.object({
  variantId: objectIdSchema,
  serviceZoneId: objectIdSchema.optional(),
  availableQuantity: z.number().int().min(0),
  reorderLevel: z.number().int().min(0).optional(),
});

export const createBrandBodySchema = z.object({
  name: z.string().min(2).max(200),
  slug: z.string().min(2).max(100),
  website: z.string().url().optional(),
});

export const createCompatibilityRuleBodySchema = z.object({
  productVariantId: objectIdSchema,
  assetTypeId: objectIdSchema.optional(),
  brandId: objectIdSchema.optional(),
  modelPattern: z.string().optional(),
  compatibilityLevel: z.enum(['CONFIRMED', 'LIKELY', 'UNKNOWN', 'INCOMPATIBLE']),
  reason: z.string().min(5).max(500),
});

export const createCommissionRuleBodySchema = z.object({
  partnerId: objectIdSchema.optional(),
  categoryId: objectIdSchema.optional(),
  productId: objectIdSchema.optional(),
  commissionType: z.enum(['PERCENTAGE', 'FIXED', 'HYBRID']),
  value: z.number().min(0),
  fixedAmount: z.number().min(0).optional(),
});
