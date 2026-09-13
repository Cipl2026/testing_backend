/** Structured realtime event envelope shared across server and clients. */
export type RealtimeBookingAction =
  | 'CREATED'
  | 'BOOKING_REQUESTED'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'PROVIDER_EN_ROUTE'
  | 'PROVIDER_ARRIVE'
  | 'START_SERVICE'
  | 'COMPLETE_SERVICE'
  | 'CANCELLED'
  | 'UPDATED'
  | 'ASSIGNED'
  | 'RESCHEDULE_REQUESTED'
  | 'PRICE_CHANGE_REQUESTED';

export interface RealtimeEnvelope<T extends Record<string, unknown> = Record<string, unknown>> {
  eventId: string;
  timestamp: string;
  bookingId?: string;
  urgentRequestId?: string;
  data: T;
}

export interface BookingRealtimeData {
  bookingId: string;
  status: string;
  action?: RealtimeBookingAction;
  providerId?: string;
  customerId?: string;
}

export interface ProviderJobRealtimeData extends BookingRealtimeData {
  removed?: boolean;
}
