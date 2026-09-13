import { beforeAll, describe, expect, it, vi } from 'vitest';
import '@/test/mongo-setup.js';
import { BookingStatus, ProviderRequestStatus } from '@ghaarfix/shared-types';
import { Booking } from '@/models/Booking.js';
import {
  expirePendingProviderRequests,
  waitForProviderResponse,
} from '@/modules/bookings/booking.service.js';
import { seedScheduledBooking } from '@/test/factories/booking.factory.js';

vi.mock('@/modules/realtime/socket.service.js', () => ({
  emitBookingStatusChanged: vi.fn(),
  emitToProvider: vi.fn(),
}));

vi.mock('@/modules/notifications/notification.service.js', () => ({
  notifyBookingEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/modules/bookings/timeline.service.js', () => ({
  addTimelineEvent: vi.fn().mockResolvedValue(undefined),
  listTimelineEvents: vi.fn().mockResolvedValue([]),
}));

const describeMongo = process.env.MONGODB_URI ? describe : describe.skip;

describeMongo('expirePendingProviderRequests integration', () => {
  it('marks pending bookings as expired when response window passes', async () => {
    const customerId = '507f1f77bcf86cd799439011';
    const providerId = '507f1f77bcf86cd799439012';
    const bookingId = await seedScheduledBooking(customerId, providerId);

    await Booking.findByIdAndUpdate(bookingId, {
      $set: {
        status: BookingStatus.PENDING_PROVIDER,
        providerRequestStatus: ProviderRequestStatus.PENDING,
        providerResponseExpiresAt: new Date(Date.now() - 60_000),
      },
    });

    const expired = await expirePendingProviderRequests();
    expect(expired).toBe(1);

    const booking = await Booking.findById(bookingId);
    expect(booking?.providerRequestExpiredAt).toBeTruthy();
  });

  it('lets customers extend the wait after expiry', async () => {
    const customerId = '507f1f77bcf86cd799439013';
    const providerId = '507f1f77bcf86cd799439014';
    const bookingId = await seedScheduledBooking(customerId, providerId);

    await Booking.findByIdAndUpdate(bookingId, {
      $set: {
        status: BookingStatus.PENDING_PROVIDER,
        providerRequestStatus: ProviderRequestStatus.PENDING,
        providerResponseExpiresAt: new Date(Date.now() - 60_000),
        providerRequestExpiredAt: new Date(),
      },
    });

    const result = await waitForProviderResponse(customerId, bookingId);
    expect(result.providerRequestExpiredAt).toBeUndefined();
    expect(result.providerResponseExpiresAt).toBeTruthy();
  });
});
