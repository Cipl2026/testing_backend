import * as checklistService from '@/modules/trust-protection/quality-checklist.service.js';
import * as partService from '@/modules/trust-protection/part-approval.service.js';
import * as claimService from '@/modules/trust-protection/protection-claim.service.js';
import { getProviderQualityForProvider } from '@/modules/trust-protection/provider-quality-score.service.js';
import { getActiveImprovementPlan } from '@/modules/trust-protection/improvement-plan.service.js';
import { listProviderCertifications } from '@/modules/trust-protection/certification.service.js';
import { uploadServiceEvidence } from '@/modules/evidence/evidence.service.js';
import { asyncHandler } from '@/utils/asyncHandler.js';
import { sendSuccess } from '@/utils/apiResponse.js';

export const uploadEvidence = asyncHandler(async (req, res) => {
  const file = req.file;
  if (!file) {
    sendSuccess(res, 'No file', null, 400);
    return;
  }
  const data = await uploadServiceEvidence(req.auth!.userId, String(req.params.bookingId), {
    type: req.body.type,
    buffer: file.buffer,
    mimeType: file.mimetype,
    caption: req.body.caption,
    capturedAt: req.body.capturedAt,
  });
  sendSuccess(res, 'Evidence uploaded', data, 201);
});

export const submitChecklist = asyncHandler(async (req, res) => {
  const data = await checklistService.submitChecklistCompletion(
    req.auth!.userId,
    String(req.params.bookingId),
    req.body.items,
  );
  sendSuccess(res, 'Checklist submitted', data);
});

export const requestPartApproval = asyncHandler(async (req, res) => {
  const data = await partService.requestPartApproval(
    req.auth!.userId,
    String(req.params.bookingId),
    req.body,
  );
  sendSuccess(res, 'Part approval requested', data, 201);
});

export const getQuality = asyncHandler(async (req, res) => {
  const data = await getProviderQualityForProvider(req.auth!.userId);
  sendSuccess(res, 'Provider quality', data);
});

export const getImprovementPlan = asyncHandler(async (req, res) => {
  const data = await getActiveImprovementPlan(req.auth!.userId);
  sendSuccess(res, 'Improvement plan', data);
});

export const getCertifications = asyncHandler(async (req, res) => {
  const items = await listProviderCertifications(req.auth!.userId);
  sendSuccess(res, 'Certifications', {
    items: items.map((c) => ({
      id: c._id.toString(),
      serviceId: c.serviceId.toString(),
      level: c.level,
      status: c.status,
      expiresAt: c.expiresAt,
    })),
  });
});

export const respondToClaim = asyncHandler(async (req, res) => {
  const data = await claimService.providerRespondToClaim(
    req.auth!.userId,
    String(req.params.id),
    req.body.response,
  );
  sendSuccess(res, 'Response submitted', data);
});

export const listPartApprovals = asyncHandler(async (req, res) => {
  const items = await partService.listBookingPartApprovals(String(req.params.bookingId));
  sendSuccess(res, 'Part approvals', { items });
});
