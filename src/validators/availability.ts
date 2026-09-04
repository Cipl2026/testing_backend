import { z } from 'zod';
import { objectIdSchema, paginationQuerySchema } from '@ghaarfix/validation';
import {
  AddressLabel,
  ProviderDiscoverySort,
  ServiceAreaType,
  TimeOffType,
} from '@ghaarfix/shared-types';

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Time must be HH:mm');

const dayScheduleSchema = z
  .object({
    enabled: z.boolean(),
    startTime: timeSchema,
    endTime: timeSchema,
  })
  .refine((d) => !d.enabled || timeToMinutes(d.startTime) < timeToMinutes(d.endTime), {
    message: 'Start time must be before end time',
  });

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h! * 60 + m!;
}

const weeklyScheduleSchema = z
  .object({
    monday: dayScheduleSchema,
    tuesday: dayScheduleSchema,
    wednesday: dayScheduleSchema,
    thursday: dayScheduleSchema,
    friday: dayScheduleSchema,
    saturday: dayScheduleSchema,
    sunday: dayScheduleSchema,
  })
  .refine((schedule) => Object.values(schedule).some((d) => d.enabled), {
    message: 'At least one day must be enabled',
  });

export const addressBodySchema = z.object({
  label: z.nativeEnum(AddressLabel),
  recipientName: z.string().trim().min(2).max(80),
  phone: z.string().trim().min(10).max(15),
  addressLine1: z.string().trim().min(3).max(200),
  addressLine2: z.string().trim().max(200).optional(),
  landmark: z.string().trim().max(120).optional(),
  city: z.string().trim().min(2).max(80),
  state: z.string().trim().min(2).max(80),
  postalCode: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'Pincode must be exactly 6 digits'),
  country: z.string().trim().min(2).max(80).default('India'),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  isDefault: z.boolean().optional(),
});

export const serviceAreaBodySchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    type: z.nativeEnum(ServiceAreaType),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    radiusKm: z.number().min(1).max(100).optional(),
    postalCodes: z.array(z.string().trim().min(3).max(12)).max(50).optional(),
    isActive: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.type === ServiceAreaType.RADIUS && !data.radiusKm) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'radiusKm is required for RADIUS type' });
    }
    if (data.type === ServiceAreaType.POSTAL_CODES && (!data.postalCodes || data.postalCodes.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'postalCodes required for POSTAL_CODES type',
      });
    }
  });

export const scheduleBodySchema = z.object({
  weeklySchedule: weeklyScheduleSchema,
  timezone: z.string().trim().min(1).max(64),
  isActive: z.boolean().optional(),
});

export const timeOffBodySchema = z
  .object({
    startDateTime: z.string().datetime(),
    endDateTime: z.string().datetime(),
    reason: z.string().trim().max(500).optional(),
    type: z.nativeEnum(TimeOffType).optional(),
  })
  .refine((d) => new Date(d.startDateTime) < new Date(d.endDateTime), {
    message: 'startDateTime must be before endDateTime',
  });

export const availabilityQuerySchema = z.object({
  serviceId: objectIdSchema,
  addressId: objectIdSchema,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const providerDiscoveryQuerySchema = paginationQuerySchema.extend({
  addressId: objectIdSchema,
  sort: z.nativeEnum(ProviderDiscoverySort).optional().default(ProviderDiscoverySort.RECOMMENDED),
});

export const slotReservationBodySchema = z.object({
  providerId: objectIdSchema,
  serviceId: objectIdSchema,
  addressId: objectIdSchema,
  startDateTime: z.string().datetime(),
  assetId: objectIdSchema.optional(),
  homeId: objectIdSchema.optional(),
});

export const reservationIdParamSchema = z.object({ reservationId: objectIdSchema });

export const providerIdParamSchema = z.object({ providerId: objectIdSchema });

export type AddressBody = z.infer<typeof addressBodySchema>;
export type ServiceAreaBody = z.infer<typeof serviceAreaBodySchema>;
export type ScheduleBody = z.infer<typeof scheduleBodySchema>;
export type TimeOffBody = z.infer<typeof timeOffBodySchema>;
export const serviceAreaUpdateSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  type: z.nativeEnum(ServiceAreaType).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  radiusKm: z.number().min(1).max(100).optional(),
  postalCodes: z.array(z.string().trim().min(3).max(12)).max(50).optional(),
  isActive: z.boolean().optional(),
});

export const timeOffUpdateSchema = z.object({
  startDateTime: z.string().datetime().optional(),
  endDateTime: z.string().datetime().optional(),
  reason: z.string().trim().max(500).optional(),
  type: z.nativeEnum(TimeOffType).optional(),
});
