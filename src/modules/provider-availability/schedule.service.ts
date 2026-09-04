import { ErrorCode } from '@ghaarfix/shared-types';
import { ProviderSchedule } from '@/models/ProviderSchedule.js';
import { AppError } from '@/utils/AppError.js';
import { isValidTimezone } from '@/utils/timezone.js';
import { serializeSchedule } from '@/utils/availabilitySerializers.js';
import type { ScheduleBody } from '@/validators/availability.js';

const DEFAULT_SCHEDULE = {
  weeklySchedule: {
    monday: { enabled: true, startTime: '09:00', endTime: '18:00' },
    tuesday: { enabled: true, startTime: '09:00', endTime: '18:00' },
    wednesday: { enabled: true, startTime: '09:00', endTime: '18:00' },
    thursday: { enabled: true, startTime: '09:00', endTime: '18:00' },
    friday: { enabled: true, startTime: '09:00', endTime: '18:00' },
    saturday: { enabled: false, startTime: '09:00', endTime: '18:00' },
    sunday: { enabled: false, startTime: '09:00', endTime: '18:00' },
  },
  timezone: 'Asia/Kolkata',
  isActive: true,
};

export async function getSchedule(providerId: string) {
  let schedule = await ProviderSchedule.findOne({ providerId });
  if (!schedule) {
    schedule = await ProviderSchedule.create({ providerId, ...DEFAULT_SCHEDULE });
  }
  return serializeSchedule(schedule);
}

export async function upsertSchedule(providerId: string, input: ScheduleBody) {
  if (!isValidTimezone(input.timezone)) {
    throw new AppError('Invalid timezone.', 400, ErrorCode.VALIDATION_ERROR);
  }

  const schedule = await ProviderSchedule.findOneAndUpdate(
    { providerId },
    {
      weeklySchedule: input.weeklySchedule,
      timezone: input.timezone,
      isActive: input.isActive ?? true,
    },
    { upsert: true, new: true },
  );
  return serializeSchedule(schedule);
}

export async function getProviderScheduleDocument(providerId: string) {
  return ProviderSchedule.findOne({ providerId, isActive: true });
}

export async function adminGetProviderSchedule(providerId: string) {
  const schedule = await ProviderSchedule.findOne({ providerId });
  if (!schedule) return null;
  return serializeSchedule(schedule);
}
