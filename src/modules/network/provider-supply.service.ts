import { ProviderCapacityStatus, ProviderSkillStatus } from '@ghaarfix/shared-types';
import { Types } from 'mongoose';
import { ProviderSkill } from '@/models/ProviderSkill.js';
import { ProviderPresence } from '@/models/ProviderPresence.js';
import { ProviderCapacity } from '@/models/ProviderCapacity.js';
import { ProviderShift } from '@/models/Network.js';
import { ServiceZone } from '@/models/ServiceZone.js';
import { Booking } from '@/models/Booking.js';
import { BookingStatus } from '@ghaarfix/shared-types';
import { localDateString } from '@/modules/network/time-bucket.util.js';

export interface ZoneSupplyCounts {
  registeredProviders: number;
  eligibleProviders: number;
  onlineProviders: number;
  availableProviders: number;
  scheduledCapacity: number;
  bookedCapacity: number;
}

export async function countZoneSupply(
  zoneId: string,
  serviceId: string,
  timeBucket: Date,
): Promise<ZoneSupplyCounts> {
  const zone = await ServiceZone.findById(zoneId);
  if (!zone) {
    return {
      registeredProviders: 0,
      eligibleProviders: 0,
      onlineProviders: 0,
      availableProviders: 0,
      scheduledCapacity: 0,
      bookedCapacity: 0,
    };
  }

  const skills = await ProviderSkill.find({
    skillId: serviceId,
    status: { $in: [ProviderSkillStatus.VERIFIED, ProviderSkillStatus.PENDING] },
  }).select('providerId status');

  const registeredIds = [...new Set(skills.map((s) => s.providerId.toString()))];
  const eligibleIds = skills
    .filter((s) => s.status === ProviderSkillStatus.VERIFIED)
    .map((s) => s.providerId.toString());

  const registeredProviders = registeredIds.length;
  const eligibleProviders = eligibleIds.length;

  if (!eligibleIds.length) {
    return {
      registeredProviders,
      eligibleProviders: 0,
      onlineProviders: 0,
      availableProviders: 0,
      scheduledCapacity: 0,
      bookedCapacity: await countBookedInBucket(zoneId, serviceId, timeBucket),
    };
  }

  const eligibleObjectIds = eligibleIds.map((id) => new Types.ObjectId(id));
  const presence = await ProviderPresence.find({
    providerId: { $in: eligibleObjectIds },
    isOnline: true,
  }).select('providerId activeJobCount');

  const onlineProviders = presence.length;
  const day = localDateString(timeBucket);
  const capacities = await ProviderCapacity.find({
    providerId: { $in: eligibleObjectIds },
    date: day,
  });

  const fullSet = new Set(
    capacities.filter((c) => c.status === ProviderCapacityStatus.FULL).map((c) => c.providerId.toString()),
  );
  const onlineSet = new Set(presence.map((p) => p.providerId.toString()));
  const availableProviders = [...onlineSet].filter((id) => !fullSet.has(id)).length;

  const dateStr = localDateString(timeBucket);
  const shifts = await ProviderShift.find({
    providerId: { $in: eligibleObjectIds },
    date: dateStr,
    status: { $in: ['PLANNED', 'ACTIVE'] },
    confirmedByProvider: true,
    $or: [{ preferredZones: zone._id }, { preferredZones: { $size: 0 } }],
  });
  const scheduledCapacity = shifts.reduce((sum, s) => sum + s.capacityLimit, 0);
  const bookedCapacity = await countBookedInBucket(zoneId, serviceId, timeBucket);

  return {
    registeredProviders,
    eligibleProviders,
    onlineProviders,
    availableProviders,
    scheduledCapacity,
    bookedCapacity,
  };
}

async function countBookedInBucket(zoneId: string, serviceId: string, timeBucket: Date): Promise<number> {
  const bucketEnd = new Date(timeBucket.getTime() + 15 * 60 * 1000);
  return Booking.countDocuments({
    serviceZoneId: zoneId,
    serviceId,
    status: { $in: [BookingStatus.CONFIRMED, BookingStatus.IN_PROGRESS, BookingStatus.PENDING_PROVIDER] },
    scheduledStart: { $gte: timeBucket, $lt: bucketEnd },
  });
}
