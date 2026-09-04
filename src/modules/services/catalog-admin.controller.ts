import * as categoryService from '@/modules/service-categories/category.service.js';
import * as catalogService from '@/modules/services/service-catalog.service.js';
import * as providerServiceModule from '@/modules/provider-services/provider-service.service.js';
import { asyncHandler } from '@/utils/asyncHandler.js';
import { sendSuccess } from '@/utils/apiResponse.js';

export const listCategories = asyncHandler(async (req, res) => {
  const result = await categoryService.adminListCategories(req.query as never);
  sendSuccess(res, 'Categories fetched successfully', { items: result.items }, 200, result.meta);
});

export const createCategory = asyncHandler(async (req, res) => {
  const category = await categoryService.adminCreateCategory(req.body);
  sendSuccess(res, 'Category created successfully', category, 201);
});

export const updateCategory = asyncHandler(async (req, res) => {
  const category = await categoryService.adminUpdateCategory(String(req.params.id), req.body);
  sendSuccess(res, 'Category updated successfully', category);
});

export const deleteCategory = asyncHandler(async (req, res) => {
  await categoryService.adminDeleteCategory(String(req.params.id));
  sendSuccess(res, 'Category deleted successfully', null);
});

export const listSubcategories = asyncHandler(async (req, res) => {
  const result = await categoryService.adminListSubcategories(req.query as never);
  sendSuccess(res, 'Subcategories fetched successfully', { items: result.items }, 200, result.meta);
});

export const createSubcategory = asyncHandler(async (req, res) => {
  const subcategory = await categoryService.adminCreateSubcategory(req.body);
  sendSuccess(res, 'Subcategory created successfully', subcategory, 201);
});

export const updateSubcategory = asyncHandler(async (req, res) => {
  const subcategory = await categoryService.adminUpdateSubcategory(String(req.params.id), req.body);
  sendSuccess(res, 'Subcategory updated successfully', subcategory);
});

export const listServices = asyncHandler(async (req, res) => {
  const result = await catalogService.adminListServices(req.query as never);
  sendSuccess(res, 'Services fetched successfully', { items: result.items }, 200, result.meta);
});

export const createService = asyncHandler(async (req, res) => {
  const service = await catalogService.adminCreateService(req.body);
  sendSuccess(res, 'Service created successfully', service, 201);
});

export const updateService = asyncHandler(async (req, res) => {
  const service = await catalogService.adminUpdateService(String(req.params.id), req.body);
  sendSuccess(res, 'Service updated successfully', service);
});

export const getService = asyncHandler(async (req, res) => {
  const service = await catalogService.adminGetService(String(req.params.id));
  sendSuccess(res, 'Service fetched successfully', service);
});

export const listProviderServices = asyncHandler(async (req, res) => {
  const result = await providerServiceModule.adminListProviderServices(req.query as never);
  sendSuccess(res, 'Provider services fetched successfully', { items: result.items }, 200, result.meta);
});

export const approveProviderService = asyncHandler(async (req, res) => {
  const record = await providerServiceModule.adminApproveProviderService(String(req.params.id));
  sendSuccess(res, 'Provider service approved successfully', record);
});

export const rejectProviderService = asyncHandler(async (req, res) => {
  const record = await providerServiceModule.adminRejectProviderService(String(req.params.id), req.body.reason);
  sendSuccess(res, 'Provider service rejected successfully', record);
});
