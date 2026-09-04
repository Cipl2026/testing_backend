import {
  Region,
  RegionalConfiguration,
  ServiceArea,
  RegionLaunchChecklist,
  TaxPolicy,
  RegionalPaymentPolicy,
  RegionalPricingPolicy,
  ProviderOnboardingPolicy,
  RegionalServiceCatalog,
  Partner,
  PartnerRegionAssignment,
  PartnerAgreement,
  PartnerPerformanceSnapshot,
  DataResidencyPolicy,
  RegionPerformanceSnapshot,
  Translation,
  ApiClient,
} from '@/models/Globalization.js';
import { FeatureFlag } from '@/models/FeatureFlag.js';
import { FeatureFlagKey } from '@ghaarfix/shared-types';
import { seedGlobalRegion } from '@/modules/globalization/region.service.js';
import { upsertTranslation } from '@/modules/globalization/localization.service.js';
import { logger } from '@/utils/logger.js';

export async function runPhase24Migrations() {
  await Promise.all([
    Region.syncIndexes(),
    RegionalConfiguration.syncIndexes(),
    ServiceArea.syncIndexes(),
    RegionLaunchChecklist.syncIndexes(),
    TaxPolicy.syncIndexes(),
    RegionalPaymentPolicy.syncIndexes(),
    RegionalPricingPolicy.syncIndexes(),
    ProviderOnboardingPolicy.syncIndexes(),
    RegionalServiceCatalog.syncIndexes(),
    Partner.syncIndexes(),
    PartnerRegionAssignment.syncIndexes(),
    PartnerAgreement.syncIndexes(),
    PartnerPerformanceSnapshot.syncIndexes(),
    DataResidencyPolicy.syncIndexes(),
    RegionPerformanceSnapshot.syncIndexes(),
    Translation.syncIndexes(),
    ApiClient.syncIndexes(),
  ]);

  await FeatureFlag.findOneAndUpdate(
    { key: FeatureFlagKey.ENABLE_GLOBALIZATION },
    {
      key: FeatureFlagKey.ENABLE_GLOBALIZATION,
      enabled: true,
      rules: [{ type: 'global' }],
    },
    { upsert: true },
  );

  await seedGlobalRegion();

  await upsertTranslation({ key: 'booking.status.accepted', locale: 'en', value: 'Accepted' });
  await upsertTranslation({ key: 'booking.status.accepted', locale: 'en-IN', value: 'Accepted' });
  await upsertTranslation({ key: 'booking.status.accepted', locale: 'hi-IN', value: 'स्वीकृत' });
  await upsertTranslation({ key: 'common.unsupported_region', locale: 'en', value: 'Service not available in your area yet.' });
  await upsertTranslation({ key: 'common.unsupported_region', locale: 'hi-IN', value: 'आपके क्षेत्र में अभी सेवा उपलब्ध नहीं है।' });

  const indiaRegion = await Region.findOne({ code: 'IN' });
  if (indiaRegion) {
    await DataResidencyPolicy.findOneAndUpdate(
      { regionId: indiaRegion._id },
      {
        regionId: indiaRegion._id,
        dataCategories: ['identity', 'financial', 'booking'],
        storageRegion: 'ap-south-1',
        replicationAllowed: false,
        backupRegion: 'ap-south-1',
        isActive: true,
      },
      { upsert: true },
    );
  }

  logger.info('Phase 24 globalization indexes ensured');
}
