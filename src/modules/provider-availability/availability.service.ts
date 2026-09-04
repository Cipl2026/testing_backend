import { DateTime } from 'luxon';
import type { ClientSession } from 'mongoose';
import {
  BLOCKING_BOOKING_STATUSES,
  ErrorCode,
  ProviderDiscoverySort,
  ProviderServiceApprovalStatus,
  ProviderStatus,
  SlotReservationStatus,
} from '@ghaarfix/shared-types';
import { env } from '@/config/env.js';
import { Booking } from '@/models/Booking.js';
import { ProviderProfile } from '@/models/ProviderProfile.js';
import { ProviderService } from '@/models/ProviderService.js';
import { Service } from '@/models/Service.js';
import { SlotReservation } from '@/models/SlotReservation.js';
import { User } from '@/models/User.js';
import { getCustomerAddressForMatching } from '@/modules/addresses/address.service.js';
import { providerMatchesAddress } from '@/modules/provider-availability/service-area.service.js';
import { getProviderScheduleDocument } from '@/modules/provider-availability/schedule.service.js';
import { getTimeOffInRange } from '@/modules/provider-availability/time-off.service.js';
import { AppError } from '@/utils/AppError.js';
import { buildPaginationMeta } from '@/utils/catalog.js';
import { distanceKm, intervalsOverlap } from '@/utils/intervals.js';
import {
  addMinutes,
  formatSlotLabel,
  getDayOfWeek,
  parseTimeOnDate,
  timeToMinutes,
} from '@/utils/timezone.js';
import type { ICustomerAddress } from '@/models/CustomerAddress.js';

const { availability: slotConfig } = env;

/** Slot duration strategy: use service maxMinutes + buffer for reservation window */
export function getRequiredSlotMinutes(serviceMaxMinutes: number): number {
  return serviceMaxMinutes + slotConfig.defaultBufferMinutes;
}

export async function getBlockingIntervals(
  providerId: string,
  rangeStart: Date,
  rangeEnd: Date,
  session?: ClientSession,
) {
  const now = new Date();
  const bookingQuery = Booking.find({
    providerId,
    status: { $in: BLOCKING_BOOKING_STATUSES },
    scheduledStart: { $lt: rangeEnd },
    scheduledEnd: { $gt: rangeStart },
  });
  const reservationQuery = SlotReservation.find({
    providerId,
    status: SlotReservationStatus.HELD,
    expiresAt: { $gt: now },
    startDateTime: { $lt: rangeEnd },
    endDateTime: { $gt: rangeStart },
  });

  const [bookings, reservations, timeOffs] = await Promise.all([
    session ? bookingQuery.session(session) : bookingQuery,
    session ? reservationQuery.session(session) : reservationQuery,
    getTimeOffInRange(providerId, rangeStart, rangeEnd),
  ]);

  return [
    ...bookings.map((b) => ({ start: b.scheduledStart, end: b.scheduledEnd, reason: 'booking' })),
    ...reservations.map((r) => ({ start: r.startDateTime, end: r.endDateTime, reason: 'reservation' })),
    ...timeOffs.map((t) => ({ start: t.startDateTime, end: t.endDateTime, reason: 'time_off' })),
  ];
}

function isSlotBlocked(
  slotStart: Date,
  slotEnd: Date,
  blocks: { start: Date; end: Date; reason: string }[],
): string | null {
  for (const block of blocks) {
    if (intervalsOverlap(block.start, block.end, slotStart, slotEnd)) {
      return block.reason;
    }
  }
  return null;
}

