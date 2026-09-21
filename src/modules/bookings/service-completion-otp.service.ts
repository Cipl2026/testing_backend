import { BookingStatus, TrackingState } from '@ghaarfix/shared-types';
import type { IBooking } from '@/models/Booking.js';
import { generateOtp } from '@/utils/crypto.js';
import { emitToCustomer } from '@/modules/realtime/socket.service.js';

const OTP_TTL_MS = 4 * 60 * 60 * 1000;

export function issueServiceCompletionOtp(booking: IBooking) {
  const otp = generateOtp(4);
  if (!booking.tracking) {
    booking.tracking = { state: TrackingState.SERVICE_ACTIVE };
  }
  booking.tracking.serviceCompletionOtp = otp;
  booking.tracking.serviceCompletionOtpExpiresAt = new Date(Date.now() + OTP_TTL_MS);
  booking.tracking.serviceCompletionOtpIssuedAt = new Date();
  return otp;
}

export function clearServiceCompletionOtp(booking: IBooking) {
  if (!booking.tracking) return;
  booking.tracking.serviceCompletionOtp = undefined;
  booking.tracking.serviceCompletionOtpExpiresAt = undefined;
  booking.tracking.serviceCompletionOtpIssuedAt = undefined;
}

export function verifyServiceCompletionOtp(booking: IBooking, otp: string) {
  const stored = booking.tracking?.serviceCompletionOtp;
  const expiresAt = booking.tracking?.serviceCompletionOtpExpiresAt;
  if (!stored || !expiresAt) {
    return { ok: false, reason: 'Completion code is not active for this booking.' };
  }
  if (expiresAt.getTime() < Date.now()) {
    return { ok: false, reason: 'Completion code has expired. Ask the customer to refresh the booking screen.' };
  }
  if (stored !== otp.trim()) {
    return { ok: false, reason: 'Incorrect completion code.' };
  }
  return { ok: true as const };
}

export function customerCompletionOtp(booking: IBooking) {
  if (booking.status !== BookingStatus.IN_PROGRESS) return undefined;
  const otp = booking.tracking?.serviceCompletionOtp;
  const expiresAt = booking.tracking?.serviceCompletionOtpExpiresAt;
  if (!otp || !expiresAt || expiresAt.getTime() < Date.now()) return undefined;
  return otp;
}

export function emitServiceCompletionOtp(customerId: string, bookingId: string, otp: string) {
  emitToCustomer(customerId, 'booking:service-otp', {
    bookingId,
    otp,
    status: 'IN_PROGRESS',
    kind: 'completion',
  });
}
