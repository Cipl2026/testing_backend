import * as issueService from '@/modules/intelligence/issue-classification/issue-classification.service.js';
import * as maintenanceService from '@/modules/intelligence/predictive-maintenance/predictive-maintenance.service.js';
import * as assistantService from '@/modules/intelligence/support-assistant/assistant.service.js';
import { asyncHandler } from '@/utils/asyncHandler.js';
import { sendSuccess } from '@/utils/apiResponse.js';

export const analyzeIssue = asyncHandler(async (req, res) => {
  const result = await issueService.analyzeIssueText(req.auth!.userId, req.body);
  sendSuccess(res, 'Issue analyzed', result, 201);
});

export const getAnalysis = asyncHandler(async (req, res) => {
  const result = await issueService.getAnalysis(req.auth!.userId, String(req.params.id));
  sendSuccess(res, 'Analysis fetched', result);
});

export const submitAnalysisFeedback = asyncHandler(async (req, res) => {
  const result = await assistantService.submitFeedback(req.auth!.userId, {
    analysisId: String(req.params.id),
    ...req.body,
  });
  sendSuccess(res, 'Feedback recorded', result, 201);
});

export const getHomeRecommendations = asyncHandler(async (req, res) => {
  const items = await maintenanceService.getHomePredictiveMaintenance(
    req.auth!.userId,
    String(req.params.homeId),
  );
  sendSuccess(res, 'Recommendations fetched', { items });
});

export const getAssetRecommendations = asyncHandler(async (req, res) => {
  const item = await maintenanceService.getAssetPredictiveMaintenance(
    req.auth!.userId,
    String(req.params.assetId),
  );
  sendSuccess(res, 'Recommendation fetched', { item });
});

export const sendAssistantMessage = asyncHandler(async (req, res) => {
  const result = await assistantService.sendAssistantMessage(req.auth!.userId, req.body);
  sendSuccess(res, 'Assistant reply', result);
});

export const listAssistantConversations = asyncHandler(async (req, res) => {
  const items = await assistantService.listConversations(req.auth!.userId);
  sendSuccess(res, 'Conversations fetched', { items });
});

export const confirmAssistantAction = asyncHandler(async (req, res) => {
  const result = await assistantService.confirmAssistantAction(req.auth!.userId, req.body);
  sendSuccess(res, 'Action processed', result);
});
