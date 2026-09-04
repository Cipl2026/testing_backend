import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import mongoose from 'mongoose';
import request from 'supertest';
import {
  FinancialAdjustmentType,
  FinancialDirection,
  FinancialEventStatus,
  FinancialEventType,
  FinancialSourceType,
  ReconciliationStatus,
  UserRole,
} from '@ghaarfix/shared-types';
import { createApp } from '@/app.js';
import { connectDatabase, disconnectDatabase } from '@/config/database.js';
import { seedAdminUser } from '@/modules/auth/auth.service.js';
import { runPhase19Migrations } from '@/migrations/009-phase19-finance.js';
import { User } from '@/models/User.js';
import { Booking } from '@/models/Booking.js';
import {
  BookingStatus,
  BookingType,
  PaymentMethod,
  PaymentStatus,
  ProviderRequestStatus,
} from '@ghaarfix/shared-types';
import {
  createFinancialEvent,
  reverseFinancialEvent,
} from '@/modules/finance/financial-ledger.service.js';
import { calculateUnitEconomics, rebuildBookingFinancialSnapshot } from '@/modules/finance/booking-economics.service.js';
import {
  reconcilePayment,
  reconcilePayout,
} from '@/modules/finance/reconciliation.service.js';
import {
  approveFinancialAdjustment,
  requestFinancialAdjustment,
} from '@/modules/finance/financial-approval.service.js';
import { postBookingServiceRevenue, processFinanceOutbox } from '@/modules/finance/finance-integration.service.js';
import { runPhase19Jobs } from '@/modules/finance/phase19-jobs.js';
import { FinancialEvent } from '@/models/Finance.js';
import { FeatureFlag } from '@/models/FeatureFlag.js';
import { FeatureFlagKey } from '@ghaarfix/shared-types';
import { money, toMinor } from '@/utils/money.js';
import { AdminAuditLog } from '@/models/AdminAuditLog.js';

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

