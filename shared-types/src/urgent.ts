export enum UrgentRequestStatus {
  SEARCHING = 'SEARCHING',
  ASSIGNED = 'ASSIGNED',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED',
  CONVERTED_TO_BOOKING = 'CONVERTED_TO_BOOKING',
}

export enum UrgentDispatchTargetStatus {
  PENDING = 'PENDING',
  NOTIFIED = 'NOTIFIED',
  VIEWED = 'VIEWED',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  LOST = 'LOST',
  EXPIRED = 'EXPIRED',
  SKIPPED = 'SKIPPED',
}

export enum ProviderPresenceStatus {
  ONLINE = 'ONLINE',
  OFFLINE = 'OFFLINE',
  BUSY = 'BUSY',
}

export const ACTIVE_URGENT_REQUEST_STATUSES: UrgentRequestStatus[] = [
  UrgentRequestStatus.SEARCHING,
  UrgentRequestStatus.ASSIGNED,
];
