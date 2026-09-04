import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import mongoose from 'mongoose';
import { DateTime } from 'luxon';
import {
  AssetCondition,
  HomeType,
  InsightType,
  MaintenanceScheduleStatus,
  PaymentMethod,
  PricingType,
  ProviderServiceApprovalStatus,
  ProviderStatus,
  ServiceAreaType,
  WarrantyStatus,
  WarrantyType,
} from '@ghaarfix/shared-types';
import { createApp } from '@/app.js';
import { connectDatabase, disconnectDatabase } from '@/config/database.js';
import { AssetServiceRecord } from '@/models/AssetServiceRecord.js';
import { AssetType } from '@/models/AssetType.js';
import { Category } from '@/models/Category.js';
import { HomeAsset } from '@/models/HomeAsset.js';
import { MaintenanceSchedule } from '@/models/MaintenanceSchedule.js';
import { MaintenanceTemplate } from '@/models/MaintenanceTemplate.js';
import { Otp } from '@/models/Otp.js';
import { ProviderProfile } from '@/models/ProviderProfile.js';
import { ProviderSchedule } from '@/models/ProviderSchedule.js';
import { ProviderService } from '@/models/ProviderService.js';
import { ProviderServiceArea } from '@/models/ProviderServiceArea.js';
import { ReminderLog } from '@/models/ReminderLog.js';
import { Service } from '@/models/Service.js';
import { Subcategory } from '@/models/Subcategory.js';
import { Warranty } from '@/models/Warranty.js';
import { seedAdminUser } from '@/modules/auth/auth.service.js';
import { seedDefaultAssetTypes } from '@/modules/home-health/admin.service.js';
import {
  processMaintenanceReminders,
  processWarrantyAlerts,
} from '@/modules/home-health/maintenance.service.js';
import { validateFavouriteProviderForService } from '@/modules/home-health/favourite.service.js';
import { hashOtp } from '@/utils/crypto.js';

const app = createApp();

let phoneSeq = 9876600100;
function nextPhone(): string {
  phoneSeq += 1;
  return String(phoneSeq);
}

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
    { providerStatus: ProviderStatus.ACTIVE, fullName: 'Pro User', experienceYears: 5, languages: ['English'], isVerified: true },
    { upsert: true },
  );
  return { token: res.body.data.accessToken as string, userId };
}

async function loginAdmin() {
  const res = await request(app)
    .post('/api/v1/admin/login')
    .send({ email: 'admin@ghaarfix.in', password: 'Admin@123456' });
  return { token: res.body.data.accessToken as string };
}

async function createAddress(token: string) {
  const res = await request(app)
    .post('/api/v1/addresses')
    .set('Authorization', `Bearer ${token}`)
    .send(ADDRESS_PAYLOAD);
  return res.body.data as { id: string };
}

