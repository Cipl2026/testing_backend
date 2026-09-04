import * as guaranteeSnapshot from '@/modules/trust-protection/guarantee-snapshot.service.js';
import * as claimService from '@/modules/trust-protection/protection-claim.service.js';
import * as revisitService from '@/modules/trust-protection/revisit.service.js';
import * as partService from '@/modules/trust-protection/part-approval.service.js';
import * as checklistService from '@/modules/trust-protection/quality-checklist.service.js';
import { getProviderTrustInfo } from '@/modules/trust-protection/certification.service.js';
import { asyncHandler } from '@/utils/asyncHandler.js';
import { sendSuccess } from '@/utils/apiResponse.js';

export const getBookingGuarantee = asyncHandler(async (req, res) => {
  const data = await guaranteeSnapshot.getBookingGuarantee(
    String(req.params.bookingId),
    req.auth!.userId,
  );
  sendSuccess(res, 'Booking guarantee', data);
});

export const createClaim = asyncHandler(async (req, res) => {
  const data = await claimService.createProtectionClaim(
    req.auth!.userId,
    String(req.params.bookingId),
    req.body,
  );
  sendSuccess(res, 'Claim submitted', data, 201);
});

export const listClaims = asyncHandler(async (req, res) => {
  const data = await claimService.listCustomerClaims(req.auth!.userId);
  sendSuccess(res, 'Claims', { items: data });
});

export const getClaim = asyncHandler(async (req, res) => {
  const data = await claimService.getClaimForCustomer(String(req.params.id), req.auth!.userId);
  sendSuccess(res, 'Claim detail', data);
});

export const addClaimEvidence = asyncHandler(async (req, res) => {
  const data = await claimService.addClaimEvidence(
    String(req.params.id),
    req.auth!.userId,
    req.body,
  );
  sendSuccess(res, 'Evidence added', data);
});

export const requestRevisit = asyncHandler(async (req, res) => {
  const data = await revisitService.requestRevisit(
    req.auth!.userId,
    String(req.params.bookingId),
    req.body,
  );
  sendSuccess(res, 'Revisit requested', data, 201);
});

export const approvePart = asyncHandler(async (req, res) => {
  const data = await partService.approvePart(req.auth!.userId, String(req.params.id));
  sendSuccess(res, 'Part approved', data);
});

export const rejectPart = asyncHandler(async (req, res) => {
  const data = await partService.rejectPart(req.auth!.userId, String(req.params.id));
  sendSuccess(res, 'Part rejected', data);
});

export const getProviderTrust = asyncHandler(async (req, res) => {
  const data = await getProviderTrustInfo(String(req.params.providerId));
  sendSuccess(res, 'Provider trust info', data);
});

export const getBookingChecklist = asyncHandler(async (req, res) => {
  const data = await checklistService.getChecklistSnapshot(String(req.params.bookingId));
  sendSuccess(res, 'Checklist snapshot', data);
});
