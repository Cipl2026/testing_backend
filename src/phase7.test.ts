import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import mongoose from 'mongoose';
import { DateTime } from 'luxon';
import {
  PaymentMethod,
  PricingType,
  ProviderServiceApprovalStatus,
  ProviderStatus,
  ReviewStatus,
  ServiceAreaType,
  ServiceEvidenceType,
  SupportTicketCategory,
} from '@ghaarfix/shared-types';
import { createApp } from '@/app.js';
import { connectDatabase, disconnectDatabase } from '@/config/database.js';
import { Invoice } from '@/models/Invoice.js';
import { Review } from '@/models/Review.js';
import { Category } from '@/models/Category.js';
import { Otp } from '@/models/Otp.js';
import { ProviderProfile } from '@/models/ProviderProfile.js';
import { ProviderSchedule } from '@/models/ProviderSchedule.js';
import { ProviderService } from '@/models/ProviderService.js';
import { ProviderServiceArea } from '@/models/ProviderServiceArea.js';
import { Service } from '@/models/Service.js';
import { Subcategory } from '@/models/Subcategory.js';
import { seedAdminUser } from '@/modules/auth/auth.service.js';
import { hashOtp } from '@/utils/crypto.js';

const app = createApp();

let phoneSeq = 9876500100;
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