export async function getAvailableSlots(input: {
  providerId: string;
  serviceId: string;
  addressId: string;
  customerId: string;
  date: string;
}) {
  const service = await Service.findOne({ _id: input.serviceId, isActive: true });
  if (!service) throw new AppError('Service not found.', 404, ErrorCode.NOT_FOUND);

  const address = await getCustomerAddressForMatching(input.customerId, input.addressId);
  await assertProviderEligible(input.providerId, input.serviceId, address);

  const schedule = await getProviderScheduleDocument(input.providerId);
  if (!schedule || !schedule.isActive) {
    throw new AppError('Provider schedule not configured.', 404, ErrorCode.NOT_FOUND);
  }

  const timezone = schedule.timezone;
  const dayKey = getDayOfWeek(input.date, timezone);
  const daySchedule = schedule.weeklySchedule[dayKey];

  if (!daySchedule.enabled) {
    return {
      provider: { id: input.providerId },
      date: input.date,
      timezone,
      slots: [],
    };
  }

  const serviceMinutes = getRequiredSlotMinutes(service.estimatedDuration.maxMinutes);
  const workStart = parseTimeOnDate(input.date, daySchedule.startTime, timezone);
  const workEnd = parseTimeOnDate(input.date, daySchedule.endTime, timezone);
  const now = new Date();
  const minNotice = addMinutes(now, slotConfig.minBookingNoticeMinutes);

  const maxDate = DateTime.now()
    .setZone(timezone)
    .plus({ days: slotConfig.maxAdvanceBookingDays })
    .toISODate();
  if (input.date > (maxDate ?? '')) {
    throw new AppError('Date is outside booking window.', 400, ErrorCode.VALIDATION_ERROR);
  }

  const blocks = await getBlockingIntervals(input.providerId, workStart, workEnd);
  const slots: Array<{
    startDateTime: string;
    endDateTime: string;
    label: string;
    available: boolean;
    reason?: string;
  }> = [];

  let cursor = workStart;
  while (addMinutes(cursor, serviceMinutes) <= workEnd) {
    const slotEnd = addMinutes(cursor, serviceMinutes);
    let available = true;
    let reason: string | undefined;

    if (cursor < minNotice) {
      available = false;
      reason = 'too_soon';
    } else if (cursor < now) {
      available = false;
      reason = 'past';
    } else {
      const blockReason = isSlotBlocked(cursor, slotEnd, blocks);
      if (blockReason) {
        available = false;
        reason = blockReason;
      }
    }

    slots.push({
      startDateTime: cursor.toISOString(),
      endDateTime: slotEnd.toISOString(),
      label: formatSlotLabel(cursor, timezone),
      available,
      ...(reason ? { reason } : {}),
    });

    cursor = addMinutes(cursor, slotConfig.slotIntervalMinutes);
  }

  return {
    provider: { id: input.providerId },
    date: input.date,
    timezone,
    slots,
  };
}

async function assertProviderEligible(providerId: string, serviceId: string, address: ICustomerAddress) {
  const user = await User.findById(providerId);
  if (!user || user.status !== 'ACTIVE') {
    throw new AppError('Provider is not available.', 404, ErrorCode.NOT_FOUND);
  }

  const profile = await ProviderProfile.findOne({ userId: providerId });
  if (!profile || profile.providerStatus !== ProviderStatus.ACTIVE) {
    throw new AppError('Provider is not available.', 404, ErrorCode.NOT_FOUND);
  }

  const providerService = await ProviderService.findOne({
    providerId,
    serviceId,
    approvalStatus: ProviderServiceApprovalStatus.APPROVED,
    isActive: true,
  });
  if (!providerService) {
    throw new AppError('Provider does not offer this service.', 404, ErrorCode.NOT_FOUND);
  }

  const inArea = await providerMatchesAddress(providerId, address);
  if (!inArea) {
    throw new AppError('Provider does not serve this area.', 404, ErrorCode.NOT_FOUND);
  }
}

