import { describe, expect, it } from 'vitest';
import { BookingStatus, TrackingState } from '@ghaarfix/shared-types';
import type { IBooking } from '@/models/Booking.js';
import {
  clearServiceStartOtp,
  customerStartOtp,
  issueServiceStartOtp,
  verifyServiceStartOtp,
} from '@/modules/bookings/service-start-otp.service.js';

function makeBooking(overrides: Partial<IBooking> = {}): IBooking {
  return {
    status: BookingStatus.PROVIDER_ARRIVED,
    tracking: { state: TrackingState.ARRIVED },
    ...overrides,
  } as IBooking;
}

describe('service-start-otp.service', () => {
  it('issues a 4-digit OTP with expiry metadata', () => {
    const booking = makeBooking();
    const otp = issueServiceStartOtp(booking);
    expect(otp).toMatch(/^\d{4}$/);
    expect(booking.tracking?.serviceStartOtp).toBe(otp);
    expect(booking.tracking?.serviceStartOtpAttempts).toBe(0);
    expect(booking.tracking?.serviceStartOtpExpiresAt).toBeInstanceOf(Date);
  });

  it('rejects missing or expired OTP on verify', () => {
    const booking = makeBooking();
    expect(verifyServiceStartOtp(booking, '1234').ok).toBe(false);

    issueServiceStartOtp(booking);
    if (booking.tracking?.serviceStartOtpExpiresAt) {
      booking.tracking.serviceStartOtpExpiresAt = new Date(Date.now() - 1000);
    }
    expect(verifyServiceStartOtp(booking, booking.tracking!.serviceStartOtp!).ok).toBe(false);
  });

  it('accepts correct OTP and increments attempts on mismatch', () => {
    const booking = makeBooking();
    const otp = issueServiceStartOtp(booking);
    expect(verifyServiceStartOtp(booking, otp).ok).toBe(true);

    issueServiceStartOtp(booking);
    const wrong = verifyServiceStartOtp(booking, '0000');
    expect(wrong.ok).toBe(false);
    expect(booking.tracking?.serviceStartOtpAttempts).toBe(1);
  });

  it('exposes OTP to customer only while arrived and not expired', () => {
    const booking = makeBooking({ status: BookingStatus.CONFIRMED });
    issueServiceStartOtp(booking);
    expect(customerStartOtp(booking)).toBeUndefined();

    booking.status = BookingStatus.PROVIDER_ARRIVED;
    const otp = issueServiceStartOtp(booking);
    expect(customerStartOtp(booking)).toBe(otp);

    clearServiceStartOtp(booking);
    expect(customerStartOtp(booking)).toBeUndefined();
  });
});