async function seedCatalogAndProvider(providerUserId: string) {
  const suffix = randomBytes(3).toString('hex');
  const category = await Category.create({ name: 'Plumbing', slug: `plumbing-${suffix}`, isActive: true, displayOrder: 1 });
  const subcategory = await Subcategory.create({
    categoryId: category._id,
    name: 'Bathroom',
    slug: `bathroom-${suffix}`,
    isActive: true,
    displayOrder: 1,
  });
  const service = await Service.create({
    categoryId: category._id,
    subcategoryId: subcategory._id,
    name: 'Tap Repair',
    slug: `tap-repair-${suffix}`,
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
  return { service };
}

async function createConfirmedBooking() {
  const customer = await loginCustomer(nextPhone());
  const provider = await loginProvider(nextPhone());
  const { service } = await seedCatalogAndProvider(provider.userId);

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

  const reservation = await request(app)
    .post('/api/v1/availability/reservations')
    .set('Authorization', `Bearer ${customer.token}`)
    .send({
      providerId: provider.userId,
      serviceId: service._id.toString(),
      addressId: address.body.data.id,
      startDateTime: slot.startDateTime,
    });

  const booking = await request(app)
    .post('/api/v1/bookings')
    .set('Authorization', `Bearer ${customer.token}`)
    .send({ reservationId: reservation.body.data.id, paymentMethod: PaymentMethod.PAY_ON_SERVICE });

  await request(app)
    .post(`/api/v1/provider/bookings/${booking.body.data.id}/accept`)
    .set('Authorization', `Bearer ${provider.token}`);

  return { customer, provider, bookingId: booking.body.data.id as string };
}

async function advanceToEnRoute(ctx: Awaited<ReturnType<typeof createConfirmedBooking>>) {
  await request(app)
    .post(`/api/v1/provider/bookings/${ctx.bookingId}/en-route`)
    .set('Authorization', `Bearer ${ctx.provider.token}`);
}

async function advanceToCompleted(ctx: Awaited<ReturnType<typeof createConfirmedBooking>>) {
  await advanceToEnRoute(ctx);
  await request(app)
    .post(`/api/v1/provider/bookings/${ctx.bookingId}/arrive`)
    .set('Authorization', `Bearer ${ctx.provider.token}`);
  await request(app)
    .post(`/api/v1/provider/bookings/${ctx.bookingId}/start`)
    .set('Authorization', `Bearer ${ctx.provider.token}`);
  await request(app)
    .post(`/api/v1/provider/bookings/${ctx.bookingId}/complete`)
    .set('Authorization', `Bearer ${ctx.provider.token}`);
}

describe('Phase 7 Post-Service API', () => {
  beforeAll(async () => {
    await connectDatabase();
    await seedAdminUser();
  });
  afterAll(async () => disconnectDatabase());
  beforeEach(async () => {
    await clearDatabase();
    await seedAdminUser();
  });

  it('rejects location for another provider booking', async () => {
    const ctx = await createConfirmedBooking();
    const other = await loginProvider(nextPhone());
    await advanceToEnRoute(ctx);
    const res = await request(app)
      .post(`/api/v1/provider/bookings/${ctx.bookingId}/location`)
      .set('Authorization', `Bearer ${other.token}`)
      .send({ latitude: 12.97, longitude: 77.59 });
    expect(res.status).toBe(404);
  });

  it('accepts location only during en route', async () => {
    const ctx = await createConfirmedBooking();
    const res = await request(app)
      .post(`/api/v1/provider/bookings/${ctx.bookingId}/location`)
      .set('Authorization', `Bearer ${ctx.provider.token}`)
      .send({ latitude: 12.97, longitude: 77.59 });
    expect(res.status).toBe(409);
  });

  it('rejects invalid coordinates', async () => {
    const ctx = await createConfirmedBooking();
    await advanceToEnRoute(ctx);
    const res = await request(app)
      .post(`/api/v1/provider/bookings/${ctx.bookingId}/location`)
      .set('Authorization', `Bearer ${ctx.provider.token}`)
      .send({ latitude: 999, longitude: 77.59 });
    expect(res.status).toBe(400);
  });

  it('allows customer to access own tracking', async () => {
    const ctx = await createConfirmedBooking();
    await advanceToEnRoute(ctx);
    await request(app)
      .post(`/api/v1/provider/bookings/${ctx.bookingId}/location`)
      .set('Authorization', `Bearer ${ctx.provider.token}`)
      .send({ latitude: 12.972, longitude: 77.595 });
    const res = await request(app)
      .get(`/api/v1/bookings/${ctx.bookingId}/tracking`)
      .set('Authorization', `Bearer ${ctx.customer.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.trackingActive).toBe(true);
    expect(res.body.data.currentLocation).toBeTruthy();
  });

  it('stops tracking after arrival', async () => {
    const ctx = await createConfirmedBooking();
    await advanceToEnRoute(ctx);
    await request(app)
      .post(`/api/v1/provider/bookings/${ctx.bookingId}/location`)
      .set('Authorization', `Bearer ${ctx.provider.token}`)
      .send({ latitude: 12.972, longitude: 77.595 });
    await request(app)
      .post(`/api/v1/provider/bookings/${ctx.bookingId}/arrive`)
      .set('Authorization', `Bearer ${ctx.provider.token}`);
    const res = await request(app)
      .get(`/api/v1/bookings/${ctx.bookingId}/tracking`)
      .set('Authorization', `Bearer ${ctx.customer.token}`);
    expect(res.body.data.trackingActive).toBe(false);
    expect(res.body.data.currentLocation).toBeNull();
  });

  it('validates evidence ownership', async () => {
    const ctx = await createConfirmedBooking();
    const other = await loginProvider(nextPhone());
    await advanceToEnRoute(ctx);
    await request(app)
      .post(`/api/v1/provider/bookings/${ctx.bookingId}/arrive`)
      .set('Authorization', `Bearer ${ctx.provider.token}`);
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64',
    );
    const res = await request(app)
      .post(`/api/v1/provider/bookings/${ctx.bookingId}/evidence`)
      .set('Authorization', `Bearer ${other.token}`)
      .field('type', ServiceEvidenceType.BEFORE)
      .attach('file', png, { filename: 'test.png', contentType: 'image/png' });
    expect(res.status).toBe(404);
  });

  it('rejects invalid upload mime', async () => {
    const ctx = await createConfirmedBooking();
    await advanceToEnRoute(ctx);
    await request(app)
      .post(`/api/v1/provider/bookings/${ctx.bookingId}/arrive`)
      .set('Authorization', `Bearer ${ctx.provider.token}`);
    const res = await request(app)
      .post(`/api/v1/provider/bookings/${ctx.bookingId}/evidence`)
      .set('Authorization', `Bearer ${ctx.provider.token}`)
      .field('type', ServiceEvidenceType.BEFORE)
      .attach('file', Buffer.from('not an image'), { filename: 'test.txt', contentType: 'text/plain' });
    expect(res.status).toBe(400);
  });

  it('completion summary is idempotent', async () => {
    const ctx = await createConfirmedBooking();
    await advanceToEnRoute(ctx);
    await request(app)
      .post(`/api/v1/provider/bookings/${ctx.bookingId}/arrive`)
      .set('Authorization', `Bearer ${ctx.provider.token}`);
    await request(app)
      .post(`/api/v1/provider/bookings/${ctx.bookingId}/start`)
      .set('Authorization', `Bearer ${ctx.provider.token}`);
    const body = {
      summary: 'Fixed tap leak',
      checklist: { serviceCompleted: true, workAreaCleaned: true, customerInformed: true, photosAttached: false },
    };
    const first = await request(app)
      .post(`/api/v1/provider/bookings/${ctx.bookingId}/completion-summary`)
      .set('Authorization', `Bearer ${ctx.provider.token}`)
      .send(body);
    const second = await request(app)
      .post(`/api/v1/provider/bookings/${ctx.bookingId}/completion-summary`)
      .set('Authorization', `Bearer ${ctx.provider.token}`)
      .send(body);
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(first.body.data.id).toBe(second.body.data.id);
  });

  it('does not create duplicate invoice', async () => {
    const ctx = await createConfirmedBooking();
    await advanceToCompleted(ctx);
    await new Promise((r) => setTimeout(r, 500));
    const first = await request(app)
      .get(`/api/v1/bookings/${ctx.bookingId}/invoice`)
      .set('Authorization', `Bearer ${ctx.customer.token}`);
    const second = await request(app)
      .get(`/api/v1/bookings/${ctx.bookingId}/invoice`)
      .set('Authorization', `Bearer ${ctx.customer.token}`);
    expect(first.status).toBe(200);
    expect(second.body.data.invoiceNumber).toBe(first.body.data.invoiceNumber);
    expect(await Invoice.countDocuments({ bookingId: ctx.bookingId })).toBe(1);
  });

  it('invoice number is unique', async () => {
    const ctx1 = await createConfirmedBooking();
    await advanceToCompleted(ctx1);
    const ctx2 = await createConfirmedBooking();
    await advanceToCompleted(ctx2);
    await new Promise((r) => setTimeout(r, 800));
    const inv1 = await request(app)
      .get(`/api/v1/bookings/${ctx1.bookingId}/invoice`)
      .set('Authorization', `Bearer ${ctx1.customer.token}`);
    const inv2 = await request(app)
      .get(`/api/v1/bookings/${ctx2.bookingId}/invoice`)
      .set('Authorization', `Bearer ${ctx2.customer.token}`);
    expect(inv1.body.data.invoiceNumber).not.toBe(inv2.body.data.invoiceNumber);
  });

  it('customer cannot access another customer invoice', async () => {
    const ctx = await createConfirmedBooking();
    await advanceToCompleted(ctx);
    await new Promise((r) => setTimeout(r, 500));
    const invoice = await request(app)
      .get(`/api/v1/bookings/${ctx.bookingId}/invoice`)
      .set('Authorization', `Bearer ${ctx.customer.token}`);
    const other = await loginCustomer(nextPhone());
    const res = await request(app)
      .get(`/api/v1/invoices/${invoice.body.data.id}`)
      .set('Authorization', `Bearer ${other.token}`);
    expect(res.status).toBe(403);
  });

  it('allows one review per booking', async () => {
    const ctx = await createConfirmedBooking();
    await advanceToCompleted(ctx);
    const first = await request(app)
      .post(`/api/v1/bookings/${ctx.bookingId}/review`)
      .set('Authorization', `Bearer ${ctx.customer.token}`)
      .send({ rating: 5, comment: 'Great job' });
    const second = await request(app)
      .post(`/api/v1/bookings/${ctx.bookingId}/review`)
      .set('Authorization', `Bearer ${ctx.customer.token}`)
      .send({ rating: 4 });
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(first.body.data.id).toBe(second.body.data.id);
    expect(await Review.countDocuments({ bookingId: ctx.bookingId })).toBe(1);
  });

  it('only booking owner can review', async () => {
    const ctx = await createConfirmedBooking();
    await advanceToCompleted(ctx);
    const other = await loginCustomer(nextPhone());
    const res = await request(app)
      .post(`/api/v1/bookings/${ctx.bookingId}/review`)
      .set('Authorization', `Bearer ${other.token}`)
      .send({ rating: 5 });
    expect(res.status).toBe(404);
  });

  it('only completed booking can be reviewed', async () => {
    const ctx = await createConfirmedBooking();
    const res = await request(app)
      .post(`/api/v1/bookings/${ctx.bookingId}/review`)
      .set('Authorization', `Bearer ${ctx.customer.token}`)
      .send({ rating: 5 });
    expect(res.status).toBe(409);
  });

  it('validates review rating', async () => {
    const ctx = await createConfirmedBooking();
    await advanceToCompleted(ctx);
    const res = await request(app)
      .post(`/api/v1/bookings/${ctx.bookingId}/review`)
      .set('Authorization', `Bearer ${ctx.customer.token}`)
      .send({ rating: 10 });
    expect(res.status).toBe(400);
  });

  it('validates support ticket booking ownership', async () => {
    const ctx = await createConfirmedBooking();
    const other = await loginCustomer(nextPhone());
    const res = await request(app)
      .post(`/api/v1/bookings/${ctx.bookingId}/support-tickets`)
      .set('Authorization', `Bearer ${other.token}`)
      .send({
        category: SupportTicketCategory.QUALITY_ISSUE,
        subject: 'Issue',
        description: 'Something went wrong with the service',
      });
    expect(res.status).toBe(404);
  });

  it('audits admin support action', async () => {
    const ctx = await createConfirmedBooking();
    const ticket = await request(app)
      .post(`/api/v1/bookings/${ctx.bookingId}/support-tickets`)
      .set('Authorization', `Bearer ${ctx.customer.token}`)
      .send({
        category: SupportTicketCategory.PAYMENT_ISSUE,
        subject: 'Payment issue',
        description: 'I was charged incorrectly for this booking',
      });
    const admin = await loginAdmin();
    const res = await request(app)
      .patch(`/api/v1/admin/support-tickets/${ticket.body.data.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ status: 'IN_PROGRESS', reason: 'Investigating payment issue' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('IN_PROGRESS');
  });

  it('admin can moderate review', async () => {
    const ctx = await createConfirmedBooking();
    await advanceToCompleted(ctx);
    const review = await request(app)
      .post(`/api/v1/bookings/${ctx.bookingId}/review`)
      .set('Authorization', `Bearer ${ctx.customer.token}`)
      .send({ rating: 1, comment: 'Bad' });
    const admin = await loginAdmin();
    const res = await request(app)
      .patch(`/api/v1/admin/reviews/${review.body.data.id}/moderation`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ status: ReviewStatus.HIDDEN, reason: 'Inappropriate language' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('HIDDEN');
  });

  it('returns provider trust metrics', async () => {
    const ctx = await createConfirmedBooking();
    await advanceToCompleted(ctx);
    await request(app)
      .post(`/api/v1/bookings/${ctx.bookingId}/review`)
      .set('Authorization', `Bearer ${ctx.customer.token}`)
      .send({ rating: 5 });
    const res = await request(app).get(`/api/v1/providers/${ctx.provider.userId}/trust`);
    expect(res.status).toBe(200);
    expect(res.body.data.completedJobs).toBeGreaterThanOrEqual(1);
  });

  it('customer cannot access another customer tracking', async () => {
    const ctx = await createConfirmedBooking();
    await advanceToEnRoute(ctx);
    const other = await loginCustomer(nextPhone());
    const res = await request(app)
      .get(`/api/v1/bookings/${ctx.bookingId}/tracking`)
      .set('Authorization', `Bearer ${other.token}`);
    expect(res.status).toBe(404);
  });
});
