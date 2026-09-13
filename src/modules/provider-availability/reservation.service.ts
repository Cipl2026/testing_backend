import { DateTime } from 'luxon';
import { ErrorCode, SlotReservationStatus, type HomeHelpTaskPriority } from '@ghaarfix/shared-types';
import { env } from '@/config/env.js';
import { getRedisClient } from '@/infra/redis.js';
import { Service } from '@/models/Service.js';
import { SlotReservation } from '@/models/SlotReservation.js';
import { Types } from 'mongoose';
import { getCustomerAddressForMatching } from '@/modules/addresses/address.service.js';
import {
  validateAssetForService,
} from '@/modules/home-health/helpers.js';
import { findOrCreateHomeForAddress } from '@/modules/home-health/home.service.js';
import {
  getAvailableSlots,
  getBlockingIntervals,
  getRequiredSlotMinutes,
} from '@/modules/provider-availability/availability.service.js';
import { getProviderScheduleDocument } from '@/modules/provider-availability/schedule.service.js';
import { intervalsOverlap } from '@/utils/intervals.js';
import { AppError } from '@/utils/AppError.js';
import { serializeReservation } from '@/utils/availabilitySerializers.js';
import { addMinutes } from '@/utils/timezone.js';
import { emitAvailabilityChanged } from '@/modules/realtime/socket.service.js';
import * as slotInventoryService from '@/modules/operations/slot-inventory.service.js';
import * as zoneResolutionService from '@/modules/operations/zone-resolution.service.js';

function buildSlotHoldKey(providerId: string, start: Date): string {
  return `slot:${providerId}:${start.toISOString()}`;
}

async function acquireSlotHold(providerId: string, start: Date, ttlSeconds: number): Promise<boolean> {
  const redis = await getRedisClient();
  if (!redis) return true;

  const key = buildSlotHoldKey(providerId, start);
  const result = await redis.set(key, 'held', 'EX', ttlSeconds, 'NX');
  return result === 'OK';
}

async function releaseSlotHold(providerId: string, start: Date): Promise<void> {
  const redis = await getRedisClient();
  if (!redis) return;
  await redis.del(buildSlotHoldKey(providerId, start));
}

/**
 * Concurrency strategy (standalone MongoDB compatible):
 * 1. Re-verify slot availability from AvailabilityService.
 * 2. Query overlapping HELD reservations (expiresAt > now) and blocking bookings.
 * 3. Insert reservation only when no overlap exists.
 * 4. A second concurrent request sees the first hold and receives 409.
 * 5. TTL index on expiresAt removes expired documents automatically.
 */
