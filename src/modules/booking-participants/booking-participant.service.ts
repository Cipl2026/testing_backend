import {
  BookingParticipantPermission,
  BookingParticipantRole,
  ErrorCode,
  HomeCapability,
  HomeNotificationEventType,
} from '@ghaarfix/shared-types';
import { Booking } from '@/models/Booking.js';
import { BookingParticipant } from '@/models/BookingParticipant.js';
import { GuestBookingRecipient } from '@/models/GuestBookingRecipient.js';
import { User } from '@/models/User.js';
import { HomeNotificationPreference } from '@/models/HomeNotificationPreference.js';
import { notifyBookingEvent } from '@/modules/notifications/notification.service.js';
import {
  assertHomeCapability,
  DEFAULT_BOOKER_PERMISSIONS,
  DEFAULT_OBSERVER_PERMISSIONS,
  DEFAULT_RECIPIENT_PERMISSIONS,
} from '@/modules/home-members/home-permission.service.js';
import { AppError } from '@/utils/AppError.js';

export async function canAccessBooking(
  customerId: string,
  bookingId: string,
  permission: BookingParticipantPermission,
): Promise<boolean> {
  const booking = await Booking.findById(bookingId);
  if (!booking) return false;
  if (booking.customerId.toString() === customerId) return true;

  const participant = await BookingParticipant.findOne({ bookingId, customerId });
  if (participant?.permissions.includes(permission)) return true;

  if (booking.homeId) {
    try {
      await assertHomeCapability(customerId, booking.homeId.toString(), HomeCapability.BOOKING_VIEW);
      return permission === BookingParticipantPermission.VIEW_BOOKING;
    } catch {
      return false;
    }
  }
  return false;
}

export async function assertBookingPermission(
  customerId: string,
  bookingId: string,
  permission: BookingParticipantPermission,
) {
  const allowed = await canAccessBooking(customerId, bookingId, permission);
  if (!allowed) throw new AppError('Booking not found.', 404, ErrorCode.NOT_FOUND);
}

export async function findBookingForCustomer(customerId: string, bookingId: string) {
  const booking = await Booking.findById(bookingId);
  if (!booking) throw new AppError('Booking not found.', 404, ErrorCode.NOT_FOUND);

  if (booking.customerId.toString() === customerId) return booking;

  const participant = await BookingParticipant.findOne({ bookingId, customerId });
  if (participant) return booking;

  if (booking.homeId) {
    await assertHomeCapability(customerId, booking.homeId.toString(), HomeCapability.BOOKING_VIEW);
    return booking;
  }

  throw new AppError('Booking not found.', 404, ErrorCode.NOT_FOUND);
}

export async function seedDefaultParticipants(bookingId: string, bookerId: string, homeId?: string) {
  await BookingParticipant.findOneAndUpdate(
    { bookingId, customerId: bookerId },
    {
      $set: {
        homeId,
        role: BookingParticipantRole.BOOKER,
        permissions: DEFAULT_BOOKER_PERMISSIONS,
        addedBy: bookerId,
      },
    },
    { upsert: true, new: true },
  );
}

export async function listBookingParticipants(customerId: string, bookingId: string) {
  await assertBookingPermission(customerId, bookingId, BookingParticipantPermission.VIEW_BOOKING);
  const participants = await BookingParticipant.find({ bookingId });
  const guest = await GuestBookingRecipient.findOne({ bookingId });

  const items = [];
  for (const p of participants) {
    const user = p.customerId ? await User.findById(p.customerId).select('fullName') : null;
    items.push({
      id: p._id.toString(),
      customerId: p.customerId?.toString(),
      name: user?.fullName ?? 'Participant',
      role: p.role,
      permissions: p.permissions,
    });
  }

  return {
    participants: items,
    guestRecipient: guest
      ? { name: guest.name, phone: guest.phone, relationship: guest.relationship }
      : null,
  };
}

export async function addBookingParticipant(
  customerId: string,
  bookingId: string,
  input: {
    customerId?: string;
    role: BookingParticipantRole;
    permissions?: BookingParticipantPermission[];
  },
) {
  const booking = await findBookingForCustomer(customerId, bookingId);
  if (booking.customerId.toString() !== customerId) {
    await assertBookingPermission(customerId, bookingId, BookingParticipantPermission.VIEW_BOOKING);
  }

  if (!input.customerId) throw new AppError('Customer id required.', 400, ErrorCode.VALIDATION_ERROR);

  const permissions =
    input.permissions ??
    (input.role === BookingParticipantRole.RECIPIENT
      ? DEFAULT_RECIPIENT_PERMISSIONS
      : input.role === BookingParticipantRole.PAYER
        ? [BookingParticipantPermission.PAY, BookingParticipantPermission.VIEW_INVOICE, BookingParticipantPermission.VIEW_BOOKING]
        : input.role === BookingParticipantRole.OBSERVER
          ? DEFAULT_OBSERVER_PERMISSIONS
          : DEFAULT_BOOKER_PERMISSIONS);

  const doc = await BookingParticipant.findOneAndUpdate(
    { bookingId, customerId: input.customerId },
    {
      $set: {
        homeId: booking.homeId,
        role: input.role,
        permissions,
        addedBy: customerId,
      },
    },
    { upsert: true, new: true },
  );

  return {
    id: doc._id.toString(),
    customerId: doc.customerId?.toString(),
    role: doc.role,
    permissions: doc.permissions,
  };
}