export async function discoverProvidersForService(
  customerId: string,
  serviceId: string,
  addressId: string,
  query: { page: number; limit: number; sort: ProviderDiscoverySort },
) {
  const service = await Service.findOne({ _id: serviceId, isActive: true });
  if (!service) throw new AppError('Service not found.', 404, ErrorCode.NOT_FOUND);

  const address = await getCustomerAddressForMatching(customerId, addressId);
  const [lon, lat] = address.location.coordinates;

  const providerServices = await ProviderService.find({
    serviceId,
    approvalStatus: ProviderServiceApprovalStatus.APPROVED,
    isActive: true,
  });

  const providerIds = providerServices.map((ps) => ps.providerId);
  const [users, profiles] = await Promise.all([
    User.find({ _id: { $in: providerIds }, status: 'ACTIVE' }),
    ProviderProfile.find({ userId: { $in: providerIds }, providerStatus: ProviderStatus.ACTIVE }),
  ]);

  const activeUserIds = new Set(users.map((u) => u._id.toString()));
  const profileMap = new Map(profiles.map((p) => [p.userId.toString(), p]));
  const psMap = new Map(providerServices.map((ps) => [ps.providerId.toString(), ps]));

  const eligible: Array<{
    providerId: string;
    distanceKm?: number;
    experienceYears: number;
    profileCompleteness: number;
  }> = [];

  for (const ps of providerServices) {
    const pid = ps.providerId.toString();
    if (!activeUserIds.has(pid)) continue;
    const profile = profileMap.get(pid);
    if (!profile) continue;

    const matches = await providerMatchesAddress(pid, address);
    if (!matches) continue;

    const schedule = await getProviderScheduleDocument(pid);
    let distance: number | undefined;
    const areas = await import('@/models/ProviderServiceArea.js').then((m) =>
      m.ProviderServiceArea.findOne({ providerId: pid, isActive: true }),
    );
    if (areas) {
      distance = distanceKm(lat, lon, areas.center.latitude, areas.center.longitude);
    }

    const completeness =
      (profile.fullName ? 20 : 0) +
      (profile.bio ? 20 : 0) +
      (profile.languages.length > 0 ? 20 : 0) +
      (profile.experienceYears ? 20 : 0) +
      (schedule ? 20 : 0);

    eligible.push({
      providerId: pid,
      distanceKm: distance,
      experienceYears: ps.experienceYears ?? profile.experienceYears ?? 0,
      profileCompleteness: completeness,
    });
  }

  const sorted = [...eligible].sort((a, b) => {
    if (query.sort === ProviderDiscoverySort.NEAREST) {
      return (a.distanceKm ?? 999) - (b.distanceKm ?? 999);
    }
    if (query.sort === ProviderDiscoverySort.EXPERIENCE) {
      return b.experienceYears - a.experienceYears;
    }
    const scoreA = (a.profileCompleteness ?? 0) - (a.distanceKm ?? 0) * 2 + a.experienceYears * 3;
    const scoreB = (b.profileCompleteness ?? 0) - (b.distanceKm ?? 0) * 2 + b.experienceYears * 3;
    return scoreB - scoreA;
  });

  const total = sorted.length;
  const pageItems = sorted.slice((query.page - 1) * query.limit, query.page * query.limit);

  const items = await Promise.all(
    pageItems.map(async (item) => {
      const profile = profileMap.get(item.providerId)!;
      const ps = psMap.get(item.providerId)!;
      const user = users.find((u) => u._id.toString() === item.providerId)!;

      let nextAvailability: string | null = null;
      const schedule = await getProviderScheduleDocument(item.providerId);
      if (schedule) {
        const today = DateTime.now().setZone(schedule.timezone).toISODate()!;
        const slots = await getAvailableSlots({
          providerId: item.providerId,
          serviceId,
          addressId,
          customerId,
          date: today,
        });
        const first = slots.slots.find((s) => s.available);
        if (first) nextAvailability = `Today, ${first.label}`;
      }

      return {
        id: item.providerId,
        fullName: profile.fullName ?? user.fullName ?? 'Professional',
        profileImage: profile.profileImage ?? user.profileImage,
        experienceYears: item.experienceYears,
        languages: profile.languages,
        distanceKm: item.distanceKm != null ? Math.round(item.distanceKm * 10) / 10 : undefined,
        service: {
          id: service._id.toString(),
          name: service.name,
          startingPrice: ps.customPricing?.enabled
            ? ps.customPricing.startingPrice
            : service.pricing.startingPrice,
          currency: service.pricing.currency,
        },
        availabilitySummary: nextAvailability,
      };
    }),
  );

  return { items, meta: buildPaginationMeta(query.page, query.limit, total) };
}

export async function getNextAvailableLabel(providerId: string, serviceId: string, addressId: string, customerId: string) {
  const schedule = await getProviderScheduleDocument(providerId);
  if (!schedule) return null;
  const today = DateTime.now().setZone(schedule.timezone).toISODate()!;
  const slots = await getAvailableSlots({ providerId, serviceId, addressId, customerId, date: today });
  const first = slots.slots.find((s) => s.available);
  return first ? `Today, ${first.label}` : null;
}

export { timeToMinutes };
