import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import {
  PaymentMethod,
  PricingType,
  ProviderServiceApprovalStatus,
  ProviderStatus,
  ServiceAreaType,
  UrgentRequestStatus,
} from '@ghaarfix/shared-types';
import { createApp } from '@/app.js';
import { connectDatabase, disconnectDatabase } from '@/config/database.js';
import { Booking } from '@/models/Booking.js';
import { Category } from '@/models/Category.js';
import { Otp } from '@/models/Otp.js';
import { ProviderProfile } from '@/models/ProviderProfile.js';
import { ProviderSchedule } from '@/models/ProviderSchedule.js';
import { ProviderService } from '@/models/ProviderService.js';
import { ProviderServiceArea } from '@/models/ProviderServiceArea.js';
import { Service } from '@/models/Service.js';
import { Subcategory } from '@/models/Subcategory.js';
import { UrgentDispatchTarget } from '@/models/UrgentDispatchTarget.js';
import { UrgentRequest } from '@/models/UrgentRequest.js';
import { seedAdminUser } from '@/modules/auth/auth.service.js';
import { issueTokens } from '@/modules/auth/auth.service.js';
import { User } from '@/models/User.js';
import { UserRole } from '@ghaarfix/shared-types';
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
  await Promise.all(Object.values(mongoose.connection.collections).map((c) => c.deleteMany({})));
}

let customerPhoneSeq = 9100000000;

async function loginCustomer() {
  customerPhoneSeq += 1;
  const phone = String(customerPhoneSeq);
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

async function loginProvider(phone: string, name: string) {
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
    { providerStatus: ProviderStatus.ACTIVE, fullName: name, experienceYears: 5, languages: ['English'] },
    { upsert: true },
  );
  return { token: res.body.data.accessToken as string, userId };
}

async function createProviderDirect(name: string, phone: string) {
  const user = await User.create({
    role: UserRole.PROVIDER,
    phone: `+91${phone}`,
    fullName: name,
    isPhoneVerified: true,
    isProfileComplete: true,
    status: 'ACTIVE',
  });
  await ProviderProfile.findOneAndUpdate(
    { userId: user._id },
    { providerStatus: ProviderStatus.ACTIVE, fullName: name, experienceYears: 5, languages: ['English'] },
    { upsert: true },
  );
  const tokens = await issueTokens(user._id.toString(), UserRole.PROVIDER);
  return { token: tokens.accessToken, userId: user._id.toString() };
}

async function seedUrgentService() {
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
    isUrgentAvailable: true,
    urgentConfig: {
      enabled: true,
      baseFee: 50,
      extraFee: 50,
      responseTimeoutMinutes: 5,
      maxProviderDistanceKm: 15,
      maxBroadcastProviders: 10,
    },
    displayOrder: 1,
  });
  return service;
}

async function setupProviderForUrgent(
  provider: { token: string; userId: string },
  serviceId: mongoose.Types.ObjectId,
  lat = 12.972,
  lng = 77.595,
) {
  await ProviderService.create({
    providerId: provider.userId,
    serviceId,
    approvalStatus: ProviderServiceApprovalStatus.APPROVED,
    isActive: true,
    supportsUrgent: true,
    isUrgentEnabled: true,
    experienceYears: 5,
    customPricing: { enabled: false },
  });
  await ProviderServiceArea.create({
    providerId: provider.userId,
    name: 'Base',
    type: ServiceAreaType.RADIUS,
    center: { latitude: lat, longitude: lng },
    radiusKm: 15,
    isActive: true,
  });
  await ProviderSchedule.create({
    providerId: provider.userId,
    timezone: 'Asia/Kolkata',
    isActive: true,
    weeklySchedule: {
      monday: { enabled: true, startTime: '00:00', endTime: '23:59' },
      tuesday: { enabled: true, startTime: '00:00', endTime: '23:59' },
      wednesday: { enabled: true, startTime: '00:00', endTime: '23:59' },
      thursday: { enabled: true, startTime: '00:00', endTime: '23:59' },
      friday: { enabled: true, startTime: '00:00', endTime: '23:59' },
      saturday: { enabled: true, startTime: '00:00', endTime: '23:59' },
      sunday: { enabled: true, startTime: '00:00', endTime: '23:59' },
    },
  });
  await request(app)
    .post('/api/v1/provider/presence/online')
    .set('Authorization', `Bearer ${provider.token}`);
  await request(app)
    .post('/api/v1/provider/presence/heartbeat')
    .set('Authorization', `Bearer ${provider.token}`)
    .send({ latitude: lat, longitude: lng });
}

