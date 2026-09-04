import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import mongoose from 'mongoose';
import {
  AnalyticsEventName,
  BookingStatus,
  BundlePricingMode,
  CampaignChannel,
  CampaignStatus,
  ExperimentStatus,
  ExperimentVariant,
  FeatureFlagKey,
  HomeType,
  PricingType,
  PromotionStatus,
  PromotionType,
  RecommendationSource,
  RecommendationType,
  RewardLedgerStatus,
  RewardLedgerType,
  RewardSourceType,
} from '@ghaarfix/shared-types';
import { createApp } from '@/app.js';
import { connectDatabase, disconnectDatabase } from '@/config/database.js';
import { Booking } from '@/models/Booking.js';
import { Category } from '@/models/Category.js';
import { FavoriteService } from '@/models/FavoriteService.js';
import { GrowthCampaign } from '@/models/GrowthCampaign.js';
import { Home } from '@/models/Home.js';
import { Otp } from '@/models/Otp.js';
import { Promotion } from '@/models/Promotion.js';
import { Recommendation } from '@/models/Recommendation.js';
import { RewardLedger } from '@/models/RewardLedger.js';
import { SearchQueryLog } from '@/models/SearchQueryLog.js';
import { SearchSynonym } from '@/models/SearchSynonym.js';
import { Service } from '@/models/Service.js';
import { ServiceBundle } from '@/models/ServiceBundle.js';
import { Subcategory } from '@/models/Subcategory.js';
import { FeatureFlag } from '@/models/FeatureFlag.js';
import { Experiment } from '@/models/Experiment.js';
import { seedAdminUser } from '@/modules/auth/auth.service.js';
import * as analyticsService from '@/modules/discovery-growth/analytics.service.js';
import * as campaignAdminService from '@/modules/discovery-growth/campaign-admin.service.js';
import * as experimentService from '@/modules/discovery-growth/experiment.service.js';
import * as featureFlagService from '@/modules/discovery-growth/feature-flag.service.js';
import * as growthService from '@/modules/discovery-growth/growth.service.js';
import * as promotionService from '@/modules/discovery-growth/promotion.service.js';
import * as recommendationService from '@/modules/discovery-growth/recommendation.service.js';
import * as bundleService from '@/modules/discovery-growth/bundle.service.js';
import { hashOtp } from '@/utils/crypto.js';

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

async function loginAdmin() {
  const res = await request(app)
    .post('/api/v1/admin/login')
    .send({ email: 'admin@ghaarfix.in', password: 'Admin@123456' });
  return { token: res.body.data.accessToken as string };
}

async function seedService(name: string, opts?: { keywords?: string[]; aliases?: string[]; price?: number }) {
  const suffix = randomBytes(3).toString('hex');
  const category = await Category.create({ name: 'Home', slug: `home-${suffix}`, isActive: true, displayOrder: 1 });
  const subcategory = await Subcategory.create({
    categoryId: category._id,
    name: 'Repair',
    slug: `repair-${suffix}`,
    isActive: true,
    displayOrder: 1,
  });
  const service = await Service.create({
    categoryId: category._id,
    subcategoryId: subcategory._id,
    name,
    slug: `${name.toLowerCase().replace(/\s+/g, '-')}-${suffix}`,
    shortDescription: `${name} service`,
    keywords: opts?.keywords ?? [],
    aliases: opts?.aliases ?? [],
    pricing: {
      type: PricingType.STARTING_FROM,
      startingPrice: opts?.price ?? 499,
      currency: 'INR',
    },
    estimatedDuration: { minMinutes: 45, maxMinutes: 90 },
    whatIsIncluded: [],
    whatIsNotIncluded: [],
    faqs: [],
    isActive: true,
    isFeatured: false,
    displayOrder: 1,
    supportedAssetTypeIds: [],
  });
  return { service, category };
}

async function seedCompletedBooking(customerId: string, serviceId: mongoose.Types.ObjectId, price = 499) {
  return Booking.create({
    bookingNumber: `BK-${randomBytes(4).toString('hex')}`,
    bookingType: 'SCHEDULED',
    source: 'SLOT_RESERVATION',
    customerId,
    providerId: new mongoose.Types.ObjectId(),
    serviceId,
    providerServiceId: new mongoose.Types.ObjectId(),
    status: BookingStatus.COMPLETED,
    providerRequestStatus: 'ACCEPTED',
    scheduledStart: new Date(),
    scheduledEnd: new Date(Date.now() + 3600000),
    timezone: 'Asia/Kolkata',
    durationMinutes: 60,
    addressSnapshot: {
      recipientName: 'Test',
      phone: '9876543210',
      addressLine1: '12 MG Road',
      city: 'Bengaluru',
      state: 'Karnataka',
      postalCode: '560001',
    },
    serviceSnapshot: {
      name: 'AC Service',
      pricing: { type: PricingType.STARTING_FROM, startingPrice: price, currency: 'INR' },
    },
    providerSnapshot: { fullName: 'Pro' },
    price: { estimatedAmount: price, finalAmount: price, currency: 'INR' },
    payment: { method: 'PAY_ON_SERVICE', status: 'PENDING' },
    reschedule: { providerRescheduleCount: 0 },
    tracking: { state: 'COMPLETED' },
  });
}