export async function createSlotReservation(
  customerId: string,
  input: {
    providerId: string;
    serviceId: string;
    addressId: string;
    startDateTime: string;
    assetId?: string;
    homeId?: string;
    durationMinutesOverride?: number;
    homeHelp?: {
      durationPackageId: string;
      durationLabel: string;
      durationMinutes: number;
      quotedAmount: number;
      generalNotes?: string;
      tasks: Array<{
        serviceId: string;
        name: string;
        priority: HomeHelpTaskPriority;
        notes?: string;
      }>;
    };
    quickServices?: {
      bookingMode: 'instant' | 'scheduled' | 'recurring';
      photoUrls?: string[];
    };
  },
) {
  const service = await Service.findOne({ _id: input.serviceId, isActive: true });
  if (!service) throw new AppError('Service not found.', 404, ErrorCode.NOT_FOUND);

  const start = new Date(input.startDateTime);
  const requiredMinutes =
    input.durationMinutesOverride ?? getRequiredSlotMinutes(service.estimatedDuration.maxMinutes);
  const end = addMinutes(start, requiredMinutes);
  const expiresAt = addMinutes(new Date(), env.availability.slotReservationMinutes);

  const address = await getCustomerAddressForMatching(customerId, input.addressId);
  const zoneResolution = await zoneResolutionService.resolveAddressToZone({
    city: address.city,
    postalCode: address.postalCode,
    location: address.location?.coordinates
      ? { latitude: address.location.coordinates[1], longitude: address.location.coordinates[0] }
      : undefined,
  });

  const schedule = await getProviderScheduleDocument(input.providerId);
  const timezone = schedule?.timezone ?? 'Asia/Kolkata';
  const dateStr = DateTime.fromJSDate(start, { zone: 'utc' }).setZone(timezone).toISODate()!;

  await slotInventoryService.reserveSlotInventory({
    providerId: input.providerId,
    serviceId: input.serviceId,
    slotStart: start,
    date: dateStr,
    serviceZoneId: zoneResolution.zone?.id,
  });

  const slots = await getAvailableSlots({
    providerId: input.providerId,
    serviceId: input.serviceId,
    addressId: input.addressId,
    customerId,
    date: dateStr,
  });

  const matchingSlot = slots.slots.find(
    (s) => s.available && new Date(s.startDateTime).getTime() === start.getTime(),
  );
  if (!matchingSlot) {
    throw new AppError(
      'That time slot is no longer available. Please choose another one.',
      409,
      ErrorCode.CONFLICT,
    );
  }

  const blocks = await getBlockingIntervals(input.providerId, start, end);
  if (blocks.some((b) => intervalsOverlap(b.start, b.end, start, end))) {
    throw new AppError(
      'That time slot was just taken. Please choose another one.',
      409,
      ErrorCode.CONFLICT,
    );
  }

  const overlappingHold = await SlotReservation.findOne({
    providerId: input.providerId,
    status: SlotReservationStatus.HELD,
    expiresAt: { $gt: new Date() },
    startDateTime: { $lt: end },
    endDateTime: { $gt: start },
  });

  if (overlappingHold) {
    throw new AppError(
      'That time slot was just taken. Please choose another one.',
      409,
      ErrorCode.CONFLICT,
    );
  }

  const holdSeconds = env.availability.slotReservationMinutes * 60;
  const holdAcquired = await acquireSlotHold(input.providerId, start, holdSeconds);
  if (!holdAcquired) {
    throw new AppError(
      'That time slot was just taken. Please choose another one.',
      409,
      ErrorCode.CONFLICT,
    );
  }

  let homeId = input.homeId;
  const assetId = input.assetId;

  if (assetId) {
    const asset = await validateAssetForService(customerId, input.serviceId, assetId, homeId);
    homeId = asset.homeId.toString();
  } else if (!homeId) {
    const home = await findOrCreateHomeForAddress(customerId, input.addressId);
    homeId = home?._id.toString();
  }

  const reservation = await SlotReservation.create({
    providerId: input.providerId,
    serviceId: input.serviceId,
    customerId,
    addressId: input.addressId,
    homeId: homeId ?? undefined,
    assetId: assetId ?? undefined,
    startDateTime: start,
    endDateTime: end,
    status: SlotReservationStatus.HELD,
    expiresAt,
    serviceZoneId: zoneResolution.zone?.id,
    homeHelp: input.homeHelp
      ? {
          durationPackageId: new Types.ObjectId(input.homeHelp.durationPackageId),
          durationLabel: input.homeHelp.durationLabel,
          durationMinutes: input.homeHelp.durationMinutes,
          quotedAmount: input.homeHelp.quotedAmount,
          generalNotes: input.homeHelp.generalNotes,
          tasks: input.homeHelp.tasks.map((task) => ({
            serviceId: new Types.ObjectId(task.serviceId),
            name: task.name,
            priority: task.priority,
            notes: task.notes,
          })),
        }
      : undefined,
    quickServices: input.quickServices,
  }).catch(async (error) => {
    await releaseSlotHold(input.providerId, start);
    throw error;
  });

  emitAvailabilityChanged(input.providerId, dateStr, {
    startDateTime: start.toISOString(),
    reason: 'reservation',
  });

  return serializeReservation(reservation);
}

export async function consumeSlotReservation(reservationId: string, customerId: string) {
  const reservation = await SlotReservation.findOneAndUpdate(
    {
      _id: reservationId,
      customerId,
      status: SlotReservationStatus.HELD,
      expiresAt: { $gt: new Date() },
    },
    { $set: { status: SlotReservationStatus.CONSUMED } },
    { new: true },
  );
  if (!reservation) {
    throw new AppError(
      'Your time slot expired before the booking could be confirmed.',
      409,
      ErrorCode.CONFLICT,
    );
  }
  await releaseSlotHold(reservation.providerId.toString(), reservation.startDateTime);
  return reservation;
}

export async function releaseSlotReservation(customerId: string, reservationId: string) {
  const reservation = await SlotReservation.findOne({ _id: reservationId, customerId });
  if (!reservation) throw new AppError('Reservation not found.', 404, ErrorCode.NOT_FOUND);

  if (reservation.status !== SlotReservationStatus.HELD) {
    throw new AppError('Reservation is no longer active.', 410, ErrorCode.CONFLICT);
  }

  reservation.status = SlotReservationStatus.RELEASED;
  await reservation.save();
  await releaseSlotHold(reservation.providerId.toString(), reservation.startDateTime);

  const schedule = await getProviderScheduleDocument(reservation.providerId.toString());
  const timezone = schedule?.timezone ?? 'Asia/Kolkata';
  const dateStr = DateTime.fromJSDate(reservation.startDateTime, { zone: 'utc' })
    .setZone(timezone)
    .toISODate()!;
  emitAvailabilityChanged(reservation.providerId.toString(), dateStr, {
    startDateTime: reservation.startDateTime.toISOString(),
    reason: 'released',
  });
}

export async function getSlotReservation(customerId: string, reservationId: string) {
  const reservation = await SlotReservation.findOne({ _id: reservationId, customerId });
  if (!reservation) throw new AppError('Reservation not found.', 404, ErrorCode.NOT_FOUND);

  if (
    reservation.status === SlotReservationStatus.HELD &&
    reservation.expiresAt <= new Date()
  ) {
    reservation.status = SlotReservationStatus.EXPIRED;
    await reservation.save();
    throw new AppError('Your selected time has expired.', 410, ErrorCode.CONFLICT);
  }

  return serializeReservation(reservation);
}
