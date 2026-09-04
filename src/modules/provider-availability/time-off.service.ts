import { ErrorCode } from '@ghaarfix/shared-types';
import { ProviderTimeOff } from '@/models/ProviderTimeOff.js';
import { AppError } from '@/utils/AppError.js';
import { serializeTimeOff } from '@/utils/availabilitySerializers.js';
import type { TimeOffBody } from '@/validators/availability.js';

export async function listTimeOff(providerId: string) {
  const items = await ProviderTimeOff.find({ providerId })
    .sort({ startDateTime: 1 })
    .limit(100);
  return items.map(serializeTimeOff);
}

export async function createTimeOff(providerId: string, input: TimeOffBody) {
  const start = new Date(input.startDateTime);
  const end = new Date(input.endDateTime);
  if (start < new Date()) {
    throw new AppError('Cannot create time off in the past.', 400, ErrorCode.VALIDATION_ERROR);
  }

  const timeOff = await ProviderTimeOff.create({
    providerId,
    startDateTime: start,
    endDateTime: end,
    reason: input.reason,
    type: input.type,
  });
  return serializeTimeOff(timeOff);
}

export async function updateTimeOff(
  providerId: string,
  timeOffId: string,
  input: Partial<TimeOffBody>,
) {
  const timeOff = await ProviderTimeOff.findOne({ _id: timeOffId, providerId });
  if (!timeOff) throw new AppError('Time off not found.', 404, ErrorCode.NOT_FOUND);
  if (timeOff.startDateTime < new Date()) {
    throw new AppError('Cannot edit past time off.', 400, ErrorCode.VALIDATION_ERROR);
  }

  if (input.startDateTime) timeOff.startDateTime = new Date(input.startDateTime);
  if (input.endDateTime) timeOff.endDateTime = new Date(input.endDateTime);
  if (input.reason !== undefined) timeOff.reason = input.reason;
  if (input.type) timeOff.type = input.type;

  if (timeOff.startDateTime >= timeOff.endDateTime) {
    throw new AppError('startDateTime must be before endDateTime.', 400, ErrorCode.VALIDATION_ERROR);
  }

  await timeOff.save();
  return serializeTimeOff(timeOff);
}

export async function deleteTimeOff(providerId: string, timeOffId: string) {
  const timeOff = await ProviderTimeOff.findOne({ _id: timeOffId, providerId });
  if (!timeOff) throw new AppError('Time off not found.', 404, ErrorCode.NOT_FOUND);
  if (timeOff.startDateTime < new Date()) {
    throw new AppError('Cannot delete past time off.', 400, ErrorCode.VALIDATION_ERROR);
  }
  await timeOff.deleteOne();
}

export async function getTimeOffInRange(providerId: string, rangeStart: Date, rangeEnd: Date) {
  return ProviderTimeOff.find({
    providerId,
    startDateTime: { $lt: rangeEnd },
    endDateTime: { $gt: rangeStart },
  });
}

export async function adminListProviderTimeOff(providerId: string) {
  return listTimeOff(providerId);
}
