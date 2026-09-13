import {
  BookingStatus,
  ProviderDiscoverySort,
  ProviderRequestStatus,
  ProviderServiceApprovalStatus,
  ProviderStatus,
  TimelineEventType,
  UserRole,
} from '@ghaarfix/shared-types';
import { env } from '@/config/env.js';
import { Booking } from '@/models/Booking.js';
import { ProviderProfile } from '@/models/ProviderProfile.js';
import { ProviderService } from '@/models/ProviderService.js';
import { SlotReservation } from '@/models/SlotReservation.js';
import { User } from '@/models/User.js';
import { addTimelineEvent } from '@/modules/bookings/timeline.service.js';
import { getBlockingIntervals } from '@/modules/provider-availability/availability.service.js';
import { discoverProvidersForService } from '@/modules/provider-availability/availability.service.js';
import { notifyBookingEvent } from '@/modules/notifications/notification.service.js';
import { enqueuePushNotification } from '@/modules/notifications/notification-queue.processor.js';
import { emitBookingStatusChanged, emitToProvider } from '@/modules/realtime/socket.service.js';
import { intervalsOverlap } from '@/utils/intervals.js';
import { logger } from '@/utils/logger.js';

export async function findAvailableProviderForBooking(
  booking: InstanceType<typeof Booking>,
  excludeProviderIds: string[] = [],
): Promise<string | null> {
  if (!booking.reservationId) return null;

  const reservation = await SlotReservation.findById(booking.reservationId);
  if (!reservation) return null;

  const exclude = new Set([booking.providerId.toString(), ...excludeProviderIds]);
  const { items } = await discoverProvidersForService(
    booking.customerId.toString(),
    booking.serviceId.toString(),
    reservation.addressId.toString(),
    { page: 1, limit: 20, sort: ProviderDiscoverySort.RECOMMENDED },
  );

  for (const candidate of items) {
    if (exclude.has(candidate.id)) continue;
    const blocks = await getBlockingIntervals(
      candidate.id,
      booking.scheduledStart,
      booking.scheduledEnd,
    );
    if (
      blocks.some((block) =>
        intervalsOverlap(block.start, block.end, booking.scheduledStart, booking.scheduledEnd),
      )
    ) {
      continue;
    }
    return candidate.id;
  }
  return null;
}

export async function reassignPendingBookingProvider(
  booking: InstanceType<typeof Booking>,
  newProviderId: string,
  reason: string,
) {
  const previousProviderId = booking.providerId.toString();
  const [user, profile, providerService] = await Promise.all([
    User.findById(newProviderId),
    ProviderProfile.findOne({ userId: newProviderId, providerStatus: ProviderStatus.ACTIVE }),
    ProviderService.findOne({
      providerId: newProviderId,
      serviceId: booking.serviceId,
      approvalStatus: ProviderServiceApprovalStatus.APPROVED,
      isActive: true,
    }),
  ]);
  if (!user || !profile || !providerService) {
    return false;
  }

  booking.providerId = user._id;
  booking.providerServiceId = providerService._id;
  booking.providerSnapshot = {
    fullName: profile.fullName ?? user.fullName ?? 'Professional',
    profileImage: profile.profileImage ?? user.profileImage,
    experienceYears: providerService.experienceYears ?? profile.experienceYears,
  };
  booking.providerRequestStatus = ProviderRequestStatus.PENDING;
  booking.providerRequestExpiredAt = undefined;
  booking.providerResponseExpiresAt = new Date(
    Date.now() + env.booking.providerResponseTimeoutMinutes * 60 * 1000,
  );
  await booking.save();

  await addTimelineEvent({
    bookingId: booking._id.toString(),
    type: TimelineEventType.PROVIDER_REPLACED,
    actorId: booking.customerId.toString(),
    actorRole: UserRole.CUSTOMER,
    metadata: {
      previousProviderId,
      newProviderId,
      reason,
    },
  });

  await notifyBookingEvent(
    booking.customerId.toString(),
    'PROVIDER_REPLACED',
    'New professional assigned',
    `${booking.providerSnapshot.fullName} will review your booking request.`,
    booking._id.toString(),
  );

  emitBookingStatusChanged(booking.customerId.toString(), {
    bookingId: booking._id.toString(),
    status: booking.status,
    action: 'PROVIDER_REPLACED',
  });

  emitToProvider(previousProviderId, 'booking:status-changed', {
    bookingId: booking._id.toString(),
    status: BookingStatus.CANCELLED,
    action: 'CUSTOMER_REASSIGNED',
  });

  void enqueuePushNotification({
    audience: 'provider',
    targetId: newProviderId,
    message: {
      title: 'New booking request',
      body: `You have a new ${booking.serviceSnapshot.name} request.`,
      data: { type: 'BOOKING_REQUESTED', bookingId: booking._id.toString() },
      tier: 'default',
    },
  });

  logger.info('pending booking provider reassigned', {
    bookingId: booking._id.toString(),
    previousProviderId,
    newProviderId,
    reason,
  });
  return true;
}

export async function assignBackupProviderForConfirmedBooking(
  booking: InstanceType<typeof Booking>,
  newProviderId: string,
) {
  const previousProviderId = booking.providerId.toString();
  const [user, profile, providerService] = await Promise.all([
    User.findById(newProviderId),
    ProviderProfile.findOne({ userId: newProviderId, providerStatus: ProviderStatus.ACTIVE }),
    ProviderService.findOne({
      providerId: newProviderId,
      serviceId: booking.serviceId,
      approvalStatus: ProviderServiceApprovalStatus.APPROVED,
      isActive: true,
    }),
  ]);
  if (!user || !profile || !providerService) return false;

  booking.providerId = user._id;
  booking.providerServiceId = providerService._id;
  booking.providerSnapshot = {
    fullName: profile.fullName ?? user.fullName ?? 'Professional',
    profileImage: profile.profileImage ?? user.profileImage,
    experienceYears: profile.experienceYears,
  };
  booking.providerConfirmation = {
    status: 'CONFIRMED',
    confirmedAt: new Date(),
    replacementProviderId: user._id,
  };
  await booking.save();

  await addTimelineEvent({
    bookingId: booking._id.toString(),
    type: TimelineEventType.PROVIDER_REPLACED,
    actorId: booking.customerId.toString(),
    actorRole: UserRole.CUSTOMER,
    metadata: {
      previousProviderId,
      newProviderId,
      reason: 'provider-did-not-reconfirm',
    },
  });

  await notifyBookingEvent(
    booking.customerId.toString(),
    'PROVIDER_REPLACED',
    'New professional assigned',
    `${booking.providerSnapshot.fullName} will arrive for your booking.`,
    booking._id.toString(),
  );

  emitBookingStatusChanged(booking.customerId.toString(), {
    bookingId: booking._id.toString(),
    status: booking.status,
    action: 'PROVIDER_REPLACED',
  });

  emitToProvider(previousProviderId, 'booking:status-changed', {
    bookingId: booking._id.toString(),
    status: booking.status,
    action: 'CUSTOMER_REASSIGNED',
  });

  void enqueuePushNotification({
    audience: 'provider',
    targetId: newProviderId,
    message: {
      title: 'New job assigned',
      body: `You have been assigned: ${booking.serviceSnapshot.name}`,
      data: { type: 'BOOKING_ASSIGNED', bookingId: booking._id.toString() },
      tier: 'default',
    },
  });

  logger.info('backup provider assigned', {
    bookingId: booking._id.toString(),
    previousProviderId,
    newProviderId,
  });
  return true;
}