async function seedCompletedBooking() {
  const customer = await User.create({
    phone: '9876520001',
    role: UserRole.CUSTOMER,
    isPhoneVerified: true,
    status: 'ACTIVE',
  });
  const provider = await User.create({
    phone: '9876520002',
    role: UserRole.PROVIDER,
    isPhoneVerified: true,
    status: 'ACTIVE',
  });

  const booking = await Booking.create({
    bookingNumber: 'GF-FIN-001',
    bookingType: BookingType.SCHEDULED,
    source: 'SLOT_RESERVATION',
    customerId: customer._id,
    providerId: provider._id,
    serviceId: new mongoose.Types.ObjectId(),
    providerServiceId: new mongoose.Types.ObjectId(),
    bookingContextType: 'PERSONAL',
    addressSnapshot: {
      recipientName: 'Test',
      phone: '9876520001',
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
    price: {
      estimatedAmount: 500,
      finalAmount: 500,
      providerPayoutAmount: 350,
      currency: 'INR',
    },
    payment: { method: PaymentMethod.ONLINE, status: PaymentStatus.PAID },
  });

  return { customer, provider, booking };
}

describe('Phase 19 — Finance & BI', () => {
  beforeAll(async () => {
    await connectDatabase();
    await runPhase19Migrations();
    await seedAdminUser();
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  beforeEach(async () => {
    await clearDatabase();
    await seedAdminUser();
    await FeatureFlag.findOneAndUpdate(
      { key: FeatureFlagKey.ENABLE_FINANCE_BI },
      { key: FeatureFlagKey.ENABLE_FINANCE_BI, enabled: true, rules: [{ type: 'global' }] },
      { upsert: true },
    );
  });

  it('stores money as integer minor units', () => {
    expect(money(49900).amountMinor).toBe(49900);
    expect(toMinor(499)).toBe(49900);
    expect(() => money(499.5)).toThrow();
  });

  it('rejects duplicate idempotency keys', async () => {
    const sourceId = new mongoose.Types.ObjectId();
    await createFinancialEvent({
      eventType: FinancialEventType.PAYMENT_COLLECTED,
      sourceType: FinancialSourceType.PAYMENT,
      sourceId,
      amountMinor: 10000,
      direction: FinancialDirection.INFLOW,
      idempotencyKey: 'dup-key-1',
    });

    const dup = await createFinancialEvent({
      eventType: FinancialEventType.PAYMENT_COLLECTED,
      sourceType: FinancialSourceType.PAYMENT,
      sourceId,
      amountMinor: 10000,
      direction: FinancialDirection.INFLOW,
      idempotencyKey: 'dup-key-1',
    });

    const count = await FinancialEvent.countDocuments({ idempotencyKey: 'dup-key-1' });
    expect(count).toBe(1);
    expect(dup.amountMinor).toBe(10000);
  });

  it('creates compensating reversal for posted events', async () => {
    const event = await createFinancialEvent({
      eventType: FinancialEventType.SERVICE_REVENUE,
      sourceType: FinancialSourceType.BOOKING,
      sourceId: new mongoose.Types.ObjectId(),
      amountMinor: 50000,
      direction: FinancialDirection.INFLOW,
      idempotencyKey: 'rev-original',
    });

    const reversal = await reverseFinancialEvent(event._id.toString(), 'rev-compensate');
    const original = await FinancialEvent.findById(event._id);

    expect(original?.status).toBe(FinancialEventStatus.REVERSED);
    expect(reversal.eventType).toBe(FinancialEventType.ADJUSTMENT);
    expect(reversal.direction).toBe(FinancialDirection.OUTFLOW);
  });

  it('calculates contribution margin from unit economics', () => {
    const result = calculateUnitEconomics({
      grossRevenueMinor: 50000,
      discountMinor: 5000,
      refundMinor: 0,
      gatewayFeeMinor: 1000,
      providerCostMinor: 35000,
      partCostMinor: 0,
      guaranteeCostMinor: 0,
    });

    expect(result.netRevenueMinor).toBe(45000);
    expect(result.contributionMarginMinor).toBe(9000);
  });

  it('detects negative contribution margin', () => {
    const result = calculateUnitEconomics({
      grossRevenueMinor: 10000,
      discountMinor: 2000,
      refundMinor: 0,
      gatewayFeeMinor: 500,
      providerCostMinor: 12000,
      partCostMinor: 0,
      guaranteeCostMinor: 0,
    });

    expect(result.contributionMarginMinor).toBeLessThan(0);
  });

  it('rebuilds booking financial snapshot from ledger', async () => {
    const { booking } = await seedCompletedBooking();
    await postBookingServiceRevenue(booking._id.toString());

    const snap = await rebuildBookingFinancialSnapshot(booking._id.toString());
    expect(snap?.grossRevenueMinor).toBe(50000);
    expect(snap?.providerCostMinor).toBe(35000);
    expect(snap?.contributionMarginMinor).toBeGreaterThan(0);
  });

  it('reconciles matched payments', async () => {
    const paymentId = new mongoose.Types.ObjectId();
    const rec = await reconcilePayment(paymentId.toString(), 50000, 'rzp_test', 50000);
    expect(rec?.status).toBe(ReconciliationStatus.MATCHED);
  });

  it('reconciles payout mismatch', async () => {
    const rec = await reconcilePayout({
      providerId: new mongoose.Types.ObjectId().toString(),
      payoutId: new mongoose.Types.ObjectId().toString(),
      expectedAmountMinor: 35000,
      actualAmountMinor: 30000,
      reason: 'Partial transfer',
    });
    expect(rec?.status).toBe(ReconciliationStatus.PARTIAL);
    expect(rec?.differenceMinor).toBe(-5000);
  });

  it('blocks self-approval for financial adjustments', async () => {
    const admin = await User.findOne({ email: 'admin@ghaarfix.in' });
    const approval = await requestFinancialAdjustment({
      type: FinancialAdjustmentType.CREDIT,
      amountMinor: 10000,
      reason: 'Test adjustment',
      requestedBy: admin!._id.toString(),
      idempotencyKey: 'adj-self-1',
    });

    await expect(
      approveFinancialAdjustment(approval._id.toString(), admin!._id.toString()),
    ).rejects.toThrow(/cannot approve/);
  });

  it('allows approval by different admin', async () => {
    const requester = await User.create({
      email: 'finance1@ghaarfix.in',
      role: UserRole.ADMIN,
      passwordHash: 'x',
      status: 'ACTIVE',
    });
    const reviewer = await User.create({
      email: 'finance2@ghaarfix.in',
      role: UserRole.ADMIN,
      passwordHash: 'x',
      status: 'ACTIVE',
    });

    const approval = await requestFinancialAdjustment({
      type: FinancialAdjustmentType.CREDIT,
      amountMinor: 10000,
      reason: 'Manual credit',
      requestedBy: requester._id.toString(),
      idempotencyKey: 'adj-approve-1',
    });

    const approved = await approveFinancialAdjustment(approval._id.toString(), reviewer._id.toString());
    expect(approved.status).toBe('APPROVED');
  });

  it('processes finance outbox idempotently', async () => {
    const { FinanceOutbox } = await import('@/models/Finance.js');
    const { booking } = await seedCompletedBooking();

    await FinanceOutbox.create({
      eventType: 'SERVICE_REVENUE',
      payload: { bookingId: booking._id.toString() },
      idempotencyKey: `outbox:service-revenue:${booking._id.toString()}`,
      status: 'PENDING',
    });

    const first = await processFinanceOutbox();
    const second = await processFinanceOutbox();
    expect(first).toBeGreaterThanOrEqual(1);
    expect(second).toBe(0);

    const events = await FinancialEvent.countDocuments({ bookingId: booking._id });
    expect(events).toBeGreaterThanOrEqual(1);
  });

  it('exposes admin finance overview', async () => {
    const { token } = await loginAdmin();
    const { booking } = await seedCompletedBooking();
    await postBookingServiceRevenue(booking._id.toString());

    const res = await request(app)
      .get('/api/v1/admin/finance/overview')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.gmvMinor).toBeDefined();
  });

  it('exposes ledger explorer for admin', async () => {
    const { token } = await loginAdmin();
    await createFinancialEvent({
      eventType: FinancialEventType.PAYMENT_COLLECTED,
      sourceType: FinancialSourceType.PAYMENT,
      sourceId: new mongoose.Types.ObjectId(),
      amountMinor: 25000,
      direction: FinancialDirection.INFLOW,
      idempotencyKey: 'ledger-explorer-1',
    });

    const res = await request(app)
      .get('/api/v1/admin/finance/ledger')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.items.length).toBeGreaterThanOrEqual(1);

    const audit = await AdminAuditLog.findOne({ action: 'FINANCE_LEDGER_EXPORT' });
    expect(audit).toBeTruthy();
  });

  it('isolates provider earnings from platform margin', async () => {
    const { provider, booking } = await seedCompletedBooking();
    await postBookingServiceRevenue(booking._id.toString());

    const { getProviderFinanceEarnings } = await import('@/modules/finance/provider-finance.service.js');
    const earnings = await getProviderFinanceEarnings(provider._id.toString());
    expect(earnings.grossEarningsMinor).toBeGreaterThan(0);
    expect((earnings as { contributionMarginMinor?: number }).contributionMarginMinor).toBeUndefined();
  });

  it('runs phase 19 background jobs', async () => {
    const { booking } = await seedCompletedBooking();
    await postBookingServiceRevenue(booking._id.toString());
    const summary = await runPhase19Jobs();
    expect(summary.enabled).toBe(true);
  });
});
