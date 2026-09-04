import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import mongoose from 'mongoose';
import request from 'supertest';
import {
  BookingStatus,
  BookingType,
  ChurnRiskLevel,
  CustomerLifecycleState,
  LoyaltyEventType,
  MarketingChannel,
  MessagePriority,
  PaymentMethod,
  PaymentStatus,
  ProviderRequestStatus,
  UserRole,
} from '@ghaarfix/shared-types';
import { createApp } from '@/app.js';
import { connectDatabase, disconnectDatabase } from '@/config/database.js';
import { seedAdminUser } from '@/modules/auth/auth.service.js';
import { runPhase20Migrations } from '@/migrations/010-phase20-lifecycle-growth.js';
import { User } from '@/models/User.js';
import { Booking } from '@/models/Booking.js';
import { FeatureFlag } from '@/models/FeatureFlag.js';
import { FeatureFlagKey } from '@ghaarfix/shared-types';
import { Otp } from '@/models/Otp.js';
import { hashOtp } from '@/utils/crypto.js';
import { calculateCustomerLifecycle } from '@/modules/customer-lifecycle/lifecycle.service.js';
import { canSendMessage, updateConsent } from '@/modules/customer-lifecycle/consent.service.js';
import { calculateChurnRisk } from '@/modules/customer-lifecycle/churn.service.js';
import {
  dismissServiceRecommendation,
  generateServiceRecommendations,
} from '@/modules/customer-lifecycle/service-recommendation.service.js';
import { creditLoyaltyPoints, redeemLoyaltyReward } from '@/modules/customer-lifecycle/loyalty.service.js';
import { getOrAssignExperimentVariant } from '@/modules/customer-lifecycle/experiment-assignment.service.js';
import { Experiment } from '@/models/Experiment.js';
import { ExperimentStatus, ExperimentVariant } from '@ghaarfix/shared-types';
import { LoyaltyReward } from '@/models/CustomerLifecycle.js';
import { runPhase20Jobs, seedDefaultLoyaltyRewards } from '@/modules/customer-lifecycle/phase20-jobs.js';
import { logCommunication } from '@/modules/customer-lifecycle/consent.service.js';

const app = createApp();

async function clearDatabase() {
  await Promise.all(Object.values(mongoose.connection.collections).map((c) => c.deleteMany({})));
}

async function loginAdmin() {
  const res = await request(app)
    .post('/api/v1/admin/login')
    .send({ email: 'admin@ghaarfix.in', password: 'Admin@123456' });
  return { token: res.body.data.accessToken as string };
}

async function seedCustomer(phone = '9876530001') {
  return User.create({
    phone,
    role: UserRole.CUSTOMER,
    isPhoneVerified: true,
    status: 'ACTIVE',
  });
}

