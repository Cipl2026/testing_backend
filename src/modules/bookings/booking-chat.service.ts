import {
  BookingMessageAuthorRole,
  BookingStatus,
  ErrorCode,
  UserRole,
} from '@ghaarfix/shared-types';
import { Booking } from '@/models/Booking.js';
import { BookingMessage } from '@/models/BookingMessage.js';
import { notifyBookingEvent } from '@/modules/notifications/notification.service.js';
import { buildRealtimeEnvelope } from '@/modules/realtime/realtime-events.js';
import { emitBookingChatMessage, emitBookingChatMessageDeleted } from '@/modules/realtime/socket.service.js';
import { buildPaginationMeta } from '@/utils/catalog.js';
import { AppError } from '@/utils/AppError.js';
import { getChatRetentionCutoffDate } from '@/utils/chatRetention.js';

const CHAT_ALLOWED_STATUSES = new Set<string>([
  BookingStatus.CONFIRMED,
  BookingStatus.PROVIDER_EN_ROUTE,
  BookingStatus.PROVIDER_ARRIVED,
  BookingStatus.IN_PROGRESS,
  BookingStatus.COMPLETED,
  BookingStatus.RESCHEDULE_REQUESTED,
]);

function assertChatAllowed(status: string) {
  if (!CHAT_ALLOWED_STATUSES.has(status)) {
    throw new AppError(
      'Chat is available after the booking is confirmed.',
      409,
      ErrorCode.CONFLICT,
    );
  }
}

async function getAuthorizedBooking(
  bookingId: string,
  userId: string,
  role: UserRole,
) {
  const booking =
    role === UserRole.CUSTOMER
      ? await Booking.findOne({ _id: bookingId, customerId: userId })
      : role === UserRole.PROVIDER
        ? await Booking.findOne({ _id: bookingId, providerId: userId })
        : null;

  if (!booking) {
    throw new AppError('Booking not found.', 404, ErrorCode.NOT_FOUND);
  }

  assertChatAllowed(booking.status);
  return booking;
}

function serializeMessage(doc: InstanceType<typeof BookingMessage>) {
  return {
    id: doc._id.toString(),
    bookingId: doc.bookingId.toString(),
    authorId: doc.authorId?.toString(),
    authorRole: doc.authorRole,
    body: doc.body,
    createdAt: doc.createdAt.toISOString(),
    deletedAt: doc.deletedAt?.toISOString() ?? null,
  };
}

export async function authorizeBookingChatJoin(
  bookingId: string,
  userId: string,
  role: UserRole,
): Promise<boolean> {
  try {
    await getAuthorizedBooking(bookingId, userId, role);
    return true;
  } catch {
    return false;
  }
}

export async function listBookingMessages(
  userId: string,
  role: UserRole,
  bookingId: string,
  query: { page?: number; limit?: number; since?: string },
) {
  await getAuthorizedBooking(bookingId, userId, role);

  const page = query.page ?? 1;
  const limit = Math.min(query.limit ?? 100, 200);
  const cutoff = getChatRetentionCutoffDate();
  const filter: Record<string, unknown> = {
    bookingId,
    deletedAt: null,
    createdAt: { $gte: cutoff },
  };
  if (query.since) {
    filter.createdAt = { $gte: new Date(Math.max(new Date(query.since).getTime(), cutoff.getTime())) };
  }

  const total = await BookingMessage.countDocuments(filter);
  const items = await BookingMessage.find(filter)
    .sort({ createdAt: 1 })
    .skip((page - 1) * limit)
    .limit(limit);

  return {
    items: items.map(serializeMessage),
    meta: buildPaginationMeta(page, limit, total),
  };
}

export async function sendBookingMessage(
  userId: string,
  role: UserRole,
  bookingId: string,
  body: string,
) {
  const booking = await getAuthorizedBooking(bookingId, userId, role);
  const trimmed = body.trim();
  if (!trimmed) {
    throw new AppError('Message cannot be empty.', 400, ErrorCode.VALIDATION_ERROR);
  }

  const authorRole =
    role === UserRole.PROVIDER
      ? BookingMessageAuthorRole.PROVIDER
      : BookingMessageAuthorRole.CUSTOMER;

  const message = await BookingMessage.create({
    bookingId,
    authorId: userId,
    authorRole,
    body: trimmed,
  });

  const serialized = serializeMessage(message);
  const envelope = buildRealtimeEnvelope(serialized, { bookingId });

  emitBookingChatMessage(bookingId, envelope);

  const recipientId =
    role === UserRole.PROVIDER
      ? booking.customerId.toString()
      : booking.providerId.toString();

  await notifyBookingEvent(
    recipientId,
    'BOOKING_MESSAGE',
    'New booking message',
    trimmed.length > 80 ? `${trimmed.slice(0, 77)}…` : trimmed,
    bookingId,
  );

  return serialized;
}

export async function unsendBookingMessage(
  userId: string,
  role: UserRole,
  bookingId: string,
  messageId: string,
) {
  await getAuthorizedBooking(bookingId, userId, role);

  const message = await BookingMessage.findOne({ _id: messageId, bookingId, deletedAt: null });
  if (!message) {
    throw new AppError('Message not found.', 404, ErrorCode.NOT_FOUND);
  }
  if (message.authorRole === BookingMessageAuthorRole.SYSTEM) {
    throw new AppError('This message cannot be removed.', 409, ErrorCode.CONFLICT);
  }
  if (message.authorId?.toString() !== userId) {
    throw new AppError('You can only remove your own messages.', 403, ErrorCode.FORBIDDEN);
  }

  message.deletedAt = new Date();
  await message.save();

  const payload = {
    bookingId,
    messageId,
    deletedAt: message.deletedAt.toISOString(),
  };
  emitBookingChatMessageDeleted(bookingId, buildRealtimeEnvelope(payload, { bookingId }));

  return serializeMessage(message);
}

export async function seedBookingChatWelcomeMessage(
  bookingId: string,
  providerId: string,
  providerName: string,
) {
  const existing = await BookingMessage.findOne({
    bookingId,
    authorRole: BookingMessageAuthorRole.SYSTEM,
  });
  if (existing) return serializeMessage(existing);

  const message = await BookingMessage.create({
    bookingId,
    authorId: providerId,
    authorRole: BookingMessageAuthorRole.SYSTEM,
    body: `Hi! I'm ${providerName}. I'll keep you updated about your service here.`,
  });

  const serialized = serializeMessage(message);
  emitBookingChatMessage(bookingId, buildRealtimeEnvelope(serialized, { bookingId }));
  return serialized;
}
