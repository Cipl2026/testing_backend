import { TimelineEventType, UserRole } from '@ghaarfix/shared-types';
import { BookingTimelineEvent } from '@/models/BookingTimelineEvent.js';

export async function addTimelineEvent(input: {
  bookingId: string;
  type: TimelineEventType;
  actorId?: string;
  actorRole?: UserRole;
  metadata?: Record<string, unknown>;
}) {
  return BookingTimelineEvent.create({
    bookingId: input.bookingId,
    type: input.type,
    actorId: input.actorId,
    actorRole: input.actorRole,
    timestamp: new Date(),
    metadata: input.metadata,
  });
}

export async function listTimelineEvents(bookingId: string) {
  const events = await BookingTimelineEvent.find({ bookingId }).sort({ timestamp: 1 });
  return events.map((e) => ({
    type: e.type,
    actorId: e.actorId?.toString(),
    actorRole: e.actorRole,
    timestamp: e.timestamp.toISOString(),
    metadata: e.metadata,
  }));
}