async function seedAcService(providerUserId: string) {
  const suffix = randomBytes(3).toString('hex');
  const assetType = await AssetType.findOne({ slug: 'air-conditioner' });
  if (!assetType) throw new Error('Missing asset type seed');

  const category = await Category.create({ name: 'HVAC', slug: `hvac-${suffix}`, isActive: true, displayOrder: 1 });
  const subcategory = await Subcategory.create({
    categoryId: category._id,
    name: 'AC',
    slug: `ac-${suffix}`,
    isActive: true,
    displayOrder: 1,
  });
  const service = await Service.create({
    categoryId: category._id,
    subcategoryId: subcategory._id,
    name: 'AC Service',
    slug: `ac-service-${suffix}`,
    shortDescription: 'AC maintenance',
    pricing: { type: PricingType.STARTING_FROM, startingPrice: 499, currency: 'INR' },
    estimatedDuration: { minMinutes: 45, maxMinutes: 90 },
    whatIsIncluded: [],
    whatIsNotIncluded: [],
    faqs: [],
    isActive: true,
    isFeatured: true,
    displayOrder: 1,
    supportedAssetTypeIds: [assetType._id],
  });
  await ProviderService.create({
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
  return { service, assetType };
}

async function createHomeWithAsset(customerToken: string, addressId: string, name = 'My Home') {
  const homeRes = await request(app)
    .post('/api/v1/homes')
    .set('Authorization', `Bearer ${customerToken}`)
    .send({ addressId, name, homeType: HomeType.APARTMENT, isPrimary: true });
  const assetType = await AssetType.findOne({ slug: 'air-conditioner' });
  const assetRes = await request(app)
    .post(`/api/v1/homes/${homeRes.body.data.id}/assets`)
    .set('Authorization', `Bearer ${customerToken}`)
    .send({
      assetTypeId: assetType!._id.toString(),
      name: 'Living Room AC',
      brand: 'LG',
      condition: AssetCondition.GOOD,
    });
  return {
    homeId: homeRes.body.data.id as string,
    assetId: assetRes.body.data.id as string,
  };
}

async function bookWithAsset(
  customer: { token: string },
  provider: { token: string; userId: string },
  serviceId: string,
  addressId: string,
  assetId: string,
) {
  const date = DateTime.now().setZone('Asia/Kolkata').plus({ days: 2 }).toISODate()!;
  const slots = await request(app)
    .get(`/api/v1/providers/${provider.userId}/availability`)
    .query({ serviceId, addressId, date })
    .set('Authorization', `Bearer ${customer.token}`);
  const slot = slots.body.data.slots.find((s: { available: boolean }) => s.available);

  const reservation = await request(app)
    .post('/api/v1/availability/reservations')
    .set('Authorization', `Bearer ${customer.token}`)
    .send({
      providerId: provider.userId,
      serviceId,
      addressId,
      startDateTime: slot.startDateTime,
      assetId,
    });

  const booking = await request(app)
    .post('/api/v1/bookings')
    .set('Authorization', `Bearer ${customer.token}`)
    .send({ reservationId: reservation.body.data.id, paymentMethod: PaymentMethod.PAY_ON_SERVICE });

  await request(app)
    .post(`/api/v1/provider/bookings/${booking.body.data.id}/accept`)
    .set('Authorization', `Bearer ${provider.token}`);

  return booking.body.data as { id: string; assetId?: string };
}

async function createManualSchedule(
  customerId: string,
  homeId: string,
  assetId: string,
  overrides?: Partial<{ nextDueAt: Date; status: MaintenanceScheduleStatus }>,
) {
  const assetType = await AssetType.findOne({ slug: 'air-conditioner' });
  const template = await MaintenanceTemplate.create({
    assetTypeId: assetType!._id,
    serviceId: new mongoose.Types.ObjectId(),
    title: 'Manual schedule',
    intervalDays: 180,
    isActive: true,
  });
  return MaintenanceSchedule.create({
    assetId,
    homeId,
    customerId,
    templateId: template._id,
    title: 'AC filter',
    nextDueAt: overrides?.nextDueAt ?? new Date(),
    status: overrides?.status ?? MaintenanceScheduleStatus.DUE,
    autoGenerated: true,
  });
}

async function completeBooking(providerToken: string, bookingId: string) {
  await request(app).post(`/api/v1/provider/bookings/${bookingId}/en-route`).set('Authorization', `Bearer ${providerToken}`);
  await request(app).post(`/api/v1/provider/bookings/${bookingId}/arrive`).set('Authorization', `Bearer ${providerToken}`);
  await request(app).post(`/api/v1/provider/bookings/${bookingId}/start`).set('Authorization', `Bearer ${providerToken}`);
  await request(app).post(`/api/v1/provider/bookings/${bookingId}/complete`).set('Authorization', `Bearer ${providerToken}`);
}

describe('Phase 8 Home Health API', () => {
  beforeAll(async () => {
    await connectDatabase();
    await seedAdminUser();
  });
  afterAll(async () => disconnectDatabase());
  beforeEach(async () => {
    await clearDatabase();
    await seedAdminUser();
    await seedDefaultAssetTypes();
  });

  it('customer can create multiple homes', async () => {
    const customer = await loginCustomer(nextPhone());
    const addr1 = await createAddress(customer.token);
    const addr2Res = await request(app)
      .post('/api/v1/addresses')
      .set('Authorization', `Bearer ${customer.token}`)
      .send({ ...ADDRESS_PAYLOAD, addressLine1: '22 Park Street', postalCode: '560002' });

    const home1 = await request(app)
      .post('/api/v1/homes')
      .set('Authorization', `Bearer ${customer.token}`)
      .send({ addressId: addr1.id, name: 'My Home' });
    const home2 = await request(app)
      .post('/api/v1/homes')
      .set('Authorization', `Bearer ${customer.token}`)
      .send({ addressId: addr2Res.body.data.id, name: "Parents' Home" });

    expect(home1.status).toBe(201);
    expect(home2.status).toBe(201);
    const list = await request(app).get('/api/v1/homes').set('Authorization', `Bearer ${customer.token}`);
    expect(list.body.data.items).toHaveLength(2);
  });

  it('customer cannot access another home', async () => {
    const a = await loginCustomer(nextPhone());
    const b = await loginCustomer(nextPhone());
    const address = await createAddress(a.token);
    const home = await request(app)
      .post('/api/v1/homes')
      .set('Authorization', `Bearer ${a.token}`)
      .send({ addressId: address.id, name: 'Private Home' });
    const res = await request(app)
      .get(`/api/v1/homes/${home.body.data.id}`)
      .set('Authorization', `Bearer ${b.token}`);
    expect(res.status).toBe(404);
  });

  it('asset belongs to correct home', async () => {
    const customer = await loginCustomer(nextPhone());
    const address = await createAddress(customer.token);
    const { homeId, assetId } = await createHomeWithAsset(customer.token, address.id);
    const asset = await request(app)
      .get(`/api/v1/assets/${assetId}`)
      .set('Authorization', `Bearer ${customer.token}`);
    expect(asset.body.data.homeId).toBe(homeId);
  });

  it('customer cannot access another asset', async () => {
    const a = await loginCustomer(nextPhone());
    const b = await loginCustomer(nextPhone());
    const address = await createAddress(a.token);
    const { assetId } = await createHomeWithAsset(a.token, address.id);
    const res = await request(app)
      .get(`/api/v1/assets/${assetId}`)
      .set('Authorization', `Bearer ${b.token}`);
    expect(res.status).toBe(404);
  });

  it('room is optional for assets', async () => {
    const customer = await loginCustomer(nextPhone());
    const address = await createAddress(customer.token);
    const { assetId } = await createHomeWithAsset(customer.token, address.id);
    const asset = await HomeAsset.findById(assetId);
    expect(asset?.roomId).toBeUndefined();
  });

  it('asset can be linked to booking', async () => {
    const customer = await loginCustomer(nextPhone());
    const provider = await loginProvider(nextPhone());
    const address = await createAddress(customer.token);
    const { assetId } = await createHomeWithAsset(customer.token, address.id);
    const { service } = await seedAcService(provider.userId);
    const booking = await bookWithAsset(customer, provider, service._id.toString(), address.id, assetId);
    expect(booking.assetId).toBe(assetId);
  });

  it('asset service record generated once on completion', async () => {
    const customer = await loginCustomer(nextPhone());
    const provider = await loginProvider(nextPhone());
    const address = await createAddress(customer.token);
    const { assetId } = await createHomeWithAsset(customer.token, address.id);
    const { service } = await seedAcService(provider.userId);
    const booking = await bookWithAsset(customer, provider, service._id.toString(), address.id, assetId);
    await completeBooking(provider.token, booking.id);
    await completeBooking(provider.token, booking.id);
    const count = await AssetServiceRecord.countDocuments({ bookingId: booking.id });
    expect(count).toBe(1);
  });

  it('cancelled booking does not create service record', async () => {
    const customer = await loginCustomer(nextPhone());
    const provider = await loginProvider(nextPhone());
    const address = await createAddress(customer.token);
    const { assetId } = await createHomeWithAsset(customer.token, address.id);
    const { service } = await seedAcService(provider.userId);
    const booking = await bookWithAsset(customer, provider, service._id.toString(), address.id, assetId);
    await request(app)
      .post(`/api/v1/bookings/${booking.id}/cancel`)
      .set('Authorization', `Bearer ${customer.token}`)
      .send({ reason: 'Changed plans' });
    const { createAssetServiceRecordFromBooking } = await import('@/modules/home-health/maintenance.service.js');
    await createAssetServiceRecordFromBooking(booking.id);
    const count = await AssetServiceRecord.countDocuments({ bookingId: booking.id });
    expect(count).toBe(0);
  });

  it('maintenance next date is calculated from completion', async () => {
    const customer = await loginCustomer(nextPhone());
    const provider = await loginProvider(nextPhone());
    const address = await createAddress(customer.token);
    const { assetId } = await createHomeWithAsset(customer.token, address.id);
    const { service, assetType } = await seedAcService(provider.userId);
    await MaintenanceTemplate.create({
      assetTypeId: assetType._id,
      serviceId: service._id,
      title: 'AC Service',
      intervalDays: 180,
      isActive: true,
    });
    const booking = await bookWithAsset(customer, provider, service._id.toString(), address.id, assetId);
    await completeBooking(provider.token, booking.id);
    const schedule = await MaintenanceSchedule.findOne({ assetId: new mongoose.Types.ObjectId(assetId) });
    expect(schedule?.nextDueAt).toBeTruthy();
    const record = await AssetServiceRecord.findOne({ bookingId: booking.id });
    expect(record?.nextMaintenanceDate).toBeTruthy();
  });

  it('snooze works', async () => {
    const customer = await loginCustomer(nextPhone());
    const address = await createAddress(customer.token);
    const { homeId, assetId } = await createHomeWithAsset(customer.token, address.id);
    const schedule = await createManualSchedule(customer.userId, homeId, assetId);
    const res = await request(app)
      .post(`/api/v1/maintenance-schedules/${schedule._id}/snooze`)
      .set('Authorization', `Bearer ${customer.token}`)
      .send({ days: 7 });
    expect(res.status).toBe(200);
    expect(res.body.data.snoozedUntil).toBeTruthy();
  });

  it('maintenance reminder is not duplicated', async () => {
    const customer = await loginCustomer(nextPhone());
    const address = await createAddress(customer.token);
    const { homeId, assetId } = await createHomeWithAsset(customer.token, address.id);
    await createManualSchedule(customer.userId, homeId, assetId);
    const first = await processMaintenanceReminders();
    const second = await processMaintenanceReminders();
    expect(first).toBeGreaterThan(0);
    expect(second).toBe(0);
    const logs = await ReminderLog.countDocuments({ entityType: 'MAINTENANCE' });
    expect(logs).toBeGreaterThan(0);
  });

  it('warranty expiration alert is sent once', async () => {
    const customer = await loginCustomer(nextPhone());
    const address = await createAddress(customer.token);
    const { assetId } = await createHomeWithAsset(customer.token, address.id);
    const endDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
    await Warranty.create({
      assetId,
      customerId: customer.userId,
      provider: 'LG',
      warrantyType: WarrantyType.MANUFACTURER,
      startDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
      endDate,
      status: WarrantyStatus.ACTIVE,
    });
    const first = await processWarrantyAlerts();
    const second = await processWarrantyAlerts();
    expect(first).toBeGreaterThan(0);
    expect(second).toBe(0);
  });

  it('favourite provider is unique', async () => {
    const customer = await loginCustomer(nextPhone());
    const provider = await loginProvider(nextPhone());
    const first = await request(app)
      .post(`/api/v1/favourite-providers/${provider.userId}`)
      .set('Authorization', `Bearer ${customer.token}`);
    const second = await request(app)
      .post(`/api/v1/favourite-providers/${provider.userId}`)
      .set('Authorization', `Bearer ${customer.token}`);
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    const list = await request(app)
      .get('/api/v1/favourite-providers')
      .set('Authorization', `Bearer ${customer.token}`);
    expect(list.body.data.items.filter((i: { providerId: string }) => i.providerId === provider.userId)).toHaveLength(1);
  });

  it('favourite provider availability is revalidated for service', async () => {
    const customer = await loginCustomer(nextPhone());
    const provider = await loginProvider(nextPhone());
    const { service } = await seedAcService(provider.userId);
    await request(app)
      .post(`/api/v1/favourite-providers/${provider.userId}`)
      .set('Authorization', `Bearer ${customer.token}`);
    const valid = await validateFavouriteProviderForService(provider.userId, service._id.toString());
    expect(valid).toBe(true);
    const other = await loginProvider(nextPhone());
    const invalid = await validateFavouriteProviderForService(other.userId, service._id.toString());
    expect(invalid).toBe(false);
  });

  it('provider cannot access unrelated customer asset context', async () => {
    const customer = await loginCustomer(nextPhone());
    const provider = await loginProvider(nextPhone());
    const otherProvider = await loginProvider(nextPhone());
    const address = await createAddress(customer.token);
    const { assetId } = await createHomeWithAsset(customer.token, address.id);
    const { service } = await seedAcService(provider.userId);
    const booking = await bookWithAsset(customer, provider, service._id.toString(), address.id, assetId);
    const ok = await request(app)
      .get(`/api/v1/provider/bookings/${booking.id}/asset-context`)
      .set('Authorization', `Bearer ${provider.token}`);
    const denied = await request(app)
      .get(`/api/v1/provider/bookings/${booking.id}/asset-context`)
      .set('Authorization', `Bearer ${otherProvider.token}`);
    expect(ok.status).toBe(200);
    expect(ok.body.data.name).toBeTruthy();
    expect(denied.status).toBe(404);
  });

  it('admin deactivation preserves historical asset type data', async () => {
    const admin = await loginAdmin();
    const customer = await loginCustomer(nextPhone());
    const address = await createAddress(customer.token);
    const { assetId } = await createHomeWithAsset(customer.token, address.id);
    const assetType = await AssetType.findOne({ slug: 'air-conditioner' });
    const res = await request(app)
      .patch(`/api/v1/admin/asset-types/${assetType!._id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ isActive: false });
    expect(res.status).toBe(200);
    const asset = await HomeAsset.findById(assetId);
    expect(asset?.assetTypeId.toString()).toBe(assetType!._id.toString());
  });

  it('home insight rule is explainable', async () => {
    const customer = await loginCustomer(nextPhone());
    const address = await createAddress(customer.token);
    const { homeId, assetId } = await createHomeWithAsset(customer.token, address.id);
    await createManualSchedule(customer.userId, homeId, assetId, {
      nextDueAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      status: MaintenanceScheduleStatus.OVERDUE,
    });
    const insights = await request(app)
      .get(`/api/v1/homes/${homeId}/insights`)
      .set('Authorization', `Bearer ${customer.token}`);
    expect(insights.status).toBe(200);
    expect(insights.body.data.insights.length).toBeGreaterThan(0);
    for (const item of insights.body.data.insights) {
      expect(typeof item.message).toBe('string');
      expect(item.message.length).toBeGreaterThan(5);
    }
  });

  it('repeated repair insight is generated correctly', async () => {
    const customer = await loginCustomer(nextPhone());
    const address = await createAddress(customer.token);
    const { homeId, assetId } = await createHomeWithAsset(customer.token, address.id);
    const provider = await loginProvider(nextPhone());
    const { service } = await seedAcService(provider.userId);

    for (let i = 0; i < 3; i += 1) {
      await AssetServiceRecord.create({
        assetId,
        bookingId: new mongoose.Types.ObjectId(),
        serviceId: service._id,
        providerId: provider.userId,
        serviceType: 'AC Repair',
        summary: `Repair ${i + 1}`,
        parts: [],
        cost: 500,
        performedAt: new Date(Date.now() - i * 30 * 24 * 60 * 60 * 1000),
      });
    }

    const insights = await request(app)
      .get(`/api/v1/homes/${homeId}/insights`)
      .set('Authorization', `Bearer ${customer.token}`);
    const repeated = insights.body.data.insights.find(
      (i: { type: string }) => i.type === InsightType.REPEATED_REPAIRS,
    );
    expect(repeated).toBeTruthy();
    expect(repeated.message).toMatch(/repair|compare|replacement/i);
  });
});
