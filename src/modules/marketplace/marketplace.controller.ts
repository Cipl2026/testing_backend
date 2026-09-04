import * as catalogService from '@/modules/marketplace/catalog.service.js';
import * as cartService from '@/modules/marketplace/cart.service.js';
import * as orderService from '@/modules/marketplace/order.service.js';
import * as compatibilityService from '@/modules/marketplace/compatibility.service.js';
import * as recommendationService from '@/modules/marketplace/recommendation.service.js';
import * as warrantyService from '@/modules/marketplace/warranty.service.js';
import * as returnService from '@/modules/marketplace/return.service.js';
import { asyncHandler } from '@/utils/asyncHandler.js';
import { sendSuccess } from '@/utils/apiResponse.js';

export const listProducts = asyncHandler(async (req, res) => {
  const result = await catalogService.listProducts({
    search: req.query.search as string | undefined,
    categoryId: req.query.categoryId as string | undefined,
    brandId: req.query.brandId as string | undefined,
    page: Number(req.query.page) || 1,
    limit: Number(req.query.limit) || 20,
  });
  sendSuccess(res, 'Products fetched', result);
});

export const getProduct = asyncHandler(async (req, res) => {
  const product = await catalogService.getProductBySlug(String(req.params.slug), {
    customerId: req.auth!.userId,
    assetId: req.query.assetId as string | undefined,
  });
  sendSuccess(res, 'Product fetched', product);
});

export const getRecommendations = asyncHandler(async (req, res) => {
  const items = await recommendationService.getMarketplaceRecommendations(req.auth!.userId, {
    homeId: req.query.homeId as string | undefined,
    assetId: req.query.assetId as string | undefined,
  });
  sendSuccess(res, 'Recommendations fetched', { items });
});

export const getCart = asyncHandler(async (req, res) => {
  const cart = await cartService.getCart(req.auth!.userId);
  sendSuccess(res, 'Cart fetched', cart);
});

export const addToCart = asyncHandler(async (req, res) => {
  const cart = await cartService.addToCart(req.auth!.userId, req.body);
  sendSuccess(res, 'Cart updated', cart);
});

export const createOrder = asyncHandler(async (req, res) => {
  const order = await orderService.createOrder(req.auth!.userId, req.body);
  sendSuccess(res, 'Order created', order, 201);
});

export const listOrders = asyncHandler(async (req, res) => {
  const items = await orderService.listOrders(req.auth!.userId);
  sendSuccess(res, 'Orders fetched', { items });
});

export const getOrder = asyncHandler(async (req, res) => {
  const order = await orderService.getOrder(req.auth!.userId, String(req.params.id));
  sendSuccess(res, 'Order fetched', order);
});

export const checkCompatibility = asyncHandler(async (req, res) => {
  const result = await compatibilityService.checkCompatibility({
    customerId: req.auth!.userId,
    ...req.body,
  });
  sendSuccess(res, 'Compatibility checked', result);
});

export const createReturn = asyncHandler(async (req, res) => {
  const result = await returnService.createReturnRequest(req.auth!.userId, req.body);
  sendSuccess(res, 'Return requested', result, 201);
});

export const listWarranties = asyncHandler(async (req, res) => {
  const items = await warrantyService.listCustomerWarranties(req.auth!.userId);
  sendSuccess(res, 'Warranties fetched', { items });
});
