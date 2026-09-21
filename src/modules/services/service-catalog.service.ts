import { ErrorCode } from '@ghaarfix/shared-types';
import { Category } from '@/models/Category.js';
import { FavoriteService } from '@/models/FavoriteService.js';
import { RecentlyViewedService } from '@/models/RecentlyViewedService.js';
import { Service } from '@/models/Service.js';
import { Subcategory } from '@/models/Subcategory.js';
import { AppError } from '@/utils/AppError.js';
import { buildPaginationMeta, escapeRegex, slugify } from '@/utils/catalog.js';
import { serializeService } from '@/utils/catalogSerializers.js';
import * as zoneAvailabilityService from '@/modules/operations/zone-availability.service.js';
import type { SearchQuery, ServiceListQuery } from '@/validators/catalog.js';

const RECENT_LIMIT = 20;

async function loadServiceRelations(service: InstanceType<typeof Service>, customerId?: string) {
  const [category, subcategory, favorite] = await Promise.all([
    Category.findById(service.categoryId),
    Subcategory.findById(service.subcategoryId),
    customerId
      ? FavoriteService.exists({ customerId, serviceId: service._id })
      : Promise.resolve(null),
  ]);
  return serializeService(service, {
    category: category ?? undefined,
    subcategory: subcategory ?? undefined,
    isFavorite: Boolean(favorite),
  });
}

function buildServiceFilter(query: ServiceListQuery, activeOnly = true) {
  const filter: Record<string, unknown> = activeOnly ? { isActive: true } : {};
  if (query.categoryId) filter.categoryId = query.categoryId;
  if (query.subcategoryId) filter.subcategoryId = query.subcategoryId;
  if (query.providerType) filter.providerType = query.providerType;
  if (query.hourlyEligible !== undefined) filter.hourlyEligible = query.hourlyEligible;
  if (query.featured !== undefined) filter.isFeatured = query.featured;
  if (query.search) {
    const regex = new RegExp(escapeRegex(query.search), 'i');
    filter.$or = [{ name: regex }, { shortDescription: regex }, { description: regex }];
  }
  return filter;
}

export async function listServices(query: ServiceListQuery, customerId?: string) {
  const filter = buildServiceFilter(query, true);
  if (query.serviceZoneId) {
    const allowedIds = await zoneAvailabilityService.filterCatalogByZone(query.serviceZoneId);
    if (!allowedIds.length) {
      return { items: [], meta: buildPaginationMeta(query.page, query.limit, 0) };
    }
    filter._id = { $in: allowedIds };
  }
  const sortField = query.sort ?? 'displayOrder';
  const total = await Service.countDocuments(filter);
  const services = await Service.find(filter)
    .sort({ [sortField]: 1, name: 1 })
    .skip((query.page - 1) * query.limit)
    .limit(query.limit);
  const favoriteIds = customerId
    ? new Set(
        (
          await FavoriteService.find({
            customerId,
            serviceId: { $in: services.map((s) => s._id) },
          })
        ).map((f) => f.serviceId.toString()),
      )
    : new Set<string>();
  const categories = await Category.find({ _id: { $in: services.map((s) => s.categoryId) } });
  const subcategories = await Subcategory.find({ _id: { $in: services.map((s) => s.subcategoryId) } });
  const categoryMap = new Map(categories.map((c) => [c._id.toString(), c]));
  const subcategoryMap = new Map(subcategories.map((s) => [s._id.toString(), s]));
  return {
    items: services.map((service) =>
      serializeService(service, {
        category: categoryMap.get(service.categoryId.toString()),
        subcategory: subcategoryMap.get(service.subcategoryId.toString()),
        isFavorite: favoriteIds.has(service._id.toString()),
      }),
    ),
    meta: buildPaginationMeta(query.page, query.limit, total),
  };
}

