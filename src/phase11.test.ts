import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import mongoose from 'mongoose';
import {
  PricingType,
  ProviderCapacityStatus,
  ServiceZoneType,
  UserRole,
  WaitlistStatus,
  WaitlistUrgency,
} from '@ghaarfix/shared-types';
import { createApp } from '@/app.js';
import { connectDatabase, disconnectDatabase } from '@/config/database.js';
import { City } from '@/models/City.js';
import { ServiceZone } from '@/models/ServiceZone.js';
import { ServiceWaitlist } from '@/models/ServiceWaitlist.js';
import { Category } from '@/models/Category.js';
import { Service } from '@/models/Service.js';
import { Subcategory } from '@/models/Subcategory.js';
import { Otp } from '@/models/Otp.js';
import { CustomerAddress } from '@/models/CustomerAddress.js';
import { CustomerProfile } from '@/models/CustomerProfile.js';
import { User } from '@/models/User.js';
import { seedAdminUser } from '@/modules/auth/auth.service.js';
import { isRedisEnabled } from '@/infra/redis.js';
import * as cityService from '@/modules/operations/city.service.js';
import * as zoneResolutionService from '@/modules/operations/zone-resolution.service.js';
import * as zoneAvailabilityService from '@/modules/operations/zone-availability.service.js';
import * as providerCapacityService from '@/modules/operations/provider-capacity.service.js';
import * as slotInventoryService from '@/modules/operations/slot-inventory.service.js';
import * as waitlistService from '@/modules/operations/waitlist.service.js';
import * as catalogService from '@/modules/services/service-catalog.service.js';
import { runPhase11Jobs } from '@/modules/operations/phase11-jobs.js';
import { runPhase11Migrations } from '@/migrations/001-phase11-indexes.js';
import { hashOtp } from '@/utils/crypto.js';
import { normalizePhone } from '@/utils/phone.js';

const app = createApp();

let phoneSeq = 9876900100;
function nextPhone(): string {
  phoneSeq += 1;
  return String(phoneSeq);
}

async function clearDatabase() {
  await Promise.all(Object.values(mongoose.connection.collections).map((c) => c.deleteMany({})));
}

