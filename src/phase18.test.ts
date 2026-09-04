import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import mongoose from 'mongoose';
import request from 'supertest';
import {
  ClaimResolutionType,
  GuaranteePolicyStatus,
  PartApprovalStatus,
  ProtectionClaimType,
  UserRole,
} from '@ghaarfix/shared-types';
import { createApp } from '@/app.js';
import { connectDatabase, disconnectDatabase } from '@/config/database.js';
import { seedAdminUser } from '@/modules/auth/auth.service.js';
import { runPhase18Migrations } from '@/migrations/008-phase18-trust.js';
import { User } from '@/models/User.js';
import {
  GuaranteeSnapshot,
  PartApproval,
  ProviderQualityScore,
  ProviderServiceCertification,
  RevisitBookingContext,
  ServiceGuaranteePolicy,
  ServiceProtectionClaim,
  BookingRefund,
} from '@/models/TrustProtection.js';
import { captureGuaranteeSnapshot } from '@/modules/trust-protection/guarantee-snapshot.service.js';
import { checkGuaranteeEligibility } from '@/modules/trust-protection/guarantee-eligibility.service.js';
import { detectRepeatIssue } from '@/modules/trust-protection/repeat-issue.service.js';
import { createProtectionClaim } from '@/modules/trust-protection/protection-claim.service.js';
import { requestRevisit } from '@/modules/trust-protection/revisit.service.js';
import {
  approvePart,
  assertPartsApprovedForInvoicing,
  requestPartApproval,
} from '@/modules/trust-protection/part-approval.service.js';
import { processBookingRefund } from '@/modules/trust-protection/booking-refund.service.js';
import {
  calculateProviderQualityScore,
  MIN_QUALITY_SAMPLE,
} from '@/modules/trust-protection/provider-quality-score.service.js';
import { runPhase18Jobs } from '@/modules/trust-protection/phase18-jobs.js';
import { Booking } from '@/models/Booking.js';
import { BookingStatus, BookingType, PaymentMethod, PaymentStatus, ProviderRequestStatus } from '@ghaarfix/shared-types';

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
    phone: '9876510001',
    role: UserRole.CUSTOMER,
    isPhoneVerified: true,
    status: 'ACTIVE',
  });
  const provider = await User.create({
    phone: '9876510002',
    role: UserRole.PROVIDER,
    isPhoneVerified: true,
    status: 'ACTIVE',
  });

  const booking = await Booking.create({
    bookingNumber: 'GF-TEST-001',
    bookingType: BookingType.SCHEDULED,
    source: 'SLOT_RESERVATION',
    customerId: customer._id,
    providerId: provider._id,
    serviceId: new mongoose.Types.ObjectId(),
    providerServiceId: new mongoose.Types.ObjectId(),
    bookingContextType: 'PERSONAL',
    addressSnapshot: {
      recipientName: 'Test',
      phone: '9876510001',
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

  await ServiceGuaranteePolicy.create({
    serviceId: booking.serviceId,
    version: 1,
    coverageDays: 30,
    coveredIssueTypes: [ProtectionClaimType.REPEAT_ISSUE, ProtectionClaimType.POOR_QUALITY],
    exclusions: [],
    maxClaims: 2,
    resolutionOptions: [ClaimResolutionType.FREE_REVISIT],
    status: GuaranteePolicyStatus.ACTIVE,
  });

  const snapshot = await captureGuaranteeSnapshot(booking._id.toString());

  return { customer, provider, booking, snapshot };
}

describe('Phase 18 — Trust & Customer Protection', () => {
  beforeAll(async () => {
    await connectDatabase();
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  beforeEach(async () => {
    await clearDatabase();
    await seedAdminUser();
    await runPhase18Migrations();
  });

  it('preserves guarantee snapshot at completion', async () => {
    const { booking, snapshot } = await seedCompletedBooking();
    expect(snapshot).toBeTruthy();
    expect(snapshot?.policyVersion).toBe(1);

    await ServiceGuaranteePolicy.findByIdAndUpdate(snapshot!.policyId, { coverageDays: 60 });
    const preserved = await GuaranteeSnapshot.findOne({ bookingId: booking._id });
    expect(preserved?.coverageDays).toBe(30);
  });

  it('validates claim eligibility', async () => {
    const { booking, customer } = await seedCompletedBooking();
    const result = await checkGuaranteeEligibility(
      booking._id.toString(),
      customer._id.toString(),
      ProtectionClaimType.REPEAT_ISSUE,
    );
    expect(result.eligible).toBe(true);
  });

  it('rejects expired guarantee claims', async () => {
    const { booking, customer, snapshot } = await seedCompletedBooking();
    await GuaranteeSnapshot.findByIdAndUpdate(snapshot!._id, {
      coverageEndsAt: new Date(Date.now() - 1000),
    });
    const result = await checkGuaranteeEligibility(
      booking._id.toString(),
      customer._id.toString(),
      ProtectionClaimType.REPEAT_ISSUE,
    );
    expect(result.eligible).toBe(false);
  });

  it('detects repeat issue without auto-refund', async () => {
    const { booking, customer } = await seedCompletedBooking();
    await Booking.create({
      bookingNumber: 'GF-TEST-PRIOR',
      bookingType: BookingType.SCHEDULED,
      source: 'SLOT_RESERVATION',
      customerId: customer._id,
      providerId: booking.providerId,
      serviceId: booking.serviceId,
      providerServiceId: booking.providerServiceId,
      bookingContextType: 'PERSONAL',
      addressSnapshot: booking.addressSnapshot,
      serviceSnapshot: booking.serviceSnapshot,
      providerSnapshot: booking.providerSnapshot,
      status: BookingStatus.COMPLETED,
      providerRequestStatus: ProviderRequestStatus.ACCEPTED,
      scheduledStart: new Date(Date.now() - 7 * 86400000),
      scheduledEnd: new Date(Date.now() - 7 * 86400000 + 3600000),
      timezone: 'Asia/Kolkata',
      durationMinutes: 60,
      price: { estimatedAmount: 500, finalAmount: 500, currency: 'INR' },
      payment: { method: PaymentMethod.ONLINE, status: PaymentStatus.PAID },
    });
    const signal = await detectRepeatIssue({
      bookingId: booking._id.toString(),
      customerId: customer._id.toString(),
      description: 'Same issue returned again',
    });
    expect(signal.advisoryOnly).toBe(true);
    expect(signal.detected).toBe(true);
  });

  it('links revisit to original booking', async () => {
    const { booking, customer } = await seedCompletedBooking();
    const revisit = await requestRevisit(customer._id.toString(), booking._id.toString(), {});
    expect(revisit.revisitBookingId).toBeTruthy();
    const ctx = await RevisitBookingContext.findOne({ originalBookingId: booking._id });
    expect(ctx?.revisitBookingId).toBeTruthy();
  });

  it('requires part approval before invoicing', async () => {
    const { booking, provider, customer } = await seedCompletedBooking();
    await requestPartApproval(provider._id.toString(), booking._id.toString(), {
      partName: 'Valve',
      quantity: 1,
      unitPrice: 500,
      reason: 'Replacement needed',
    });
    await expect(assertPartsApprovedForInvoicing(booking._id.toString())).rejects.toThrow(
      /unapproved/i,
    );
    const part = await PartApproval.findOne({ bookingId: booking._id });
    await approvePart(customer._id.toString(), part!._id.toString());
    await expect(assertPartsApprovedForInvoicing(booking._id.toString())).resolves.toBeUndefined();
  });

  it('processes refund idempotently', async () => {
    const { booking } = await seedCompletedBooking();
    const admin = await User.findOne({ role: UserRole.ADMIN });
    const key = 'refund-key-1';
    const first = await processBookingRefund({
      bookingId: booking._id.toString(),
      amount: 100,
      idempotencyKey: key,
      processedBy: admin!._id.toString(),
    });
    const second = await processBookingRefund({
      bookingId: booking._id.toString(),
      amount: 100,
      idempotencyKey: key,
      processedBy: admin!._id.toString(),
    });
    expect(second._id.toString()).toBe(first._id.toString());
    expect(await BookingRefund.countDocuments({ idempotencyKey: key })).toBe(1);
  });

  it('applies minimum sample threshold to quality score', async () => {
    const { provider } = await seedCompletedBooking();
    const score = await calculateProviderQualityScore(provider._id.toString());
    expect(score?.sampleSize).toBeLessThan(MIN_QUALITY_SAMPLE);
    expect(score?.status).not.toBe('EXCELLENT');
  });

  it('prevents duplicate claims with idempotency key', async () => {
    const { booking, customer } = await seedCompletedBooking();
    const key = 'claim-key-1';
    const first = await createProtectionClaim(customer._id.toString(), booking._id.toString(), {
      type: ProtectionClaimType.POOR_QUALITY,
      description: 'Work quality was below expectations for this service.',
      idempotencyKey: key,
    });
    const second = await createProtectionClaim(customer._id.toString(), booking._id.toString(), {
      type: ProtectionClaimType.POOR_QUALITY,
      description: 'Work quality was below expectations for this service.',
      idempotencyKey: key,
    });
    expect(second.id).toBe(first.id);
  });

  it('exposes admin trust overview', async () => {
    await seedCompletedBooking();
    const admin = await loginAdmin();
    const res = await request(app)
      .get('/api/v1/admin/trust/overview')
      .set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('openClaims');
  });

  it('runs phase 18 jobs', async () => {
    await seedCompletedBooking();
    const result = await runPhase18Jobs();
    expect(result).toBeDefined();
  });

  it('expires stale part approvals', async () => {
    const { booking, provider } = await seedCompletedBooking();
    await PartApproval.create({
      bookingId: booking._id,
      providerId: provider._id,
      customerId: booking.customerId,
      partName: 'Pipe',
      quantity: 1,
      unitPrice: 200,
      totalPrice: 200,
      reason: 'Leak fix',
      status: PartApprovalStatus.PENDING,
      expiresAt: new Date(Date.now() - 1000),
    });
    const { expireStalePartApprovals } = await import(
      '@/modules/trust-protection/part-approval.service.js'
    );
    const count = await expireStalePartApprovals();
    expect(count).toBeGreaterThanOrEqual(1);
  });
});