export async function getUrgentServices(customerId?: string) {
  const services = await Service.find({
    isActive: true,
    isUrgentAvailable: true,
    'urgentConfig.enabled': true,
  })
    .sort({ displayOrder: 1, name: 1 })
    .limit(24);
  const favoriteIds = customerId
    ? new Set(
        (
          await FavoriteService.find({
            customerId,
            serviceId: { $in: services.map((s) => s._id) },
          })
        ).map((f) => f.serviceId.toString()),
      )
    : new Set<string>();
  const categories = await Category.find({ _id: { $in: services.map((s) => s.categoryId) } });
  const categoryMap = new Map(categories.map((c) => [c._id.toString(), c]));
  return services.map((service) =>
    serializeService(service, {
      category: categoryMap.get(service.categoryId.toString()),
      isFavorite: favoriteIds.has(service._id.toString()),
    }),
  );
}

export async function getFeaturedServices(customerId?: string) {
  const services = await Service.find({ isActive: true, isFeatured: true })
    .sort({ displayOrder: 1, name: 1 })
    .limit(12);
  const favoriteIds = customerId
    ? new Set(
        (
          await FavoriteService.find({
            customerId,
            serviceId: { $in: services.map((s) => s._id) },
          })
        ).map((f) => f.serviceId.toString()),
      )
    : new Set<string>();
  const categories = await Category.find({ _id: { $in: services.map((s) => s.categoryId) } });
  const categoryMap = new Map(categories.map((c) => [c._id.toString(), c]));
  return services.map((service) =>
    serializeService(service, {
      category: categoryMap.get(service.categoryId.toString()),
      isFavorite: favoriteIds.has(service._id.toString()),
    }),
  );
}

export async function searchServices(query: SearchQuery, customerId?: string) {
  const regex = new RegExp(escapeRegex(query.q), 'i');
  const filter = {
    isActive: true,
    $or: [
      { name: regex },
      { shortDescription: regex },
      { description: regex },
      { keywords: regex },
      { aliases: regex },
      { searchText: regex },
    ],
  };
  const total = await Service.countDocuments(filter);
  const services = await Service.find(filter)
    .sort({ displayOrder: 1, name: 1 })
    .skip((query.page - 1) * query.limit)
    .limit(query.limit);
  const favoriteIds = customerId
    ? new Set(
        (
          await FavoriteService.find({
            customerId,
            serviceId: { $in: services.map((s) => s._id) },
          })
        ).map((f) => f.serviceId.toString()),
      )
    : new Set<string>();
  return {
    items: services.map((service) =>
      serializeService(service, { isFavorite: favoriteIds.has(service._id.toString()) }),
    ),
    meta: buildPaginationMeta(query.page, query.limit, total),
  };
}

export async function getServiceById(serviceId: string, customerId?: string, trackRecent = false) {
  const service = await Service.findOne({ _id: serviceId, isActive: true });
  if (!service) throw new AppError('Service not found.', 404, ErrorCode.NOT_FOUND);
  if (customerId && trackRecent) await trackRecentlyViewed(customerId, serviceId);
  return loadServiceRelations(service, customerId);
}

export async function getServiceBySlug(slug: string, customerId?: string, trackRecent = false) {
  const service = await Service.findOne({ slug: slug.toLowerCase(), isActive: true });
  if (!service) throw new AppError('Service not found.', 404, ErrorCode.NOT_FOUND);
  if (customerId && trackRecent) await trackRecentlyViewed(customerId, service._id.toString());
  return loadServiceRelations(service, customerId);
}

async function trackRecentlyViewed(customerId: string, serviceId: string) {
  await RecentlyViewedService.findOneAndUpdate(
    { customerId, serviceId },
    { viewedAt: new Date() },
    { upsert: true, new: true },
  );
  const count = await RecentlyViewedService.countDocuments({ customerId });
  if (count > RECENT_LIMIT) {
    const stale = await RecentlyViewedService.find({ customerId })
      .sort({ viewedAt: 1 })
      .limit(count - RECENT_LIMIT);
    await RecentlyViewedService.deleteMany({ _id: { $in: stale.map((s) => s._id) } });
  }
}

export async function listRecentServices(customerId: string) {
  const recent = await RecentlyViewedService.find({ customerId })
    .sort({ viewedAt: -1 })
    .limit(RECENT_LIMIT);
  const services = await Service.find({
    _id: { $in: recent.map((r) => r.serviceId) },
    isActive: true,
  });
  const serviceMap = new Map(services.map((s) => [s._id.toString(), s]));
  const items = recent
    .map((r) => serviceMap.get(r.serviceId.toString()))
    .filter((s): s is InstanceType<typeof Service> => Boolean(s));
  return Promise.all(items.map((service) => loadServiceRelations(service, customerId)));
}

