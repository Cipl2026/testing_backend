import type { ICategory } from '@/models/Category.js';
import type { ISubcategory } from '@/models/Subcategory.js';
import type { IService } from '@/models/Service.js';
import type { IProviderService } from '@/models/ProviderService.js';

export function serializeCategory(category: ICategory) {
  return {
    id: category._id.toString(),
    name: category.name,
    slug: category.slug,
    description: category.description,
    image: category.image,
    icon: category.icon,
    isActive: category.isActive,
    displayOrder: category.displayOrder,
  };
}

export function serializeSubcategory(subcategory: ISubcategory, category?: ICategory) {
  return {
    id: subcategory._id.toString(),
    categoryId: subcategory.categoryId.toString(),
    categoryName: category?.name,
    name: subcategory.name,
    slug: subcategory.slug,
    description: subcategory.description,
    image: subcategory.image,
    isActive: subcategory.isActive,
    displayOrder: subcategory.displayOrder,
  };
}

export function serializeService(
  service: IService,
  extras?: {
    category?: ICategory;
    subcategory?: ISubcategory;
    isFavorite?: boolean;
  },
) {
  return {
    id: service._id.toString(),
    categoryId: service.categoryId.toString(),
    subcategoryId: service.subcategoryId.toString(),
    categoryName: extras?.category?.name,
    subcategoryName: extras?.subcategory?.name,
    name: service.name,
    slug: service.slug,
    shortDescription: service.shortDescription,
    description: service.description,
    image: service.image,
    pricing: service.pricing,
    estimatedDuration: service.estimatedDuration,
    whatIsIncluded: service.whatIsIncluded,
    whatIsNotIncluded: service.whatIsNotIncluded,
    faqs: service.faqs,
    warranty: service.warranty,
    isActive: service.isActive,
    isFeatured: service.isFeatured,
    isUrgentAvailable: service.isUrgentAvailable,
    urgentConfig: service.urgentConfig,
    displayOrder: service.displayOrder,
    isFavorite: extras?.isFavorite ?? false,
  };
}

export function serializeProviderService(
  record: IProviderService,
  extras?: { service?: IService; providerName?: string },
) {
  return {
    id: record._id.toString(),
    providerId: record.providerId.toString(),
    providerName: extras?.providerName,
    serviceId: record.serviceId.toString(),
    service: extras?.service ? serializeService(extras.service) : undefined,
    experienceYears: record.experienceYears,
    description: record.description,
    customPricing: record.customPricing,
    isActive: record.isActive,
    supportsUrgent: record.supportsUrgent,
    isUrgentEnabled: record.isUrgentEnabled,
    approvalStatus: record.approvalStatus,
    rejectionReason: record.rejectionReason,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}
