import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { PricingType } from '@ghaarfix/shared-types';
import { createApp } from '@/app.js';
import { connectDatabase, disconnectDatabase } from '@/config/database.js';
import { env } from '@/config/env.js';
import { Category } from '@/models/Category.js';
import { FavoriteService } from '@/models/FavoriteService.js';
import { ProviderService } from '@/models/ProviderService.js';
import { Service } from '@/models/Service.js';
import { Subcategory } from '@/models/Subcategory.js';
import { User } from '@/models/User.js';
import { hashOtp } from '@/utils/crypto.js';
import { Otp } from '@/models/Otp.js';
import { seedAdminUser } from '@/modules/auth/auth.service.js';

const app = createApp();

async function clearDatabase() {
  const collections = mongoose.connection.collections;
  await Promise.all(Object.values(collections).map((collection) => collection.deleteMany({})));
}

async function loginCustomer(phone = '9876543210') {
  const otp = '123456';
  await Otp.create({
    requestId: `req-${phone}`,
    phone: `+91${phone}`,
    role: 'CUSTOMER',
    otpHash: hashOtp(otp),
    expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    attempts: 0,
    isVerified: false,
    lastSentAt: new Date(),
  });
  const response = await request(app)
    .post('/api/v1/auth/verify-otp')
    .send({ phone, otp, role: 'CUSTOMER' });
  return response.body.data.accessToken as string;
}

async function loginProvider(phone = '9876543211') {
  const otp = '123456';
  await Otp.create({
    requestId: `req-${phone}`,
    phone: `+91${phone}`,
    role: 'PROVIDER',
    otpHash: hashOtp(otp),
    expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    attempts: 0,
    isVerified: false,
    lastSentAt: new Date(),
  });
  const response = await request(app)
    .post('/api/v1/auth/verify-otp')
    .send({ phone, otp, role: 'PROVIDER' });
  return response.body.data.accessToken as string;
}

async function loginAdmin() {
  const response = await request(app)
    .post('/api/v1/admin/login')
    .send({ email: env.admin.email, password: env.admin.password });
  return response.body.data.accessToken as string;
}

async function seedCatalogFixtures() {
  const category = await Category.create({
    name: 'Plumbing',
    slug: 'plumbing',
    icon: 'water-outline',
    isActive: true,
    displayOrder: 1,
  });
  const subcategory = await Subcategory.create({
    categoryId: category._id,
    name: 'Bathroom Plumbing',
    slug: 'bathroom-plumbing',
    isActive: true,
    displayOrder: 1,
  });
  const activeService = await Service.create({
    categoryId: category._id,
    subcategoryId: subcategory._id,
    name: 'Tap Repair',
    slug: 'tap-repair',
    shortDescription: 'Fix leaking taps',
    pricing: { type: PricingType.STARTING_FROM, startingPrice: 199, currency: 'INR' },
    estimatedDuration: { minMinutes: 30, maxMinutes: 60 },
    whatIsIncluded: ['Inspection'],
    whatIsNotIncluded: ['Parts'],
    faqs: [],
    isActive: true,
    isFeatured: true,
    displayOrder: 1,
  });
  const inactiveService = await Service.create({
    categoryId: category._id,
    subcategoryId: subcategory._id,
    name: 'Hidden Service',
    slug: 'hidden-service',
    shortDescription: 'Inactive',
    pricing: { type: PricingType.STARTING_FROM, startingPrice: 99, currency: 'INR' },
    estimatedDuration: { minMinutes: 30, maxMinutes: 60 },
    whatIsIncluded: [],
    whatIsNotIncluded: [],
    faqs: [],
    isActive: false,
    isFeatured: false,
    displayOrder: 2,
  });
  return { category, subcategory, activeService, inactiveService };
}

