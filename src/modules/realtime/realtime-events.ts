import { randomUUID } from 'node:crypto';

import type { RealtimeBookingAction, RealtimeEnvelope } from '@ghaarfix/shared-types';

export type BookingStatusPayload = {
  bookingId: string;
  status: string;
  action?: RealtimeBookingAction;
  providerId?: string;
  customerId?: string;
};

export function buildRealtimeEnvelope<T extends Record<string, unknown>>(
  data: T,
  ids?: { bookingId?: string; urgentRequestId?: string },
): RealtimeEnvelope<T> {
  return {
    eventId: randomUUID(),
    timestamp: new Date().toISOString(),
    bookingId: ids?.bookingId ?? (typeof data.bookingId === 'string' ? data.bookingId : undefined),
    urgentRequestId:
      ids?.urgentRequestId ??
      (typeof data.urgentRequestId === 'string' ? data.urgentRequestId : undefined),
    data,
  };
}

export function isRealtimeEnvelope(
  payload: unknown,
): payload is RealtimeEnvelope<Record<string, unknown>> {
  if (!payload || typeof payload !== 'object') return false;
  const candidate = payload as Record<string, unknown>;
  return (
    typeof candidate.eventId === 'string' &&
    typeof candidate.timestamp === 'string' &&
    candidate.data != null &&
    typeof candidate.data === 'object'
  );
}

export function unwrapBookingPayload(payload: unknown): BookingStatusPayload | null {
  if (!payload || typeof payload !== 'object') return null;
  if (isRealtimeEnvelope(payload)) {
    const data = payload.data;
    if (typeof data.bookingId !== 'string' || typeof data.status !== 'string') return null;
    return {
      bookingId: data.bookingId,
      status: data.status,
      action: typeof data.action === 'string' ? (data.action as RealtimeBookingAction) : undefined,
      providerId: typeof data.providerId === 'string' ? data.providerId : undefined,
      customerId: typeof data.customerId === 'string' ? data.customerId : undefined,
    };
  }
  const flat = payload as Record<string, unknown>;
  if (typeof flat.bookingId !== 'string' || typeof flat.status !== 'string') return null;
  return {
    bookingId: flat.bookingId,
    status: flat.status,
    action: typeof flat.action === 'string' ? (flat.action as RealtimeBookingAction) : undefined,
    providerId: typeof flat.providerId === 'string' ? flat.providerId : undefined,
    customerId: typeof flat.customerId === 'string' ? flat.customerId : undefined,
  };
}
