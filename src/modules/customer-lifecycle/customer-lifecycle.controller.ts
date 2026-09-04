import * as lifecycleService from '@/modules/customer-lifecycle/lifecycle.service.js';
import * as consentService from '@/modules/customer-lifecycle/consent.service.js';
import * as recommendationService from '@/modules/customer-lifecycle/service-recommendation.service.js';
import * as loyaltyService from '@/modules/customer-lifecycle/loyalty.service.js';
import * as adminService from '@/modules/customer-lifecycle/growth-admin.service.js';
import * as personalizationService from '@/modules/customer-lifecycle/personalization.service.js';
import { asyncHandler } from '@/utils/asyncHandler.js';
import { sendSuccess } from '@/utils/apiResponse.js';
import { AppError } from '@/utils/AppError.js';
import { ErrorCode } from '@ghaarfix/shared-types';

export const getLifecycle = asyncHandler(async (req, res) => {
  const data = await lifecycleService.getCustomerLifecycle(req.auth!.userId);
  sendSuccess(res, 'Customer lifecycle', data);
});

export const getRecommendations = asyncHandler(async (req, res) => {
  const items = await recommendationService.listServiceRecommendations(req.auth!.userId);
  sendSuccess(res, 'Recommendations', { items });
});

export const dismissRecommendation = asyncHandler(async (req, res) => {
  const rec = await recommendationService.dismissServiceRecommendation(
    req.auth!.userId,
    String(req.params.id),
  );
  if (!rec) throw new AppError('Recommendation not found.', 404, ErrorCode.NOT_FOUND);
  sendSuccess(res, 'Recommendation dismissed', rec);
});

export const getMaintenance = asyncHandler(async (req, res) => {
  const { listActiveRecommendations } = await import(
    '@/modules/discovery-growth/recommendation.service.js'
  );
  const items = await listActiveRecommendations(req.auth!.userId);
  sendSuccess(res, 'Maintenance reminders', { items });
});

export const getLoyalty = asyncHandler(async (req, res) => {
  const data = await loyaltyService.getLoyaltySummary(req.auth!.userId);
  sendSuccess(res, 'Loyalty account', data);
});

export const getLoyaltyHistory = asyncHandler(async (req, res) => {
  const data = await loyaltyService.getLoyaltySummary(req.auth!.userId);
  sendSuccess(res, 'Loyalty history', { items: data.history });
});

export const getRewards = asyncHandler(async (_req, res) => {
  const items = await loyaltyService.listAvailableRewards();
  sendSuccess(res, 'Rewards catalog', { items });
});

export const redeemReward = asyncHandler(async (req, res) => {
  const tx = await loyaltyService.redeemLoyaltyReward(
    req.auth!.userId,
    String(req.params.id),
    req.body.idempotencyKey,
  );
  sendSuccess(res, 'Reward redeemed', tx);
});

export const getReferral = asyncHandler(async (req, res) => {
  const data = await adminService.getCustomerReferralSummary(req.auth!.userId);
  sendSuccess(res, 'Referral program', data);
});

export const getCommunicationPreferences = asyncHandler(async (req, res) => {
  const data = await consentService.getOrCreateConsent(req.auth!.userId);
  sendSuccess(res, 'Communication preferences', data);
});

export const updateCommunicationPreferences = asyncHandler(async (req, res) => {
  const data = await consentService.updateConsent(req.auth!.userId, req.body);
  sendSuccess(res, 'Preferences updated', data);
});

export const getForYou = asyncHandler(async (req, res) => {
  const data = await personalizationService.personalizeForCustomer(req.auth!.userId);
  sendSuccess(res, 'For you', data);
});
