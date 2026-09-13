export enum BookingStatus {
  PENDING_PROVIDER = 'PENDING_PROVIDER',
  CONFIRMED = 'CONFIRMED',
  PROVIDER_EN_ROUTE = 'PROVIDER_EN_ROUTE',
  PROVIDER_ARRIVED = 'PROVIDER_ARRIVED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  RESCHEDULE_REQUESTED = 'RESCHEDULE_REQUESTED',
}

export enum BookingType {
  SCHEDULED = 'SCHEDULED',
  URGENT = 'URGENT',
}

export enum BookingSource {
  SLOT_RESERVATION = 'SLOT_RESERVATION',
  URGENT_FIX = 'URGENT_FIX',
  HOME_HELP = 'HOME_HELP',
  QUICK_SERVICES = 'QUICK_SERVICES',
}

export enum PaymentMethod {
  ONLINE = 'ONLINE',
  PAY_ON_SERVICE = 'PAY_ON_SERVICE',
}

export enum PaymentStatus {
  CREATED = 'CREATED',
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  PAID = 'PAID',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
  PAY_ON_SERVICE = 'PAY_ON_SERVICE',
}

export enum ProviderRequestStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED',
}

export enum TrackingState {
  NOT_TRACKING = 'NOT_TRACKING',
  EN_ROUTE = 'EN_ROUTE',
  ARRIVED = 'ARRIVED',
  SERVICE_ACTIVE = 'SERVICE_ACTIVE',
  COMPLETED = 'COMPLETED',
}

export enum EtaSource {
  STRAIGHT_LINE = 'STRAIGHT_LINE',
  ROUTING_API = 'ROUTING_API',
  UNAVAILABLE = 'UNAVAILABLE',
}

export enum RescheduleStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
}

export enum PriceChangeStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export enum RejectReasonCategory {
  NOT_AVAILABLE = 'NOT_AVAILABLE',
  TOO_FAR = 'TOO_FAR',
  SCHEDULE_CONFLICT = 'SCHEDULE_CONFLICT',
  SERVICE_NOT_OFFERED = 'SERVICE_NOT_OFFERED',
  OTHER = 'OTHER',
}

export enum TimelineEventType {
  BOOKING_CREATED = 'BOOKING_CREATED',
  BOOKING_CONFIRMED = 'BOOKING_CONFIRMED',
  PROVIDER_ACCEPTED = 'PROVIDER_ACCEPTED',
  PROVIDER_REJECTED = 'PROVIDER_REJECTED',
  PROVIDER_REQUEST_EXPIRED = 'PROVIDER_REQUEST_EXPIRED',
  PROVIDER_EN_ROUTE = 'PROVIDER_EN_ROUTE',
  PROVIDER_ARRIVED = 'PROVIDER_ARRIVED',
  PROVIDER_CONFIRMED = 'PROVIDER_CONFIRMED',
  PROVIDER_REPLACED = 'PROVIDER_REPLACED',
  SERVICE_STARTED = 'SERVICE_STARTED',
  SERVICE_COMPLETED = 'SERVICE_COMPLETED',
  CUSTOMER_CONFIRMED_COMPLETION = 'CUSTOMER_CONFIRMED_COMPLETION',
  CANCELLED = 'CANCELLED',
  RESCHEDULE_REQUESTED = 'RESCHEDULE_REQUESTED',
  RESCHEDULE_ACCEPTED = 'RESCHEDULE_ACCEPTED',
  RESCHEDULE_REJECTED = 'RESCHEDULE_REJECTED',
  PRICE_CHANGE_REQUESTED = 'PRICE_CHANGE_REQUESTED',
  PRICE_CHANGE_APPROVED = 'PRICE_CHANGE_APPROVED',
  PRICE_CHANGE_REJECTED = 'PRICE_CHANGE_REJECTED',
  REVIEW_SUBMITTED = 'REVIEW_SUBMITTED',
  INVOICE_ISSUED = 'INVOICE_ISSUED',
  SERVICE_EVIDENCE_UPLOADED = 'SERVICE_EVIDENCE_UPLOADED',
  SUPPORT_TICKET_CREATED = 'SUPPORT_TICKET_CREATED',
  URGENT_PROVIDER_ASSIGNED = 'URGENT_PROVIDER_ASSIGNED',
}

export enum AddressLabel {
  HOME = 'HOME',
  WORK = 'WORK',
  OTHER = 'OTHER',
}

export enum QuickServicesBookingMode {
  INSTANT = 'instant',
  SCHEDULED = 'scheduled',
  RECURRING = 'recurring',
}

export interface QuickServicesSnapshot {
  bookingMode: QuickServicesBookingMode;
  photoUrls?: string[];
}

export enum ServiceAreaType {
  RADIUS = 'RADIUS',
  POSTAL_CODES = 'POSTAL_CODES',
}

export enum TimeOffType {
  TIME_OFF = 'TIME_OFF',
  BREAK = 'BREAK',
}

export enum ProviderDiscoverySort {
  RECOMMENDED = 'RECOMMENDED',
  NEAREST = 'NEAREST',
  EXPERIENCE = 'EXPERIENCE',
}

export enum SlotReservationStatus {
  HELD = 'HELD',
  CONSUMED = 'CONSUMED',
  RELEASED = 'RELEASED',
  EXPIRED = 'EXPIRED',
}

export type DayOfWeek =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday';

export interface DaySchedule {
  enabled: boolean;
  startTime: string;
  endTime: string;
}

export interface WeeklySchedule {
  monday: DaySchedule;
  tuesday: DaySchedule;
  wednesday: DaySchedule;
  thursday: DaySchedule;
  friday: DaySchedule;
  saturday: DaySchedule;
  sunday: DaySchedule;
}

export interface AssetSnapshot {
  name?: string;
  assetTypeName?: string;
  brand?: string;
  model?: string;
  serialNumber?: string;
  roomName?: string;
}

export const BLOCKING_BOOKING_STATUSES: BookingStatus[] = [
  BookingStatus.PENDING_PROVIDER,
  BookingStatus.CONFIRMED,
  BookingStatus.PROVIDER_EN_ROUTE,
  BookingStatus.PROVIDER_ARRIVED,
  BookingStatus.IN_PROGRESS,
  BookingStatus.RESCHEDULE_REQUESTED,
];
