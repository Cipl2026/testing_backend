import {
  HomeHelpCompatibilityGroup,
  PricingType,
  ServiceProviderType,
} from '@ghaarfix/shared-types';
import { Category } from '@/models/Category.js';
import { HomeHelpDurationPackage } from '@/models/HomeHelpDurationPackage.js';
import { Service } from '@/models/Service.js';
import { Subcategory } from '@/models/Subcategory.js';
import { logger } from '@/utils/logger.js';

const HOME_HELP_CATEGORY_SLUG = 'home-help';

export async function runPhase25Migrations() {
  await Promise.all([HomeHelpDurationPackage.syncIndexes(), Service.syncIndexes()]);

  let category = await Category.findOne({ slug: HOME_HELP_CATEGORY_SLUG });
  if (!category) {
    category = await Category.create({
      name: 'Home Help',
      slug: HOME_HELP_CATEGORY_SLUG,
      description: 'Hourly household help — cleaning, laundry, kitchen support and more.',
      icon: 'home-help',
      isActive: true,
      displayOrder: 5,
    });
    logger.info('Home Help category created');
  }

  const subcategorySpecs = [
    { name: 'Cleaning by Room', slug: 'cleaning-by-room', group: HomeHelpCompatibilityGroup.CLEANING },
    { name: 'Laundry & Linen', slug: 'laundry-linen', group: HomeHelpCompatibilityGroup.LAUNDRY },
    { name: 'One-off Help', slug: 'one-off-help', group: HomeHelpCompatibilityGroup.HOME_HELP },
  ];

  const subcategoryMap = new Map<string, InstanceType<typeof Subcategory>>();
  for (const spec of subcategorySpecs) {
    let subcategory = await Subcategory.findOne({ slug: spec.slug, categoryId: category._id });
    if (!subcategory) {
      subcategory = await Subcategory.create({
        categoryId: category._id,
        name: spec.name,
        slug: spec.slug,
        isActive: true,
        displayOrder: subcategoryMap.size + 1,
      });
    }
    subcategoryMap.set(spec.slug, subcategory);
  }

  const serviceSpecs = [
    {
      slug: 'general-home-help',
      name: 'General Home Help',
      subcategorySlug: 'one-off-help',
      shortDescription: 'Flexible hourly help for everyday household tasks.',
      startingPrice: 0,
      minMinutes: 30,
      maxMinutes: 180,
      group: HomeHelpCompatibilityGroup.HOME_HELP,
      displayOrder: 0,
    },
    {
      slug: 'bathroom-cleaning',
      name: 'Bathroom Cleaning',
      subcategorySlug: 'cleaning-by-room',
      shortDescription: 'Scrub, sanitize and tidy bathroom surfaces.',
      startingPrice: 49,
      minMinutes: 20,
      maxMinutes: 45,
      group: HomeHelpCompatibilityGroup.CLEANING,
      displayOrder: 1,
    },
    {
      slug: 'kitchen-cleaning',
      name: 'Kitchen Cleaning',
      subcategorySlug: 'cleaning-by-room',
      shortDescription: 'Counters, sink, appliances and floor wipe-down.',
      startingPrice: 59,
      minMinutes: 25,
      maxMinutes: 50,
      group: HomeHelpCompatibilityGroup.CLEANING,
      displayOrder: 2,
    },
    {
      slug: 'dusting',
      name: 'Dusting',
      subcategorySlug: 'cleaning-by-room',
      shortDescription: 'Dust shelves, furniture and reachable surfaces.',
      startingPrice: 39,
      minMinutes: 20,
      maxMinutes: 40,
      group: HomeHelpCompatibilityGroup.CLEANING,
      displayOrder: 3,
    },
    {
      slug: 'laundry-help',
      name: 'Laundry Help',
      subcategorySlug: 'laundry-linen',
      shortDescription: 'Sort, wash, dry and fold laundry.',
      startingPrice: 49,
      minMinutes: 30,
      maxMinutes: 60,
      group: HomeHelpCompatibilityGroup.LAUNDRY,
      displayOrder: 4,
    },
    {
      slug: 'dishwashing',
      name: 'Dishwashing',
      subcategorySlug: 'one-off-help',
      shortDescription: 'Wash, dry and organize dishes.',
      startingPrice: 29,
      minMinutes: 15,
      maxMinutes: 30,
      group: HomeHelpCompatibilityGroup.KITCHEN,
      displayOrder: 5,
    },
    {
      slug: 'fridge-cleaning',
      name: 'Fridge Cleaning',
      subcategorySlug: 'cleaning-by-room',
      shortDescription: 'Clean shelves, trays and exterior surfaces.',
      startingPrice: 59,
      minMinutes: 25,
      maxMinutes: 45,
      group: HomeHelpCompatibilityGroup.CLEANING,
      displayOrder: 6,
    },
    {
      slug: 'sweeping-mopping',
      name: 'Sweeping & Mopping',
      subcategorySlug: 'cleaning-by-room',
      shortDescription: 'Sweep and mop floors in selected rooms.',
      startingPrice: 49,
      minMinutes: 25,
      maxMinutes: 50,
      group: HomeHelpCompatibilityGroup.CLEANING,
      displayOrder: 7,
    },
    {
      slug: 'window-cleaning',
      name: 'Window Cleaning',
      subcategorySlug: 'cleaning-by-room',
      shortDescription: 'Clean reachable windows and glass surfaces.',
      startingPrice: 69,
      minMinutes: 30,
      maxMinutes: 60,
      group: HomeHelpCompatibilityGroup.CLEANING,
      displayOrder: 8,
    },
    {
      slug: 'balcony-cleaning',
      name: 'Balcony Cleaning',
      subcategorySlug: 'cleaning-by-room',
      shortDescription: 'Sweep, wipe and tidy balcony area.',
      startingPrice: 59,
      minMinutes: 25,
      maxMinutes: 45,
      group: HomeHelpCompatibilityGroup.CLEANING,
      displayOrder: 9,
    },
    {
      slug: 'fan-cleaning',
      name: 'Fan Cleaning',
      subcategorySlug: 'cleaning-by-room',
      shortDescription: 'Dust and wipe ceiling fans safely.',
      startingPrice: 49,
      minMinutes: 20,
      maxMinutes: 35,
      group: HomeHelpCompatibilityGroup.CLEANING,
      displayOrder: 10,
    },
    {
      slug: 'ironing-folding',
      name: 'Ironing & Folding',
      subcategorySlug: 'laundry-linen',
      shortDescription: 'Iron clothes and fold them neatly.',
      startingPrice: 59,
      minMinutes: 30,
      maxMinutes: 60,
      group: HomeHelpCompatibilityGroup.LAUNDRY,
      displayOrder: 11,
    },
    {
      slug: 'wardrobe-cleaning',
      name: 'Wardrobe Cleaning',
      subcategorySlug: 'laundry-linen',
      shortDescription: 'Organize, fold and tidy wardrobe items.',
      startingPrice: 79,
      minMinutes: 40,
      maxMinutes: 75,
      group: HomeHelpCompatibilityGroup.LAUNDRY,
      displayOrder: 12,
    },
    {
      slug: 'kitchen-prep',
      name: 'Kitchen Prep',
      subcategorySlug: 'one-off-help',
      shortDescription: 'Wash, peel, chop and prep ingredients.',
      startingPrice: 49,
      minMinutes: 25,
      maxMinutes: 50,
      group: HomeHelpCompatibilityGroup.KITCHEN,
      displayOrder: 13,
    },
    {
      slug: 'plant-care',
      name: 'Plant Care',
      subcategorySlug: 'one-off-help',
      shortDescription: 'Water plants and basic balcony plant upkeep.',
      startingPrice: 39,
      minMinutes: 20,
      maxMinutes: 40,
      group: HomeHelpCompatibilityGroup.HOME_HELP,
      displayOrder: 14,
    },
    {
      slug: 'packing-unpacking',
      name: 'Packing & Unpacking',
      subcategorySlug: 'one-off-help',
      shortDescription: 'Pack or unpack boxes and organize items.',
      startingPrice: 89,
      minMinutes: 45,
      maxMinutes: 90,
      group: HomeHelpCompatibilityGroup.HOME_HELP,
      displayOrder: 15,
    },
    {
      slug: 'pre-party-clean',
      name: 'Pre-Party Express Clean',
      subcategorySlug: 'cleaning-by-room',
      shortDescription: 'Quick tidy before guests arrive.',
      startingPrice: 99,
      minMinutes: 45,
      maxMinutes: 90,
      group: HomeHelpCompatibilityGroup.CLEANING,
      displayOrder: 16,
    },
    {
      slug: 'after-party-clean',
      name: 'After-Party Express Clean',
      subcategorySlug: 'cleaning-by-room',
      shortDescription: 'Quick cleanup after a gathering.',
      startingPrice: 99,
      minMinutes: 45,
      maxMinutes: 90,
      group: HomeHelpCompatibilityGroup.CLEANING,
      displayOrder: 17,
    },
    {
      slug: 'car-surface-cleaning',
      name: 'Car Surface Cleaning',
      subcategorySlug: 'one-off-help',
      shortDescription: 'Exterior wipe-down and basic interior tidy.',
      startingPrice: 79,
      minMinutes: 30,
      maxMinutes: 50,
      group: HomeHelpCompatibilityGroup.HOME_HELP,
      displayOrder: 18,
    },
  ];

  for (const spec of serviceSpecs) {
    const exists = await Service.findOne({ slug: spec.slug });
    if (exists) continue;
    const subcategory = subcategoryMap.get(spec.subcategorySlug);
    if (!subcategory) continue;

    await Service.create({
      categoryId: category._id,
      subcategoryId: subcategory._id,
      name: spec.name,
      slug: spec.slug,
      shortDescription: spec.shortDescription,
      pricing: { type: PricingType.FIXED, startingPrice: spec.startingPrice, currency: 'INR' },
      estimatedDuration: { minMinutes: spec.minMinutes, maxMinutes: spec.maxMinutes },
      whatIsIncluded: [spec.shortDescription ?? ''],
      whatIsNotIncluded: ['Specialist repairs', 'Heavy equipment moving'],
      isActive: true,
      isFeatured: spec.slug === 'general-home-help',
      isUrgentAvailable: spec.slug === 'general-home-help',
      urgentConfig: {
        enabled: spec.slug === 'general-home-help',
        baseFee: 49,
        extraFee: 29,
        responseTimeoutMinutes: 15,
        maxProviderDistanceKm: 8,
        maxBroadcastProviders: 12,
      },
      providerType: ServiceProviderType.HOME_HELP_PRO,
      hourlyEligible: true,
      instantEligible: spec.slug === 'general-home-help',
      compatibilityGroup: spec.group,
      displayOrder: spec.displayOrder,
      keywords: [spec.name, 'home help', 'hourly help'],
      aliases: [],
    });
  }

  const packageCount = await HomeHelpDurationPackage.countDocuments();
  if (packageCount === 0) {
    await HomeHelpDurationPackage.insertMany([
      { label: '30 minutes', durationMinutes: 30, basePrice: 199, currency: 'INR', displayOrder: 1 },
      { label: '1 hour', durationMinutes: 60, basePrice: 349, currency: 'INR', displayOrder: 2 },
      { label: '1.5 hours', durationMinutes: 90, basePrice: 499, currency: 'INR', displayOrder: 3 },
      { label: '2 hours', durationMinutes: 120, basePrice: 649, currency: 'INR', displayOrder: 4 },
      { label: '2.5 hours', durationMinutes: 150, basePrice: 799, currency: 'INR', displayOrder: 5 },
      { label: '3 hours', durationMinutes: 180, basePrice: 949, currency: 'INR', displayOrder: 6 },
    ]);
    logger.info('Home Help duration packages seeded');
  }

  await Service.updateOne(
    { slug: 'general-home-help' },
    {
      $set: {
        isUrgentAvailable: true,
        instantEligible: true,
        'urgentConfig.enabled': true,
        'urgentConfig.baseFee': 49,
        'urgentConfig.extraFee': 29,
        'urgentConfig.responseTimeoutMinutes': 15,
        'urgentConfig.maxProviderDistanceKm': 8,
        'urgentConfig.maxBroadcastProviders': 12,
      },
    },
  );

  logger.info('Phase 25 Home Help migrations complete');
}