describe('Phase 20 — Lifecycle Growth', () => {
  beforeAll(async () => {
    await connectDatabase();
    await runPhase20Migrations();
    await seedAdminUser();
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  beforeEach(async () => {
    await clearDatabase();
    await seedAdminUser();
    await FeatureFlag.findOneAndUpdate(
      { key: FeatureFlagKey.ENABLE_LIFECYCLE_GROWTH },
      { key: FeatureFlagKey.ENABLE_LIFECYCLE_GROWTH, enabled: true, rules: [{ type: 'global' }] },
      { upsert: true },
    );
    await seedDefaultLoyaltyRewards();
  });

  it('transitions lifecycle from NEW to ACTIVATED', async () => {
    const customer = await seedCustomer();
    const snap1 = await calculateCustomerLifecycle(customer._id.toString());
    expect(snap1?.state).toBe(CustomerLifecycleState.NEW);

    await Booking.create({
      bookingNumber: 'GF-LC-001',
      bookingType: BookingType.SCHEDULED,
      source: 'SLOT_RESERVATION',
      customerId: customer._id,
      providerId: new mongoose.Types.ObjectId(),
      serviceId: new mongoose.Types.ObjectId(),
      providerServiceId: new mongoose.Types.ObjectId(),
      bookingContextType: 'PERSONAL',
      addressSnapshot: {
        recipientName: 'Test',
        phone: '9876530001',
        addressLine1: 'Test St',
        city: 'Bengaluru',
        state: 'KA',
        postalCode: '560001',
      },
      serviceSnapshot: { name: 'Plumbing', pricing: { type: 'FIXED', currency: 'INR' } },
      providerSnapshot: { fullName: 'Provider' },
      status: BookingStatus.COMPLETED,
      providerRequestStatus: ProviderRequestStatus.ACCEPTED,
      scheduledStart: new Date(),
      scheduledEnd: new Date(Date.now() + 3600000),
      timezone: 'Asia/Kolkata',
      durationMinutes: 60,
      price: { estimatedAmount: 500, finalAmount: 500, currency: 'INR' },
      payment: { method: PaymentMethod.ONLINE, status: PaymentStatus.PAID },
    });

    const snap2 = await calculateCustomerLifecycle(customer._id.toString());
    expect(snap2?.state).toBe(CustomerLifecycleState.ACTIVATED);
    expect(snap2?.reason).toContain('First successful');
  });

  it('blocks marketing when opt-out', async () => {
    const customer = await seedCustomer('9876530002');
    await updateConsent(customer._id.toString(), { marketingOptIn: false });

    const check = await canSendMessage({
      customerId: customer._id.toString(),
      channel: MarketingChannel.PUSH,
      priority: MessagePriority.MARKETING,
    });
    expect(check.allowed).toBe(false);
  });

  it('allows transactional messages when marketing opted out', async () => {
    const customer = await seedCustomer('9876530003');
    await updateConsent(customer._id.toString(), { marketingOptIn: false });

    const check = await canSendMessage({
      customerId: customer._id.toString(),
      channel: MarketingChannel.PUSH,
      priority: MessagePriority.TRANSACTIONAL,
    });
    expect(check.allowed).toBe(true);
  });

  it('enforces frequency guard', async () => {
    const customer = await seedCustomer('9876530004');
    await updateConsent(customer._id.toString(), { marketingOptIn: true, pushEnabled: true });

    await logCommunication({
      customerId: customer._id.toString(),
      channel: MarketingChannel.PUSH,
      priority: MessagePriority.MARKETING,
      messageType: 'TEST',
      idempotencyKey: 'freq-1',
    });

    const check = await canSendMessage({
      customerId: customer._id.toString(),
      channel: MarketingChannel.PUSH,
      priority: MessagePriority.MARKETING,
    });
    expect(check.allowed).toBe(false);
    expect(check.reason).toContain('Daily frequency');
  });

  it('prevents duplicate communication via idempotency', async () => {
    const customer = await seedCustomer('9876530005');
    const first = await logCommunication({
      customerId: customer._id.toString(),
      channel: MarketingChannel.IN_APP,
      priority: MessagePriority.SERVICE_REMINDER,
      messageType: 'REMINDER',
      idempotencyKey: 'dup-comm-1',
    });
    const second = await logCommunication({
      customerId: customer._id.toString(),
      channel: MarketingChannel.IN_APP,
      priority: MessagePriority.SERVICE_REMINDER,
      messageType: 'REMINDER',
      idempotencyKey: 'dup-comm-1',
    });
    expect(first).toBe(true);
    expect(second).toBe(false);
  });

  it('calculates churn with explainable factors', async () => {
    const customer = await seedCustomer('9876530006');
    await calculateCustomerLifecycle(customer._id.toString());
    const churn = await calculateChurnRisk(customer._id.toString());
    expect(churn?.topFactors).toBeDefined();
    expect(churn?.recommendedAction).toBeTruthy();
    expect(churn?.riskLevel).toBe(ChurnRiskLevel.LOW);
  });

  it('credits loyalty points idempotently', async () => {
    const customer = await seedCustomer('9876530007');
    await creditLoyaltyPoints({
      customerId: customer._id.toString(),
      points: 100,
      type: LoyaltyEventType.BOOKING_COMPLETED,
      idempotencyKey: 'loyalty-1',
    });
    const dup = await creditLoyaltyPoints({
      customerId: customer._id.toString(),
      points: 100,
      type: LoyaltyEventType.BOOKING_COMPLETED,
      idempotencyKey: 'loyalty-1',
    });
    expect(dup.points).toBe(100);
  });

  it('prevents double reward redemption', async () => {
    const customer = await seedCustomer('9876530008');
    await creditLoyaltyPoints({
      customerId: customer._id.toString(),
      points: 1000,
      type: LoyaltyEventType.BONUS,
      idempotencyKey: 'bonus-1',
    });
    const reward = await LoyaltyReward.findOne();
    expect(reward).toBeTruthy();

    await redeemLoyaltyReward(customer._id.toString(), reward!._id.toString(), 'redeem-1');
    const dup = await redeemLoyaltyReward(customer._id.toString(), reward!._id.toString(), 'redeem-1');
    expect(dup.type).toBe(LoyaltyEventType.REDEEMED);
  });

  it('assigns experiment variant consistently', async () => {
    const customer = await seedCustomer('9876530009');
    await Experiment.create({
      key: 'reminder-copy',
      name: 'Reminder Copy Test',
      status: ExperimentStatus.RUNNING,
      variants: [ExperimentVariant.CONTROL, ExperimentVariant.VARIANT_A],
      startAt: new Date(Date.now() - 86400000),
      endAt: new Date(Date.now() + 86400000 * 30),
    });

    const a = await getOrAssignExperimentVariant(customer._id.toString(), 'reminder-copy');
    const b = await getOrAssignExperimentVariant(customer._id.toString(), 'reminder-copy');
    expect(a.variant).toBe(b.variant);
    expect(a.enrolled).toBe(true);
  });

  it('dismisses service recommendation', async () => {
    const customer = await seedCustomer('9876530010');
    await generateServiceRecommendations(customer._id.toString());
    const { listServiceRecommendations } = await import(
      '@/modules/customer-lifecycle/service-recommendation.service.js'
    );
    const items = await listServiceRecommendations(customer._id.toString());
    if (items.length === 0) return;

    const dismissed = await dismissServiceRecommendation(customer._id.toString(), items[0].id);
    expect(dismissed?.status).toBe('DISMISSED');
  });

  it('exposes admin growth overview', async () => {
    const { token } = await loginAdmin();
    const res = await request(app)
      .get('/api/v1/admin/growth/overview')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.lifecycle).toBeDefined();
  });

  it('exposes customer communication preferences', async () => {
    const customer = await loginCustomer();
    const res = await request(app)
      .patch('/api/v1/customer/communication-preferences')
      .set('Authorization', `Bearer ${customer.token}`)
      .send({ marketingOptIn: true, pushEnabled: true });
    expect(res.status).toBe(200);
    expect(res.body.data.marketingOptIn).toBe(true);
  });

  it('runs phase 20 jobs', async () => {
    const summary = await runPhase20Jobs();
    expect(summary.enabled).toBe(true);
  });
});

async function loginCustomer(phone = '9876539999') {
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
  return { token: res.body.data.accessToken as string };
}
