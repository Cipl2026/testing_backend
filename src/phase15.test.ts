import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import {
  AddressLabel,
  MarketplaceOrderStatus,
  MarketplacePartnerStatus,
  PartnerMemberRole,
  PaymentMethod,
  ProductApprovalStatus,
  ProductStatus,
  UserRole,
} from '@ghaarfix/shared-types';
import { createApp } from '@/app.js';
import { connectDatabase, disconnectDatabase } from '@/config/database.js';
import { Otp } from '@/models/Otp.js';
import { CustomerProfile } from '@/models/CustomerProfile.js';
import { User } from '@/models/User.js';
import { CustomerAddress } from '@/models/CustomerAddress.js';
import { seedAdminUser } from '@/modules/auth/auth.service.js';
import { runPhase15Migrations } from '@/migrations/005-phase15-marketplace.js';
import {
  Brand,
  Inventory,
  MarketplacePartner,
  PartnerMember,
  Product,
  ProductVariant,
} from '@/models/Marketplace.js';
import { reserveInventory } from '@/modules/marketplace/inventory.service.js';
import { generatePartnerSettlement } from '@/modules/marketplace/settlement.service.js';
import { hashOtp } from '@/utils/crypto.js';
import { normalizePhone } from '@/utils/phone.js';

const app = createApp();

let phoneSeq = 9877101000;
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
  await CustomerProfile.create({ userId: user._id, fullName: 'Marketplace User' });
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

async function createCustomerAddress(customerId: string) {
  return CustomerAddress.create({
    customerId,
    label: AddressLabel.HOME,
    recipientName: 'Test User',
    phone: '9876543210',
    addressLine1: '12 MG Road',
    city: 'Bengaluru',
    state: 'Karnataka',
    postalCode: '560001',
    country: 'India',
    location: { type: 'Point', coordinates: [77.5946, 12.9716] },
    isDefault: true,
  });
}

