import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { DateTime } from 'luxon';
import {
  BookingStatus,
  BookingSource,
  BookingType,
  PaymentMethod,
  PaymentStatus,
  PricingType,
  ProviderRequestStatus,
  ProviderServiceApprovalStatus,
  ProviderStatus,
  ServiceAreaType,
} from '@ghaarfix/shared-types';
import { createApp } from '@/app.js';
import { connectDatabase, disconnectDatabase } from '@/config/database.js';
import { env } from '@/config/env.js';
import { Booking } from '@/models/Booking.js';
import { Category } from '@/models/Category.js';
import { CustomerAddress } from '@/models/CustomerAddress.js';
import { Otp } from '@/models/Otp.js';
import { ProviderProfile } from '@/models/ProviderProfile.js';
import { ProviderSchedule } from '@/models/ProviderSchedule.js';
import { ProviderService } from '@/models/ProviderService.js';
import { ProviderServiceArea } from '@/models/ProviderServiceArea.js';
import { ProviderTimeOff } from '@/models/ProviderTimeOff.js';
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
  const collections = mongoose.connection.collections;
  await Promise.all(Object.values(collections).map((c) => c.deleteMany({})));
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

async function seedServiceCatalog() {
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
  return { service };
}

async function setupEligibleProvider(serviceId: string, providerUserId: string, radiusKm = 10) {
  await ProviderService.create({
    providerId: providerUserId,
    serviceId,
    approvalStatus: ProviderServiceApprovalStatus.APPROVED,
    isActive: true,
    experienceYears: 5,
    customPricing: { enabled: false },
  });
  await ProviderServiceArea.create({
    providerId: providerUserId,
    name: 'Home Base',
    type: ServiceAreaType.RADIUS,
    center: { latitude: 12.9716, longitude: 77.5946 },
    radiusKm,
    postalCodes: [],
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
}

describe('Phase 4 Availability API', () => {
  beforeAll(async () => {
    await connectDatabase();
    await seedAdminUser();
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  beforeEach(async () => {
    await clearDatabase();
    await seedAdminUser();
  });

  it('allows customer to create address', async () => {
    const { token } = await loginCustomer();
    const res = await request(app)
      .post('/api/v1/addresses')
      .set('Authorization', `Bearer ${token}`)
      .send(ADDRESS_PAYLOAD);
    expect(res.status).toBe(201);
    expect(res.body.data.isDefault).toBe(true);
  });

  it('prevents customer from modifying another customer address', async () => {
    const a = await loginCustomer('9876543210');
    const b = await loginCustomer('9876543212');
    const created = await request(app)
      .post('/api/v1/addresses')
      .set('Authorization', `Bearer ${a.token}`)
      .send(ADDRESS_PAYLOAD);
    const res = await request(app)
      .patch(`/api/v1/addresses/${created.body.data.id}`)
      .set('Authorization', `Bearer ${b.token}`)
      .send({ city: 'Mumbai' });
    expect(res.status).toBe(404);
  });

  it('ensures only one default address', async () => {
    const { token } = await loginCustomer();
    await request(app)
      .post('/api/v1/addresses')
      .set('Authorization', `Bearer ${token}`)
      .send(ADDRESS_PAYLOAD);
    const second = await request(app)
      .post('/api/v1/addresses')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...ADDRESS_PAYLOAD, addressLine1: 'Second Home', isDefault: true });
    expect(second.status).toBe(201);
    const list = await request(app)
      .get('/api/v1/addresses')
      .set('Authorization', `Bearer ${token}`);
    const defaults = list.body.data.items.filter((i: { isDefault: boolean }) => i.isDefault);
    expect(defaults).toHaveLength(1);
  });

  it('allows provider to create service area', async () => {
    const { token } = await loginProvider();
    const res = await request(app)
      .post('/api/v1/providers/me/service-areas')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Base',
        type: 'RADIUS',
        latitude: 12.97,
        longitude: 77.59,
        radiusKm: 8,
      });
    expect(res.status).toBe(201);
  });

  it('hides provider outside service area', async () => {
    const { token } = await loginCustomer();
    const provider = await loginProvider();
    const { service } = await seedServiceCatalog();
    await setupEligibleProvider(service._id.toString(), provider.userId, 1);
    const address = await request(app)
      .post('/api/v1/addresses')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...ADDRESS_PAYLOAD, latitude: 13.5, longitude: 78.0 });
    const res = await request(app)
      .get(`/api/v1/services/${service._id}/providers`)
      .query({ addressId: address.body.data.id })
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(0);
  });

  it('shows provider inside service area', async () => {
    const { token } = await loginCustomer();
    const provider = await loginProvider();
    const { service } = await seedServiceCatalog();
    await setupEligibleProvider(service._id.toString(), provider.userId, 15);
    const address = await request(app)
      .post('/api/v1/addresses')
      .set('Authorization', `Bearer ${token}`)
      .send(ADDRESS_PAYLOAD);
    const res = await request(app)
      .get(`/api/v1/services/${service._id}/providers`)
      .query({ addressId: address.body.data.id })
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.items.length).toBeGreaterThan(0);
  });

  it('hides inactive provider', async () => {
    const { token } = await loginCustomer();
    const provider = await loginProvider();
    const { service } = await seedServiceCatalog();
    await setupEligibleProvider(service._id.toString(), provider.userId);
    await ProviderProfile.updateOne({ userId: provider.userId }, { providerStatus: ProviderStatus.INACTIVE });
    const address = await request(app)
      .post('/api/v1/addresses')
      .set('Authorization', `Bearer ${token}`)
      .send(ADDRESS_PAYLOAD);
    const res = await request(app)
      .get(`/api/v1/services/${service._id}/providers`)
      .query({ addressId: address.body.data.id })
      .set('Authorization', `Bearer ${token}`);
    expect(res.body.data.items).toHaveLength(0);
  });

  it('hides unapproved provider service', async () => {
    const { token } = await loginCustomer();
    const provider = await loginProvider();
    const { service } = await seedServiceCatalog();
    await ProviderService.create({
      providerId: provider.userId,
      serviceId: service._id.toString(),
      approvalStatus: ProviderServiceApprovalStatus.PENDING,
      isActive: true,
      customPricing: { enabled: false },
    });
    await ProviderServiceArea.create({
      providerId: provider.userId,
      name: 'Base',
      type: ServiceAreaType.RADIUS,
      center: { latitude: 12.9716, longitude: 77.5946 },
      radiusKm: 10,
      isActive: true,
    });
    const address = await request(app)
      .post('/api/v1/addresses')
      .set('Authorization', `Bearer ${token}`)
      .send(ADDRESS_PAYLOAD);
    const res = await request(app)
      .get(`/api/v1/services/${service._id}/providers`)
      .query({ addressId: address.body.data.id })
      .set('Authorization', `Bearer ${token}`);
    expect(res.body.data.items).toHaveLength(0);
  });

  it('generates slots for provider schedule', async () => {
    const customer = await loginCustomer();
    const provider = await loginProvider();
    const { service } = await seedServiceCatalog();
    await setupEligibleProvider(service._id.toString(), provider.userId);
    const address = await request(app)
      .post('/api/v1/addresses')
      .set('Authorization', `Bearer ${customer.token}`)
      .send(ADDRESS_PAYLOAD);
    const date = DateTime.now().setZone('Asia/Kolkata').plus({ days: 1 }).toISODate()!;
    const res = await request(app)
      .get(`/api/v1/providers/${provider.userId}/availability`)
      .query({ serviceId: service._id.toString(), addressId: address.body.data.id, date })
      .set('Authorization', `Bearer ${customer.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.slots.length).toBeGreaterThan(0);
  });

  it('does not return past slots for today', async () => {
    const customer = await loginCustomer();
    const provider = await loginProvider();
    const { service } = await seedServiceCatalog();
    await setupEligibleProvider(service._id.toString(), provider.userId);
    const address = await request(app)
      .post('/api/v1/addresses')
      .set('Authorization', `Bearer ${customer.token}`)
      .send(ADDRESS_PAYLOAD);
    const date = DateTime.now().setZone('Asia/Kolkata').toISODate()!;
    const res = await request(app)
      .get(`/api/v1/providers/${provider.userId}/availability`)
      .query({ serviceId: service._id.toString(), addressId: address.body.data.id, date })
      .set('Authorization', `Bearer ${customer.token}`);
    const available = res.body.data.slots.filter((s: { available: boolean }) => s.available);
    for (const slot of available) {
      expect(new Date(slot.startDateTime).getTime()).toBeGreaterThan(Date.now());
    }
  });

  it('blocks slots during provider time off', async () => {
    const customer = await loginCustomer();
    const provider = await loginProvider();
    const { service } = await seedServiceCatalog();
    await setupEligibleProvider(service._id.toString(), provider.userId);
    const date = DateTime.now().setZone('Asia/Kolkata').plus({ days: 1 });
    await ProviderTimeOff.create({
      providerId: provider.userId,
      startDateTime: date.set({ hour: 0 }).toUTC().toJSDate(),
      endDateTime: date.set({ hour: 23, minute: 59 }).toUTC().toJSDate(),
      type: 'TIME_OFF',
    });
    const address = await request(app)
      .post('/api/v1/addresses')
      .set('Authorization', `Bearer ${customer.token}`)
      .send(ADDRESS_PAYLOAD);
    const res = await request(app)
      .get(`/api/v1/providers/${provider.userId}/availability`)
      .query({ serviceId: service._id.toString(), addressId: address.body.data.id, date: date.toISODate() })
      .set('Authorization', `Bearer ${customer.token}`);
    expect(res.body.data.slots.every((s: { available: boolean }) => !s.available)).toBe(true);
  });

  it('blocks slots with existing booking', async () => {
    const customer = await loginCustomer();
    const provider = await loginProvider();
    const { service } = await seedServiceCatalog();
    await setupEligibleProvider(service._id.toString(), provider.userId);
    const address = await CustomerAddress.create({
      customerId: customer.userId,
      ...ADDRESS_PAYLOAD,
      label: 'HOME',
      location: { type: 'Point', coordinates: [77.5946, 12.9716] },
    });
    const date = DateTime.now().setZone('Asia/Kolkata').plus({ days: 1 });
    const start = date.set({ hour: 10, minute: 0, second: 0, millisecond: 0 }).toUTC().toJSDate();
    const end = date.set({ hour: 12, minute: 0 }).toUTC().toJSDate();
    await Booking.create({
      bookingNumber: 'GF-TEST-001',
      bookingType: BookingType.SCHEDULED,
      source: BookingSource.SLOT_RESERVATION,
      customerId: customer.userId,
      providerId: provider.userId,
      serviceId: service._id,
      providerServiceId: new mongoose.Types.ObjectId(),
      reservationId: new mongoose.Types.ObjectId(),
      addressSnapshot: {
        recipientName: ADDRESS_PAYLOAD.recipientName,
        phone: ADDRESS_PAYLOAD.phone,
        addressLine1: ADDRESS_PAYLOAD.addressLine1,
        city: ADDRESS_PAYLOAD.city,
        state: ADDRESS_PAYLOAD.state,
        postalCode: ADDRESS_PAYLOAD.postalCode,
      },
      serviceSnapshot: { name: 'Tap Repair', pricing: { type: PricingType.STARTING_FROM, startingPrice: 199, currency: 'INR' } },
      providerSnapshot: { fullName: 'Pro User' },
      status: BookingStatus.CONFIRMED,
      providerRequestStatus: ProviderRequestStatus.ACCEPTED,
      scheduledStart: start,
      scheduledEnd: end,
      timezone: 'Asia/Kolkata',
      durationMinutes: 75,
      price: { estimatedAmount: 199, finalAmount: 199, currency: 'INR' },
      payment: { method: PaymentMethod.PAY_ON_SERVICE, status: PaymentStatus.PAY_ON_SERVICE },
      reschedule: { providerRescheduleCount: 0 },
    });
    const res = await request(app)
      .get(`/api/v1/providers/${provider.userId}/availability`)
      .query({ serviceId: service._id.toString(), addressId: address._id.toString(), date: date.toISODate() })
      .set('Authorization', `Bearer ${customer.token}`);
    const overlappingSlots = res.body.data.slots.filter((s: { startDateTime: string }) => {
      const slotStart = new Date(s.startDateTime);
      const slotEnd = new Date(slotStart.getTime() + 75 * 60 * 1000);
      return slotStart < end && slotEnd > start;
    });
    expect(overlappingSlots.length).toBeGreaterThan(0);
    expect(overlappingSlots.every((s: { available: boolean }) => !s.available)).toBe(true);
  });

  it('creates and releases slot reservation', async () => {
    const customer = await loginCustomer();
    const provider = await loginProvider();
    const { service } = await seedServiceCatalog();
    await setupEligibleProvider(service._id.toString(), provider.userId);
    const address = await request(app)
      .post('/api/v1/addresses')
      .set('Authorization', `Bearer ${customer.token}`)
      .send(ADDRESS_PAYLOAD);
    const date = DateTime.now().setZone('Asia/Kolkata').plus({ days: 2 }).toISODate()!;
    const slots = await request(app)
      .get(`/api/v1/providers/${provider.userId}/availability`)
      .query({ serviceId: service._id.toString(), addressId: address.body.data.id, date })
      .set('Authorization', `Bearer ${customer.token}`);
    const slot = slots.body.data.slots.find((s: { available: boolean }) => s.available);
    expect(slot).toBeTruthy();
    const reserve = await request(app)
      .post('/api/v1/availability/reservations')
      .set('Authorization', `Bearer ${customer.token}`)
      .send({
        providerId: provider.userId,
        serviceId: service._id.toString(),
        addressId: address.body.data.id,
        startDateTime: slot.startDateTime,
      });
    expect(reserve.status).toBe(201);
    const release = await request(app)
      .delete(`/api/v1/availability/reservations/${reserve.body.data.id}`)
      .set('Authorization', `Bearer ${customer.token}`);
    expect(release.status).toBe(200);
  });

  it('prevents two customers reserving same slot', async () => {
    const a = await loginCustomer('9876543210');
    const b = await loginCustomer('9876543212');
    const provider = await loginProvider();
    const { service } = await seedServiceCatalog();
    await setupEligibleProvider(service._id.toString(), provider.userId);
    const addressA = await request(app)
      .post('/api/v1/addresses')
      .set('Authorization', `Bearer ${a.token}`)
      .send(ADDRESS_PAYLOAD);
    const date = DateTime.now().setZone('Asia/Kolkata').plus({ days: 3 }).toISODate()!;
    const slots = await request(app)
      .get(`/api/v1/providers/${provider.userId}/availability`)
      .query({ serviceId: service._id.toString(), addressId: addressA.body.data.id, date })
      .set('Authorization', `Bearer ${a.token}`);
    const slot = slots.body.data.slots.find((s: { available: boolean }) => s.available);
    const first = await request(app)
      .post('/api/v1/availability/reservations')
      .set('Authorization', `Bearer ${a.token}`)
      .send({
        providerId: provider.userId,
        serviceId: service._id.toString(),
        addressId: addressA.body.data.id,
        startDateTime: slot.startDateTime,
      });
    expect(first.status).toBe(201);
    const addressB = await request(app)
      .post('/api/v1/addresses')
      .set('Authorization', `Bearer ${b.token}`)
      .send(ADDRESS_PAYLOAD);
    const second = await request(app)
      .post('/api/v1/availability/reservations')
      .set('Authorization', `Bearer ${b.token}`)
      .send({
        providerId: provider.userId,
        serviceId: service._id.toString(),
        addressId: addressB.body.data.id,
        startDateTime: slot.startDateTime,
      });
    expect(second.status).toBe(409);
  });

  it('prevents customer from releasing another reservation', async () => {
    const a = await loginCustomer('9876543210');
    const b = await loginCustomer('9876543212');
    const provider = await loginProvider();
    const { service } = await seedServiceCatalog();
    await setupEligibleProvider(service._id.toString(), provider.userId);
    const address = await request(app)
      .post('/api/v1/addresses')
      .set('Authorization', `Bearer ${a.token}`)
      .send(ADDRESS_PAYLOAD);
    const date = DateTime.now().setZone('Asia/Kolkata').plus({ days: 4 }).toISODate()!;
    const slots = await request(app)
      .get(`/api/v1/providers/${provider.userId}/availability`)
      .query({ serviceId: service._id.toString(), addressId: address.body.data.id, date })
      .set('Authorization', `Bearer ${a.token}`);
    const slot = slots.body.data.slots.find((s: { available: boolean }) => s.available);
    const reserve = await request(app)
      .post('/api/v1/availability/reservations')
      .set('Authorization', `Bearer ${a.token}`)
      .send({
        providerId: provider.userId,
        serviceId: service._id.toString(),
        addressId: address.body.data.id,
        startDateTime: slot.startDateTime,
      });
    const release = await request(app)
      .delete(`/api/v1/availability/reservations/${reserve.body.data.id}`)
      .set('Authorization', `Bearer ${b.token}`);
    expect(release.status).toBe(404);
  });

  it('treats expired reservation as inactive for blocking', async () => {
    const customer = await loginCustomer();
    const provider = await loginProvider();
    const { service } = await seedServiceCatalog();
    await setupEligibleProvider(service._id.toString(), provider.userId);
    const address = await request(app)
      .post('/api/v1/addresses')
      .set('Authorization', `Bearer ${customer.token}`)
      .send(ADDRESS_PAYLOAD);
    const start = DateTime.now()
      .setZone('Asia/Kolkata')
      .plus({ days: 5 })
      .set({ hour: 11, minute: 0, second: 0, millisecond: 0 })
      .toUTC()
      .toJSDate();
    await SlotReservation.create({
      providerId: provider.userId,
      serviceId: service._id.toString(),
      customerId: customer.userId,
      addressId: address.body.data.id,
      startDateTime: start,
      endDateTime: new Date(start.getTime() + 75 * 60 * 1000),
      status: 'HELD',
      expiresAt: new Date(Date.now() - 60_000),
    });
    const date = DateTime.fromJSDate(start).setZone('Asia/Kolkata').toISODate()!;
    const res = await request(app)
      .get(`/api/v1/providers/${provider.userId}/availability`)
      .query({ serviceId: service._id.toString(), addressId: address.body.data.id, date })
      .set('Authorization', `Bearer ${customer.token}`);
    const slot = res.body.data.slots.find((s: { label: string }) => s.label === '11:00');
    expect(slot?.available).toBe(true);
  });

  it('rejects date outside advance booking window', async () => {
    const customer = await loginCustomer();
    const provider = await loginProvider();
    const { service } = await seedServiceCatalog();
    await setupEligibleProvider(service._id.toString(), provider.userId);
    const address = await request(app)
      .post('/api/v1/addresses')
      .set('Authorization', `Bearer ${customer.token}`)
      .send(ADDRESS_PAYLOAD);
    const farDate = DateTime.now().setZone('Asia/Kolkata').plus({ days: env.availability.maxAdvanceBookingDays + 2 }).toISODate();
    const res = await request(app)
      .get(`/api/v1/providers/${provider.userId}/availability`)
      .query({ serviceId: service._id.toString(), addressId: address.body.data.id, date: farDate })
      .set('Authorization', `Bearer ${customer.token}`);
    expect(res.status).toBe(400);
  });
});
