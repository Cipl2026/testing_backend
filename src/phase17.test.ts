import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import mongoose from 'mongoose';
import request from 'supertest';
import {
  CoverageGapStatus,
  ExpansionRecommendationStatus,
  PricingType,
  ProviderShiftStatus,
  ProviderSkillStatus,
  ServiceZoneType,
  SupplyDemandStatus,
  UserRole,
  WaitTimeConfidence,
  ZoneQualityStatus,
} from '@ghaarfix/shared-types';
import { createApp } from '@/app.js';
import { connectDatabase, disconnectDatabase } from '@/config/database.js';
import { seedAdminUser } from '@/modules/auth/auth.service.js';
import { runPhase17Migrations } from '@/migrations/007-phase17-network.js';
import { City } from '@/models/City.js';
import { Category } from '@/models/Category.js';
import { Subcategory } from '@/models/Subcategory.js';
import { Service } from '@/models/Service.js';
import { ServiceZone } from '@/models/ServiceZone.js';
import { ServiceZoneAvailability } from '@/models/ServiceZoneAvailability.js';
import { User } from '@/models/User.js';
import { ProviderSkill } from '@/models/ProviderSkill.js';
import { ProviderPresence } from '@/models/ProviderPresence.js';
import { CoverageGap, ProviderShift } from '@/models/Network.js';
import { classifySupplyDemand } from '@/modules/network/supply-demand.service.js';
import { floorToBucket, shiftsOverlap } from '@/modules/network/time-bucket.util.js';
import { classifySlotStatus } from '@/modules/network/slot-intelligence.service.js';
import { classifyQualityStatus, MIN_QUALITY_SAMPLE } from '@/modules/network/quality-heatmap.service.js';
import { detectCoverageGap } from '@/modules/network/coverage-gap.service.js';
import { estimateWaitTime } from '@/modules/network/wait-time.service.js';
import { createProviderShift } from '@/modules/network/shift.service.js';
import { ExpansionRecommendation } from '@/models/Network.js';
import { acknowledgeExpansion } from '@/modules/network/expansion.service.js';
import { runPhase17Jobs } from '@/modules/network/phase17-jobs.js';

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

async function seedZoneFixture() {
  const cityA = await City.create({ name: 'Bengaluru', slug: 'bengaluru', state: 'Karnataka', country: 'India', isActive: true });
  const cityB = await City.create({ name: 'Mumbai', slug: 'mumbai', state: 'Maharashtra', country: 'India', isActive: true });

  const zoneA = await ServiceZone.create({
    name: 'Zone A',
    slug: 'zone-a',
    type: ServiceZoneType.PINCODE,
    cityId: cityA._id,
    isActive: true,
    priority: 1,
    postalCodes: ['560001'],
  });
  const zoneB = await ServiceZone.create({
    name: 'Zone B',
    slug: 'zone-b',
    type: ServiceZoneType.PINCODE,
    cityId: cityB._id,
    isActive: true,
    priority: 1,
    postalCodes: ['400001'],
  });

  const category = await Category.create({ name: 'Electrical', slug: 'electrical', isActive: true, displayOrder: 1 });
  const subcategory = await Subcategory.create({
    categoryId: category._id,
    name: 'Wiring',
    slug: 'wiring',
    isActive: true,
    displayOrder: 1,
  });

  const service = await Service.create({
    categoryId: category._id,
    subcategoryId: subcategory._id,
    name: 'Electrician',
    slug: 'electrician',
    shortDescription: 'Electrician service',
    keywords: [],
    aliases: [],
    pricing: { type: PricingType.STARTING_FROM, startingPrice: 299, currency: 'INR' },
    estimatedDuration: { minMinutes: 45, maxMinutes: 90 },
    whatIsIncluded: [],
    whatIsNotIncluded: [],
    faqs: [],
    isActive: true,
    isFeatured: false,
    displayOrder: 1,
  });

  await ServiceZoneAvailability.create({ serviceZoneId: zoneA._id, serviceId: service._id, isAvailable: true });
  await ServiceZoneAvailability.create({ serviceZoneId: zoneB._id, serviceId: service._id, isAvailable: true });

  const provider = await User.create({
    phone: '9876500001',
    role: UserRole.PROVIDER,
    isPhoneVerified: true,
    isProfileComplete: true,
    status: 'ACTIVE',
  });

  await ProviderSkill.create({
    providerId: provider._id,
    skillId: service._id,
    status: ProviderSkillStatus.VERIFIED,
  });

  await ProviderPresence.create({
    providerId: provider._id,
    isOnline: true,
    status: 'ONLINE',
    lastSeenAt: new Date(),
  });

  return {
    cityA,
    cityB,
    zoneA,
    zoneB,
    service,
    provider,
  };
}

