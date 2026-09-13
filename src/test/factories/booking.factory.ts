import { Types } from 'mongoose';
import {
  BookingSource,
  BookingStatus,
  BookingType,
  PaymentMethod,
  PaymentStatus,
  ProviderRequestStatus,
  TrackingState,
  UrgentDispatchTargetStatus,
  UrgentRequestStatus,
  UserRole,
} from '@ghaarfix/shared-types';
import { Booking } from '@/models/Booking.js';
import { UrgentDispatchTarget } from '@/models/UrgentDispatchTarget.js';
import { UrgentRequest } from '@/models/UrgentRequest.js';
import { User } from '@/models/User.js';
import { UrgentDispatchConfig } from '@/models/UrgentDispatchConfig.js';

const addressSnapshot = {
  recipientName: 'Test Customer',
  phone: '9999999999',
  addressLine1: '12 Test Street',
  city: 'Bengaluru',
  state: 'KA',
  postalCode: '560001',
  location: { latitude: 12.9716, longitude: 77.5946 },
};

export async function seedNoShowRedispatchFixture(options?: { createdAt?: Date; bookingStatus?: BookingStatus }) {
  const customer = await User.create({
    role: UserRole.CUSTOMER,
    phone: `9${Date.now()}`.slice(0, 10),
    isPhoneVerified: true,
    isProfileComplete: true,
    status: 'ACTIVE',
    fullName: 'Test Customer',
  });
  const provider = await User.create({
    role: UserRole.PROVIDER,
    phone: `8${Date.now()}`.slice(0, 10),
    isPhoneVerified: true,
    isProfileComplete: true,
    status: 'ACTIVE',
    fullName: 'Test Provider',
  });

  const serviceId = new Types.ObjectId();
  const providerServiceId = new Types.ObjectId();

  await UrgentDispatchConfig.findOneAndUpdate(
    { key: 'global' },
    { $set: { noShowMinutes: 1 } },
    { upsert: true },
  );

  const urgentRequest = await UrgentRequest.create({
    requestNumber: `URG-${Date.now()}`,
    customerId: customer._id,
    serviceId,
    providerId: provider._id,
    addressSnapshot,
    location: { type: 'Point', coordinates: [77.5946, 12.9716] },
    status: UrgentRequestStatus.ASSIGNED,
    paymentMethod: PaymentMethod.PAY_ON_SERVICE,
    pricing: {
      baseAmount: 500,
      urgentFee: 99,
      jobSubtotal: 599,
      platformFee: 50,
      providerPayoutAmount: 549,
      estimatedTotal: 599,
      currency: 'INR',
      pricingVersion: 2,
    },
    searchConfig: {
      maxDistanceKm: 8,
      maxBroadcastProviders: 10,
      broadcastCount: 1,
      currentRadiusKm: 2,
      notifiedCount: 1,
      waveIndex: 1,
    },
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  });

  const createdAt = options?.createdAt ?? new Date(Date.now() - 2 * 60 * 60 * 1000);
  const booking = await Booking.create({
    bookingNumber: `BK-${Date.now()}`,
    bookingType: BookingType.URGENT,
    source: BookingSource.URGENT_FIX,
    customerId: customer._id,
    providerId: provider._id,
    serviceId,
    providerServiceId,
    urgentRequestId: urgentRequest._id,
    addressSnapshot,
    serviceSnapshot: {
      name: 'Plumbing',
      pricing: { type: 'FIXED', startingPrice: 500, currency: 'INR' },
    },
    providerSnapshot: { fullName: 'Test Provider' },
    status: options?.bookingStatus ?? BookingStatus.CONFIRMED,
    providerRequestStatus: ProviderRequestStatus.ACCEPTED,
    scheduledStart: new Date(Date.now() + 30 * 60 * 1000),
    scheduledEnd: new Date(Date.now() + 90 * 60 * 1000),
    timezone: 'Asia/Kolkata',
    durationMinutes: 60,
    price: {
      estimatedAmount: 599,
      finalAmount: 599,
      currency: 'INR',
    },
    payment: {
      method: PaymentMethod.PAY_ON_SERVICE,
      status: PaymentStatus.PENDING,
    },
    reschedule: { providerRescheduleCount: 0 },
    tracking: { state: TrackingState.NOT_TRACKING },
    createdAt,
    updatedAt: createdAt,
  });

  await UrgentDispatchTarget.create({
    urgentRequestId: urgentRequest._id,
    providerId: provider._id,
    status: UrgentDispatchTargetStatus.ACCEPTED,
    distanceMeters: 1200,
    rankScore: 0.8,
    notifiedAt: new Date(Date.now() - 30 * 60 * 1000),
    respondedAt: new Date(Date.now() - 25 * 60 * 1000),
  });

  urgentRequest.bookingId = booking._id;
  await urgentRequest.save();

  return {
    customerId: customer._id.toString(),
    providerId: provider._id.toString(),
    bookingId: booking._id.toString(),
    urgentRequestId: urgentRequest._id.toString(),
  };
}

export async function seedScheduledBooking(customerId: string, providerId: string) {
  const serviceId = new Types.ObjectId();
  const providerServiceId = new Types.ObjectId();
  const booking = await Booking.create({
    bookingNumber: `BK-SCH-${Date.now()}`,
    bookingType: BookingType.SCHEDULED,
    source: BookingSource.SLOT_RESERVATION,
    customerId,
    providerId,
    serviceId,
    providerServiceId,
    addressSnapshot,
    serviceSnapshot: {
      name: 'Cleaning',
      pricing: { type: 'FIXED', startingPrice: 400, currency: 'INR' },
    },
    providerSnapshot: { fullName: 'Test Provider' },
    status: BookingStatus.CONFIRMED,
    providerRequestStatus: ProviderRequestStatus.ACCEPTED,
    scheduledStart: new Date(Date.now() + 24 * 60 * 60 * 1000),
    scheduledEnd: new Date(Date.now() + 25 * 60 * 60 * 1000),
    timezone: 'Asia/Kolkata',
    durationMinutes: 60,
    price: { estimatedAmount: 400, finalAmount: 400, currency: 'INR' },
    payment: { method: PaymentMethod.PAY_ON_SERVICE, status: PaymentStatus.PENDING },
    reschedule: { providerRescheduleCount: 0 },
    tracking: { state: TrackingState.NOT_TRACKING },
  });
  return booking._id.toString();
}
