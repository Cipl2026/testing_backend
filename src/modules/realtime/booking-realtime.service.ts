import {
  buildRealtimeEnvelope,
  type BookingStatusPayload,
} from '@/modules/realtime/realtime-events.js';
import {
  emitBookingServiceCompleted,
  emitBookingStatusChanged,
  emitToAdmin,
  emitToProvider,
} from '@/modules/realtime/socket.service.js';

function aliasEvents(payload: BookingStatusPayload): void {
  const envelope = buildRealtimeEnvelope(payload, { bookingId: payload.bookingId });

  emitToAdmin('booking:updated', envelope);
  emitToAdmin('booking:status_changed', envelope);

  if (payload.action === 'CREATED') {
    emitToAdmin('booking:created', envelope);
  }
  if (payload.action === 'CANCELLED') {
    emitToAdmin('booking:cancelled', envelope);
  }
  if (payload.action === 'ACCEPTED' || payload.action === 'ASSIGNED') {
    emitToAdmin('booking:assigned', envelope);
  }
}

/** Broadcast booking lifecycle updates to customer, provider, and admin with structured envelopes. */
export function broadcastBookingRealtimeUpdate(
  payload: BookingStatusPayload,
  targets: { customerId?: string; providerId?: string },
): void {
  const envelope = buildRealtimeEnvelope(payload, { bookingId: payload.bookingId });

  if (targets.customerId) {
    emitBookingStatusChanged(targets.customerId, envelope);
    if (payload.action === 'COMPLETE_SERVICE') {
      emitBookingServiceCompleted(targets.customerId, envelope);
    }
  }

  if (targets.providerId) {
    emitToProvider(targets.providerId, 'booking:status-changed', envelope);

    if (
      payload.action === 'BOOKING_REQUESTED' ||
      payload.action === 'CREATED' ||
      payload.action === 'ASSIGNED'
    ) {
      emitToProvider(targets.providerId, 'provider:new_job', envelope);
      emitToProvider(targets.providerId, 'booking:created', envelope);
    }

    if (payload.action === 'CANCELLED' || payload.action === 'REJECTED') {
      emitToProvider(targets.providerId, 'provider:job_removed', envelope);
    }

    if (payload.action === 'ACCEPTED') {
      emitToProvider(targets.providerId, 'booking:accepted', envelope);
    }
  }

  aliasEvents(payload);
}

export function broadcastBookingCancelled(
  payload: BookingStatusPayload,
  targets: { customerId?: string; providerId?: string },
): void {
  broadcastBookingRealtimeUpdate({ ...payload, action: 'CANCELLED' }, targets);
}