export async function listFavoriteServices(customerId: string) {
  const favorites = await FavoriteService.find({ customerId }).sort({ createdAt: -1 });
  const services = await Service.find({
    _id: { $in: favorites.map((f) => f.serviceId) },
    isActive: true,
  });
  return Promise.all(services.map((service) => loadServiceRelations(service, customerId)));
}

export async function addFavoriteService(customerId: string, serviceId: string) {
  const service = await Service.findOne({ _id: serviceId, isActive: true });
  if (!service) throw new AppError('Service not found.', 404, ErrorCode.NOT_FOUND);
  try {
    await FavoriteService.create({ customerId, serviceId });
  } catch {
    throw new AppError('Service is already in favorites.', 409, ErrorCode.CONFLICT);
  }
}

export async function removeFavoriteService(customerId: string, serviceId: string) {
  const deleted = await FavoriteService.findOneAndDelete({ customerId, serviceId });
  if (!deleted) throw new AppError('Favorite not found.', 404, ErrorCode.NOT_FOUND);
}

export async function adminListServices(query: ServiceListQuery) {
  const filter = buildServiceFilter(query, false);
  const total = await Service.countDocuments(filter);
  const services = await Service.find(filter)
    .sort({ displayOrder: 1, name: 1 })
    .skip((query.page - 1) * query.limit)
    .limit(query.limit);
  const categories = await Category.find({ _id: { $in: services.map((s) => s.categoryId) } });
  const subcategories = await Subcategory.find({ _id: { $in: services.map((s) => s.subcategoryId) } });
  const categoryMap = new Map(categories.map((c) => [c._id.toString(), c]));
  const subcategoryMap = new Map(subcategories.map((s) => [s._id.toString(), s]));
  return {
    items: services.map((service) =>
      serializeService(service, {
        category: categoryMap.get(service.categoryId.toString()),
        subcategory: subcategoryMap.get(service.subcategoryId.toString()),
      }),
    ),
    meta: buildPaginationMeta(query.page, query.limit, total),
  };
}

export async function adminCreateService(input: Record<string, unknown>) {
  const category = await Category.findById(input.categoryId as string);
  const subcategory = await Subcategory.findOne({
    _id: input.subcategoryId,
    categoryId: input.categoryId,
  });
  if (!category || !subcategory) {
    throw new AppError('Invalid category or subcategory.', 400, ErrorCode.VALIDATION_ERROR);
  }
  const baseSlug = slugify((input.slug as string | undefined) ?? (input.name as string));
  let slug = baseSlug;
  let counter = 1;
  while (await Service.exists({ slug })) slug = `${baseSlug}-${counter++}`;
  try {
    const service = await Service.create({ ...input, slug });
    return serializeService(service, { category, subcategory });
  } catch {
    throw new AppError('Service slug already exists.', 409, ErrorCode.CONFLICT);
  }
}

export async function adminUpdateService(id: string, input: Record<string, unknown>) {
  const service = await Service.findById(id);
  if (!service) throw new AppError('Service not found.', 404, ErrorCode.NOT_FOUND);
  if (input.categoryId || input.subcategoryId) {
    const categoryId = (input.categoryId as string) ?? service.categoryId.toString();
    const subcategoryId = (input.subcategoryId as string) ?? service.subcategoryId.toString();
    const subcategory = await Subcategory.findOne({ _id: subcategoryId, categoryId });
    if (!subcategory) throw new AppError('Invalid category or subcategory.', 400, ErrorCode.VALIDATION_ERROR);
  }
  Object.assign(service, input);
  if (input.slug) service.slug = slugify(input.slug as string);
  await service.save();
  return loadServiceRelations(service);
}

export async function adminGetService(id: string) {
  const service = await Service.findById(id);
  if (!service) throw new AppError('Service not found.', 404, ErrorCode.NOT_FOUND);
  return loadServiceRelations(service);
}
