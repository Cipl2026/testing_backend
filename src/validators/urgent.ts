import { z } from 'zod';
import { PaymentMethod, QuickServicesBookingMode } from '@ghaarfix/shared-types';

export const quickServicesPayloadSchema = z
  .object({
    bookingMode: z.nativeEnum(QuickServicesBookingMode),
    photoUrls: z.array(z.string().min(1).max(2048)).max(3).optional(),
    recurring: z
      .object({
        frequency: z.enum(['daily', 'weekly', 'monthly', 'custom']),
        startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        preferredTime: z.string().regex(/^\d{2}:\d{2}$/),
        endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        untilCancelled: z.boolean().optional(),
      })
      .optional(),
  })
  .optional();

export const createUrgentRequestBodySchema = z
  .object({
    serviceId: z.string().min(1).optional(),
    customServiceName: z.string().trim().min(2).max(120).optional(),
    addressId: z.string().min(1),
    notes: z.string().max(500).optional(),
    paymentMethod: z.nativeEnum(PaymentMethod),
    quickServices: quickServicesPayloadSchema,
  })
  .refine((data) => Boolean(data.serviceId || data.customServiceName), {
    message: 'Select a service or describe what you need.',
    path: ['serviceId'],
  });

export const urgentRequestIdParamSchema = z.object({
  urgentRequestId: z.string().min(1),
});

export const cancelUrgentBodySchema = z.object({
  reason: z.string().max(500).optional(),
});

export const rejectUrgentBodySchema = z.object({
  reason: z.string().max(500).optional(),
  category: z.string().optional(),
});

export const presenceHeartbeatBodySchema = z.object({
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});

export const pushTokenBodySchema = z.object({
  token: z.string().min(1),
  platform: z.enum(['ios', 'android', 'unknown']).optional(),
  deviceId: z.string().optional(),
});

export const adminUrgentListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: z.string().optional(),
  search: z.string().optional(),
});

export type CreateUrgentRequestBody = z.infer<typeof createUrgentRequestBodySchema>;
