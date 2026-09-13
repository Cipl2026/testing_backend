import { beforeAll, describe, expect, it, vi } from 'vitest';
import '@/test/mongo-setup.js';
import {
  BookingStatus,
  BookingType,
  UrgentDispatchTargetStatus,
  UrgentRequestStatus,
} from '@ghaarfix/shared-types';
import { Booking } from '@/models/Booking.js';
import { UrgentDispatchTarget } from '@/models/UrgentDispatchTarget.js';
import { UrgentRequest } from '@/models/UrgentRequest.js';
import { redispatchAfterNoShow } from '@/modules/bookings/booking.service.js';
import { AppError } from '@/utils/AppError.js';
import {
  seedNoShowRedispatchFixture,
  seedScheduledBooking,
} from '@/test/factories/booking.factory.js';

vi.mock('@/modules/urgent/urgent-wave.service.js', () => ({
  startUrgentSearchWaves: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/modules/presence/presence.service.js', () => ({
  setProviderOnline: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/modules/realtime/socket.service.js', () => ({
  emitBookingStatusChanged: vi.fn(),
  emitToProvider: vi.fn(),
  emitUrgentSearching: vi.fn(),
}));

vi.mock('@/modules/notifications/notification.service.js', () => ({
  notifyBookingEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/modules/bookings/timeline.service.js', () => ({
  addTimelineEvent: vi.fn().mockResolvedValue(undefined),
}));

const describeMongo = process.env.MONGODB_URI ? describe : describe.skip;

describeMongo('redispatchAfterNoShow integration', () => {
  it('cancels booking and resets urgent request after no-show window', async () => {
    const fixture = await seedNoShowRedispatchFixture();

    const result = await redispatchAfterNoShow(fixture.customerId, fixture.bookingId, 'Did not arrive');

    expect(result.redispatch).toBe(true);
    expect(result.urgentRequestId).toBe(fixture.urgentRequestId);

    const booking = await Booking.findById(fixture.bookingId);
    expect(booking?.status).toBe(BookingStatus.CANCELLED);

    const request = await UrgentRequest.findById(fixture.urgentRequestId);
    expect(request?.status).toBe(UrgentRequestStatus.SEARCHING);
    expect(request?.providerId).toBeUndefined();

    const target = await UrgentDispatchTarget.findOne({
      urgentRequestId: fixture.urgentRequestId,
      providerId: fixture.providerId,
    });
    expect(target?.status).toBe(UrgentDispatchTargetStatus.REJECTED);
  });

  it('rejects escalation before no-show window elapses', async () => {
    const fixture = await seedNoShowRedispatchFixture({
      createdAt: new Date(),
    });

    await expect(
      redispatchAfterNoShow(fixture.customerId, fixture.bookingId, 'Too early'),
    ).rejects.toBeInstanceOf(AppError);
  });

  it('rejects scheduled bookings', async () => {
    const fixture = await seedNoShowRedispatchFixture();
    const scheduledBookingId = await seedScheduledBooking(fixture.customerId, fixture.providerId);

    await expect(
      redispatchAfterNoShow(fixture.customerId, scheduledBookingId, 'Wrong type'),
    ).rejects.toMatchObject({
      message: expect.stringContaining('Only urgent bookings'),
    });
  });

  it('rejects when booking is not in an eligible status', async () => {
    const fixture = await seedNoShowRedispatchFixture({
      bookingStatus: BookingStatus.IN_PROGRESS,
    });

    await expect(
      redispatchAfterNoShow(fixture.customerId, fixture.bookingId, 'Already started'),
    ).rejects.toMatchObject({
      message: expect.stringContaining('cannot be re-dispatched'),
    });
  });
});
