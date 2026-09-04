import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import crypto from 'node:crypto';
import {
  AlertFeedbackType,
  ConnectedDeviceStatus,
  DeviceAssetLinkRelationship,
  DeviceDiscoveryStatus,
  HomeAlertSource,
  HomeAlertStatus,
  IoTConnectionStatus,
  IoTProviderType,
  UserRole,
} from '@ghaarfix/shared-types';
import { createApp } from '@/app.js';
import { connectDatabase, disconnectDatabase } from '@/config/database.js';
import { Otp } from '@/models/Otp.js';
import { CustomerProfile } from '@/models/CustomerProfile.js';
import { User } from '@/models/User.js';
import { Home } from '@/models/Home.js';
import { HomeAsset } from '@/models/HomeAsset.js';
import { AssetType } from '@/models/AssetType.js';
import { CustomerAddress } from '@/models/CustomerAddress.js';
import { AddressLabel } from '@ghaarfix/shared-types';
import { seedAdminUser } from '@/modules/auth/auth.service.js';
import { runPhase16Migrations } from '@/migrations/006-phase16-iot.js';
import {
  ConnectedDevice,
  IoTIntegrationConnection,
  IoTEvent,
  ServiceSignalAccess,
} from '@/models/IoT.js';
import { ingestWebhookEvent, verifyWebhookSignature } from '@/modules/iot/event-ingestion.service.js';
import { processIoTEvent } from '@/modules/iot/event-processor.service.js';
import { grantServiceSignalAccess } from '@/modules/iot/service-signal-access.service.js';
import { hashOtp } from '@/utils/crypto.js';
import { normalizePhone } from '@/utils/phone.js';

const app = createApp();

let phoneSeq = 9877201000;
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
  await CustomerProfile.create({ userId: user._id, fullName: 'IoT User' });
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
  return { token: res.body.data.accessToken as string, userId: user._id.toString() };
}

async function loginAdmin() {
  const res = await request(app)
    .post('/api/v1/admin/login')
    .send({ email: 'admin@ghaarfix.in', password: 'Admin@123456' });
  return { token: res.body.data.accessToken as string };
}

function signWebhook(secret: string, timestamp: string, body: string) {
  return crypto.createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
}

async function createTestHome(customerId: string, name: string) {
  const address = await CustomerAddress.create({
    customerId,
    label: AddressLabel.HOME,
    recipientName: 'IoT User',
    phone: '9876543210',
    addressLine1: '12 MG Road',
    city: 'Bengaluru',
    state: 'Karnataka',
    postalCode: '560001',
    country: 'India',
    location: { type: 'Point', coordinates: [77.5946, 12.9716] },
    isDefault: true,
  });
  return Home.create({
    customerId,
    addressId: address._id,
    name,
    isPrimary: true,
  });
}