describe('Phase 10 Discovery & Growth', () => {
  beforeAll(async () => {
    await connectDatabase();
    await seedAdminUser();
  });
  afterAll(async () => disconnectDatabase());
  beforeEach(async () => {
    await clearDatabase();
    await seedAdminUser();
  });

  it('1. search exact match', async () => {
    await seedService('Geyser Repair', { keywords: ['geyser', 'water heater'] });
    const res = await request(app).get('/api/v1/search').query({ q: 'Geyser Repair' });
    expect(res.status).toBe(200);
    expect(res.body.data.services.some((s: { name: string }) => s.name === 'Geyser Repair')).toBe(true);
  });

  it('2. search synonym', async () => {
    await SearchSynonym.create({ term: 'ac', synonyms: ['air conditioner', 'cooling'], isActive: true });
    await seedService('AC Service', { aliases: ['air conditioner'] });
    const res = await request(app).get('/api/v1/search').query({ q: 'air conditioner' });
    expect(res.status).toBe(200);
    expect(res.body.data.services.length).toBeGreaterThan(0);
  });

  it('3. search zero-result event', async () => {
    const res = await request(app).get('/api/v1/search').query({ q: 'solar panel repair' });
    expect(res.status).toBe(200);
    expect(res.body.data.services).toHaveLength(0);
    const log = await SearchQueryLog.findOne({ normalizedQuery: 'solar panel repair', isZeroResult: true });
    expect(log).toBeTruthy();
  });

  it('4. recommendation reason exists', async () => {
    const customer = await loginCustomer();
    await Recommendation.create({
      customerId: customer.userId,
      type: RecommendationType.MAINTENANCE,
      title: 'AC maintenance',
      description: 'Service due',
      action: { type: 'BOOK_SERVICE' },
      priority: 10,
      reason: 'Recommended because your AC was last serviced 7 months ago.',
      source: RecommendationSource.HOME_HEALTH,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });
    const res = await request(app)
      .get('/api/v1/recommendations')
      .set('Authorization', `Bearer ${customer.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.items[0].reason).toContain('AC was last serviced');
  });

  it('5. dismissed recommendation does not return', async () => {
    const customer = await loginCustomer();
    const rec = await Recommendation.create({
      customerId: customer.userId,
      type: RecommendationType.POPULAR,
      title: 'Popular',
      description: 'Popular service',
      action: { type: 'BOOK_SERVICE' },
      priority: 1,
      reason: 'Popular among customers.',
      source: RecommendationSource.POPULARITY,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });
    await request(app)
      .post(`/api/v1/recommendations/${rec._id}/dismiss`)
      .set('Authorization', `Bearer ${customer.token}`);
    const res = await request(app)
      .get('/api/v1/recommendations')
      .set('Authorization', `Bearer ${customer.token}`);
    expect(res.body.data.items).toHaveLength(0);
  });

  it('6. recommendation expiry works', async () => {
    const customer = await loginCustomer();
    await Recommendation.create({
      customerId: customer.userId,
      type: RecommendationType.SEASONAL,
      title: 'Seasonal',
      description: 'Seasonal',
      action: { type: 'BOOK_SERVICE' },
      priority: 1,
      reason: 'Seasonal offer.',
      source: RecommendationSource.SEASON,
      expiresAt: new Date(Date.now() - 1000),
    });
    const items = await recommendationService.listActiveRecommendations(customer.userId);
    expect(items).toHaveLength(0);
  });

  it('7. rebooking revalidates current pricing', async () => {
    const customer = await loginCustomer();
    const { service } = await seedService('Tap Repair', { price: 299 });
    const booking = await seedCompletedBooking(customer.userId, service._id, 199);
    await Service.findByIdAndUpdate(service._id, { 'pricing.startingPrice': 399 });
    const res = await request(app)
      .get(`/api/v1/rebooking/${booking._id}`)
      .set('Authorization', `Bearer ${customer.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.currentPricing.startingPrice).toBe(399);
    expect(res.body.data.pricingChanged).toBe(true);
  });

  it('8. favourite service unique', async () => {
    const customer = await loginCustomer();
    const { service } = await seedService('Plumbing');
    await request(app)
      .post(`/api/v1/favourite-services/${service._id}`)
      .set('Authorization', `Bearer ${customer.token}`);
    await request(app)
      .post(`/api/v1/favourite-services/${service._id}`)
      .set('Authorization', `Bearer ${customer.token}`);
    const count = await FavoriteService.countDocuments({ customerId: customer.userId, serviceId: service._id });
    expect(count).toBe(1);
  });

  it('9. bundle pricing server-authoritative', async () => {
    const { service: s1 } = await seedService('Service A', { price: 500 });
    const { service: s2 } = await seedService('Service B', { price: 300 });
    const bundle = await ServiceBundle.create({
      name: 'Home Care Bundle',
      serviceIds: [s1._id, s2._id],
      pricingMode: BundlePricingMode.DISCOUNTED,
      discount: 10,
      isActive: true,
      validFrom: new Date(Date.now() - 86400000),
      validTo: new Date(Date.now() + 86400000 * 30),
    });
    const pricing = await bundleService.getBundleWithPricing(bundle._id.toString());
    expect(pricing.subtotal).toBe(800);
    expect(pricing.totalPrice).toBe(720);
  });

  it('10. promotion minimum order validation', async () => {
    const customer = await loginCustomer();
    await Promotion.create({
      code: 'SAVE10',
      type: PromotionType.PERCENTAGE,
      value: 10,
      minimumOrder: 1000,
      usageCount: 0,
      validFrom: new Date(Date.now() - 86400000),
      validTo: new Date(Date.now() + 86400000),
      status: PromotionStatus.ACTIVE,
    });
    await expect(
      promotionService.validatePromotion({
        code: 'SAVE10',
        customerId: customer.userId,
        orderAmount: 500,
      }),
    ).rejects.toThrow(/Minimum order/);
  });

  it('11. promotion usage limit concurrency', async () => {
    const customer = await loginCustomer();
    const promo = await Promotion.create({
      code: 'ONCE',
      type: PromotionType.FIXED_AMOUNT,
      value: 50,
      usageLimit: 1,
      usageCount: 0,
      validFrom: new Date(Date.now() - 86400000),
      validTo: new Date(Date.now() + 86400000),
      status: PromotionStatus.ACTIVE,
    });
    await promotionService.redeemPromotion(promo._id.toString(), customer.userId, 50);
    await expect(
      promotionService.redeemPromotion(promo._id.toString(), customer.userId, 50),
    ).rejects.toThrow(/usage limit/);
  });

  it('12. self-referral rejected', async () => {
    const customer = await loginCustomer();
    const code = await growthService.getOrCreateReferralCode(customer.userId);
    await expect(growthService.redeemReferralCode(customer.userId, code.code)).rejects.toThrow(/own referral/);
  });

  it('13. referral rewards referrer and friend on signup', async () => {
    const referrer = await loginCustomer();
    const referred = await loginCustomer();
    const code = await growthService.getOrCreateReferralCode(referrer.userId);
    await growthService.redeemReferralCode(referred.userId, code.code);

    const referrerBalance = await growthService.getRewardBalance(referrer.userId);
    expect(referrerBalance.balance).toBe(100);

    const referredBalance = await growthService.getRewardBalance(referred.userId);
    expect(referredBalance.balance).toBe(50);
  });

  it('13c. referrer earns 10 coins when referred friend completes a booking', async () => {
    const referrer = await loginCustomer();
    const referred = await loginCustomer();
    const code = await growthService.getOrCreateReferralCode(referrer.userId);
    await growthService.redeemReferralCode(referred.userId, code.code);

    const { service } = await seedService('Referral Booking Service');
    const booking = await seedCompletedBooking(referred.userId, service._id, 500);

    await growthService.awardBookingRewardCoins(booking._id.toString(), referred.userId, 500);
    await growthService.awardReferrerBookingCoins(booking._id.toString(), referred.userId);

    const referrerBalance = await growthService.getRewardBalance(referrer.userId);
    expect(referrerBalance.balance).toBe(110);

    const referredBalance = await growthService.getRewardBalance(referred.userId);
    expect(referredBalance.balance).toBe(60);
  });

  it('13b. booking completion credits 10 Ghaarfix coins', async () => {
    const customer = await loginCustomer();
    const { service } = await seedService('Reward Service');
    const booking = await seedCompletedBooking(customer.userId, service._id, 500);

    await growthService.awardBookingRewardCoins(
      booking._id.toString(),
      customer.userId,
      500,
    );

    const balance = await growthService.getRewardBalance(customer.userId);
    expect(balance.balance).toBe(10);

    const ledger = await RewardLedger.findOne({ idempotencyKey: `booking-earn-${booking._id}` });
    expect(ledger).toBeTruthy();
    expect(ledger?.amount).toBe(10);
    expect(ledger?.type).toBe(RewardLedgerType.CREDIT);
  });

  it('14. reward ledger idempotent', async () => {
    const customer = await loginCustomer();
    const key = 'test-idempotent-key';
    await growthService.creditRewardIdempotent(
      customer.userId,
      50,
      RewardSourceType.LOYALTY,
      'src-1',
      key,
    );
    await growthService.creditRewardIdempotent(
      customer.userId,
      50,
      RewardSourceType.LOYALTY,
      'src-1',
      key,
    );
    const entries = await RewardLedger.find({ idempotencyKey: key });
    expect(entries).toHaveLength(1);
  });

  it('15. expired reward unavailable', async () => {
    const customer = await loginCustomer();
    await RewardLedger.create({
      customerId: customer.userId,
      type: RewardLedgerType.CREDIT,
      amount: 100,
      status: RewardLedgerStatus.COMPLETED,
      sourceType: RewardSourceType.PROMOTION,
      sourceId: 'promo-1',
      expiresAt: new Date(Date.now() - 86400000),
    });
    await growthService.expireRewards();
    const balance = await growthService.getRewardBalance(customer.userId);
    expect(balance.balance).toBe(0);
  });

  it('16. feature flag targeting works', async () => {
    const customer = await loginCustomer();
    await FeatureFlag.create({
      key: FeatureFlagKey.ENABLE_REFERRALS,
      enabled: true,
      rules: [{ type: 'whitelist', customerIds: [customer.userId] }],
    });
    const enabled = await featureFlagService.evaluateFlag(
      FeatureFlagKey.ENABLE_REFERRALS,
      customer.userId,
    );
    expect(enabled).toBe(true);
  });

  it('17. experiment assignment deterministic', async () => {
    const customer = await loginCustomer();
    await Experiment.create({
      key: 'home-layout',
      name: 'Home Layout',
      status: ExperimentStatus.RUNNING,
      variants: [ExperimentVariant.CONTROL, ExperimentVariant.VARIANT_A],
      targeting: { percentage: 100 },
      startAt: new Date(Date.now() - 86400000),
      endAt: new Date(Date.now() + 86400000 * 30),
    });
    const first = await experimentService.getVariantForCustomer(customer.userId, 'home-layout');
    const second = await experimentService.getVariantForCustomer(customer.userId, 'home-layout');
    expect(first.variant).toBe(second.variant);
    expect(first.enrolled).toBe(true);
  });

  it('18. analytics rejects sensitive properties', async () => {
    await expect(
      analyticsService.trackEvent({
        eventName: AnalyticsEventName.HOME_VIEWED,
        properties: { phone: '9876543210' },
      }),
    ).rejects.toThrow(/not allowed/);
  });

  it('19. campaign audience respects region', async () => {
    const customer = await loginCustomer();
    await Home.create({
      customerId: customer.userId,
      name: 'Karnataka Home',
      homeType: HomeType.APARTMENT,
      addressId: new mongoose.Types.ObjectId(),
      metadata: { state: 'Karnataka' },
      isPrimary: true,
    });
    const campaign = await GrowthCampaign.create({
      name: 'Regional Campaign',
      status: CampaignStatus.DRAFT,
      channel: CampaignChannel.RECOMMENDATION,
      regions: ['Karnataka'],
      audienceSegment: 'ALL',
      startAt: new Date(),
      endAt: new Date(Date.now() + 86400000),
      message: 'Hello',
    });
    const preview = await campaignAdminService.previewCampaignAudience(campaign._id.toString());
    expect(preview.count).toBeGreaterThanOrEqual(1);
  });

  it('20. duplicate campaign notification prevented', async () => {
    const campaign = await GrowthCampaign.create({
      name: 'Deduped Campaign',
      status: CampaignStatus.SCHEDULED,
      channel: CampaignChannel.NOTIFICATION,
      regions: [],
      audienceSegment: 'ALL',
      startAt: new Date(Date.now() - 1000),
      endAt: new Date(Date.now() + 86400000),
      message: 'Promo',
    });
    const first = await campaignAdminService.runScheduledCampaigns();
    const second = await campaignAdminService.runScheduledCampaigns();
    expect(first.processed).toBe(1);
    expect(second.processed).toBe(0);
    const updated = await GrowthCampaign.findById(campaign._id);
    expect(updated?.sentCount).toBe(1);
  });
});
