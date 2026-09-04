import * as searchService from '@/modules/discovery-growth/search.service.js';
import * as analyticsService from '@/modules/discovery-growth/analytics.service.js';
import * as promotionService from '@/modules/discovery-growth/promotion.service.js';
import * as bundleService from '@/modules/discovery-growth/bundle.service.js';
import * as featureFlagService from '@/modules/discovery-growth/feature-flag.service.js';
import * as experimentService from '@/modules/discovery-growth/experiment.service.js';
import * as campaignAdminService from '@/modules/discovery-growth/campaign-admin.service.js';
import { asyncHandler } from '@/utils/asyncHandler.js';
import { sendSuccess } from '@/utils/apiResponse.js';
import { ErrorCode } from '@ghaarfix/shared-types';
import { AppError } from '@/utils/AppError.js';

export const getSearchInsights = asyncHandler(async (_req, res) => {
  const insights = await searchService.getSearchInsights();
  sendSuccess(res, 'Search insights fetched successfully', insights);
});

export const getGrowthAnalytics = asyncHandler(async (_req, res) => {
  const analytics = await analyticsService.getGrowthAnalytics();
  sendSuccess(res, 'Growth analytics fetched successfully', analytics);
});

export const listPromotions = asyncHandler(async (_req, res) => {
  const items = await promotionService.listPromotions();
  sendSuccess(res, 'Promotions fetched successfully', { items });
});

export const createPromotion = asyncHandler(async (req, res) => {
  const item = await promotionService.createPromotion(req.body);
  sendSuccess(res, 'Promotion created successfully', item, 201);
});

export const updatePromotion = asyncHandler(async (req, res) => {
  const item = await promotionService.updatePromotion(String(req.params.id), req.body);
  if (!item) throw new AppError('Promotion not found.', 404, ErrorCode.NOT_FOUND);
  sendSuccess(res, 'Promotion updated successfully', item);
});

export const deletePromotion = asyncHandler(async (req, res) => {
  const item = await promotionService.deletePromotion(String(req.params.id));
  if (!item) throw new AppError('Promotion not found.', 404, ErrorCode.NOT_FOUND);
  sendSuccess(res, 'Promotion deleted successfully', null);
});

export const listServiceBundles = asyncHandler(async (_req, res) => {
  const items = await bundleService.listBundles();
  sendSuccess(res, 'Service bundles fetched successfully', { items });
});

export const createServiceBundle = asyncHandler(async (req, res) => {
  const item = await bundleService.createBundle(req.body);
  sendSuccess(res, 'Service bundle created successfully', item, 201);
});

export const updateServiceBundle = asyncHandler(async (req, res) => {
  const item = await bundleService.updateBundle(String(req.params.id), req.body);
  if (!item) throw new AppError('Service bundle not found.', 404, ErrorCode.NOT_FOUND);
  sendSuccess(res, 'Service bundle updated successfully', item);
});

export const deleteServiceBundle = asyncHandler(async (req, res) => {
  const item = await bundleService.deleteBundle(String(req.params.id));
  if (!item) throw new AppError('Service bundle not found.', 404, ErrorCode.NOT_FOUND);
  sendSuccess(res, 'Service bundle deleted successfully', null);
});

export const listFeatureFlags = asyncHandler(async (_req, res) => {
  const items = await featureFlagService.listFeatureFlags();
  sendSuccess(res, 'Feature flags fetched successfully', { items });
});

export const createFeatureFlag = asyncHandler(async (req, res) => {
  const item = await featureFlagService.createFeatureFlag(req.body);
  sendSuccess(res, 'Feature flag created successfully', item, 201);
});

export const updateFeatureFlag = asyncHandler(async (req, res) => {
  const item = await featureFlagService.updateFeatureFlag(String(req.params.id), req.body);
  if (!item) throw new AppError('Feature flag not found.', 404, ErrorCode.NOT_FOUND);
  sendSuccess(res, 'Feature flag updated successfully', item);
});

export const deleteFeatureFlag = asyncHandler(async (req, res) => {
  const item = await featureFlagService.deleteFeatureFlag(String(req.params.id));
  if (!item) throw new AppError('Feature flag not found.', 404, ErrorCode.NOT_FOUND);
  sendSuccess(res, 'Feature flag deleted successfully', null);
});

export const listExperiments = asyncHandler(async (_req, res) => {
  const items = await experimentService.listExperiments();
  sendSuccess(res, 'Experiments fetched successfully', { items });
});

