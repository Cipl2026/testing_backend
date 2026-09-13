import { BookingStatus, TrackingState } from '@ghaarfix/shared-types';
import type { IBooking } from '@/models/Booking.js';
import { generateOtp } from '@/utils/crypto.js';
import { emitToCustomer } from '@/modules/realtime/socket.service.js';

const OTP_TTL_MS = 30 * 60 * 1000;
const MAX_ATTEMPTS = 5;

export function issueServiceStartOtp(booking: IBooking) {
  const otp = generateOtp(4);
  if (!booking.tracking) {
    booking.tracking = { state: TrackingState.ARRIVED };
  }
  booking.tracking.serviceStartOtp = otp;
  booking.tracking.serviceStartOtpExpiresAt = new Date(Date.now() + OTP_TTL_MS);
  booking.tracking.serviceStartOtpIssuedAt = new Date();
  booking.tracking.serviceStartOtpAttempts = 0;
  return otp;
}

export function clearServiceStartOtp(booking: IBooking) {
  if (!booking.tracking) return;
  booking.tracking.serviceStartOtp = undefined;
  booking.tracking.serviceStartOtpExpiresAt = undefined;
  booking.tracking.serviceStartOtpIssuedAt = undefined;
  booking.tracking.serviceStartOtpAttempts = 0;
}

export function verifyServiceStartOtp(booking: IBooking, otp: string) {
  const stored = booking.tracking?.serviceStartOtp;
  const expiresAt = booking.tracking?.serviceStartOtpExpiresAt;
  if (!stored || !expiresAt) {
    return { ok: false, reason: 'Start code is not active. Ask the customer to refresh the booking screen.' };
  }
  if (expiresAt.getTime() < Date.now()) {
    return { ok: false, reason: 'Start code has expired. Ask the customer to refresh the booking screen.' };
  }
  const attempts = booking.tracking?.serviceStartOtpAttempts ?? 0;
  if (attempts >= MAX_ATTEMPTS) {
    return { ok: false, reason: 'Too many incorrect attempts. Contact support if you need help.' };
  }
  if (stored !== otp.trim()) {
    if (booking.tracking) {
      booking.tracking.serviceStartOtpAttempts = attempts + 1;
    }
    return { ok: false, reason: 'Incorrect start code.' };
  }
  return { ok: true as const };
}

export function customerStartOtp(booking: IBooking) {
  if (booking.status !== BookingStatus.PROVIDER_ARRIVED) return undefined;
  const otp = booking.tracking?.serviceStartOtp;
  const expiresAt = booking.tracking?.serviceStartOtpExpiresAt;
  if (!otp || !expiresAt || expiresAt.getTime() < Date.now()) return undefined;
  return otp;
}

export function emitServiceStartOtp(customerId: string, bookingId: string, otp: string) {
  emitToCustomer(customerId, 'booking:start-otp', { bookingId, otp });
}
