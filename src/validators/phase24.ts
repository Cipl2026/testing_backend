import { z } from 'zod';
import { objectIdSchema } from '@ghaarfix/validation';
import { RegionType, RegionServiceAreaType } from '@ghaarfix/shared-types';

export const createRegionBodySchema = z.object({
  name: z.string().min(1),
  code: z.string().min(2).max(10),
  type: z.nativeEnum(RegionType),
  parentId: objectIdSchema.optional(),
  countryCode: z.string().length(2).optional(),
  timezone: z.string().min(1),
  currencyCode: z.string().length(3),
  locale: z.string().min(2),
  cityId: objectIdSchema.optional(),
  serviceZoneId: objectIdSchema.optional(),
});

export const updateRegionBodySchema = createRegionBodySchema
  .partial()
  .omit({ code: true, type: true });

export const regionConfigBodySchema = z.object({
  currency: z.string().length(3).optional(),
  timezone: z.string().optional(),
  defaultLocale: z.string().optional(),
  supportedLocales: z.array(z.string()).optional(),
  paymentMethods: z.array(z.string()).optional(),
  bookingPolicy: z.record(z.unknown()).optional(),
  featureFlags: z.record(z.boolean()).optional(),
});

export const createServiceAreaBodySchema = z.object({
  regionId: objectIdSchema,
  name: z.string().min(1),
  type: z.nativeEnum(RegionServiceAreaType),
  priority: z.number().int().optional(),
  postalCodes: z.array(z.string()).optional(),
  center: z.object({ latitude: z.number(), longitude: z.number() }).optional(),
  radiusMeters: z.number().positive().optional(),
  serviceZoneId: objectIdSchema.optional(),
});

export const createPartnerBodySchema = z.object({
  name: z.string().min(1),
  code: z.string().min(2),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().optional(),
});

export const createApiClientBodySchema = z.object({
  name: z.string().min(1),
  organizationId: objectIdSchema.optional(),
  partnerId: objectIdSchema.optional(),
  scopes: z.array(z.string()).min(1),
});

export const regionResolveQuerySchema = z.object({
  latitude: z.coerce.number().optional(),
  longitude: z.coerce.number().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  countryCode: z.string().optional(),
  postalCode: z.string().optional(),
});
