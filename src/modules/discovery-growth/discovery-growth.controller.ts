import * as searchService from '@/modules/discovery-growth/search.service.js';
import * as recommendationService from '@/modules/discovery-growth/recommendation.service.js';
import * as discoveryService from '@/modules/discovery-growth/discovery.service.js';
import * as rebookingService from '@/modules/discovery-growth/rebooking.service.js';
import * as growthService from '@/modules/discovery-growth/growth.service.js';
import * as promotionService from '@/modules/discovery-growth/promotion.service.js';
import * as featureFlagService from '@/modules/discovery-growth/feature-flag.service.js';
import * as bundleService from '@/modules/discovery-growth/bundle.service.js';
import * as catalogService from '@/modules/services/service-catalog.service.js';
import { asyncHandler } from '@/utils/asyncHandler.js';
import { sendSuccess } from '@/utils/apiResponse.js';
import { ErrorCode } from '@ghaarfix/shared-types';
import { AppError } from '@/utils/AppError.js';

export const search = asyncHandler(async (req, res) => {
  const { q, page, limit } = req.query as never;
  const result = await searchService.search(q, {
    customerId: req.auth?.userId,
    page,
    limit,
  });
  sendSuccess(res, 'Search results fetched successfully', result);
});

export const searchSuggestions = asyncHandler(async (req, res) => {
  const { q, limit } = req.query as never;
  const result = await searchService.getSuggestions(q, limit);
  sendSuccess(res, 'Search suggestions fetched successfully', result);
});

export const listRecommendations = asyncHandler(async (req, res) => {
  const { homeId } = req.query as { homeId?: string };
  const items = await recommendationService.listActiveRecommendations(req.auth!.userId, homeId);
  sendSuccess(res, 'Recommendations fetched successfully', { items });
});

export const dismissRecommendation = asyncHandler(async (req, res) => {
  const rec = await recommendationService.dismissRecommendation(
    req.auth!.userId,
    String(req.params.id),
  );
  if (!rec) throw new AppError('Recommendation not found.', 404, ErrorCode.NOT_FOUND);
  sendSuccess(res, 'Recommendation dismissed', { id: rec._id.toString() });
});

export const clickRecommendation = asyncHandler(async (req, res) => {
  const rec = await recommendationService.clickRecommendation(
    req.auth!.userId,
    String(req.params.id),
  );
  if (!rec) throw new AppError('Recommendation not found.', 404, ErrorCode.NOT_FOUND);
  sendSuccess(res, 'Recommendation click recorded', { id: rec._id.toString() });
});

export const listFavouriteServices = asyncHandler(async (req, res) => {
  const items = await catalogService.listFavoriteServices(req.auth!.userId);
  sendSuccess(res, 'Favourite services fetched successfully', { items });
});

export const addFavouriteService = asyncHandler(async (req, res) => {
  await catalogService.addFavoriteService(req.auth!.userId, String(req.params.serviceId));
  sendSuccess(res, 'Service saved', null);
});

export const removeFavouriteService = asyncHandler(async (req, res) => {
  await catalogService.removeFavoriteService(req.auth!.userId, String(req.params.serviceId));
  sendSuccess(res, 'Service removed from favourites', null);
});

export const listServiceBundles = asyncHandler(async (_req, res) => {
  const bundles = await bundleService.listActiveBundles();
  sendSuccess(res, 'Service bundles fetched successfully', {
    items: bundles.map((b) => ({
      id: b._id.toString(),
      name: b.name,
      description: b.description,
      pricingMode: b.pricingMode,
    })),
  });
});

export const getServiceBundle = asyncHandler(async (req, res) => {
  const bundle = await bundleService.getBundleWithPricing(String(req.params.id));
  sendSuccess(res, 'Service bundle fetched successfully', bundle);
});

export const validatePromotion = asyncHandler(async (req, res) => {
  const result = await promotionService.validatePromotion({
    ...req.body,
    customerId: req.auth!.userId,
  });
  sendSuccess(res, 'Promotion validated successfully', result);
});

export const listActivePromotions = asyncHandler(async (_req, res) => {
  const items = await promotionService.listActivePromotions();
  sendSuccess(res, 'Active promotions fetched successfully', { items });
});

export const getMyReferral = asyncHandler(async (req, res) => {
  const referral = await growthService.getReferralProfile(req.auth!.userId);
  sendSuccess(res, 'Referral profile fetched successfully', referral);
});

export const redeemReferral = asyncHandler(async (req, res) => {
  const redemption = await growthService.redeemReferralCode(req.auth!.userId, req.body.code);
  sendSuccess(res, 'Referral redeemed successfully', {
    id: redemption._id.toString(),
    status: redemption.status,
  });
});

export const getRewardBalance = asyncHandler(async (req, res) => {
  const balance = await growthService.getRewardBalance(req.auth!.userId);
  sendSuccess(res, 'Reward balance fetched successfully', balance);
});

export const getRewardLedger = asyncHandler(async (req, res) => {
  const items = await growthService.getRewardLedger(req.auth!.userId);
  sendSuccess(res, 'Reward ledger fetched successfully', { items });
});

export const getFeatures = asyncHandler(async (req, res) => {
  const { region } = req.query as { region?: string };
  const features = await featureFlagService.getCustomerFeatures(req.auth!.userId, region);
  sendSuccess(res, 'Feature flags fetched successfully', { features });
});

export const getDiscoveryHome = asyncHandler(async (req, res) => {
  const { homeId, region } = req.query as { homeId?: string; region?: string };
  const sections = await discoveryService.getHomeDiscovery(req.auth!.userId, homeId, region);
  sendSuccess(res, 'Discovery home fetched successfully', sections);
});

export const getRebooking = asyncHandler(async (req, res) => {
  const data = await rebookingService.getRebookingPrefill(
    req.auth!.userId,
    String(req.params.bookingId),
  );
  sendSuccess(res, 'Rebooking data fetched successfully', data);
});
