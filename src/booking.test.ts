import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { DateTime } from 'luxon';
import {
  PaymentMethod,
  PricingType,
  ProviderServiceApprovalStatus,
  ProviderStatus,
  ServiceAreaType,
  SlotReservationStatus,
} from '@ghaarfix/shared-types';
import { createApp } from '@/app.js';
import { connectDatabase, disconnectDatabase } from '@/config/database.js';
import { Booking } from '@/models/Booking.js';
import { BookingIdempotency } from '@/models/BookingIdempotency.js';
import { Category } from '@/models/Category.js';
import { Otp } from '@/models/Otp.js';
import { ProviderProfile } from '@/models/ProviderProfile.js';
import { ProviderSchedule } from '@/models/ProviderSchedule.js';
import { ProviderService } from '@/models/ProviderService.js';
import { ProviderServiceArea } from '@/models/ProviderServiceArea.js';
import { Service } from '@/models/Service.js';
import { SlotReservation } from '@/models/SlotReservation.js';
import { Subcategory } from '@/models/Subcategory.js';
import { seedAdminUser } from '@/modules/auth/auth.service.js';
import { hashOtp } from '@/utils/crypto.js';

const app = createApp();

const ADDRESS_PAYLOAD = {
  label: 'HOME',
  recipientName: 'Test User',
  phone: '9876543210',
  addressLine1: '12 MG Road',
  city: 'Bengaluru',
  state: 'Karnataka',
  postalCode: '560001',
  country: 'India',
  latitude: 12.9716,
  longitude: 77.5946,
};

async function clearDatabase() {
  await Promise.all(
    Object.values(mongoose.connection.collections).map((c) => c.deleteMany({})),
  );
}

async function loginCustomer(phone = '9876543210') {
  await Otp.create({
    requestId: `req-${phone}`,
    phone: `+91${phone}`,
    role: 'CUSTOMER',
    otpHash: hashOtp('123456'),
    expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    attempts: 0,
    isVerified: false,
    lastSentAt: new Date(),
  });
  const res = await request(app)
    .post('/api/v1/auth/verify-otp')
    .send({ phone, otp: '123456', role: 'CUSTOMER' });
  return { token: res.body.data.accessToken as string, userId: res.body.data.user.id as string };
}

async function loginProvider(phone = '9876543211') {
  await Otp.create({
    requestId: `req-${phone}`,
    phone: `+91${phone}`,
    role: 'PROVIDER',
    otpHash: hashOtp('123456'),
    expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    attempts: 0,
    isVerified: false,
    lastSentAt: new Date(),
  });
  const res = await request(app)
    .post('/api/v1/auth/verify-otp')
    .send({ phone, otp: '123456', role: 'PROVIDER' });
  const userId = res.body.data.user.id as string;
  await ProviderProfile.findOneAndUpdate(
    { userId },
    { providerStatus: ProviderStatus.ACTIVE, fullName: 'Pro User', experienceYears: 5, languages: ['English'] },
    { upsert: true },
  );
  return { token: res.body.data.accessToken as string, userId };
}

async function seedCatalogAndProvider(providerUserId: string) {
  const category = await Category.create({ name: 'Plumbing', slug: 'plumbing', isActive: true, displayOrder: 1 });
  const subcategory = await Subcategory.create({
    categoryId: category._id,
    name: 'Bathroom',
    slug: 'bathroom',
    isActive: true,
    displayOrder: 1,
  });
  const service = await Service.create({
    categoryId: category._id,
    subcategoryId: subcategory._id,
    name: 'Tap Repair',
    slug: 'tap-repair',
    shortDescription: 'Fix taps',
    pricing: { type: PricingType.STARTING_FROM, startingPrice: 199, currency: 'INR' },
    estimatedDuration: { minMinutes: 30, maxMinutes: 60 },
    whatIsIncluded: [],
    whatIsNotIncluded: [],
    faqs: [],
    isActive: true,
    isFeatured: true,
    displayOrder: 1,
  });
  const ps = await ProviderService.create({
    providerId: providerUserId,
    serviceId: service._id,
    approvalStatus: ProviderServiceApprovalStatus.APPROVED,
    isActive: true,
    experienceYears: 5,
    customPricing: { enabled: false },
  });
  await ProviderServiceArea.create({
    providerId: providerUserId,
    name: 'Base',
    type: ServiceAreaType.RADIUS,
    center: { latitude: 12.9716, longitude: 77.5946 },
    radiusKm: 15,
    isActive: true,
  });
  await ProviderSchedule.create({
    providerId: providerUserId,
    timezone: 'Asia/Kolkata',
    isActive: true,
    weeklySchedule: {
      monday: { enabled: true, startTime: '09:00', endTime: '18:00' },
      tuesday: { enabled: true, startTime: '09:00', endTime: '18:00' },
      wednesday: { enabled: true, startTime: '09:00', endTime: '18:00' },
      thursday: { enabled: true, startTime: '09:00', endTime: '18:00' },
      friday: { enabled: true, startTime: '09:00', endTime: '18:00' },
      saturday: { enabled: true, startTime: '09:00', endTime: '18:00' },
      sunday: { enabled: true, startTime: '09:00', endTime: '18:00' },
    },
  });
  return { service, ps };
}

