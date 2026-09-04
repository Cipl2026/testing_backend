import bcrypt from 'bcryptjs';
import {
  AddressLabel,
  MaintenancePriority,
  PromotionStatus,
  PromotionType,
  ProviderServiceApprovalStatus,
  ProviderStatus,
  ServiceAreaType,
  UserRole,
  RewardSourceType,
  FeatureFlagKey,
} from '@ghaarfix/shared-types';
import { connectDatabase, disconnectDatabase } from '@/config/database.js';
import { env } from '@/config/env.js';
import { AssetType } from '@/models/AssetType.js';
import { CustomerAddress } from '@/models/CustomerAddress.js';
import { MaintenanceTemplate } from '@/models/MaintenanceTemplate.js';
import { Promotion } from '@/models/Promotion.js';
import { FeatureFlag } from '@/models/FeatureFlag.js';
import { ProviderProfile } from '@/models/ProviderProfile.js';
import { ProviderSchedule } from '@/models/ProviderSchedule.js';
import { ProviderService } from '@/models/ProviderService.js';
import { ProviderServiceArea } from '@/models/ProviderServiceArea.js';
import { Service } from '@/models/Service.js';
import { User } from '@/models/User.js';
import * as presenceService from '@/modules/presence/presence.service.js';
import { creditRewardIdempotent } from '@/modules/discovery-growth/growth.service.js';
import { seedCatalog } from '@/scripts/seed-catalog.js';
import { seedHomeCarousel } from '@/scripts/seed-home-carousel.js';
import { CUSTOMER_AVATAR, PROVIDER_AVATARS } from '@/scripts/seed-media.js';
import { logger } from '@/utils/logger.js';

const DEMO_CUSTOMER_PHONE = '9876543210';
const DEV_MPIN = '1234';
const DELHI_LAT = 28.6139;
const DELHI_LNG = 77.209;

const PROVIDERS = [
  { phone: '9876543211', name: 'Rajesh Kumar', lat: 28.6139, lng: 77.209 },
  { phone: '9876543212', name: 'Amit Sharma', lat: 28.5355, lng: 77.391 },
  { phone: '9876543213', name: 'Vikram Singh', lat: 28.4089, lng: 77.3178 },
] as const;

const WEEKLY_SCHEDULE = {
  monday: { enabled: true, startTime: '08:00', endTime: '20:00' },
  tuesday: { enabled: true, startTime: '08:00', endTime: '20:00' },
  wednesday: { enabled: true, startTime: '08:00', endTime: '20:00' },
  thursday: { enabled: true, startTime: '08:00', endTime: '20:00' },
  friday: { enabled: true, startTime: '08:00', endTime: '20:00' },
  saturday: { enabled: true, startTime: '09:00', endTime: '18:00' },
  sunday: { enabled: true, startTime: '09:00', endTime: '18:00' },
};

async function upsertUserWithMpin(phone: string, role: UserRole, fullName: string) {
  const phoneE164 = `+91${phone}`;
  const passwordHash = await bcrypt.hash(DEV_MPIN, 12);
  return User.findOneAndUpdate(
    { phone: phoneE164 },
    {
      $setOnInsert: { role },
      $set: {
        fullName,
        isPhoneVerified: true,
        isProfileComplete: true,
        status: 'ACTIVE',
        passwordHash,
        ...(role === UserRole.CUSTOMER ? { profileImage: CUSTOMER_AVATAR } : {}),
        ...(role === UserRole.PROVIDER ? { profileImage: PROVIDER_AVATARS[phone] } : {}),
      },
    },
    { upsert: true, new: true },
  );
}

