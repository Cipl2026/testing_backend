/** Phase 11 — Operations & Scale shared enums */

export enum ServiceZoneType {
  CITY_WIDE = 'CITY_WIDE',
  POLYGON = 'POLYGON',
  PINCODE = 'PINCODE',
  CUSTOM = 'CUSTOM',
}

export enum ProviderCapacityStatus {
  AVAILABLE = 'AVAILABLE',
  LIMITED = 'LIMITED',
  FULL = 'FULL',
  OFFLINE = 'OFFLINE',
}

export enum WaitlistStatus {
  PENDING = 'PENDING',
  MATCHED = 'MATCHED',
  NOTIFIED = 'NOTIFIED',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
}

export enum WaitlistUrgency {
  NORMAL = 'NORMAL',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

export enum QueueJobStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  DEAD_LETTER = 'DEAD_LETTER',
}

export enum QueueName {
  URGENT_MATCHING = 'urgent-matching',
  IOT_EVENTS = 'iot-events',
  NOTIFICATIONS = 'notifications',
  MAINTENANCE = 'maintenance',
  ANALYTICS = 'analytics',
  CAMPAIGNS = 'campaigns',
  CLEANUP = 'cleanup',
}
