import { z } from 'zod';
import { objectIdSchema, paginationQuerySchema } from '@ghaarfix/validation';
import {
  ProviderCapacityStatus,
  ServiceZoneType,
  WaitlistStatus,
  WaitlistUrgency,
} from '@ghaarfix/shared-types';

export const cityBodySchema = z.object({
  name: z.string().trim().min(2).max(100),
  state: z.string().trim().min(2).max(100),
  country: z.string().trim().min(2).max(3).optional(),
  center: z
    .object({
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
    })
    .optional(),
  isActive: z.boolean().optional(),
});

export const serviceZoneBodySchema = z.object({
  name: z.string().trim().min(2).max(120),
  type: z.nativeEnum(ServiceZoneType),
  cityId: objectIdSchema,
  boundary: z
    .object({
      type: z.literal('Polygon'),
      coordinates: z.array(z.array(z.array(z.number()))),
    })
    .optional(),
  postalCodes: z.array(z.string().trim().min(3).max(10)).optional(),
  priority: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

export const serviceZoneQuerySchema = z.object({
  cityId: objectIdSchema.optional(),
  activeOnly: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? true : v === 'true')),
});

export const zoneResolveQuerySchema = z.object({
  city: z.string().trim().min(1).max(100).optional(),
  postalCode: z.string().trim().min(3).max(10).optional(),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
});

export const serviceAvailabilityQuerySchema = z.object({
  serviceZoneId: objectIdSchema,
});

export const waitlistBodySchema = z.object({
  serviceId: objectIdSchema,
  serviceZoneId: objectIdSchema,
  addressId: objectIdSchema,
  urgency: z.nativeEnum(WaitlistUrgency).optional(),
  preferredDate: z.string().optional(),
  notes: z.string().trim().max(500).optional(),
});

export const waitlistIdParamSchema = z.object({
  id: objectIdSchema,
});

export const providerCapacityPatchSchema = z.object({
  maxDailyJobs: z.number().int().min(1).max(50).optional(),
  status: z.nativeEnum(ProviderCapacityStatus).optional(),
});

export const zoneDemandQuerySchema = z.object({
  serviceZoneId: objectIdSchema.optional(),
  days: z.coerce.number().int().min(1).max(90).optional().default(7),
});

export const waitlistAdminQuerySchema = paginationQuerySchema.extend({
  serviceZoneId: objectIdSchema.optional(),
  status: z.nativeEnum(WaitlistStatus).optional(),
});

export const zoneAvailabilityBodySchema = z.object({
  serviceZoneId: objectIdSchema,
  serviceId: objectIdSchema,
  isAvailable: z.boolean(),
  capacityHint: z.number().int().min(0).optional(),
  notes: z.string().trim().max(300).optional(),
});
