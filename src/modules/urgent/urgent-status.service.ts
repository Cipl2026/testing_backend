import { UrgentRequestStatus } from '@ghaarfix/shared-types';
import { AppError } from '@/utils/AppError.js';
import { ErrorCode } from '@ghaarfix/shared-types';

const VALID_TRANSITIONS: Record<UrgentRequestStatus, UrgentRequestStatus[]> = {
  [UrgentRequestStatus.SEARCHING]: [
    UrgentRequestStatus.ASSIGNED,
    UrgentRequestStatus.EXPIRED,
    UrgentRequestStatus.CANCELLED,
  ],
  [UrgentRequestStatus.ASSIGNED]: [UrgentRequestStatus.CONVERTED_TO_BOOKING],
  [UrgentRequestStatus.EXPIRED]: [],
  [UrgentRequestStatus.CANCELLED]: [],
  [UrgentRequestStatus.CONVERTED_TO_BOOKING]: [],
};

export function assertUrgentTransition(from: UrgentRequestStatus, to: UrgentRequestStatus): void {
  if (!VALID_TRANSITIONS[from]?.includes(to)) {
    throw new AppError(`Invalid urgent request transition: ${from} → ${to}`, 409, ErrorCode.CONFLICT);
  }
}