describe('Phase 16 — Connected Home Intelligence', () => {
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
    await runPhase16Migrations();
  });

  it('validates webhook signatures and rejects replay', () => {
    const secret = 'test-secret';
    const body = JSON.stringify({ eventType: 'LEAK_DETECTED' });
    const ts = String(Date.now());
    const sig = signWebhook(secret, ts, body);
    expect(() =>
      verifyWebhookSignature({ secret, signature: sig, timestamp: ts, rawBody: body }),
    ).not.toThrow();

    const oldTs = String(Date.now() - 10 * 60 * 1000);
    expect(() =>
      verifyWebhookSignature({ secret, signature: sig, timestamp: oldTs, rawBody: body }),
    ).toThrow();
  });

  it('deduplicates IoT events', async () => {
    const { userId } = await loginCustomer();
    const home = await createTestHome(userId, 'Test Home');
    const connection = await IoTIntegrationConnection.create({
      customerId: userId,
      homeId: home._id,
      provider: IoTProviderType.GENERIC_WEBHOOK,
      status: IoTConnectionStatus.CONNECTED,
      webhookSecret: 'dedupe-secret',
    });
    const device = await ConnectedDevice.create({
      customerId: userId,
      homeId: home._id,
      connectionId: connection._id,
      provider: IoTProviderType.GENERIC_WEBHOOK,
      externalDeviceId: 'leak-1',
      deviceType: 'LEAK_SENSOR',
      name: 'Leak Sensor',
      status: ConnectedDeviceStatus.ONLINE,
      discoveryStatus: DeviceDiscoveryStatus.APPROVED,
      capabilities: [],
    });

    const payload = {
      deviceId: 'leak-1',
      eventType: 'LEAK_DETECTED',
      eventId: 'evt-001',
      severity: 'CRITICAL',
    };
    const body = JSON.stringify(payload);
    const ts = String(Date.now());
    const sig = signWebhook(connection.webhookSecret!, ts, body);

    const first = await ingestWebhookEvent({
      connectionId: connection._id.toString(),
      payload,
      rawBody: body,
      signature: sig,
      timestamp: ts,
    });
    const second = await ingestWebhookEvent({
      connectionId: connection._id.toString(),
      payload,
      rawBody: body,
      signature: sig,
      timestamp: ts,
    });

    expect(first.duplicate).toBe(false);
    expect(second.duplicate).toBe(true);
    expect(await IoTEvent.countDocuments({ deviceId: device._id })).toBe(1);
  });

  it('blocks customer from accessing another home device', async () => {
    const customerA = await loginCustomer();
    const customerB = await loginCustomer();
    const homeA = await createTestHome(customerA.userId, 'Home A');

    const device = await ConnectedDevice.create({
      customerId: customerA.userId,
      homeId: homeA._id,
      provider: IoTProviderType.GENERIC_WEBHOOK,
      externalDeviceId: 'dev-a',
      deviceType: 'WATER_SENSOR',
      name: 'Sensor A',
      status: ConnectedDeviceStatus.ONLINE,
      discoveryStatus: DeviceDiscoveryStatus.APPROVED,
      capabilities: [],
    });

    const res = await request(app)
      .get(`/api/v1/iot/devices/${device._id}`)
      .set('Authorization', `Bearer ${customerB.token}`);
    expect(res.status).toBe(404);
  });

  it('creates critical alert from leak event via rule engine', async () => {
    const { userId, token } = await loginCustomer();
    const home = await createTestHome(userId, 'Leak Home');
    const connection = await IoTIntegrationConnection.create({
      customerId: userId,
      homeId: home._id,
      provider: IoTProviderType.GENERIC_WEBHOOK,
      status: IoTConnectionStatus.CONNECTED,
      webhookSecret: 'alert-secret',
    });
    await ConnectedDevice.create({
      customerId: userId,
      homeId: home._id,
      connectionId: connection._id,
      provider: IoTProviderType.GENERIC_WEBHOOK,
      externalDeviceId: 'leak-2',
      deviceType: 'LEAK_SENSOR',
      name: 'Kitchen Leak',
      status: ConnectedDeviceStatus.ONLINE,
      discoveryStatus: DeviceDiscoveryStatus.APPROVED,
      capabilities: [],
    });

    const payload = { deviceId: 'leak-2', eventType: 'LEAK_DETECTED', severity: 'CRITICAL', eventId: 'evt-2' };
    const body = JSON.stringify(payload);
    const ts = String(Date.now());
    const ingested = await ingestWebhookEvent({
      connectionId: connection._id.toString(),
      payload,
      rawBody: body,
      signature: signWebhook(connection.webhookSecret!, ts, body),
      timestamp: ts,
    });
    await processIoTEvent(ingested.eventId);

    const alerts = await request(app)
      .get(`/api/v1/iot/alerts?homeId=${home._id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(alerts.status).toBe(200);
    expect(alerts.body.data.items.length).toBeGreaterThan(0);
  });

  it('records false positive feedback and dismisses alert', async () => {
    const { userId, token } = await loginCustomer();
    const home = await createTestHome(userId, 'Feedback Home');
    const { HomeAlert } = await import('@/models/IoT.js');
    const alert = await HomeAlert.create({
      source: HomeAlertSource.IOT_EVENT,
      homeId: home._id,
      severity: 'HIGH',
      title: 'Test alert',
      message: 'Test',
      recommendedActions: ['Dismiss false alarm'],
      status: HomeAlertStatus.ACTIVE,
    });

    const res = await request(app)
      .post(`/api/v1/iot/alerts/${alert._id}/feedback`)
      .set('Authorization', `Bearer ${token}`)
      .send({ feedback: AlertFeedbackType.FALSE_ALARM });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe(HomeAlertStatus.DISMISSED);
  });

  it('expires provider signal access after booking', async () => {
    const providerId = new mongoose.Types.ObjectId().toString();
    const bookingId = new mongoose.Types.ObjectId().toString();
    await grantServiceSignalAccess({
      bookingId,
      providerId,
      signalSummary: 'Leak sensor detected water at 10:42 AM.',
      expiresAt: new Date(Date.now() - 1000),
    });
    const active = await ServiceSignalAccess.find({ bookingId, providerId });
    expect(active.length).toBe(1);
    const { expireStaleSignalAccess } = await import('@/modules/iot/service-signal-access.service.js');
    await expireStaleSignalAccess();
    expect(await ServiceSignalAccess.countDocuments({ bookingId })).toBe(0);
  });

  it('disconnect revokes device access', async () => {
    const { userId, token } = await loginCustomer();
    const connection = await IoTIntegrationConnection.create({
      customerId: userId,
      provider: IoTProviderType.SMART_HOME_PROVIDER,
      status: IoTConnectionStatus.CONNECTED,
      webhookSecret: 'disconnect',
    });
    await ConnectedDevice.create({
      customerId: userId,
      connectionId: connection._id,
      provider: IoTProviderType.SMART_HOME_PROVIDER,
      externalDeviceId: 'x1',
      deviceType: 'TEMPERATURE_SENSOR',
      name: 'Temp',
      status: ConnectedDeviceStatus.ONLINE,
      discoveryStatus: DeviceDiscoveryStatus.APPROVED,
      capabilities: [],
    });

    const res = await request(app)
      .delete(`/api/v1/iot/connections/${connection._id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);

    const device = await ConnectedDevice.findOne({ externalDeviceId: 'x1' });
    expect(device?.status).toBe(ConnectedDeviceStatus.REMOVED);
  });

  it('links device to asset with verified confidence', async () => {
    const { userId, token } = await loginCustomer();
    const home = await createTestHome(userId, 'Link Home');
    const assetType = await AssetType.findOne() ?? await AssetType.create({ name: 'Water Purifier', slug: 'water-purifier', icon: 'droplet' });
    const asset = await HomeAsset.create({
      homeId: home._id,
      customerId: userId,
      assetTypeId: assetType._id,
      name: 'Purifier',
      condition: 'GOOD',
    });
    const device = await ConnectedDevice.create({
      customerId: userId,
      homeId: home._id,
      provider: IoTProviderType.GENERIC_WEBHOOK,
      externalDeviceId: 'link-dev',
      deviceType: 'WATER_SENSOR',
      name: 'Purifier Sensor',
      status: ConnectedDeviceStatus.ONLINE,
      discoveryStatus: DeviceDiscoveryStatus.APPROVED,
      capabilities: [],
    });

    const res = await request(app)
      .post(`/api/v1/iot/devices/${device._id}/link`)
      .set('Authorization', `Bearer ${token}`)
      .send({ assetId: asset._id.toString(), relationshipType: DeviceAssetLinkRelationship.MONITORS });
    expect(res.status).toBe(200);
    expect(res.body.data.confidence).toBe(1);
    expect(res.body.data.verified).toBe(true);
  });

  it('returns admin IoT overview', async () => {
    const admin = await loginAdmin();
    const res = await request(app)
      .get('/api/v1/admin/iot/overview')
      .set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('devices');
  });
});