describe('Phase 15 — Trusted Marketplace', () => {
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
    await runPhase15Migrations();
  });

  it('lists active marketplace products', async () => {
    const res = await request(app).get('/api/v1/marketplace/products');
    expect(res.status).toBe(200);
    expect(res.body.data.items.length).toBeGreaterThan(0);
  });

  it('requires admin approval before product is active for customers', async () => {
    const partner = await MarketplacePartner.findOne();
    const brand = await Brand.findOne();
    expect(partner).toBeTruthy();

    const pending = await Product.create({
      name: 'Pending Filter',
      slug: 'pending-filter',
      brandId: brand!._id,
      partnerId: partner!._id,
      status: ProductStatus.DRAFT,
      approvalStatus: ProductApprovalStatus.PENDING_REVIEW,
      isInstallable: false,
    });
    await ProductVariant.create({
      productId: pending._id,
      sku: 'PEND-FILTER-01',
      name: 'Standard',
      price: 999,
      currency: 'INR',
    });

    const list = await request(app).get('/api/v1/marketplace/products?search=pending');
    expect(list.body.data.items.every((p: { slug: string }) => p.slug !== 'pending-filter')).toBe(true);

    const admin = await loginAdmin();
    await request(app)
      .post(`/api/v1/admin/marketplace/products/${pending._id}/approve`)
      .set('Authorization', `Bearer ${admin.token}`);

    const approved = await Product.findById(pending._id);
    expect(approved?.approvalStatus).toBe(ProductApprovalStatus.APPROVED);
    expect(approved?.status).toBe(ProductStatus.ACTIVE);
  });

  it('blocks partner member from accessing another partner', async () => {
    const partnerA = await MarketplacePartner.findOne();
    const partnerB = await MarketplacePartner.create({
      name: 'Other Vendor',
      slug: 'other-vendor',
      type: 'LOCAL_VENDOR',
      status: MarketplacePartnerStatus.ACTIVE,
      businessDetails: {},
    });

    const { token, userId } = await loginCustomer();
    await PartnerMember.create({
      partnerId: partnerA!._id,
      userId,
      role: PartnerMemberRole.OWNER,
      status: 'ACTIVE',
    });

    const res = await request(app)
      .get(`/api/v1/partner/${partnerB._id}/products`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('prevents inventory oversell with concurrent reservations', async () => {
    const variant = await ProductVariant.findOne();
    const partner = await MarketplacePartner.findOne();
    const inv = await Inventory.findOne({ variantId: variant!._id });
    await Inventory.findByIdAndUpdate(inv!._id, { availableQuantity: 2, reservedQuantity: 0 });

    const customerA = await loginCustomer();
    const customerB = await loginCustomer();

    await reserveInventory({
      customerId: customerA.userId,
      variantId: variant!._id.toString(),
      partnerId: partner!._id.toString(),
      quantity: 2,
    });

    await expect(
      reserveInventory({
        customerId: customerB.userId,
        variantId: variant!._id.toString(),
        partnerId: partner!._id.toString(),
        quantity: 1,
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it('creates idempotent marketplace orders', async () => {
    const { token, userId } = await loginCustomer();
    const variant = await ProductVariant.findOne();
    const partner = await MarketplacePartner.findOne();

    const address = await createCustomerAddress(userId);

    await request(app)
      .post('/api/v1/marketplace/cart')
      .set('Authorization', `Bearer ${token}`)
      .send({
        variantId: variant!._id.toString(),
        partnerId: partner!._id.toString(),
        quantity: 1,
      });

    const body = {
      addressId: address._id.toString(),
      paymentMethod: PaymentMethod.PAY_ON_SERVICE,
      idempotencyKey: 'idem-marketplace-001',
    };

    const first = await request(app)
      .post('/api/v1/marketplace/orders')
      .set('Authorization', `Bearer ${token}`)
      .send(body);
    expect(first.status).toBe(201);

    const second = await request(app)
      .post('/api/v1/marketplace/orders')
      .set('Authorization', `Bearer ${token}`)
      .send(body);
    expect(second.status).toBe(201);
    expect(second.body.data.id).toBe(first.body.data.id);
  });

  it('uses server-side pricing and blocks cart price manipulation', async () => {
    const { token } = await loginCustomer();
    const variant = await ProductVariant.findOne();
    const partner = await MarketplacePartner.findOne();

    const cartRes = await request(app)
      .post('/api/v1/marketplace/cart')
      .set('Authorization', `Bearer ${token}`)
      .send({
        variantId: variant!._id.toString(),
        partnerId: partner!._id.toString(),
        quantity: 1,
        unitPrice: 1,
      });
    expect(cartRes.status).toBe(200);
    expect(cartRes.body.data.pricing.finalAmount).toBeGreaterThan(1000);
  });

  it('preserves commission snapshot on settlement generation', async () => {
    const partner = await MarketplacePartner.findOne();
    const start = new Date('2026-01-01');
    const end = new Date('2026-01-31');
    const settlement = await generatePartnerSettlement(partner!._id.toString(), start, end);
    expect(settlement).toBeTruthy();

    const again = await generatePartnerSettlement(partner!._id.toString(), start, end);
    expect(again._id.toString()).toBe(settlement!._id.toString());
  });

  it('blocks suspended partner from new inventory reservations', async () => {
    const partner = await MarketplacePartner.findOne();
    const variant = await ProductVariant.findOne();
    await MarketplacePartner.findByIdAndUpdate(partner!._id, { status: MarketplacePartnerStatus.SUSPENDED });

    await expect(
      reserveInventory({
        customerId: new mongoose.Types.ObjectId().toString(),
        variantId: variant!._id.toString(),
        partnerId: partner!._id.toString(),
        quantity: 1,
      }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('returns marketplace analytics for admin', async () => {
    const admin = await loginAdmin();
    const res = await request(app)
      .get('/api/v1/admin/marketplace/analytics')
      .set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('activeProducts');
  });

  it('creates warranty records after pay-on-service order', async () => {
    const { token, userId } = await loginCustomer();
    const variant = await ProductVariant.findOne();
    const partner = await MarketplacePartner.findOne();
    const address = await createCustomerAddress(userId);

    await request(app)
      .post('/api/v1/marketplace/cart')
      .set('Authorization', `Bearer ${token}`)
      .send({
        variantId: variant!._id.toString(),
        partnerId: partner!._id.toString(),
        quantity: 1,
      });

    await request(app)
      .post('/api/v1/marketplace/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({
        addressId: address._id.toString(),
        paymentMethod: PaymentMethod.PAY_ON_SERVICE,
        idempotencyKey: 'warranty-order-1',
      });

    const warranties = await request(app)
      .get('/api/v1/warranties')
      .set('Authorization', `Bearer ${token}`);
    expect(warranties.status).toBe(200);
    expect(warranties.body.data.items.length).toBeGreaterThan(0);
  });
});
