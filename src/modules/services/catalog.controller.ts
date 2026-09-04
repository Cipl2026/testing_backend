import * as categoryService from '@/modules/service-categories/category.service.js';
import * as catalogService from '@/modules/services/service-catalog.service.js';
import { asyncHandler } from '@/utils/asyncHandler.js';
import { sendSuccess } from '@/utils/apiResponse.js';

export const listCategories = asyncHandler(async (_req, res) => {
  const items = await categoryService.listPublicCategories();
  sendSuccess(res, 'Categories fetched successfully', { items });
});

export const getCategory = asyncHandler(async (req, res) => {
  const category = await categoryService.getPublicCategory(String(req.params.categoryId));
  sendSuccess(res, 'Category fetched successfully', category);
});

export const listSubcategories = asyncHandler(async (req, res) => {
  const items = await categoryService.listPublicSubcategories(String(req.params.categoryId));
  sendSuccess(res, 'Subcategories fetched successfully', { items });
});

export const listServices = asyncHandler(async (req, res) => {
  const result = await catalogService.listServices(req.query as never, req.auth?.userId);
  sendSuccess(res, 'Services fetched successfully', { items: result.items }, 200, result.meta);
});

export const getFeatured = asyncHandler(async (req, res) => {
  const items = await catalogService.getFeaturedServices(req.auth?.userId);
  sendSuccess(res, 'Featured services fetched successfully', { items });
});

export const searchServices = asyncHandler(async (req, res) => {
  const result = await catalogService.searchServices(req.query as never, req.auth?.userId);
  sendSuccess(res, 'Search results fetched successfully', { items: result.items }, 200, result.meta);
});

export const listRecent = asyncHandler(async (req, res) => {
  const items = await catalogService.listRecentServices(req.auth!.userId);
  sendSuccess(res, 'Recently viewed services fetched successfully', { items });
});

export const listFavorites = asyncHandler(async (req, res) => {
  const items = await catalogService.listFavoriteServices(req.auth!.userId);
  sendSuccess(res, 'Favorite services fetched successfully', { items });
});

export const getService = asyncHandler(async (req, res) => {
  const service = await catalogService.getServiceById(
    String(req.params.serviceId),
    req.auth?.userId,
    Boolean(req.auth?.userId),
  );
  sendSuccess(res, 'Service fetched successfully', service);
});

export const getServiceBySlug = asyncHandler(async (req, res) => {
  const service = await catalogService.getServiceBySlug(
    String(req.params.slug),
    req.auth?.userId,
    Boolean(req.auth?.userId),
  );
  sendSuccess(res, 'Service fetched successfully', service);
});

export const addFavorite = asyncHandler(async (req, res) => {
  await catalogService.addFavoriteService(req.auth!.userId, String(req.params.serviceId));
  sendSuccess(res, 'Service added to favorites', null);
});

export const removeFavorite = asyncHandler(async (req, res) => {
  await catalogService.removeFavoriteService(req.auth!.userId, String(req.params.serviceId));
  sendSuccess(res, 'Service removed from favorites', null);
});
