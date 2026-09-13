import { z } from 'zod';
import {
  HomeHelpCompatibilityGroup,
  PricingType,
  ProviderServiceApprovalStatus,
  ServiceProviderType,
} from '@ghaarfix/shared-types';
import { objectIdSchema, paginationQuerySchema } from '@ghaarfix/validation';

const catalogImageSchema = z
  .string()
  .trim()
  .min(1, 'Image is required')
  .refine(
    (value) =>
      value.startsWith('http://') ||
      value.startsWith('https://') ||
      value.startsWith('/api/'),
    'Image must be a valid URL or uploaded file path',
  );

const catalogImageOptionalSchema = z
  .string()
  .trim()
  .optional()
  .or(z.literal(''))
  .refine(
    (value) =>
      !value ||
      value.startsWith('http://') ||
      value.startsWith('https://') ||
      value.startsWith('/api/'),
    'Image must be a valid URL or uploaded file path',
  );

export const objectIdParamSchema = z.object({ id: objectIdSchema });

export const categoryIdParamSchema = z.object({ categoryId: objectIdSchema });

export const serviceIdParamSchema = z.object({ serviceId: objectIdSchema });

export const slugParamSchema = z.object({ slug: z.string().min(1).max(120) });

export const categoryBodySchema = z.object({
  name: z.string().trim().min(2).max(80),
  slug: z.string().trim().min(2).max(80).optional(),
  description: z.string().trim().max(500).optional(),
  image: catalogImageOptionalSchema,
  icon: z.string().trim().max(40).optional(),
  isActive: z.boolean().optional(),
  displayOrder: z.number().int().min(0).optional(),
});

export const categoryCreateBodySchema = categoryBodySchema.extend({
  image: catalogImageSchema,
});

export const subcategoryBodySchema = z.object({
  categoryId: objectIdSchema,
  name: z.string().trim().min(2).max(80),
  slug: z.string().trim().min(2).max(80).optional(),
  description: z.string().trim().max(500).optional(),
  image: catalogImageOptionalSchema,
  isActive: z.boolean().optional(),
  displayOrder: z.number().int().min(0).optional(),
});

export const subcategoryCreateBodySchema = subcategoryBodySchema.extend({
  image: catalogImageSchema,
});

const faqSchema = z.object({
  question: z.string().trim().min(3),
  answer: z.string().trim().min(3),
});

export const serviceBodySchema = z.object({
  categoryId: objectIdSchema,
  subcategoryId: objectIdSchema,
  name: z.string().trim().min(2).max(120),
  slug: z.string().trim().min(2).max(120).optional(),
  shortDescription: z.string().trim().max(200).optional(),
  description: z.string().trim().max(5000).optional(),
  image: catalogImageOptionalSchema,
  pricing: z.object({
    type: z.nativeEnum(PricingType),
    startingPrice: z.number().min(0).optional(),
    currency: z.string().default('INR'),
  }),
  estimatedDuration: z.object({
    minMinutes: z.number().int().min(1),
    maxMinutes: z.number().int().min(1),
  }),
  whatIsIncluded: z.array(z.string().trim().min(1)).max(20).optional(),
  whatIsNotIncluded: z.array(z.string().trim().min(1)).max(20).optional(),
  faqs: z.array(faqSchema).max(20).optional(),
  warranty: z
    .object({
      days: z.number().int().min(0).optional(),
      description: z.string().trim().max(500).optional(),
    })
    .optional(),
  isActive: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  displayOrder: z.number().int().min(0).optional(),
  providerType: z.nativeEnum(ServiceProviderType).optional(),
  hourlyEligible: z.boolean().optional(),
  instantEligible: z.boolean().optional(),
  compatibilityGroup: z.nativeEnum(HomeHelpCompatibilityGroup).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const serviceCreateBodySchema = serviceBodySchema.extend({
  image: catalogImageSchema,
});

export const serviceListQuerySchema = paginationQuerySchema.extend({
  categoryId: objectIdSchema.optional(),
  subcategoryId: objectIdSchema.optional(),
  serviceZoneId: objectIdSchema.optional(),
  providerType: z.nativeEnum(ServiceProviderType).optional(),
  hourlyEligible: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
  featured: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
  search: z.string().trim().min(1).max(80).optional(),
  sort: z.enum(['displayOrder', 'name', 'createdAt']).optional().default('displayOrder'),
});

export const searchQuerySchema = z.object({
  q: z.string().trim().min(1).max(80),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const providerServiceBodySchema = z.object({
  serviceId: objectIdSchema,
  experienceYears: z.number().int().min(0).max(60).optional(),
  description: z.string().trim().max(1000).optional(),
  customPricing: z
    .object({
      enabled: z.boolean().default(false),
      visitCharge: z.number().min(0).optional(),
      startingPrice: z.number().min(0).optional(),
      notes: z.string().trim().max(300).optional(),
    })
    .optional(),
});

export const providerServiceUpdateSchema = providerServiceBodySchema
  .partial()
  .extend({
    isActive: z.boolean().optional(),
    isUrgentEnabled: z.boolean().optional(),
  });

export const rejectProviderServiceSchema = z.object({
  reason: z.string().trim().min(3).max(500),
});

export const adminListQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(80).optional(),
  categoryId: objectIdSchema.optional(),
  approvalStatus: z.nativeEnum(ProviderServiceApprovalStatus).optional(),
});

export type ServiceListQuery = z.infer<typeof serviceListQuerySchema>;
export type SearchQuery = z.infer<typeof searchQuerySchema>;
export type AdminListQuery = z.infer<typeof adminListQuerySchema>;
