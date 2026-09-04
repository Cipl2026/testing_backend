import * as policyService from '@/modules/trust-protection/guarantee-policy.service.js';
import * as claimService from '@/modules/trust-protection/protection-claim.service.js';
import * as analyticsService from '@/modules/trust-protection/trust-analytics.service.js';
import * as inspectionService from '@/modules/trust-protection/provider-quality-score.service.js';
import * as improvementService from '@/modules/trust-protection/improvement-plan.service.js';
import * as certService from '@/modules/trust-protection/certification.service.js';
import { processBookingRefund } from '@/modules/trust-protection/booking-refund.service.js';
import { asyncHandler } from '@/utils/asyncHandler.js';
import { sendSuccess } from '@/utils/apiResponse.js';

export const getOverview = asyncHandler(async (_req, res) => {
  const data = await analyticsService.getTrustOverview();
  sendSuccess(res, 'Trust overview', data);
});

export const getAnalytics = asyncHandler(async (_req, res) => {
  const data = await analyticsService.getTrustAnalytics();
  sendSuccess(res, 'Trust analytics', data);
});

export const listPolicies = asyncHandler(async (req, res) => {
  const data = await policyService.listGuaranteePolicies(req.query as never);
  sendSuccess(res, 'Guarantee policies', { items: data });
});

export const createPolicy = asyncHandler(async (req, res) => {
  const policy = await policyService.createGuaranteePolicy(req.body);
  sendSuccess(res, 'Policy created', { id: policy._id.toString() }, 201);
});

export const updatePolicy = asyncHandler(async (req, res) => {
  const policy = await policyService.updateGuaranteePolicy(String(req.params.id), req.body);
  sendSuccess(res, 'Policy updated', policy);
});

export const activatePolicy = asyncHandler(async (req, res) => {
  const policy = await policyService.activateGuaranteePolicy(String(req.params.id));
  sendSuccess(res, 'Policy activated', policy);
});

export const listClaims = asyncHandler(async (req, res) => {
  const data = await claimService.listAdminClaims(req.query as never);
  sendSuccess(res, 'Claims', { items: data });
});

export const updateClaim = asyncHandler(async (req, res) => {
  const data = await claimService.updateClaimStatus(
    String(req.params.id),
    req.auth!.userId,
    req.body,
  );
  sendSuccess(res, 'Claim updated', data);
});

export const listInspections = asyncHandler(async (req, res) => {
  const items = await inspectionService.listInspections(req.query as never);
  sendSuccess(res, 'Inspections', { items });
});

export const createInspection = asyncHandler(async (req, res) => {
  const inspection = await inspectionService.createQualityInspection({
    ...req.body,
    inspectorId: req.auth!.userId,
  });
  sendSuccess(res, 'Inspection scheduled', inspection, 201);
});

export const completeInspection = asyncHandler(async (req, res) => {
  const inspection = await inspectionService.completeInspection(String(req.params.id), req.body);
  sendSuccess(res, 'Inspection completed', inspection);
});

export const listProviderQuality = asyncHandler(async (req, res) => {
  const items = await analyticsService.listProviderQualityScores(
    req.query.limit ? Number(req.query.limit) : 50,
  );
  sendSuccess(res, 'Provider quality', { items });
});

export const createImprovementPlan = asyncHandler(async (req, res) => {
  const plan = await improvementService.createImprovementPlan(
    req.auth!.userId,
    String(req.params.id),
    { ...req.body, deadline: new Date(req.body.deadline) },
  );
  sendSuccess(res, 'Improvement plan created', plan, 201);
});

export const grantCertification = asyncHandler(async (req, res) => {
  const cert = await certService.grantCertification(req.auth!.userId, {
    ...req.body,
    expiresAt: req.body.expiresAt ? new Date(req.body.expiresAt) : undefined,
  });
  sendSuccess(res, 'Certification granted', cert, 201);
});

export const revokeCertification = asyncHandler(async (req, res) => {
  const cert = await certService.revokeCertification(
    req.auth!.userId,
    String(req.params.id),
    req.body.reason ?? 'Revoked by admin',
  );
  sendSuccess(res, 'Certification revoked', cert);
});

export const processRefund = asyncHandler(async (req, res) => {
  const refund = await processBookingRefund({
    bookingId: String(req.params.bookingId),
    claimId: req.body.claimId,
    amount: req.body.amount,
    idempotencyKey: req.body.idempotencyKey,
    processedBy: req.auth!.userId,
  });
  sendSuccess(res, 'Refund processed', refund);
});