export const createExperiment = asyncHandler(async (req, res) => {
  const item = await experimentService.createExperiment(req.body);
  sendSuccess(res, 'Experiment created successfully', item, 201);
});

export const updateExperiment = asyncHandler(async (req, res) => {
  const item = await experimentService.updateExperiment(String(req.params.id), req.body);
  if (!item) throw new AppError('Experiment not found.', 404, ErrorCode.NOT_FOUND);
  sendSuccess(res, 'Experiment updated successfully', item);
});

export const deleteExperiment = asyncHandler(async (req, res) => {
  const item = await experimentService.deleteExperiment(String(req.params.id));
  if (!item) throw new AppError('Experiment not found.', 404, ErrorCode.NOT_FOUND);
  sendSuccess(res, 'Experiment deleted successfully', null);
});

export const listCampaigns = asyncHandler(async (_req, res) => {
  const items = await campaignAdminService.listCampaigns();
  sendSuccess(res, 'Campaigns fetched successfully', { items });
});

export const createCampaign = asyncHandler(async (req, res) => {
  const item = await campaignAdminService.createCampaign(req.auth!.userId, req.body);
  sendSuccess(res, 'Campaign created successfully', item, 201);
});

export const updateCampaign = asyncHandler(async (req, res) => {
  const item = await campaignAdminService.updateCampaign(
    req.auth!.userId,
    String(req.params.id),
    req.body,
  );
  if (!item) throw new AppError('Campaign not found.', 404, ErrorCode.NOT_FOUND);
  sendSuccess(res, 'Campaign updated successfully', item);
});

export const deleteCampaign = asyncHandler(async (req, res) => {
  const item = await campaignAdminService.deleteCampaign(req.auth!.userId, String(req.params.id));
  if (!item) throw new AppError('Campaign not found.', 404, ErrorCode.NOT_FOUND);
  sendSuccess(res, 'Campaign deleted successfully', null);
});

export const listSearchSynonyms = asyncHandler(async (_req, res) => {
  const items = await campaignAdminService.listSearchSynonyms();
  sendSuccess(res, 'Search synonyms fetched successfully', { items });
});

export const createSearchSynonym = asyncHandler(async (req, res) => {
  const item = await campaignAdminService.createSearchSynonym(req.auth!.userId, req.body);
  sendSuccess(res, 'Search synonym created successfully', item, 201);
});

export const updateSearchSynonym = asyncHandler(async (req, res) => {
  const item = await campaignAdminService.updateSearchSynonym(
    req.auth!.userId,
    String(req.params.id),
    req.body,
  );
  if (!item) throw new AppError('Search synonym not found.', 404, ErrorCode.NOT_FOUND);
  sendSuccess(res, 'Search synonym updated successfully', item);
});

export const deleteSearchSynonym = asyncHandler(async (req, res) => {
  const item = await campaignAdminService.deleteSearchSynonym(req.auth!.userId, String(req.params.id));
  if (!item) throw new AppError('Search synonym not found.', 404, ErrorCode.NOT_FOUND);
  sendSuccess(res, 'Search synonym deleted successfully', null);
});

export const listSeasonalRules = asyncHandler(async (_req, res) => {
  const items = await campaignAdminService.listSeasonalRules();
  sendSuccess(res, 'Seasonal rules fetched successfully', { items });
});

export const createSeasonalRule = asyncHandler(async (req, res) => {
  const item = await campaignAdminService.createSeasonalRule(req.auth!.userId, req.body);
  sendSuccess(res, 'Seasonal rule created successfully', item, 201);
});

export const updateSeasonalRule = asyncHandler(async (req, res) => {
  const item = await campaignAdminService.updateSeasonalRule(
    req.auth!.userId,
    String(req.params.id),
    req.body,
  );
  if (!item) throw new AppError('Seasonal rule not found.', 404, ErrorCode.NOT_FOUND);
  sendSuccess(res, 'Seasonal rule updated successfully', item);
});

export const deleteSeasonalRule = asyncHandler(async (req, res) => {
  const item = await campaignAdminService.deleteSeasonalRule(req.auth!.userId, String(req.params.id));
  if (!item) throw new AppError('Seasonal rule not found.', 404, ErrorCode.NOT_FOUND);
  sendSuccess(res, 'Seasonal rule deleted successfully', null);
});

export const previewCampaignAudience = asyncHandler(async (req, res) => {
  const preview = await campaignAdminService.previewCampaignAudience(String(req.params.id));
  sendSuccess(res, 'Campaign audience preview fetched successfully', preview);
});
