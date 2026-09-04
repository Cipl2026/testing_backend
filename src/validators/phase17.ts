import { z } from 'zod';
import { objectIdSchema } from '@ghaarfix/validation';
import { ProviderShiftStatus } from '@ghaarfix/shared-types';

export const serviceIdParamSchema = z.object({ serviceId: objectIdSchema });
export const shiftIdParamSchema = z.object({ id: objectIdSchema });
export const opportunityIdParamSchema = z.object({ id: objectIdSchema });
export const expansionIdParamSchema = z.object({ id: objectIdSchema });

export const availabilityQuerySchema = z.object({
  zoneId: objectIdSchema.optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const waitTimeQuerySchema = z.object({
  zoneId: objectIdSchema,
  distanceKm: z.coerce.number().optional(),
  urgent: z.enum(['true', 'false']).optional(),
});

export const createShiftBodySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  preferredZones: z.array(objectIdSchema).optional(),
  capacityLimit: z.number().int().min(1).max(20).optional(),
  confirm: z.boolean().optional(),
});

export const updateShiftBodySchema = z.object({
  startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  preferredZones: z.array(objectIdSchema).optional(),
  capacityLimit: z.number().int().min(1).max(20).optional(),
  status: z.nativeEnum(ProviderShiftStatus).optional(),
  confirm: z.boolean().optional(),
});

export const launchPlanBodySchema = z.object({
  cityId: objectIdSchema,
  serviceId: objectIdSchema,
  notes: z.string().max(1000).optional(),
});

export const networkQuerySchema = z.object({
  zoneId: objectIdSchema.optional(),
  serviceId: objectIdSchema.optional(),
  cityId: objectIdSchema.optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});
