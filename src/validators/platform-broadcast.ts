import { z } from 'zod';
import { objectIdSchema } from '@ghaarfix/validation';

export const broadcastAudienceSchema = z.enum(['ALL_CUSTOMERS', 'ALL_PROVIDERS', 'ALL_USERS']);

export const sendPlatformNotificationBodySchema = z.object({
  title: z.string().trim().min(3).max(120),
  body: z.string().trim().min(3).max(500),
  audience: broadcastAudienceSchema,
  deepLink: z.string().trim().max(200).optional(),
});

export const sendTestPlatformNotificationBodySchema = z
  .object({
    phone: z.string().trim().min(10).max(15).optional(),
    userId: objectIdSchema.optional(),
    role: z.enum(['CUSTOMER', 'PROVIDER']).optional(),
    title: z.string().trim().min(3).max(120).optional(),
    body: z.string().trim().min(3).max(500).optional(),
    deepLink: z.string().trim().max(200).optional(),
    tier: z.enum(['default', 'emergency']).optional(),
  })
  .refine((value) => Boolean(value.phone || value.userId), {
    message: 'Provide a phone number or user ID.',
    path: ['phone'],
  });

export type SendPlatformNotificationBody = z.infer<typeof sendPlatformNotificationBodySchema>;
export type SendTestPlatformNotificationBody = z.infer<typeof sendTestPlatformNotificationBodySchema>;
