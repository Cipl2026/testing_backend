import * as operationalService from '@/modules/provider-quality/operational-signal.service.js';
import * as performanceService from '@/modules/provider-quality/performance.service.js';
import * as skillService from '@/modules/provider-quality/skill.service.js';
import * as verificationService from '@/modules/provider-quality/verification.service.js';
import { asyncHandler } from '@/utils/asyncHandler.js';
import { sendSuccess } from '@/utils/apiResponse.js';
import { AppError } from '@/utils/AppError.js';
import { ErrorCode } from '@ghaarfix/shared-types';

export const listVerifications = asyncHandler(async (req, res) => {
  const items = await verificationService.listProviderVerifications(req.auth!.userId);
  sendSuccess(res, 'Verifications fetched successfully', { items });
});

export const submitVerification = asyncHandler(async (req, res) => {
  const data = await verificationService.submitProviderVerification(
    req.auth!.userId,
    req.body.type,
    req.body.metadata,
  );
  sendSuccess(res, 'Verification submitted successfully', data, 201);
});

export const uploadVerificationDocument = asyncHandler(async (req, res) => {
  const file = req.file;
  if (!file) throw new AppError('File required.', 400, ErrorCode.VALIDATION_ERROR);
  const data = await verificationService.uploadVerificationDocument(
    req.auth!.userId,
    String(req.params.id),
    String(req.body.documentType ?? 'GENERIC'),
    file,
  );
  sendSuccess(res, 'Document uploaded successfully', data, 201);
});

export const listSkills = asyncHandler(async (req, res) => {
  const items = await skillService.listProviderSkills(req.auth!.userId);
  sendSuccess(res, 'Skills fetched successfully', { items });
});

export const submitSkill = asyncHandler(async (req, res) => {
  const data = await skillService.submitProviderSkill(req.auth!.userId, req.body, req.file);
  sendSuccess(res, 'Skill submitted successfully', data, 201);
});

export const getPerformance = asyncHandler(async (req, res) => {
  const data = await performanceService.getProviderPerformanceDashboard(req.auth!.userId);
  sendSuccess(res, 'Performance fetched successfully', data);
});

export const adminListVerifications = asyncHandler(async (req, res) => {
  const items = await verificationService.adminListVerifications(req.query as never);
  sendSuccess(res, 'Verifications fetched successfully', { items });
});

export const adminReviewVerification = asyncHandler(async (req, res) => {
  const data = await verificationService.adminReviewVerification(
    req.auth!.userId,
    String(req.params.id),
    req.body,
  );
  sendSuccess(res, 'Verification reviewed successfully', data);
});

export const adminUpdateSkill = asyncHandler(async (req, res) => {
  const data = await skillService.adminUpdateSkillStatus(req.auth!.userId, String(req.params.id), req.body);
  sendSuccess(res, 'Skill updated successfully', data);
});

export const adminGetProviderPerformance = asyncHandler(async (req, res) => {
  const data = await performanceService.adminGetProviderPerformance(String(req.params.providerId));
  sendSuccess(res, 'Provider performance fetched successfully', data);
});

export const adminListSignals = asyncHandler(async (req, res) => {
  const items = await operationalService.adminListSignals(req.query as never);
  sendSuccess(res, 'Operational signals fetched successfully', { items });
});

export const adminUpdateSignal = asyncHandler(async (req, res) => {
  const data = await operationalService.adminUpdateSignal(req.auth!.userId, String(req.params.id), req.body);
  sendSuccess(res, 'Signal updated successfully', data);
});

export const adminOperationsDashboard = asyncHandler(async (_req, res) => {
  const data = await operationalService.getOperationsDashboard();
  sendSuccess(res, 'Operations dashboard fetched successfully', data);
});

export const adminServiceQuality = asyncHandler(async (req, res) => {
  const data = await performanceService.getServiceQualityAnalytics(req.query as never);
  sendSuccess(res, 'Service quality analytics fetched successfully', data);
});