describe('Catalog API', () => {
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

  it('allows admin to create category', async () => {
    const token = await loginAdmin();
    const response = await request(app)
      .post('/api/v1/admin/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Electrical', icon: 'flash-outline', displayOrder: 1 });

    expect(response.status).toBe(201);
    expect(response.body.data.slug).toBe('electrical');
  });

  it('prevents customer from creating category', async () => {
    const token = await loginCustomer();
    const response = await request(app)
      .post('/api/v1/admin/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Electrical' });

    expect(response.status).toBe(403);
  });

  it('fails on duplicate category slug', async () => {
    const token = await loginAdmin();
    await Category.create({ name: 'Cleaning', slug: 'cleaning', isActive: true, displayOrder: 1 });
    const response = await request(app)
      .post('/api/v1/admin/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Cleaning', slug: 'cleaning' });

    expect(response.status).toBe(409);
  });

  it('requires valid category for subcategory', async () => {
    const token = await loginAdmin();
    const response = await request(app)
      .post('/api/v1/admin/subcategories')
      .set('Authorization', `Bearer ${token}`)
      .send({
        categoryId: new mongoose.Types.ObjectId().toString(),
        name: 'Fan',
      });

    expect(response.status).toBe(404);
  });

  it('hides inactive services from customer listing', async () => {
    const { inactiveService } = await seedCatalogFixtures();
    const response = await request(app).get('/api/v1/services');
    const ids = response.body.data.items.map((item: { id: string }) => item.id);
    expect(ids).not.toContain(inactiveService._id.toString());
    expect(response.status).toBe(200);
  });

  it('allows admin to list inactive services', async () => {
    const token = await loginAdmin();
    await seedCatalogFixtures();
    const response = await request(app)
      .get('/api/v1/admin/services')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.data.items.length).toBeGreaterThanOrEqual(2);
  });

  it('allows provider to add own service request', async () => {
    const token = await loginProvider();
    const { activeService } = await seedCatalogFixtures();
    const response = await request(app)
      .post('/api/v1/providers/me/services')
      .set('Authorization', `Bearer ${token}`)
      .send({ serviceId: activeService._id.toString(), experienceYears: 3 });

    expect(response.status).toBe(201);
    expect(response.body.data.approvalStatus).toBe('PENDING');
  });

  it('prevents duplicate provider service', async () => {
    const token = await loginProvider();
    const { activeService } = await seedCatalogFixtures();
    const provider = await User.findOne({ role: 'PROVIDER' });
    await ProviderService.create({
      providerId: provider!._id,
      serviceId: activeService._id,
      approvalStatus: 'PENDING',
      isActive: true,
      customPricing: { enabled: false },
    });
    const response = await request(app)
      .post('/api/v1/providers/me/services')
      .set('Authorization', `Bearer ${token}`)
      .send({ serviceId: activeService._id.toString() });

    expect(response.status).toBe(409);
  });

  it('prevents provider from modifying another provider service', async () => {
    const token = await loginProvider('9876543211');
    const otherToken = await loginProvider('9876543212');
    const { activeService } = await seedCatalogFixtures();
    const create = await request(app)
      .post('/api/v1/providers/me/services')
      .set('Authorization', `Bearer ${token}`)
      .send({ serviceId: activeService._id.toString() });
    const response = await request(app)
      .patch(`/api/v1/providers/me/services/${create.body.data.id}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ experienceYears: 10 });

    expect(response.status).toBe(404);
  });

  it('allows admin to approve provider service', async () => {
    const providerToken = await loginProvider();
    const adminToken = await loginAdmin();
    const { activeService } = await seedCatalogFixtures();
    const created = await request(app)
      .post('/api/v1/providers/me/services')
      .set('Authorization', `Bearer ${providerToken}`)
      .send({ serviceId: activeService._id.toString() });
    const response = await request(app)
      .patch(`/api/v1/admin/provider-services/${created.body.data.id}/approve`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.approvalStatus).toBe('APPROVED');
  });

  it('stores rejection reason', async () => {
    const providerToken = await loginProvider();
    const adminToken = await loginAdmin();
    const { activeService } = await seedCatalogFixtures();
    const created = await request(app)
      .post('/api/v1/providers/me/services')
      .set('Authorization', `Bearer ${providerToken}`)
      .send({ serviceId: activeService._id.toString() });
    const response = await request(app)
      .patch(`/api/v1/admin/provider-services/${created.body.data.id}/reject`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Incomplete profile details' });

    expect(response.status).toBe(200);
    expect(response.body.data.rejectionReason).toBe('Incomplete profile details');
  });

  it('allows customer to favorite service', async () => {
    const token = await loginCustomer();
    const { activeService } = await seedCatalogFixtures();
    const response = await request(app)
      .post(`/api/v1/services/${activeService._id}/favorite`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    const favorite = await FavoriteService.findOne({ serviceId: activeService._id });
    expect(favorite).toBeTruthy();
  });

  it('prevents duplicate favorite', async () => {
    const token = await loginCustomer();
    const { activeService } = await seedCatalogFixtures();
    const customer = await User.findOne({ role: 'CUSTOMER' });
    await FavoriteService.create({ customerId: customer!._id, serviceId: activeService._id });
    const response = await request(app)
      .post(`/api/v1/services/${activeService._id}/favorite`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(409);
  });

  it('returns relevant active services for search', async () => {
    await seedCatalogFixtures();
    const response = await request(app).get('/api/v1/services/search').query({ q: 'tap' });
    expect(response.status).toBe(200);
    expect(response.body.data.items.length).toBeGreaterThan(0);
  });

  it('paginates service results', async () => {
    await seedCatalogFixtures();
    const response = await request(app).get('/api/v1/services').query({ page: 1, limit: 1 });
    expect(response.status).toBe(200);
    expect(response.body.data.items).toHaveLength(1);
    expect(response.body.meta.total).toBeGreaterThanOrEqual(1);
  });
});
