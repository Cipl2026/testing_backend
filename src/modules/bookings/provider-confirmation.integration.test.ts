import { describe, expect, it, vi } from 'vitest';
import '@/test/mongo-setup.js';
import {
  BookingStatus,
  BookingType,
  PaymentMethod,
  PaymentStatus,
  ProviderRequestStatus,
  TrackingState,
  UserRole,
} from '@ghaarfix/shared-types';
import { Booking } from '@/models/Booking.js';
import { User } from '@/models/User.js';
import { requestReplacementForMissedConfirmation } from '@/modules/bookings/provider-confirmation.service.js';
import { AppError } from '@/utils/AppError.js';

vi.mock('@/modules/bookings/provider-reassignment.service.js', () => ({
  findAvailableProviderForBackup: vi.fn(),
  findAvailableProviderForBooking: vi.fn().mockResolvedValue('507f1f77bcf86cd799439031'),
  assignBackupProviderForConfirmedBooking: vi.fn().mockResolvedValue(true),
}));

vi.mock('@/modules/notifications/notification.service.js', () => ({
  notifyBookingEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/modules/notifications/notification-queue.processor.js', () => ({
  enqueuePushNotification: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/modules/realtime/socket.service.js', () => ({
  emitBookingStatusChanged: vi.fn(),
}));

vi.mock('@/modules/bookings/timeline.service.js', () => ({
  addTimelineEvent: vi.fn().mockResolvedValue(undefined),
}));

const describeMongo = process.env.MONGODB_URI ? describe : describe.skip;

describeMongo('provider confirmation integration', () => {
  it('assigns replacement when customer requests after MISSED confirmation', async () => {
    const customer = await User.create({
      role: UserRole.CUSTOMER,
      phone: `9${Date.now()}`.slice(0, 10),
      isPhoneVerified: true,
      isProfileComplete: true,
      status: 'ACTIVE',
      fullName: 'Customer',
    });
    const provider = await User.create({
      role: UserRole.PROVIDER,
      phone: `8${Date.now()}`.slice(0, 10),
      isPhoneVerified: true,
      isProfileComplete: true,
      status: 'ACTIVE',
      fullName: 'Provider',
    });

    const booking = await Booking.create({
      bookingNumber: `BK-CONF-${Date.now()}`,
      bookingType: BookingType.SCHEDULED,
      source: 'SLOT_RESERVATION',
      customerId: customer._id,
      providerId: provider._id,
      serviceId: '507f1f77bcf86cd799439041',
      providerServiceId: '507f1f77bcf86cd799439042',
      addressSnapshot: {
        recipientName: 'Customer',
        phone: '9999999999',
        addressLine1: 'Test',
        city: 'Bengaluru',
        state: 'KA',
        postalCode: '560001',
      },
      serviceSnapshot: {
        name: 'Cleaning',
        pricing: { type: 'FIXED', startingPrice: 400, currency: 'INR' },
      },
      providerSnapshot: { fullName: 'Provider' },
      status: BookingStatus.CONFIRMED,
      providerRequestStatus: ProviderRequestStatus.ACCEPTED,
      providerConfirmation: { status: 'MISSED' },
      scheduledStart: new Date(Date.now() + 60 * 60 * 1000),
      scheduledEnd: new Date(Date.now() + 2 * 60 * 60 * 1000),
      timezone: 'Asia/Kolkata',
      durationMinutes: 60,
      price: { estimatedAmount: 400, finalAmount: 400, currency: 'INR' },
      payment: { method: PaymentMethod.PAY_ON_SERVICE, status: PaymentStatus.PENDING },
      reschedule: { providerRescheduleCount: 0 },
      tracking: { state: TrackingState.NOT_TRACKING },
    });

    const result = await requestReplacementForMissedConfirmation(
      customer._id.toString(),
      booking._id.toString(),
    );

    expect(result.assigned).toBe(true);
    expect(result.providerId).toBe('507f1f77bcf86cd799439031');
  });

  it('rejects replacement when confirmation was not missed', async () => {
    const customer = await User.create({
      role: UserRole.CUSTOMER,
      phone: `9${Date.now()}1`.slice(0, 10),
      isPhoneVerified: true,
      isProfileComplete: true,
      status: 'ACTIVE',
      fullName: 'Customer',
    });
    const provider = await User.create({
      role: UserRole.PROVIDER,
      phone: `8${Date.now()}1`.slice(0, 10),
      isPhoneVerified: true,
      isProfileComplete: true,
      status: 'ACTIVE',
      fullName: 'Provider',
    });

    const booking = await Booking.create({
      bookingNumber: `BK-CONF-${Date.now()}-2`,
      bookingType: BookingType.SCHEDULED,
      source: 'SLOT_RESERVATION',
      customerId: customer._id,
      providerId: provider._id,
      serviceId: '507f1f77bcf86cd799439051',
      providerServiceId: '507f1f77bcf86cd799439052',
      addressSnapshot: {
        recipientName: 'Customer',
        phone: '9999999999',
        addressLine1: 'Test',
        city: 'Bengaluru',
        state: 'KA',
        postalCode: '560001',
      },
      serviceSnapshot: {
        name: 'Cleaning',
        pricing: { type: 'FIXED', startingPrice: 400, currency: 'INR' },
      },
      providerSnapshot: { fullName: 'Provider' },
      status: BookingStatus.CONFIRMED,
      providerRequestStatus: ProviderRequestStatus.ACCEPTED,
      providerConfirmation: { status: 'PENDING' },
      scheduledStart: new Date(Date.now() + 60 * 60 * 1000),
      scheduledEnd: new Date(Date.now() + 2 * 60 * 60 * 1000),
      timezone: 'Asia/Kolkata',
      durationMinutes: 60,
      price: { estimatedAmount: 400, finalAmount: 400, currency: 'INR' },
      payment: { method: PaymentMethod.PAY_ON_SERVICE, status: PaymentStatus.PENDING },
      reschedule: { providerRescheduleCount: 0 },
      tracking: { state: TrackingState.NOT_TRACKING },
    });

    await expect(
      requestReplacementForMissedConfirmation(customer._id.toString(), booking._id.toString()),
    ).rejects.toBeInstanceOf(AppError);
  });
});
