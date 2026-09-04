import * as adminService from '@/modules/customer-lifecycle/growth-admin.service.js';
import * as lifecycleService from '@/modules/customer-lifecycle/lifecycle.service.js';
import * as retentionService from '@/modules/customer-lifecycle/retention.service.js';
import * as churnService from '@/modules/customer-lifecycle/churn.service.js';
import * as campaignService from '@/modules/customer-lifecycle/campaign-delivery.service.js';
import * as attributionService from '@/modules/customer-lifecycle/attribution.service.js';
import * as experimentService from '@/modules/customer-lifecycle/experiment-assignment.service.js';
import { ServiceRecommendation } from '@/models/CustomerLifecycle.js';
import { asyncHandler } from '@/utils/asyncHandler.js';
import { sendSuccess } from '@/utils/apiResponse.js';

export const getOverview = asyncHandler(async (_req, res) => {
  const data = await adminService.getGrowthOverview();
  sendSuccess(res, 'Growth overview', data);
});

export const getLifecycle = asyncHandler(async (_req, res) => {
  const data = await lifecycleService.getLifecycleOverview();
  sendSuccess(res, 'Lifecycle distribution', data);
});

export const getRetention = asyncHandler(async (_req, res) => {
  const data = await retentionService.getRetentionOverview();
  sendSuccess(res, 'Retention analytics', data);
});

export const getCohorts = asyncHandler(async (_req, res) => {
  const data = await retentionService.getRetentionOverview();
  sendSuccess(res, 'Cohort analysis', { items: data.cohorts });
});

export const getChurn = asyncHandler(async (req, res) => {
  const data = await churnService.listChurnPredictions(req.query as never);
  sendSuccess(res, 'Churn predictions', data);
});

export const getRecommendations = asyncHandler(async (_req, res) => {
  const items = await ServiceRecommendation.find({ status: 'ACTIVE' })
    .sort({ createdAt: -1 })
    .limit(50);
  sendSuccess(res, 'Active recommendations', { items });
});

export const listCampaigns = asyncHandler(async (req, res) => {
  const data = await campaignService.listCampaigns(req.query as never);
  sendSuccess(res, 'Campaigns', data);
});

export const createCampaign = asyncHandler(async (req, res) => {
  const campaign = await campaignService.createCampaign(req.body);
  sendSuccess(res, 'Campaign created', campaign, 201);
});

export const updateCampaign = asyncHandler(async (req, res) => {
  const campaign = await campaignService.updateCampaign(String(req.params.id), req.body);
  sendSuccess(res, 'Campaign updated', campaign);
});

export const previewCampaign = asyncHandler(async (req, res) => {
  const data = await campaignService.previewCampaignAudience(String(req.params.id));
  sendSuccess(res, 'Campaign preview', data);
});

export const launchCampaign = asyncHandler(async (req, res) => {
  const campaign = await campaignService.launchCampaign(String(req.params.id));
  sendSuccess(res, 'Campaign launched', campaign);
});

export const pauseCampaign = asyncHandler(async (req, res) => {
  const campaign = await campaignService.pauseCampaign(String(req.params.id));
  sendSuccess(res, 'Campaign paused', campaign);
});

export const getExperimentResults = asyncHandler(async (req, res) => {
  const data = await experimentService.getExperimentResults(String(req.params.id));
  sendSuccess(res, 'Experiment results', data);
});

export const getReferrals = asyncHandler(async (_req, res) => {
  const data = await adminService.getReferralIntelligence();
  sendSuccess(res, 'Referral intelligence', data);
});

export const getLoyalty = asyncHandler(async (_req, res) => {
  const data = await adminService.getLoyaltyAdminSummary();
  sendSuccess(res, 'Loyalty summary', data);
});

export const getAttribution = asyncHandler(async (req, res) => {
  const data = await attributionService.getAttributionSummary(req.query.model as never);
  sendSuccess(res, 'Attribution', data);
});