async function loginCustomer(phone = nextPhone()) {
  const normalized = normalizePhone(phone);
  const user = await User.create({
    phone: normalized,
    role: UserRole.CUSTOMER,
    isPhoneVerified: false,
    isProfileComplete: true,
    status: 'ACTIVE',
  });
  await CustomerProfile.create({ userId: user._id, fullName: 'Test Customer' });
  await Otp.create({
    requestId: `req-${phone}`,
    phone: normalized,
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

async function loginProvider(phone = nextPhone()) {
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
  return { token: res.body.data.accessToken as string, userId: res.body.data.user.id as string };
}

async function loginAdmin() {
  const res = await request(app)
    .post('/api/v1/admin/login')
    .send({ email: 'admin@ghaarfix.in', password: 'Admin@123456' });
  return { token: res.body.data.accessToken as string };
}

async function createTestAddress(customerId: string, postalCode = '110001') {
  return CustomerAddress.create({
    customerId,
    label: 'HOME',
    recipientName: 'Test User',
    phone: '9876543210',
    addressLine1: '12 MG Road',
    city: 'Delhi',
    state: 'Delhi',
    postalCode,
    country: 'India',
    location: { type: 'Point', coordinates: [77.209, 28.6139] },
    isDefault: true,
  });
}

async function seedService(name: string) {
  const suffix = randomBytes(3).toString('hex');
  const category = await Category.create({ name: 'Ops', slug: `ops-${suffix}`, isActive: true, displayOrder: 1 });
  const subcategory = await Subcategory.create({
    categoryId: category._id,
    name: 'General',
    slug: `general-${suffix}`,
    isActive: true,
    displayOrder: 1,
  });
  const service = await Service.create({
    categoryId: category._id,
    subcategoryId: subcategory._id,
    name,
    slug: `${name.toLowerCase().replace(/\s+/g, '-')}-${suffix}`,
    shortDescription: `${name} service`,
    keywords: [],
    aliases: [],
    pricing: { type: PricingType.STARTING_FROM, startingPrice: 499, currency: 'INR' },
    estimatedDuration: { minMinutes: 45, maxMinutes: 90 },
    whatIsIncluded: [],
    whatIsNotIncluded: [],
    faqs: [],
    isActive: true,
    isFeatured: false,
    displayOrder: 1,
    supportedAssetTypeIds: [],
  });
  return service;
}

describe('Phase 11 — Operations & Scale', () => {
  beforeAll(async () => {
    await connectDatabase();
    await seedAdminUser();
    await runPhase11Migrations();
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  beforeEach(async () => {
    await clearDatabase();
    await seedAdminUser();
    await runPhase11Migrations();
  });

  it('1. lists public cities', async () => {
    const res = await request(app).get('/api/v1/cities');
    expect(res.status).toBe(200);
    expect(res.body.data.items.length).toBeGreaterThanOrEqual(4);
  });

  it('2. admin creates a city', async () => {
    const { token } = await loginAdmin();
    const res = await request(app)
      .post('/api/v1/admin/cities')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Panipat', state: 'Haryana' });
    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('Panipat');
  });

  it('3. admin lists all cities including inactive', async () => {
    const { token } = await loginAdmin();
    await cityService.createCity({ name: 'TestCity', state: 'TestState', isActive: false });
    const res = await request(app)
      .get('/api/v1/admin/cities')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.items.some((c: { name: string }) => c.name === 'TestCity')).toBe(true);
  });

  it('4. admin creates service zone with pincode', async () => {
    const city = await City.findOne({ name: 'Delhi' });
    const { token } = await loginAdmin();
    const res = await request(app)
      .post('/api/v1/admin/service-zones')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Central Delhi',
        type: ServiceZoneType.PINCODE,
        cityId: city!._id.toString(),
        postalCodes: ['110001'],
        priority: 10,
      });
    expect(res.status).toBe(201);
    expect(res.body.data.postalCodes).toContain('110001');
  });

  it('5. lists service zones filtered by city', async () => {
    const city = await City.findOne({ name: 'Noida' });
    const res = await request(app).get(`/api/v1/service-zones?cityId=${city!._id.toString()}`);
    expect(res.status).toBe(200);
    expect(res.body.data.items.length).toBeGreaterThan(0);
  });

  it('6. resolves zone by postal code', async () => {
    const city = await City.findOne({ name: 'Delhi' });
    await ServiceZone.create({
      name: 'Connaught Place',
      slug: `cp-${randomBytes(2).toString('hex')}`,
      type: ServiceZoneType.PINCODE,
      cityId: city!._id,
      postalCodes: ['110001'],
      priority: 5,
      isActive: true,
    });
    const result = await zoneResolutionService.resolveAddressToZone({
      postalCode: '110001',
      city: 'Delhi',
    });
    expect(result.zone?.id).toBeTruthy();
    expect(result.snapshot?.zoneName).toBe('Connaught Place');
  });

  it('7. upserts zone availability for a service', async () => {
    const zone = await ServiceZone.findOne();
    const service = await seedService('Plumbing');
    const row = await zoneAvailabilityService.upsertZoneAvailability({
      serviceZoneId: zone!._id.toString(),
      serviceId: service._id.toString(),
      isAvailable: false,
    });
    expect(row.isAvailable).toBe(false);
  });

  it('8. filters catalog services by zone availability', async () => {
    const zone = await ServiceZone.findOne();
    const allowed = await seedService('Allowed Service');
    const blocked = await seedService('Blocked Service');
    await zoneAvailabilityService.upsertZoneAvailability({
      serviceZoneId: zone!._id.toString(),
      serviceId: blocked._id.toString(),
      isAvailable: false,
    });
    const result = await catalogService.listServices({
      page: 1,
      limit: 20,
      sort: 'displayOrder',
      serviceZoneId: zone!._id.toString(),
    });
    const ids = result.items.map((s) => s.id);
    expect(ids).toContain(allowed._id.toString());
    expect(ids).not.toContain(blocked._id.toString());
  });

  it('9. customer joins waitlist', async () => {
    const { token, userId } = await loginCustomer();
    const zone = await ServiceZone.findOne();
    const service = await seedService('AC Repair');
    const address = await createTestAddress(userId);
    const res = await request(app)
      .post('/api/v1/waitlist')
      .set('Authorization', `Bearer ${token}`)
      .send({
        serviceId: service._id.toString(),
        serviceZoneId: zone!._id.toString(),
        addressId: address._id.toString(),
        urgency: WaitlistUrgency.HIGH,
      });
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe(WaitlistStatus.PENDING);
  });

  it('10. dedupes waitlist entries for same customer/service/zone', async () => {
    const { userId } = await loginCustomer();
    const zone = await ServiceZone.findOne();
    const service = await seedService('Electrical');
    const address = await createTestAddress(userId, '110002');
    const first = await waitlistService.createWaitlistEntry(userId, {
      serviceId: service._id.toString(),
      serviceZoneId: zone!._id.toString(),
      addressId: address._id.toString(),
    });
    const second = await waitlistService.createWaitlistEntry(userId, {
      serviceId: service._id.toString(),
      serviceZoneId: zone!._id.toString(),
      addressId: address._id.toString(),
    });
    expect(first.id).toBe(second.id);
    expect(await ServiceWaitlist.countDocuments()).toBe(1);
  });

  it('11. customer lists waitlist entries', async () => {
    const { token, userId } = await loginCustomer();
    const zone = await ServiceZone.findOne();
    const service = await seedService('Painting');
    const address = await createTestAddress(userId, '110003');
    await waitlistService.createWaitlistEntry(userId, {
      serviceId: service._id.toString(),
      serviceZoneId: zone!._id.toString(),
      addressId: address._id.toString(),
    });
    const res = await request(app)
      .get('/api/v1/waitlist')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
  });

  it('12. customer cancels waitlist entry', async () => {
    const { token, userId } = await loginCustomer();
    const zone = await ServiceZone.findOne();
    const service = await seedService('Carpentry');
    const address = await createTestAddress(userId, '110004');
    const entry = await waitlistService.createWaitlistEntry(userId, {
      serviceId: service._id.toString(),
      serviceZoneId: zone!._id.toString(),
      addressId: address._id.toString(),
    });
    const res = await request(app)
      .delete(`/api/v1/waitlist/${entry.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const updated = await ServiceWaitlist.findById(entry.id);
    expect(updated?.status).toBe(WaitlistStatus.CANCELLED);
  });

  it('13. provider reads daily capacity', async () => {
    const { token, userId } = await loginProvider();
    const res = await request(app)
      .get('/api/v1/provider/capacity')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.providerId).toBe(userId);
    expect(res.body.data.status).toBe(ProviderCapacityStatus.AVAILABLE);
  });

  it('14. provider updates capacity limits', async () => {
    const { token } = await loginProvider();
    const res = await request(app)
      .patch('/api/v1/provider/capacity')
      .set('Authorization', `Bearer ${token}`)
      .send({ maxDailyJobs: 12 });
    expect(res.status).toBe(200);
    expect(res.body.data.maxDailyJobs).toBe(12);
  });

  it('15. admin fetches system health', async () => {
    const { token } = await loginAdmin();
    const res = await request(app)
      .get('/api/v1/admin/system-health')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.mongo).toBe('up');
    expect(['disabled', 'up', 'down']).toContain(res.body.data.redis);
  });

  it('16. health liveness endpoint responds', async () => {
    const res = await request(app).get('/api/v1/health/liveness');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('17. health readiness checks mongo', async () => {
    const res = await request(app).get('/api/v1/health/readiness');
    expect(res.status).toBe(200);
    expect(res.body.checks.mongo).toBe('up');
  });

  it('18. slot inventory atomic reserve respects capacity', async () => {
    const providerId = new mongoose.Types.ObjectId().toString();
    const service = await seedService('Inventory Test');
    const slotStart = new Date('2030-06-01T10:00:00.000Z');
    await slotInventoryService.upsertSlotInventory({
      providerId,
      serviceId: service._id.toString(),
      date: '2030-06-01',
      slotStart,
      capacity: 1,
    });
    await slotInventoryService.reserveSlotInventory({
      providerId,
      serviceId: service._id.toString(),
      slotStart,
      date: '2030-06-01',
    });
    if (isRedisEnabled()) {
      await expect(
        slotInventoryService.reserveSlotInventory({
          providerId,
          serviceId: service._id.toString(),
          slotStart,
          date: '2030-06-01',
        }),
      ).rejects.toThrow(/inventory is full/i);
    }
  });

  it('19. phase11 jobs run without error', async () => {
    const result = await runPhase11Jobs();
    expect(result).toMatchObject({
      waitlistMatched: expect.any(Number),
      capacityRollup: expect.any(Number),
      reservationsCleaned: expect.any(Number),
      zoneDemandRows: expect.any(Number),
      waitlistExpired: expect.any(Number),
    });
  });

  it('20. provider capacity marks FULL when at limit', async () => {
    const providerId = new mongoose.Types.ObjectId().toString();
    await providerCapacityService.updateProviderCapacity(providerId, { maxDailyJobs: 2 });
    await providerCapacityService.incrementProviderBookedCount(providerId);
    await providerCapacityService.incrementProviderBookedCount(providerId);
    const capacity = await providerCapacityService.getProviderCapacity(providerId);
    expect(capacity.status).toBe(ProviderCapacityStatus.FULL);
  });
});