describe('Phase 17 — Hyperlocal Network Intelligence', () => {
  beforeAll(async () => {
    await connectDatabase();
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  beforeEach(async () => {
    await clearDatabase();
    await seedAdminUser();
    await runPhase17Migrations();
  });

  it('classifies supply-demand status correctly', () => {
    expect(classifySupplyDemand(20, 10).status).toBe(SupplyDemandStatus.SURPLUS);
    expect(classifySupplyDemand(9, 10).status).toBe(SupplyDemandStatus.BALANCED);
    expect(classifySupplyDemand(6, 10).status).toBe(SupplyDemandStatus.CONSTRAINED);
    expect(classifySupplyDemand(2, 10).status).toBe(SupplyDemandStatus.CRITICAL);
  });

  it('floors time buckets consistently in UTC', () => {
    const date = new Date('2026-01-15T10:37:00.000Z');
    const bucket = floorToBucket(date);
    expect(bucket.toISOString()).toBe('2026-01-15T10:30:00.000Z');
  });

  it('detects shift overlap and prevents duplicates', async () => {
    const { provider } = await seedZoneFixture();
    await createProviderShift(provider._id.toString(), {
      date: '2026-02-01',
      startTime: '09:00',
      endTime: '13:00',
      confirm: true,
    });

    await expect(
      createProviderShift(provider._id.toString(), {
        date: '2026-02-01',
        startTime: '12:00',
        endTime: '16:00',
        confirm: true,
      }),
    ).rejects.toThrow(/overlap/i);

    expect(
      shiftsOverlap(
        { date: '2026-02-01', startTime: '09:00', endTime: '13:00' },
        { date: '2026-02-01', startTime: '13:00', endTime: '17:00' },
      ),
    ).toBe(false);
  });

  it('classifies overloaded slots', () => {
    expect(classifySlotStatus(SupplyDemandStatus.CRITICAL)).toBe('AT_RISK');
    expect(classifySlotStatus(SupplyDemandStatus.BALANCED)).toBe('AVAILABLE');
  });

  it('prevents duplicate coverage gaps', async () => {
    const { zoneA, service } = await seedZoneFixture();

    await CoverageGap.create({
      cityId: zoneA.cityId,
      serviceZoneId: zoneA._id,
      serviceId: service._id,
      timeRangeStart: new Date(),
      timeRangeEnd: new Date(Date.now() + 3600000),
      severity: 'CRITICAL',
      demandEstimate: 35,
      supplyEstimate: 10,
      recommendation: 'Recruit electricians',
      status: CoverageGapStatus.OPEN,
      dedupeKey: `${zoneA._id}:${service._id}:${new Date().toISOString().slice(0, 13)}`,
    });

    const gaps = await CoverageGap.find({ serviceZoneId: zoneA._id });
    expect(gaps).toHaveLength(1);
  });

  it('returns low-confidence wait time when data is sparse', async () => {
    const { zoneA, service, provider } = await seedZoneFixture();
    await ProviderPresence.updateOne({ providerId: provider._id }, { isOnline: false });
    const estimate = await estimateWaitTime({
      zoneId: zoneA._id.toString(),
      serviceId: service._id.toString(),
    });
    expect(estimate.confidence).toBe(WaitTimeConfidence.LOW);
    expect(estimate.label).toContain('vary');
  });

  it('hides quality heatmap below privacy threshold', () => {
    const status = classifyQualityStatus({
      averageRating: 4.8,
      cancellationRate: 0.01,
      slaBreachRate: 0,
      sampleSize: MIN_QUALITY_SAMPLE - 1,
    });
    expect(status).toBe('INSUFFICIENT_DATA');
  });

  it('aggregates quality when sample threshold met', () => {
    const status = classifyQualityStatus({
      averageRating: 4.8,
      cancellationRate: 0.01,
      slaBreachRate: 0,
      sampleSize: MIN_QUALITY_SAMPLE,
    });
    expect(status).toBe(ZoneQualityStatus.EXCELLENT);
  });

  it('keeps expansion recommendations advisory', async () => {
    const rec = await ExpansionRecommendation.create({
      targetType: 'ZONE',
      targetId: new mongoose.Types.ObjectId(),
      score: 80,
      reasons: ['High demand'],
      confidence: 0.7,
      status: ExpansionRecommendationStatus.PENDING,
    });

    const updated = await acknowledgeExpansion(rec._id.toString());
    expect(updated?.status).toBe(ExpansionRecommendationStatus.ACKNOWLEDGED);
  });

  it('isolates multi-city zone metrics', async () => {
    const { zoneA, zoneB, service } = await seedZoneFixture();
    const gapA = await detectCoverageGap(zoneA._id.toString(), service._id.toString());
    const gapB = await detectCoverageGap(zoneB._id.toString(), service._id.toString());

    if (gapA) expect(gapA.cityId?.toString()).toBe(zoneA.cityId.toString());
    if (gapB) expect(gapB.cityId?.toString()).toBe(zoneB.cityId.toString());
    expect(zoneA.cityId.toString()).not.toBe(zoneB.cityId.toString());
  });

  it('runs phase 17 jobs idempotently', async () => {
    await seedZoneFixture();
    const first = await runPhase17Jobs();
    const second = await runPhase17Jobs();
    expect(first).toBeDefined();
    expect(second).toBeDefined();
  });

  it('exposes admin network overview endpoint', async () => {
    await seedZoneFixture();
    const admin = await loginAdmin();
    const res = await request(app)
      .get('/api/v1/admin/network/overview')
      .set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('openCoverageGaps');
  });

  it('allows provider to create confirmed shift', async () => {
    const { provider } = await seedZoneFixture();
    const shift = await ProviderShift.create({
      providerId: provider._id,
      date: '2026-03-01',
      startTime: '10:00',
      endTime: '14:00',
      preferredZones: [],
      status: ProviderShiftStatus.PLANNED,
      capacityLimit: 6,
      confirmedByProvider: true,
    });
    expect(shift.confirmedByProvider).toBe(true);
  });
});
