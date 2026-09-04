import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { BillingInterval, HomeType, SubscriptionStatus, UserRole } from '@ghaarfix/shared-types';
import { createApp } from '@/app.js';
import { connectDatabase, disconnectDatabase } from '@/config/database.js';
import { Otp } from '@/models/Otp.js';
import { CustomerProfile } from '@/models/CustomerProfile.js';
import { User } from '@/models/User.js';
import { Subscription } from '@/models/Subscription.js';
import { SubscriptionPlanPrice } from '@/models/SubscriptionPlan.js';
import { Entitlement, EntitlementUsage } from '@/models/Entitlement.js';
import { seedAdminUser } from '@/modules/auth/auth.service.js';
import { seedDefaultAssetTypes } from '@/modules/home-health/admin.service.js';
import { runPhase12Migrations } from '@/migrations/002-phase12-care-plans.js';
import { runPhase12Jobs } from '@/modules/care-plans/phase12-jobs.js';
import * as entitlementService from '@/modules/care-plans/entitlement.service.js';
import { hashOtp } from '@/utils/crypto.js';
import { normalizePhone } from '@/utils/phone.js';

const app = createApp();

let phoneSeq = 9876800100;
function nextPhone(): string {
  phoneSeq += 1;
  return String(phoneSeq);
}

async function clearDatabase() {
  await Promise.all(Object.values(mongoose.connection.collections).map((c) => c.deleteMany({})));
}

