import { z } from 'zod';
import { HomeHelpTaskPriority, PaymentMethod } from '@ghaarfix/shared-types';
import { objectIdSchema } from '@ghaarfix/validation';

export const homeHelpTaskSelectionSchema = z.object({
  serviceId: z.string().min(1),
  priority: z.nativeEnum(HomeHelpTaskPriority).default(HomeHelpTaskPriority.MEDIUM),
  notes: z.string().max(200).optional(),
});

export const homeHelpQuoteBodySchema = z.object({
  durationPackageId: z.string().min(1),
  tasks: z.array(homeHelpTaskSelectionSchema).min(1).max(8),
  generalNotes: z.string().max(500).optional(),
});

export const homeHelpReservationBodySchema = homeHelpQuoteBodySchema.extend({
  providerId: z.string().min(1),
  addressId: z.string().min(1),
  startDateTime: z.string().datetime(),
  homeId: z.string().optional(),
});

export const homeHelpInstantBodySchema = homeHelpQuoteBodySchema.extend({
  addressId: z.string().min(1),
  paymentMethod: z.nativeEnum(PaymentMethod),
});

export const homeHelpProvidersQuerySchema = z.object({
  addressId: objectIdSchema,
  taskServiceIds: z
    .union([z.string().min(1), z.array(objectIdSchema)])
    .transform((value) => {
      if (Array.isArray(value)) return value;
      return value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
    }),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});