export async function updateBookingParticipant(
  customerId: string,
  bookingId: string,
  participantId: string,
  input: { permissions?: BookingParticipantPermission[]; role?: BookingParticipantRole },
) {
  const booking = await Booking.findById(bookingId);
  if (!booking || booking.customerId.toString() !== customerId) {
    throw new AppError('Booking not found.', 404, ErrorCode.NOT_FOUND);
  }
  const participant = await BookingParticipant.findOne({ _id: participantId, bookingId });
  if (!participant) throw new AppError('Participant not found.', 404, ErrorCode.NOT_FOUND);
  if (participant.role === BookingParticipantRole.BOOKER) {
    throw new AppError('Cannot modify booker permissions.', 403, ErrorCode.FORBIDDEN);
  }
  if (input.role) participant.role = input.role;
  if (input.permissions) participant.permissions = input.permissions;
  await participant.save();
  return { id: participant._id.toString(), role: participant.role, permissions: participant.permissions };
}

export async function removeBookingParticipant(
  customerId: string,
  bookingId: string,
  participantId: string,
) {
  const booking = await Booking.findById(bookingId);
  if (!booking || booking.customerId.toString() !== customerId) {
    throw new AppError('Booking not found.', 404, ErrorCode.NOT_FOUND);
  }
  const participant = await BookingParticipant.findOne({ _id: participantId, bookingId });
  if (!participant) throw new AppError('Participant not found.', 404, ErrorCode.NOT_FOUND);
  if (participant.role === BookingParticipantRole.BOOKER) {
    throw new AppError('Cannot remove booker.', 403, ErrorCode.FORBIDDEN);
  }
  await participant.deleteOne();
  return { id: participantId, removed: true };
}

export async function setGuestRecipient(
  customerId: string,
  bookingId: string,
  input: { name: string; phone: string; relationship?: string },
) {
  const booking = await Booking.findById(bookingId);
  if (!booking || booking.customerId.toString() !== customerId) {
    throw new AppError('Booking not found.', 404, ErrorCode.NOT_FOUND);
  }
  const guest = await GuestBookingRecipient.findOneAndUpdate(
    { bookingId },
    { $set: input },
    { upsert: true, new: true },
  );
  return { name: guest.name, phone: guest.phone, relationship: guest.relationship };
}

export async function getProviderServiceRecipient(bookingId: string) {
  const booking = await Booking.findById(bookingId);
  if (!booking) return null;

  const recipient = await BookingParticipant.findOne({
    bookingId,
    role: BookingParticipantRole.RECIPIENT,
  });
  if (recipient?.customerId) {
    const user = await User.findById(recipient.customerId);
    return {
      name: user?.fullName ?? booking.addressSnapshot.recipientName,
      phone: booking.addressSnapshot.phone,
    };
  }

  const guest = await GuestBookingRecipient.findOne({ bookingId });
  if (guest) return { name: guest.name, phone: guest.phone };

  return {
    name: booking.addressSnapshot.recipientName,
    phone: booking.addressSnapshot.phone,
  };
}

export async function getBookingParticipantSummary(bookingId: string) {
  const booking = await Booking.findById(bookingId);
  if (!booking) return null;

  const booker = await User.findById(booking.customerId);
  const recipientParticipant = await BookingParticipant.findOne({
    bookingId,
    role: BookingParticipantRole.RECIPIENT,
  });
  const payerParticipant = await BookingParticipant.findOne({
    bookingId,
    role: BookingParticipantRole.PAYER,
  });
  const guest = await GuestBookingRecipient.findOne({ bookingId });

  let recipientName = booking.addressSnapshot.recipientName;
  if (recipientParticipant?.customerId) {
    const user = await User.findById(recipientParticipant.customerId);
    recipientName = user?.fullName ?? recipientName;
  } else if (guest) {
    recipientName = guest.name;
  }

  let payerName = booker?.fullName;
  if (payerParticipant?.customerId) {
    const user = await User.findById(payerParticipant.customerId);
    payerName = user?.fullName ?? payerName;
  }

  return {
    bookedBy: booker?.fullName ?? 'Customer',
    serviceRecipient: recipientName,
    paymentBy: payerName,
  };
}

export async function notifyBookingParticipants(
  bookingId: string,
  type: string,
  title: string,
  body: string,
  homeId?: string,
) {
  const eventMap: Record<string, HomeNotificationEventType> = {
    PROVIDER_EN_ROUTE: HomeNotificationEventType.PROVIDER_EN_ROUTE,
    PROVIDER_ARRIVED: HomeNotificationEventType.PROVIDER_ARRIVED,
    SERVICE_STARTED: HomeNotificationEventType.SERVICE_STARTED,
    SERVICE_COMPLETED: HomeNotificationEventType.SERVICE_COMPLETED,
  };

  const participants = await BookingParticipant.find({ bookingId });
  const sent = new Set<string>();

  for (const p of participants) {
    if (!p.customerId) continue;
    const userId = p.customerId.toString();
    if (sent.has(userId)) continue;

    if (homeId && eventMap[type]) {
      const pref = await HomeNotificationPreference.findOne({
        homeId,
        customerId: userId,
        eventType: eventMap[type],
      });
      if (pref && !pref.enabled) continue;
    }

    if (
      type === 'PROVIDER_EN_ROUTE' &&
      !p.permissions.includes(BookingParticipantPermission.TRACK_PROVIDER)
    ) {
      continue;
    }

    await notifyBookingEvent(userId, type, title, body, bookingId);
    sent.add(userId);
  }
}
