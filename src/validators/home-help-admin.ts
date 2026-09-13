import { z } from 'zod';
import { objectIdSchema } from '@ghaarfix/validation';
import { homeHelpTaskSelectionSchema } from '@/validators/home-help.js';

export const homeHelpPackageIdParamSchema = z.object({ packageId: objectIdSchema });

export const homeHelpDurationPackageBodySchema = z.object({
  label: z.string().trim().min(2).max(80),
  durationMinutes: z.number().int().min(15).max(480),
  basePrice: z.number().min(0),
  currency: z.string().default('INR'),
  isActive: z.boolean().optional(),
  displayOrder: z.number().int().min(0).optional(),
});

export const homeHelpDurationPackageUpdateSchema = homeHelpDurationPackageBodySchema.partial();

export const homeHelpCompatibilityConfigBodySchema = z.object({
  maxTasksPerVisit: z.number().int().min(1).max(20).optional(),
  specialistExclusive: z.boolean().optional(),
  requireHomeHelpForMixedGroups: z.boolean().optional(),
  stackingRules: z.array(z.string().trim().min(3).max(200)).max(20).optional(),
});

export { homeHelpTaskSelectionSchema };