async function setupProvider(
  userId: string,
  name: string,
  phone: string,
  lat: number,
  lng: number,
  serviceIds: string[],
) {
  await ProviderProfile.findOneAndUpdate(
    { userId },
    {
      providerStatus: ProviderStatus.ACTIVE,
      fullName: name,
      profileImage: PROVIDER_AVATARS[phone],
      experienceYears: 5,
      bio: `Certified Ghaarfix professional with 5+ years of experience serving homes in Delhi NCR.`,
      languages: ['English', 'Hindi'],
    },
    { upsert: true },
  );

  for (const serviceId of serviceIds) {
    const service = await Service.findById(serviceId);
    const urgent = Boolean(service?.isUrgentAvailable);
    await ProviderService.findOneAndUpdate(
      { providerId: userId, serviceId },
      {
        approvalStatus: ProviderServiceApprovalStatus.APPROVED,
        isActive: true,
        experienceYears: 5,
        customPricing: { enabled: false },
        supportsUrgent: urgent,
        isUrgentEnabled: urgent,
      },
      { upsert: true },
    );
  }

  await ProviderServiceArea.findOneAndUpdate(
    { providerId: userId, name: 'Service Area' },
    {
      type: ServiceAreaType.RADIUS,
      center: { latitude: lat, longitude: lng },
      radiusKm: 25,
      isActive: true,
    },
    { upsert: true },
  );

  await ProviderSchedule.findOneAndUpdate(
    { providerId: userId },
    {
      timezone: 'Asia/Kolkata',
      isActive: true,
      weeklySchedule: WEEKLY_SCHEDULE,
    },
    { upsert: true },
  );

  await presenceService.setProviderOnline(userId);
  await presenceService.heartbeatProvider(userId, { latitude: lat, longitude: lng });
}

async function seedDemoCustomer(customerId: string) {
  const existing = await CustomerAddress.findOne({ customerId, isDefault: true });
  if (existing) return;

  await CustomerAddress.create({
    customerId,
    label: AddressLabel.HOME,
    recipientName: 'Demo Customer',
    phone: `+91${DEMO_CUSTOMER_PHONE}`,
    addressLine1: '12 Connaught Place',
    addressLine2: 'Block A',
    landmark: 'Near Metro Station',
    city: 'New Delhi',
    state: 'Delhi',
    postalCode: '110001',
    country: 'India',
    location: { type: 'Point', coordinates: [DELHI_LNG, DELHI_LAT] },
    isDefault: true,
  });
}

async function seedPromotions() {
  const validFrom = new Date(Date.now() - 7 * 86_400_000);
  const validTo = new Date(Date.now() + 180 * 86_400_000);

  const promos = [
    {
      code: 'GHAAR20',
      type: PromotionType.PERCENTAGE,
      value: 20,
      minimumOrder: 499,
      maximumDiscount: 300,
    },
    {
      code: 'HDFC100',
      type: PromotionType.FIXED_AMOUNT,
      value: 100,
      minimumOrder: 999,
    },
    {
      code: 'SAVE10',
      type: PromotionType.PERCENTAGE,
      value: 10,
      minimumOrder: 299,
      maximumDiscount: 150,
    },
  ];

  for (const promo of promos) {
    await Promotion.findOneAndUpdate(
      { code: promo.code },
      {
        type: promo.type,
        value: promo.value,
        minimumOrder: promo.minimumOrder,
        maximumDiscount: promo.maximumDiscount,
        usageCount: 0,
        validFrom,
        validTo,
        status: PromotionStatus.ACTIVE,
      },
      { upsert: true },
    );
  }
}

async function seedMaintenanceTemplates() {
  const mappings: Array<{
    assetSlug: string;
    serviceSlug: string;
    title: string;
    intervalDays: number;
  }> = [
    { assetSlug: 'air-conditioner', serviceSlug: 'split-ac-service', title: 'AC service due', intervalDays: 180 },
    { assetSlug: 'washing-machine', serviceSlug: 'washing-machine-repair', title: 'Washer check-up', intervalDays: 365 },
    { assetSlug: 'refrigerator', serviceSlug: 'refrigerator-repair', title: 'Fridge maintenance', intervalDays: 365 },
    { assetSlug: 'geyser', serviceSlug: 'geyser-repair', title: 'Geyser service', intervalDays: 365 },
    { assetSlug: 'water-purifier', serviceSlug: 'sink-leakage-repair', title: 'Water system check', intervalDays: 365 },
  ];

  for (const mapping of mappings) {
    const assetType = await AssetType.findOne({ slug: mapping.assetSlug });
    const service = await Service.findOne({ slug: mapping.serviceSlug, isActive: true });
    if (!assetType || !service) continue;

    await MaintenanceTemplate.findOneAndUpdate(
      { assetTypeId: assetType._id, serviceId: service._id },
      {
        title: mapping.title,
        intervalDays: mapping.intervalDays,
        priority: MaintenancePriority.NORMAL,
        isActive: true,
      },
      { upsert: true },
    );
  }
}

