import { ErrorCode } from '@ghaarfix/shared-types';
import { ServiceSignalAccess } from '@/models/IoT.js';
import { AppError } from '@/utils/AppError.js';

export async function grantServiceSignalAccess(input: {
  bookingId: string;
  providerId: string;
  deviceId?: string;
  eventId?: string;
  signalSummary: string;
  expiresAt: Date;
}) {
  return ServiceSignalAccess.create(input);
}

export async function getProviderSignalAccess(providerId: string, bookingId: string) {
  const now = new Date();
  const access = await ServiceSignalAccess.find({
    providerId,
    bookingId,
    expiresAt: { $gt: now },
  }).sort({ createdAt: -1 });

  return access.map((a) => ({
    id: a._id.toString(),
    signalSummary: a.signalSummary,
    deviceId: a.deviceId?.toString(),
    eventId: a.eventId?.toString(),
    expiresAt: a.expiresAt,
  }));
}

export async function assertProviderSignalAccess(providerId: string, bookingId: string) {
  const items = await getProviderSignalAccess(providerId, bookingId);
  if (!items.length) {
    throw new AppError('No active signal access for this booking.', 403, ErrorCode.FORBIDDEN);
  }
  return items;
}

export async function expireStaleSignalAccess() {
  const result = await ServiceSignalAccess.deleteMany({ expiresAt: { $lt: new Date() } });
  return result.deletedCount ?? 0;
}