describe('Phase 6 Urgent Fix API', () => {
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

  it('creates urgent request and dispatches to online provider', async () => {
    const customer = await loginCustomer();
    const provider = await loginProvider('9876543211', 'Pro One');
    const service = await seedUrgentService();
    await setupProviderForUrgent(provider, service._id);

    const address = await request(app)
      .post('/api/v1/addresses')
      .set('Authorization', `Bearer ${customer.token}`)
      .send(ADDRESS_PAYLOAD);

    const res = await request(app)
      .post('/api/v1/urgent-requests')
      .set('Authorization', `Bearer ${customer.token}`)
      .set('Idempotency-Key', 'urgent-1')
      .send({
        serviceId: service._id.toString(),
        addressId: address.body.data.id,
        paymentMethod: PaymentMethod.PAY_ON_SERVICE,
        notes: 'Leaking tap urgently',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe(UrgentRequestStatus.SEARCHING);

    const targets = await UrgentDispatchTarget.find({ urgentRequestId: res.body.data.id });
    expect(targets.length).toBe(1);
  });

  it('rejects service without urgent enabled', async () => {
    const customer = await loginCustomer();
    const category = await Category.create({ name: 'X', slug: 'x', isActive: true, displayOrder: 1 });
    const sub = await Subcategory.create({
      categoryId: category._id,
      name: 'Y',
      slug: 'y',
      isActive: true,
      displayOrder: 1,
    });
    const service = await Service.create({
      categoryId: category._id,
      subcategoryId: sub._id,
      name: 'No Urgent',
      slug: 'no-urgent',
      pricing: { type: PricingType.FIXED, startingPrice: 100, currency: 'INR' },
      estimatedDuration: { minMinutes: 30, maxMinutes: 60 },
      whatIsIncluded: [],
      whatIsNotIncluded: [],
      faqs: [],
      isActive: true,
      isUrgentAvailable: false,
      urgentConfig: { enabled: false, baseFee: 0, extraFee: 0, responseTimeoutMinutes: 2, maxProviderDistanceKm: 5, maxBroadcastProviders: 5 },
      displayOrder: 1,
    });

    const address = await request(app)
      .post('/api/v1/addresses')
      .set('Authorization', `Bearer ${customer.token}`)
      .send(ADDRESS_PAYLOAD);

    const res = await request(app)
      .post('/api/v1/urgent-requests')
      .set('Authorization', `Bearer ${customer.token}`)
      .send({
        serviceId: service._id.toString(),
        addressId: address.body.data.id,
        paymentMethod: PaymentMethod.PAY_ON_SERVICE,
      });

    expect(res.status).toBe(400);
  });

  it('only first provider wins atomic accept', async () => {
    const customer = await loginCustomer();
    const service = await seedUrgentService();
    await Service.findByIdAndUpdate(service._id, {
      'urgentConfig.maxBroadcastProviders': 25,
    });
    const providers = await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        createProviderDirect(`Pro ${i}`, `98${String(10000000 + i)}`),
      ),
    );
    for (const [i, provider] of providers.entries()) {
      await setupProviderForUrgent(provider, service._id, 12.9716 + i * 0.0001, 77.5946);
    }

    const address = await request(app)
      .post('/api/v1/addresses')
      .set('Authorization', `Bearer ${customer.token}`)
      .send(ADDRESS_PAYLOAD);

    const createRes = await request(app)
      .post('/api/v1/urgent-requests')
      .set('Authorization', `Bearer ${customer.token}`)
      .send({
        serviceId: service._id.toString(),
        addressId: address.body.data.id,
        paymentMethod: PaymentMethod.PAY_ON_SERVICE,
      });

    const urgentRequestId = createRes.body.data.id as string;

    const results = await Promise.all(
      providers.map((p) =>
        request(app)
          .post(`/api/v1/provider/urgent-requests/${urgentRequestId}/accept`)
          .set('Authorization', `Bearer ${p.token}`),
      ),
    );

    const successes = results.filter((r) => r.status === 200);
    const nonSuccess = results.filter((r) => r.status !== 200);
    expect(successes.length).toBe(1);
    expect(nonSuccess.length).toBe(19);

    const bookings = await Booking.countDocuments({ urgentRequestId });
    expect(bookings).toBe(1);

    const urgent = await UrgentRequest.findById(urgentRequestId);
    expect(urgent?.status).toBe(UrgentRequestStatus.CONVERTED_TO_BOOKING);
  });

  it('customer cancel prevents provider accept', async () => {
    const customer = await loginCustomer();
    const provider = await loginProvider('9876543211', 'Pro One');
    const service = await seedUrgentService();
    await setupProviderForUrgent(provider, service._id);

    const address = await request(app)
      .post('/api/v1/addresses')
      .set('Authorization', `Bearer ${customer.token}`)
      .send(ADDRESS_PAYLOAD);

    const createRes = await request(app)
      .post('/api/v1/urgent-requests')
      .set('Authorization', `Bearer ${customer.token}`)
      .send({
        serviceId: service._id.toString(),
        addressId: address.body.data.id,
        paymentMethod: PaymentMethod.PAY_ON_SERVICE,
      });

    const urgentRequestId = createRes.body.data.id as string;

    await request(app)
      .post(`/api/v1/urgent-requests/${urgentRequestId}/cancel`)
      .set('Authorization', `Bearer ${customer.token}`)
      .send({ reason: 'Changed mind' });

    const acceptRes = await request(app)
      .post(`/api/v1/provider/urgent-requests/${urgentRequestId}/accept`)
      .set('Authorization', `Bearer ${provider.token}`);

    expect(acceptRes.status).toBe(409);
  });

  it('offline provider is excluded from dispatch', async () => {
    const customer = await loginCustomer();
    const provider = await loginProvider('9876543211', 'Offline Pro');
    const service = await seedUrgentService();
    await ProviderService.create({
      providerId: provider.userId,
      serviceId: service._id,
      approvalStatus: ProviderServiceApprovalStatus.APPROVED,
      isActive: true,
      supportsUrgent: true,
      isUrgentEnabled: true,
      customPricing: { enabled: false },
    });
    await ProviderServiceArea.create({
      providerId: provider.userId,
      name: 'Base',
      type: ServiceAreaType.RADIUS,
      center: { latitude: 12.9716, longitude: 77.5946 },
      radiusKm: 15,
      isActive: true,
    });

    const address = await request(app)
      .post('/api/v1/addresses')
      .set('Authorization', `Bearer ${customer.token}`)
      .send(ADDRESS_PAYLOAD);

    const res = await request(app)
      .post('/api/v1/urgent-requests')
      .set('Authorization', `Bearer ${customer.token}`)
      .send({
        serviceId: service._id.toString(),
        addressId: address.body.data.id,
        paymentMethod: PaymentMethod.PAY_ON_SERVICE,
      });

    expect(res.body.data.status).toBe(UrgentRequestStatus.EXPIRED);
  });

  it('idempotent customer retry does not duplicate urgent request', async () => {
    const customer = await loginCustomer();
    const provider = await loginProvider('9876543211', 'Pro One');
    const service = await seedUrgentService();
    await setupProviderForUrgent(provider, service._id);

    const address = await request(app)
      .post('/api/v1/addresses')
      .set('Authorization', `Bearer ${customer.token}`)
      .send(ADDRESS_PAYLOAD);

    const payload = {
      serviceId: service._id.toString(),
      addressId: address.body.data.id,
      paymentMethod: PaymentMethod.PAY_ON_SERVICE,
    };

    const first = await request(app)
      .post('/api/v1/urgent-requests')
      .set('Authorization', `Bearer ${customer.token}`)
      .set('Idempotency-Key', 'dup-key')
      .send(payload);

    const second = await request(app)
      .post('/api/v1/urgent-requests')
      .set('Authorization', `Bearer ${customer.token}`)
      .set('Idempotency-Key', 'dup-key')
      .send(payload);

    expect(first.body.data.id).toBe(second.body.data.id);
    expect(await UrgentRequest.countDocuments({ customerId: customer.userId })).toBe(1);
  });
});
