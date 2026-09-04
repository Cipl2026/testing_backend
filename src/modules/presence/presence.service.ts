import { ProviderPresenceStatus } from '@ghaarfix/shared-types';
import { env } from '@/config/env.js';
import { ProviderPresence } from '@/models/ProviderPresence.js';
import { Booking } from '@/models/Booking.js';
import { BLOCKING_BOOKING_STATUSES } from '@ghaarfix/shared-types';
import { UrgentRequest } from '@/models/UrgentRequest.js';
import { UrgentRequestStatus } from '@ghaarfix/shared-types';

function validateCoordinates(longitude: number, latitude: number): void {
  if (longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) {
    throw new Error('Invalid coordinates');
  }
}

async function countActiveJobs(providerId: string): Promise<number> {
  const [bookings, urgent] = await Promise.all([
    Booking.countDocuments({ providerId, status: { $in: BLOCKING_BOOKING_STATUSES } }),
    UrgentRequest.countDocuments({ providerId, status: UrgentRequestStatus.ASSIGNED }),
  ]);
  return bookings + urgent;
}

export async function getOrCreatePresence(providerId: string) {
  let presence = await ProviderPresence.findOne({ providerId });
  if (!presence) {
    presence = await ProviderPresence.create({
      providerId,
      status: ProviderPresenceStatus.OFFLINE,
      isOnline: false,
      urgentAvailable: false,
      lastSeenAt: new Date(),
      activeJobCount: 0,
    });
  }
  return presence;
}

export async function setProviderOnline(providerId: string) {
  const presence = await getOrCreatePresence(providerId);
  presence.status = ProviderPresenceStatus.ONLINE;
  presence.isOnline = true;
  presence.urgentAvailable = true;
  presence.lastSeenAt = new Date();
  presence.activeJobCount = await countActiveJobs(providerId);
  await presence.save();
  return serializePresence(presence);
}

export async function setProviderOffline(providerId: string) {
  const presence = await getOrCreatePresence(providerId);
  presence.status = ProviderPresenceStatus.OFFLINE;
  presence.isOnline = false;
  presence.urgentAvailable = false;
  presence.lastSeenAt = new Date();
  await presence.save();
  return serializePresence(presence);
}

export async function setProviderBusy(providerId: string) {
  const presence = await getOrCreatePresence(providerId);
  presence.status = ProviderPresenceStatus.BUSY;
  presence.isOnline = true;
  presence.urgentAvailable = false;
  presence.activeJobCount = await countActiveJobs(providerId);
  presence.lastSeenAt = new Date();
  await presence.save();
  return serializePresence(presence);
}

export async function heartbeatProvider(
  providerId: string,
  input?: { latitude?: number; longitude?: number },
) {
  const presence = await getOrCreatePresence(providerId);
  presence.lastSeenAt = new Date();
  presence.activeJobCount = await countActiveJobs(providerId);

  if (input?.latitude !== undefined && input?.longitude !== undefined) {
    validateCoordinates(input.longitude, input.latitude);
    presence.currentLocation = {
      type: 'Point',
      coordinates: [input.longitude, input.latitude],
    };
    presence.locationUpdatedAt = new Date();
  }

  await presence.save();
  return serializePresence(presence);
}

export async function registerPushToken(
  providerId: string,
  token: string,
  platform: 'ios' | 'android' | 'unknown' = 'unknown',
  deviceId?: string,
) {
  const { PushToken } = await import('@/models/PushToken.js');
  await PushToken.findOneAndUpdate(
    { token },
    { providerId, customerId: undefined, platform, deviceId, isActive: true, lastUsedAt: new Date() },
    { upsert: true },
  );
  return { success: true };
}

export async function registerCustomerPushToken(
  customerId: string,
  token: string,
  platform: 'ios' | 'android' | 'unknown' = 'unknown',
  deviceId?: string,
) {
  const { PushToken } = await import('@/models/PushToken.js');
  await PushToken.findOneAndUpdate(
    { token },
    { customerId, providerId: undefined, platform, deviceId, isActive: true, lastUsedAt: new Date() },
    { upsert: true },
  );
  return { success: true };
}

export async function expireStalePresence(): Promise<number> {
  const cutoff = new Date(Date.now() - env.urgent.presenceTimeoutMinutes * 60 * 1000);
  const result = await ProviderPresence.updateMany(
    {
      isOnline: true,
      lastSeenAt: { $lt: cutoff },
    },
    {
      $set: {
        isOnline: false,
        urgentAvailable: false,
        status: ProviderPresenceStatus.OFFLINE,
      },
    },
  );
  return result.modifiedCount;
}

function serializePresence(presence: InstanceType<typeof ProviderPresence>) {
  return {
    providerId: presence.providerId.toString(),
    status: presence.status,
    isOnline: presence.isOnline,
    urgentAvailable: presence.urgentAvailable,
    lastSeenAt: presence.lastSeenAt.toISOString(),
    activeJobCount: presence.activeJobCount,
    hasLocation: Boolean(presence.currentLocation?.coordinates?.length),
  };
}

export async function getProviderPresence(providerId: string) {
  const presence = await getOrCreatePresence(providerId);
  return serializePresence(presence);
}