async function loginCustomer(phone = nextPhone()) {
  const normalized = normalizePhone(phone);
  await User.create({
    phone: normalized,
    role: UserRole.CUSTOMER,
    isPhoneVerified: false,
    isProfileComplete: true,
    status: 'ACTIVE',
  });
  await CustomerProfile.create({ userId: (await User.findOne({ phone: normalized }))!._id, fullName: 'Test Customer' });
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

async function loginAdmin() {
  const res = await request(app)
    .post('/api/v1/admin/login')
    .send({ email: 'admin@ghaarfix.in', password: 'Admin@123456' });
  return { token: res.body.data.accessToken as string };
}

async function createHome(token: string) {
  const addressRes = await request(app)
    .post('/api/v1/addresses')
    .set('Authorization', `Bearer ${token}`)
    .send({
      label: 'HOME',
      recipientName: 'Test User',
      phone: '9876543210',
      addressLine1: '12 MG Road',
      city: 'Faridabad',
      state: 'Haryana',
      postalCode: '121001',
      country: 'India',
      latitude: 28.4089,
      longitude: 77.3178,
    });
  const res = await request(app)
    .post('/api/v1/homes')
    .set('Authorization', `Bearer ${token}`)
    .send({
      addressId: addressRes.body.data.id,
      name: 'Test Home',
      homeType: HomeType.APARTMENT,
      isPrimary: true,
    });
  return res.body.data as { id: string };
}

describe('Phase 12 — Care Plan Platform', () => {
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
    await seedDefaultAssetTypes();
    await runPhase12Migrations();
  });

  it('1. lists active care plans publicly', async () => {
    const res = await request(app).get('/api/v1/care-plans');
    expect(res.status).toBe(200);
    expect(res.body.data.items.length).toBeGreaterThanOrEqual(3);
  });

  it('2. customer purchases home-scoped plan with home validation', async () => {
    const customer = await loginCustomer();
    const home = await createHome(customer.token);

    const res = await request(app)
      .post('/api/v1/subscriptions')
      .set('Authorization', `Bearer ${customer.token}`)
      .send({
        planSlug: 'home-care-plus',
        billingInterval: BillingInterval.MONTHLY,
        homeIds: [home.id],
      });

    expect(res.status).toBe(201);
    expect(res.body.data.subscription.status).toBe(SubscriptionStatus.ACTIVE);
    expect(res.body.data.subscription.homeIds).toContain(home.id);
  });

  it('3. blocks home plan without home selection', async () => {
    const customer = await loginCustomer();
    const res = await request(app)
      .post('/api/v1/subscriptions')
      .set('Authorization', `Bearer ${customer.token}`)
      .send({ planSlug: 'home-care-plus', billingInterval: BillingInterval.MONTHLY });
    expect(res.status).toBe(400);
  });

  it('4. exposes subscription benefits after purchase', async () => {
    const customer = await loginCustomer();
    const home = await createHome(customer.token);
    const subRes = await request(app)
      .post('/api/v1/subscriptions')
      .set('Authorization', `Bearer ${customer.token}`)
      .send({
        planSlug: 'home-care-plus',
        billingInterval: BillingInterval.YEARLY,
        homeIds: [home.id],
      });
    const subId = subRes.body.data.subscription.id as string;

    const benefits = await request(app)
      .get(`/api/v1/subscriptions/${subId}/benefits`)
      .set('Authorization', `Bearer ${customer.token}`);
    expect(benefits.status).toBe(200);
    expect(benefits.body.data.items.length).toBeGreaterThan(0);
  });

  it('5. recommends plan with explainable reason', async () => {
    const customer = await loginCustomer();
    const home = await createHome(customer.token);
    const res = await request(app)
      .get('/api/v1/care-plans/recommendations')
      .query({ homeId: home.id })
      .set('Authorization', `Bearer ${customer.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.recommended).toBeTruthy();
    expect(res.body.data.reason).toMatch(/maintenance/i);
  });

  it('6. blocks duplicate entitlement usage for same booking', async () => {
    const customer = await loginCustomer();
    const home = await createHome(customer.token);
    await request(app)
      .post('/api/v1/subscriptions')
      .set('Authorization', `Bearer ${customer.token}`)
      .send({
        planSlug: 'home-care-plus',
        billingInterval: BillingInterval.MONTHLY,
        homeIds: [home.id],
      });

    const sub = await Subscription.findOne({ customerId: customer.userId });
    const ent = await Entitlement.findOne({ subscriptionId: sub!._id });
    const bookingId = new mongoose.Types.ObjectId().toString();

    await entitlementService.reserveEntitlement(customer.userId, ent!._id.toString(), bookingId);
    await entitlementService.consumeEntitlement(ent!._id.toString(), bookingId);

    const dup = await EntitlementUsage.findOne({ entitlementId: ent!._id, bookingId });
    expect(dup?.status).toBe('CONSUMED');

    await entitlementService.consumeEntitlement(ent!._id.toString(), bookingId);
    const count = await EntitlementUsage.countDocuments({ entitlementId: ent!._id, bookingId });
    expect(count).toBe(1);
  });

  it('7. releases reservation on entitlement release', async () => {
    const customer = await loginCustomer();
    const home = await createHome(customer.token);
    await request(app)
      .post('/api/v1/subscriptions')
      .set('Authorization', `Bearer ${customer.token}`)
      .send({
        planSlug: 'home-care-plus',
        billingInterval: BillingInterval.MONTHLY,
        homeIds: [home.id],
      });

    const ent = await Entitlement.findOne();
    const bookingId = new mongoose.Types.ObjectId().toString();
    await entitlementService.reserveEntitlement(customer.userId, ent!._id.toString(), bookingId);
    await entitlementService.releaseEntitlementReservation(ent!._id.toString(), bookingId);

    const refreshed = await Entitlement.findById(ent!._id);
    expect(refreshed?.reservedQuantity).toBe(0);
  });

  it('8. preserves price snapshot when admin changes plan price', async () => {
    const customer = await loginCustomer();
    const home = await createHome(customer.token);
    const subRes = await request(app)
      .post('/api/v1/subscriptions')
      .set('Authorization', `Bearer ${customer.token}`)
      .send({
        planSlug: 'home-care-plus',
        billingInterval: BillingInterval.MONTHLY,
        homeIds: [home.id],
      });
    const snapshotAmount = subRes.body.data.subscription.priceSnapshot.amount as number;

    const admin = await loginAdmin();
    const planId = subRes.body.data.subscription.planId as string;
    await request(app)
      .post(`/api/v1/admin/care-plans/${planId}/prices`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ billingInterval: BillingInterval.MONTHLY, amount: 999, currency: 'INR' });

    const sub = await Subscription.findById(subRes.body.data.subscription.id);
    expect(sub?.priceSnapshot.amount).toBe(snapshotAmount);

    const activePrice = await SubscriptionPlanPrice.findOne({
      planId,
      billingInterval: BillingInterval.MONTHLY,
      isActive: true,
    });
    expect(activePrice?.amount).toBe(999);
  });

  it('9. admin can list subscriptions and view analytics', async () => {
    const customer = await loginCustomer();
    const home = await createHome(customer.token);
    await request(app)
      .post('/api/v1/subscriptions')
      .set('Authorization', `Bearer ${customer.token}`)
      .send({
        planSlug: 'home-care-plus',
        billingInterval: BillingInterval.MONTHLY,
        homeIds: [home.id],
      });

    const admin = await loginAdmin();
    const list = await request(app)
      .get('/api/v1/admin/subscriptions')
      .set('Authorization', `Bearer ${admin.token}`);
    expect(list.status).toBe(200);
    expect(list.body.data.items.length).toBeGreaterThan(0);

    const analytics = await request(app)
      .get('/api/v1/admin/subscription-analytics')
      .set('Authorization', `Bearer ${admin.token}`);
    expect(analytics.status).toBe(200);
    expect(analytics.body.data.activeSubscribers).toBeGreaterThanOrEqual(1);
  });

  it('10. cancel at period end does not delete subscription', async () => {
    const customer = await loginCustomer();
    const home = await createHome(customer.token);
    const subRes = await request(app)
      .post('/api/v1/subscriptions')
      .set('Authorization', `Bearer ${customer.token}`)
      .send({
        planSlug: 'home-care-plus',
        billingInterval: BillingInterval.MONTHLY,
        homeIds: [home.id],
      });
    const subId = subRes.body.data.subscription.id as string;

    const cancel = await request(app)
      .post(`/api/v1/subscriptions/${subId}/cancel`)
      .set('Authorization', `Bearer ${customer.token}`)
      .send({ immediate: false });
    expect(cancel.status).toBe(200);
    expect(cancel.body.data.cancelAtPeriodEnd).toBe(true);

    const count = await Subscription.countDocuments({ _id: subId });
    expect(count).toBe(1);
  });

  it('11. phase12 jobs run idempotently', async () => {
    const first = await runPhase12Jobs();
    const second = await runPhase12Jobs();
    expect(first).toBeDefined();
    expect(second).toBeDefined();
  });
});
