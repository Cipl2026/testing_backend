import {
  HomeHelpCompatibilityGroup,
  ServiceProviderType,
  type HomeHelpCatalogResponse,
  type HomeHelpDurationPackageSummary,
} from '@ghaarfix/shared-types';
import { Category } from '@/models/Category.js';
import { HomeHelpDurationPackage } from '@/models/HomeHelpDurationPackage.js';
import { Service } from '@/models/Service.js';
import { AppError } from '@/utils/AppError.js';
import { ErrorCode } from '@ghaarfix/shared-types';
import { HOME_HELP_DISCLAIMER } from '@/modules/home-help/compatibility.service.js';
import { getHomeHelpCompatibilityConfig } from '@/modules/home-help/compatibility-config.service.js';

const ANCHOR_SERVICE_SLUG = 'general-home-help';

function serializeDurationPackage(doc: InstanceType<typeof HomeHelpDurationPackage>): HomeHelpDurationPackageSummary {
  return {
    id: doc._id.toString(),
    label: doc.label,
    durationMinutes: doc.durationMinutes,
    basePrice: doc.basePrice,
    currency: doc.currency,
    displayOrder: doc.displayOrder,
  };
}

export async function getHomeHelpCatalog(): Promise<HomeHelpCatalogResponse> {
  const category = await Category.findOne({ slug: 'home-help', isActive: true });
  if (!category) {
    throw new AppError('Home Help is not available yet.', 404, ErrorCode.NOT_FOUND);
  }

  const [anchorService, tasks, durationPackages, compatibility] = await Promise.all([
    Service.findOne({ slug: ANCHOR_SERVICE_SLUG, isActive: true }),
    Service.find({
      categoryId: category._id,
      isActive: true,
      providerType: ServiceProviderType.HOME_HELP_PRO,
      hourlyEligible: true,
      slug: { $ne: ANCHOR_SERVICE_SLUG },
    }).sort({ displayOrder: 1, name: 1 }),
    HomeHelpDurationPackage.find({ isActive: true }).sort({ displayOrder: 1, durationMinutes: 1 }),
    getHomeHelpCompatibilityConfig(),
  ]);

  if (!anchorService) {
    throw new AppError('Home Help anchor service is not configured.', 404, ErrorCode.NOT_FOUND);
  }
  if (!durationPackages.length) {
    throw new AppError('Home Help duration packages are not configured.', 404, ErrorCode.NOT_FOUND);
  }

  return {
    anchorServiceId: anchorService._id.toString(),
    tasks: tasks.map((task) => ({
      id: task._id.toString(),
      name: task.name,
      slug: task.slug,
      shortDescription: task.shortDescription,
      image: task.image,
      compatibilityGroup: task.compatibilityGroup ?? HomeHelpCompatibilityGroup.HOME_HELP,
      startingPrice: task.pricing.startingPrice,
      currency: task.pricing.currency ?? 'INR',
    })),
    durationPackages: durationPackages.map(serializeDurationPackage),
    disclaimer: HOME_HELP_DISCLAIMER,
    compatibility,
  };
}

export async function getDurationPackageById(durationPackageId: string) {
  const pkg = await HomeHelpDurationPackage.findOne({ _id: durationPackageId, isActive: true });
  if (!pkg) {
    throw new AppError('Duration package not found.', 404, ErrorCode.NOT_FOUND);
  }
  return pkg;
}

export async function getAnchorService() {
  const service = await Service.findOne({ slug: ANCHOR_SERVICE_SLUG, isActive: true });
  if (!service) {
    throw new AppError('Home Help anchor service is not configured.', 404, ErrorCode.NOT_FOUND);
  }
  return service;
}