async function seedIntelligenceFlags() {
  const flags = [
    FeatureFlagKey.ENABLE_AI_ASSISTANT,
    FeatureFlagKey.ENABLE_AI_ISSUE_CLASSIFICATION,
    FeatureFlagKey.ENABLE_AI_IMAGE_ANALYSIS,
    FeatureFlagKey.ENABLE_PREDICTIVE_MAINTENANCE,
  ];

  for (const key of flags) {
    await FeatureFlag.findOneAndUpdate(
      { key },
      {
        $set: {
          enabled: true,
          description: `Dev seed: ${key}`,
          rules: [{ type: 'global' }],
        },
      },
      { upsert: true },
    );
  }
}

async function enrichProviderProfiles() {
  for (const providerSeed of PROVIDERS) {
    const phoneE164 = `+91${providerSeed.phone}`;
    const user = await User.findOne({ phone: phoneE164 });
    if (!user) continue;
    await User.updateOne(
      { _id: user._id },
      { $set: { profileImage: PROVIDER_AVATARS[providerSeed.phone], fullName: providerSeed.name } },
    );
    await ProviderProfile.findOneAndUpdate(
      { userId: user._id },
      {
        $set: {
          fullName: providerSeed.name,
          profileImage: PROVIDER_AVATARS[providerSeed.phone],
          bio: `Certified Ghaarfix professional with 5+ years of experience serving homes in Delhi NCR.`,
        },
      },
      { upsert: true },
    );
  }

  const customer = await User.findOne({ phone: `+91${DEMO_CUSTOMER_PHONE}` });
  if (customer) {
    await User.updateOne(
      { _id: customer._id },
      { $set: { profileImage: CUSTOMER_AVATAR, fullName: 'Demo Customer' } },
    );
  }
}

export async function seedDevEnvironment(): Promise<void> {
  if (env.isProd || env.isTest) return;

  const approvedProviders = await ProviderService.countDocuments({
    approvalStatus: ProviderServiceApprovalStatus.APPROVED,
  });

  if (approvedProviders >= 3) {
    logger.info('Dev providers present — syncing catalog images, promotions, and maintenance templates');
    await seedCatalog();
    await seedHomeCarousel();
    await seedPromotions();
    await seedMaintenanceTemplates();
    await seedIntelligenceFlags();
    await enrichProviderProfiles();
    return;
  }

  logger.info('Applying full dev seed (catalog, users, providers, promotions)...');

  await seedCatalog();
  await seedHomeCarousel();

  const customer = await upsertUserWithMpin(DEMO_CUSTOMER_PHONE, UserRole.CUSTOMER, 'Demo Customer');
  if (!customer) throw new Error('Failed to seed demo customer');
  await seedDemoCustomer(customer._id.toString());
  await creditRewardIdempotent(
    customer._id.toString(),
    1000,
    RewardSourceType.LOYALTY,
    'dev-seed',
    'dev-seed-reward-balance',
  );

  const featuredServices = await Service.find({ isActive: true, isFeatured: true }).limit(12);
  const urgentServices = await Service.find({ isActive: true, isUrgentAvailable: true }).limit(8);
  const allServiceIds = [
    ...new Set([
      ...featuredServices.map((s) => s._id.toString()),
      ...urgentServices.map((s) => s._id.toString()),
    ]),
  ];

  if (allServiceIds.length === 0) {
    const fallback = await Service.find({ isActive: true }).limit(6);
    allServiceIds.push(...fallback.map((s) => s._id.toString()));
  }

  for (const providerSeed of PROVIDERS) {
    const provider = await upsertUserWithMpin(
      providerSeed.phone,
      UserRole.PROVIDER,
      providerSeed.name,
    );
    if (!provider) continue;
    await setupProvider(
      provider._id.toString(),
      providerSeed.name,
      providerSeed.phone,
      providerSeed.lat,
      providerSeed.lng,
      allServiceIds,
    );
  }

  await seedPromotions();
  await seedMaintenanceTemplates();
  await seedIntelligenceFlags();

  logger.info('Dev seed completed', {
    customerPhone: DEMO_CUSTOMER_PHONE,
    customerMpin: DEV_MPIN,
    providers: PROVIDERS.map((p) => ({ phone: p.phone, mpin: DEV_MPIN })),
  });
}

async function main() {
  if (env.isProd) {
    throw new Error('Dev seed cannot run in production.');
  }
  await connectDatabase();
  await seedDevEnvironment();
  await disconnectDatabase();
}

if (process.argv[1]?.endsWith('seed-dev.ts') || process.argv[1]?.endsWith('seed-dev.js')) {
  main().catch(async (error) => {
    console.error('Dev seed failed:', error);
    await disconnectDatabase();
    process.exit(1);
  });
}