async function createHeldReservation(customer: { token: string; userId: string }, providerUserId: string, serviceId: string) {
  const address = await request(app)
    .post('/api/v1/addresses')
    .set('Authorization', `Bearer ${customer.token}`)
    .send(ADDRESS_PAYLOAD);
  const date = DateTime.now().setZone('Asia/Kolkata').plus({ days: 2 }).toISODate()!;
  const slots = await request(app)
    .get(`/api/v1/providers/${providerUserId}/availability`)
    .query({ serviceId, addressId: address.body.data.id, date })
    .set('Authorization', `Bearer ${customer.token}`);
  const slot = slots.body.data.slots.find((s: { available: boolean }) => s.available);
  const reservation = await request(app)
    .post('/api/v1/availability/reservations')
    .set('Authorization', `Bearer ${customer.token}`)
    .send({
      providerId: providerUserId,
      serviceId,
      addressId: address.body.data.id,
      startDateTime: slot.startDateTime,
    });
  return { reservation: reservation.body.data, addressId: address.body.data.id };
}

describe('Phase 5 Booking API', () => {
  beforeAll(async () => {
    await connectDatabase();
    await seedAdminUser();
  });
  afterAll(async () => disconnectDatabase());
  beforeEach(async () => {
    await clearDatabase();
    await seedAdminUser();
  });

  it('creates booking from reservation', async () => {
    const customer = await loginCustomer();
    const provider = await loginProvider();
    const { service } = await seedCatalogAndProvider(provider.userId);
    const { reservation } = await createHeldReservation(customer, provider.userId, service._id.toString());
    const res = await request(app)
      .post('/api/v1/bookings')
      .set('Authorization', `Bearer ${customer.token}`)
      .send({ reservationId: reservation.id, paymentMethod: PaymentMethod.PAY_ON_SERVICE });
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('PENDING_PROVIDER');
    expect(res.body.data.bookingNumber).toMatch(/^GF-/);
  });

  it('prevents booking from another customer reservation', async () => {
    const customer = await loginCustomer('9876543210');
    const other = await loginCustomer('9876543212');
    const provider = await loginProvider();
    const { service } = await seedCatalogAndProvider(provider.userId);
    const { reservation } = await createHeldReservation(customer, provider.userId, service._id.toString());
    const res = await request(app)
      .post('/api/v1/bookings')
      .set('Authorization', `Bearer ${other.token}`)
      .send({ reservationId: reservation.id, paymentMethod: PaymentMethod.PAY_ON_SERVICE });
    expect(res.status).toBe(409);
  });

  it('prevents double consumption of reservation', async () => {
    const customer = await loginCustomer();
    const provider = await loginProvider();
    const { service } = await seedCatalogAndProvider(provider.userId);
    const { reservation } = await createHeldReservation(customer, provider.userId, service._id.toString());
    const first = await request(app)
      .post('/api/v1/bookings')
      .set('Authorization', `Bearer ${customer.token}`)
      .send({ reservationId: reservation.id, paymentMethod: PaymentMethod.PAY_ON_SERVICE });
    expect(first.status).toBe(201);
    const second = await request(app)
      .post('/api/v1/bookings')
      .set('Authorization', `Bearer ${customer.token}`)
      .send({ reservationId: reservation.id, paymentMethod: PaymentMethod.PAY_ON_SERVICE });
    expect(await Booking.countDocuments()).toBe(1);
    expect(second.body.data.id).toBe(first.body.data.id);
  });

  it('supports idempotent booking creation', async () => {
    const customer = await loginCustomer();
    const provider = await loginProvider();
    const { service } = await seedCatalogAndProvider(provider.userId);
    const { reservation } = await createHeldReservation(customer, provider.userId, service._id.toString());
    const key = 'idem-key-1';
    const first = await request(app)
      .post('/api/v1/bookings')
      .set('Authorization', `Bearer ${customer.token}`)
      .set('Idempotency-Key', key)
      .send({ reservationId: reservation.id, paymentMethod: PaymentMethod.PAY_ON_SERVICE });
    const second = await request(app)
      .post('/api/v1/bookings')
      .set('Authorization', `Bearer ${customer.token}`)
      .set('Idempotency-Key', key)
      .send({ reservationId: reservation.id, paymentMethod: PaymentMethod.PAY_ON_SERVICE });
    expect(first.body.data.id).toBe(second.body.data.id);
    const count = await BookingIdempotency.countDocuments({ key });
    expect(count).toBe(1);
  });

  it('allows provider to accept booking', async () => {
    const customer = await loginCustomer();
    const provider = await loginProvider();
    const { service } = await seedCatalogAndProvider(provider.userId);
    const { reservation } = await createHeldReservation(customer, provider.userId, service._id.toString());
    const created = await request(app)
      .post('/api/v1/bookings')
      .set('Authorization', `Bearer ${customer.token}`)
      .send({ reservationId: reservation.id, paymentMethod: PaymentMethod.PAY_ON_SERVICE });
    const res = await request(app)
      .post(`/api/v1/provider/bookings/${created.body.data.id}/accept`)
      .set('Authorization', `Bearer ${provider.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('CONFIRMED');
  });

  it('prevents non-provider from accepting', async () => {
    const customer = await loginCustomer();
    const provider = await loginProvider();
    const otherProvider = await loginProvider('9876543212');
    const { service } = await seedCatalogAndProvider(provider.userId);
    const { reservation } = await createHeldReservation(customer, provider.userId, service._id.toString());
    const created = await request(app)
      .post('/api/v1/bookings')
      .set('Authorization', `Bearer ${customer.token}`)
      .send({ reservationId: reservation.id, paymentMethod: PaymentMethod.PAY_ON_SERVICE });
    const res = await request(app)
      .post(`/api/v1/provider/bookings/${created.body.data.id}/accept`)
      .set('Authorization', `Bearer ${otherProvider.token}`);
    expect(res.status).toBe(404);
  });

  it('rejects expired reservation booking', async () => {
    const customer = await loginCustomer();
    const provider = await loginProvider();
    const { service, ps } = await seedCatalogAndProvider(provider.userId);
    const address = await request(app)
      .post('/api/v1/addresses')
      .set('Authorization', `Bearer ${customer.token}`)
      .send(ADDRESS_PAYLOAD);
    const start = DateTime.now().setZone('Asia/Kolkata').plus({ days: 3 }).set({ hour: 10 }).toUTC().toJSDate();
    const reservation = await SlotReservation.create({
      providerId: provider.userId,
      serviceId: service._id,
      customerId: customer.userId,
      addressId: address.body.data.id,
      startDateTime: start,
      endDateTime: new Date(start.getTime() + 75 * 60 * 1000),
      status: SlotReservationStatus.HELD,
      expiresAt: new Date(Date.now() - 1000),
    });
    void ps;
    const res = await request(app)
      .post('/api/v1/bookings')
      .set('Authorization', `Bearer ${customer.token}`)
      .send({ reservationId: reservation._id.toString(), paymentMethod: PaymentMethod.PAY_ON_SERVICE });
    expect(res.status).toBe(409);
  });

  it('validates status transitions for customer', async () => {
    const customer = await loginCustomer();
    const provider = await loginProvider();
    const { service } = await seedCatalogAndProvider(provider.userId);
    const { reservation } = await createHeldReservation(customer, provider.userId, service._id.toString());
    const created = await request(app)
      .post('/api/v1/bookings')
      .set('Authorization', `Bearer ${customer.token}`)
      .send({ reservationId: reservation.id, paymentMethod: PaymentMethod.PAY_ON_SERVICE });
    const res = await request(app)
      .post(`/api/v1/provider/bookings/${created.body.data.id}/start`)
      .set('Authorization', `Bearer ${provider.token}`);
    expect(res.status).toBe(409);
  });
});
