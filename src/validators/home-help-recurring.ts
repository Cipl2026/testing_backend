import { z } from 'zod';
import { objectIdSchema, paginationQuerySchema } from '@ghaarfix/validation';
import { HomeHelpRecurringPlanStatus } from '@/models/HomeHelpRecurringPlan.js';

export const recurringPlanIdParamSchema = z.object({
  planId: objectIdSchema,
});

export const cancelRecurringPlanBodySchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

export const adminRecurringPlanListQuerySchema = paginationQuerySchema.extend({
  status: z.nativeEnum(HomeHelpRecurringPlanStatus).optional(),
  customerId: objectIdSchema.optional(),
  providerId: objectIdSchema.optional(),
});

export const adminUpdateRecurringPlanBodySchema = z.object({
  status: z.nativeEnum(HomeHelpRecurringPlanStatus).optional(),
  providerId: objectIdSchema.optional(),
});
