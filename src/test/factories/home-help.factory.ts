import {
  HomeHelpCompatibilityGroup,
  HomeHelpTaskPriority,
  ServiceProviderType,
} from '@ghaarfix/shared-types';
import { Category } from '@/models/Category.js';
import { HomeHelpDurationPackage } from '@/models/HomeHelpDurationPackage.js';
import { Service } from '@/models/Service.js';
import { Subcategory } from '@/models/Subcategory.js';
import { PricingType } from '@ghaarfix/shared-types';

const baseServiceFields = {
  estimatedDuration: { minMinutes: 60, maxMinutes: 120 },
  whatIsIncluded: [],
  whatIsNotIncluded: [],
  faqs: [],
  isFeatured: false,
  isUrgentAvailable: false,
  urgentConfig: {
    enabled: false,
    baseFee: 0,
    extraFee: 0,
    responseTimeoutMinutes: 2,
    maxProviderDistanceKm: 10,
    maxBroadcastProviders: 10,
  },
  displayOrder: 0,
  supportedAssetTypeIds: [],
  keywords: [],
  aliases: [],
  searchText: '',
  instantEligible: false,
};

export async function seedHomeHelpCatalogFixture() {
  const category = await Category.create({
    name: 'Home Help',
    slug: 'home-help',
    isActive: true,
    displayOrder: 1,
  });

  const subcategory = await Subcategory.create({
    categoryId: category._id,
    name: 'General Tasks',
    slug: 'general-tasks',
    isActive: true,
    displayOrder: 1,
  });

  const anchorService = await Service.create({
    ...baseServiceFields,
    name: 'General Home Help',
    slug: 'general-home-help',
    categoryId: category._id,
    subcategoryId: subcategory._id,
    isActive: true,
    providerType: ServiceProviderType.HOME_HELP_PRO,
    hourlyEligible: true,
    compatibilityGroup: HomeHelpCompatibilityGroup.HOME_HELP,
    pricing: { type: PricingType.STARTING_FROM, startingPrice: 299, currency: 'INR' },
  });

  const cleaningTask = await Service.create({
    ...baseServiceFields,
    name: 'Kitchen Cleaning',
    slug: `kitchen-cleaning-test-${Date.now()}`,
    categoryId: category._id,
    subcategoryId: subcategory._id,
    isActive: true,
    providerType: ServiceProviderType.HOME_HELP_PRO,
    hourlyEligible: true,
    compatibilityGroup: HomeHelpCompatibilityGroup.CLEANING,
    pricing: { type: PricingType.STARTING_FROM, startingPrice: 99, currency: 'INR' },
  });

  const laundryTask = await Service.create({
    ...baseServiceFields,
    name: 'Laundry Help',
    slug: `laundry-help-test-${Date.now()}`,
    categoryId: category._id,
    subcategoryId: subcategory._id,
    isActive: true,
    providerType: ServiceProviderType.HOME_HELP_PRO,
    hourlyEligible: true,
    compatibilityGroup: HomeHelpCompatibilityGroup.LAUNDRY,
    pricing: { type: PricingType.STARTING_FROM, startingPrice: 79, currency: 'INR' },
  });

  const durationPackage = await HomeHelpDurationPackage.create({
    label: '2 hours',
    durationMinutes: 120,
    basePrice: 499,
    currency: 'INR',
    isActive: true,
    displayOrder: 1,
  });

  return {
    categoryId: category._id.toString(),
    anchorServiceId: anchorService._id.toString(),
    cleaningTaskId: cleaningTask._id.toString(),
    laundryTaskId: laundryTask._id.toString(),
    durationPackageId: durationPackage._id.toString(),
  };
}

export const sampleHomeHelpTasks = (cleaningTaskId: string) => [
  { serviceId: cleaningTaskId, priority: HomeHelpTaskPriority.HIGH },
];
