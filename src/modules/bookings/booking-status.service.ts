import {
  BookingStatus,
  ErrorCode,
  TimelineEventType,
  UserRole,
} from '@ghaarfix/shared-types';
import { AppError } from '@/utils/AppError.js';

type TransitionAction =
  | 'PROVIDER_ACCEPT'
  | 'PROVIDER_REJECT'
  | 'PROVIDER_EN_ROUTE'
  | 'PROVIDER_ARRIVE'
  | 'START_SERVICE'
  | 'COMPLETE_SERVICE'
  | 'CUSTOMER_CANCEL'
  | 'PROVIDER_CANCEL'
  | 'EXPIRE_PROVIDER_REQUEST'
  | 'RESCHEDULE_REQUEST'
  | 'RESCHEDULE_ACCEPT'
  | 'RESCHEDULE_REJECT';

const TRANSITIONS: Record<BookingStatus, Partial<Record<TransitionAction, BookingStatus>>> = {
  [BookingStatus.PENDING_PROVIDER]: {
    PROVIDER_ACCEPT: BookingStatus.CONFIRMED,
    PROVIDER_REJECT: BookingStatus.CANCELLED,
    CUSTOMER_CANCEL: BookingStatus.CANCELLED,
    EXPIRE_PROVIDER_REQUEST: BookingStatus.CANCELLED,
  },
  [BookingStatus.CONFIRMED]: {
    PROVIDER_EN_ROUTE: BookingStatus.PROVIDER_EN_ROUTE,
    CUSTOMER_CANCEL: BookingStatus.CANCELLED,
    PROVIDER_CANCEL: BookingStatus.CANCELLED,
    RESCHEDULE_REQUEST: BookingStatus.RESCHEDULE_REQUESTED,
  },
  [BookingStatus.RESCHEDULE_REQUESTED]: {
    RESCHEDULE_ACCEPT: BookingStatus.CONFIRMED,
    RESCHEDULE_REJECT: BookingStatus.CONFIRMED,
    CUSTOMER_CANCEL: BookingStatus.CANCELLED,
  },
  [BookingStatus.PROVIDER_EN_ROUTE]: {
    PROVIDER_ARRIVE: BookingStatus.PROVIDER_ARRIVED,
    CUSTOMER_CANCEL: BookingStatus.CANCELLED,
  },
  [BookingStatus.PROVIDER_ARRIVED]: {
    START_SERVICE: BookingStatus.IN_PROGRESS,
  },
  [BookingStatus.IN_PROGRESS]: {
    COMPLETE_SERVICE: BookingStatus.COMPLETED,
  },
  [BookingStatus.COMPLETED]: {},
  [BookingStatus.CANCELLED]: {},
};

const ROLE_ACTIONS: Record<UserRole, TransitionAction[]> = {
  [UserRole.CUSTOMER]: ['CUSTOMER_CANCEL', 'RESCHEDULE_ACCEPT', 'RESCHEDULE_REJECT'],
  [UserRole.PROVIDER]: [
    'PROVIDER_ACCEPT',
    'PROVIDER_REJECT',
    'PROVIDER_EN_ROUTE',
    'PROVIDER_ARRIVE',
    'START_SERVICE',
    'COMPLETE_SERVICE',
    'PROVIDER_CANCEL',
    'RESCHEDULE_REQUEST',
  ],
  [UserRole.ADMIN]: [
    'PROVIDER_ACCEPT',
    'PROVIDER_REJECT',
    'PROVIDER_EN_ROUTE',
    'PROVIDER_ARRIVE',
    'START_SERVICE',
    'COMPLETE_SERVICE',
    'CUSTOMER_CANCEL',
    'PROVIDER_CANCEL',
    'EXPIRE_PROVIDER_REQUEST',
    'RESCHEDULE_REQUEST',
    'RESCHEDULE_ACCEPT',
    'RESCHEDULE_REJECT',
  ],
};

export function transitionBookingStatus(
  current: BookingStatus,
  action: TransitionAction,
  role: UserRole,
): BookingStatus {
  if (!ROLE_ACTIONS[role].includes(action)) {
    throw new AppError('You are not allowed to perform this action.', 403, ErrorCode.FORBIDDEN);
  }
  const next = TRANSITIONS[current][action];
  if (!next) {
    throw new AppError('Invalid booking status transition.', 409, ErrorCode.CONFLICT);
  }
  return next;
}

export function timelineTypeForAction(action: TransitionAction): TimelineEventType {
  const map: Partial<Record<TransitionAction, TimelineEventType>> = {
    PROVIDER_ACCEPT: TimelineEventType.PROVIDER_ACCEPTED,
    PROVIDER_REJECT: TimelineEventType.PROVIDER_REJECTED,
    EXPIRE_PROVIDER_REQUEST: TimelineEventType.PROVIDER_REQUEST_EXPIRED,
    PROVIDER_EN_ROUTE: TimelineEventType.PROVIDER_EN_ROUTE,
    PROVIDER_ARRIVE: TimelineEventType.PROVIDER_ARRIVED,
    START_SERVICE: TimelineEventType.SERVICE_STARTED,
    COMPLETE_SERVICE: TimelineEventType.SERVICE_COMPLETED,
    CUSTOMER_CANCEL: TimelineEventType.CANCELLED,
    PROVIDER_CANCEL: TimelineEventType.CANCELLED,
    RESCHEDULE_REQUEST: TimelineEventType.RESCHEDULE_REQUESTED,
    RESCHEDULE_ACCEPT: TimelineEventType.RESCHEDULE_ACCEPTED,
    RESCHEDULE_REJECT: TimelineEventType.RESCHEDULE_REJECTED,
  };
  return map[action] ?? TimelineEventType.BOOKING_CREATED;
}

export type { TransitionAction };
