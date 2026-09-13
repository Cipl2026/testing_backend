import {
  BookingStatus,
  BookingType,
  ErrorCode,
  TimelineEventType,
  UserRole,
} from '@ghaarfix/shared-types';
import { env } from '@/config/env.js';
import { Booking } from '@/models/Booking.js';
import { addTimelineEvent } from '@/modules/bookings/timeline.service.js';
import {
  assignBackupProviderForConfirmedBooking,
  findAvailableProviderForBooking,
} from '@/modules/bookings/provider-reassignment.service.js';
import { notifyBookingEvent } from '@/modules/notifications/notification.service.js';
import { enqueuePushNotification } from '@/modules/notifications/notification-queue.processor.js';
import { AppError } from '@/utils/AppError.js';
import { logger } from '@/utils/logger.js';

const ACTIVE_STATUSES = new Set([BookingStatus.CONFIRMED, BookingStatus.PROVIDER_EN_ROUTE]);

export async function confirmProviderBooking(providerId: string, bookingId: string) {
  const booking = await Booking.findOne({ _id: bookingId, providerId });
  if (!booking) throw new AppError('Booking not found.', 404, ErrorCode.NOT_FOUND);
  if (booking.bookingType !== BookingType.SCHEDULED) {
    throw new AppError('Only scheduled bookings require confirmation.', 409, ErrorCode.CONFLICT);
  }
  if (!ACTIVE_STATUSES.has(booking.status)) {
    throw new AppError('This booking cannot be confirmed in its current state.', 409, ErrorCode.CONFLICT);
  }

  booking.providerConfirmation = {
    ...(booking.providerConfirmation ?? { status: 'PENDING' }),
    status: 'CONFIRMED',
    confirmedAt: new Date(),
  };
  await booking.save();

  await addTimelineEvent({
    bookingId,
    type: TimelineEventType.PROVIDER_CONFIRMED,
    actorId: providerId,
    actorRole: UserRole.PROVIDER,
  });

  return { confirmed: true, confirmedAt: booking.providerConfirmation.confirmedAt?.toISOString() };
}

async function findBackupProvider(booking: InstanceType<typeof Booking>) {
  return findAvailableProviderForBooking(booking);
}

async function assignBackupProvider(booking: InstanceType<typeof Booking>, newProviderId: string) {
  return assignBackupProviderForConfirmedBooking(booking, newProviderId);
}

export async function requestReplacementForMissedConfirmation(
  customerId: string,
  bookingId: string,
) {
  const booking = await Booking.findOne({ _id: bookingId, customerId });
  if (!booking) throw new AppError('Booking not found.', 404, ErrorCode.NOT_FOUND);
  if (booking.providerConfirmation?.status !== 'MISSED') {
    throw new AppError('Replacement is only available when confirmation was missed.', 409, ErrorCode.CONFLICT);
  }
  if (booking.providerConfirmation.replacementProviderId) {
    throw new AppError('A replacement professional is already assigned.', 409, ErrorCode.CONFLICT);
  }

  const backupId = await findBackupProvider(booking);
  if (!backupId) {
    throw new AppError('No alternate professionals are available right now.', 409, ErrorCode.CONFLICT);
  }

  const assigned = await assignBackupProvider(booking, backupId);
  if (!assigned) {
    throw new AppError('Could not assign a replacement professional.', 409, ErrorCode.CONFLICT);
  }

  return { assigned: true, providerId: backupId };
}

export async function processProviderConfirmationReminders(): Promise<{
  reminders24h: number;
  reminders2h: number;
  replacements: number;
}> {
  const now = Date.now();
  const cfg = env.booking.providerConfirmation;
  const windowStart = new Date(now + cfg.deadlineHours * 60 * 60 * 1000);
  const windowEnd = new Date(now + cfg.reminder24hHours * 60 * 60 * 1000 + 60 * 60 * 1000);

  const bookings = await Booking.find({
    bookingType: BookingType.SCHEDULED,
    status: { $in: [...ACTIVE_STATUSES] },
    scheduledStart: { $gte: windowStart, $lte: windowEnd },
  }).limit(100);

  let reminders24h = 0;
  let reminders2h = 0;
  let replacements = 0;

  for (const booking of bookings) {
    const msUntilStart = booking.scheduledStart.getTime() - now;
    const hoursUntil = msUntilStart / (60 * 60 * 1000);
    const confirmation = booking.providerConfirmation ?? { status: 'PENDING' as const };

    if (confirmation.status === 'CONFIRMED') continue;

    if (
      hoursUntil <= cfg.reminder24hHours + 0.25 &&
      hoursUntil > cfg.reminder2hHours &&
      !confirmation.reminder24hSentAt
    ) {
      booking.providerConfirmation = { ...confirmation, status: 'PENDING', reminder24hSentAt: new Date() };
      await booking.save();
      void enqueuePushNotification({
        audience: 'provider',
        targetId: booking.providerId.toString(),
        message: {
          title: 'Confirm tomorrow\'s job',
          body: `Please confirm your ${booking.serviceSnapshot.name} booking.`,
          data: { type: 'BOOKING_CONFIRM_REMINDER', bookingId: booking._id.toString() },
          tier: 'default',
        },
      });
      reminders24h += 1;
      continue;
    }

    if (
      hoursUntil <= cfg.reminder2hHours + 0.1 &&
      hoursUntil > cfg.deadlineHours &&
      !confirmation.reminder2hSentAt
    ) {
      booking.providerConfirmation = {
        ...confirmation,
        status: 'PENDING',
        reminder2hSentAt: new Date(),
        reminder24hSentAt: confirmation.reminder24hSentAt ?? new Date(),
      };
      await booking.save();
      void enqueuePushNotification({
        audience: 'provider',
        targetId: booking.providerId.toString(),
        message: {
          title: 'Are you ready?',
          body: 'Confirm you are coming for your upcoming job.',
          data: { type: 'BOOKING_READY_REMINDER', bookingId: booking._id.toString() },
          tier: 'default',
        },
      });
      reminders2h += 1;
      continue;
    }

    if (hoursUntil <= cfg.deadlineHours && confirmation.status !== 'MISSED') {
      booking.providerConfirmation = {
        ...confirmation,
        status: 'MISSED',
      };
      await booking.save();

      await notifyBookingEvent(
        booking.customerId.toString(),
        'FINDING_REPLACEMENT',
        'Finding another professional',
        'Your original professional did not confirm. We are finding a replacement for your booking.',
        booking._id.toString(),
      );

      const backupId = await findBackupProvider(booking);
      if (backupId && (await assignBackupProvider(booking, backupId))) {
        replacements += 1;
      } else {
        logger.warn('no backup provider found for booking', { bookingId: booking._id.toString() });
      }
    }
  }

  return { reminders24h, reminders2h, replacements };
}

export function initProviderConfirmationOnBooking(booking: InstanceType<typeof Booking>) {
  if (booking.bookingType !== BookingType.SCHEDULED) return;
  if (booking.status !== BookingStatus.CONFIRMED && booking.status !== BookingStatus.PENDING_PROVIDER) {
    return;
  }
  booking.providerConfirmation = { status: 'PENDING' };
}
