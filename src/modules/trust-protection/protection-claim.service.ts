import {
  ClaimResolutionType,
  ErrorCode,
  ProtectionClaimStatus,
  ProtectionClaimType,
} from '@ghaarfix/shared-types';
import { ServiceProtectionClaim } from '@/models/TrustProtection.js';
import { Booking } from '@/models/Booking.js';
import { AppError } from '@/utils/AppError.js';
import { generateClaimNumber } from '@/utils/invoiceNumber.js';
import { assertClaimEligible } from '@/modules/trust-protection/guarantee-eligibility.service.js';
import { detectRepeatIssue } from '@/modules/trust-protection/repeat-issue.service.js';
import { AdminAuditLog } from '@/models/AdminAuditLog.js';
import { DamageAssessment } from '@/models/TrustProtection.js';

const SLA_HOURS = 72;

export async function createProtectionClaim(
  customerId: string,
  bookingId: string,
  input: {
    type: ProtectionClaimType;
    description: string;
    requestedResolution?: ClaimResolutionType;
    idempotencyKey?: string;
  },
) {
  if (input.idempotencyKey) {
    const existing = await ServiceProtectionClaim.findOne({ idempotencyKey: input.idempotencyKey });
    if (existing) return serializeClaim(existing);
  }

  await assertClaimEligible(bookingId, customerId, input.type);

  const booking = await Booking.findOne({ _id: bookingId, customerId });
  if (!booking) throw new AppError('Booking not found.', 404, ErrorCode.NOT_FOUND);

  const repeatSignal = await detectRepeatIssue({
    bookingId,
    customerId,
    description: input.description,
    assetId: booking.assetId?.toString(),
  });

  const claim = await ServiceProtectionClaim.create({
    claimNumber: generateClaimNumber(),
    bookingId,
    customerId,
    providerId: booking.providerId,
    type: input.type,
    description: input.description,
    status: ProtectionClaimStatus.SUBMITTED,
    requestedResolution: input.requestedResolution,
    repeatIssueDetected: repeatSignal.detected,
    idempotencyKey: input.idempotencyKey,
    slaDueAt: new Date(Date.now() + SLA_HOURS * 60 * 60 * 1000),
  });

  if (input.type === ProtectionClaimType.DAMAGE) {
    await DamageAssessment.create({
      claimId: claim._id,
      bookingId,
      description: input.description,
      customerEvidence: [],
      status: 'PENDING',
    });
  }

  return serializeClaim(claim);
}

export async function listCustomerClaims(customerId: string) {
  const items = await ServiceProtectionClaim.find({ customerId }).sort({ createdAt: -1 });
  return items.map(serializeClaim);
}

export async function getClaimForCustomer(claimId: string, customerId: string) {
  const claim = await ServiceProtectionClaim.findOne({ _id: claimId, customerId });
  if (!claim) throw new AppError('Claim not found.', 404, ErrorCode.NOT_FOUND);
  return serializeClaim(claim);
}

export async function addClaimEvidence(
  claimId: string,
  customerId: string,
  evidence: { fileKey: string; fileUrl: string; mimeType: string },
) {
  const claim = await ServiceProtectionClaim.findOne({ _id: claimId, customerId });
  if (!claim) throw new AppError('Claim not found.', 404, ErrorCode.NOT_FOUND);

  claim.evidence.push({ ...evidence, uploadedAt: new Date() });
  if (claim.status === ProtectionClaimStatus.AWAITING_CUSTOMER) {
    claim.status = ProtectionClaimStatus.UNDER_REVIEW;
  }
  await claim.save();
  return serializeClaim(claim);
}

export async function listAdminClaims(query?: { status?: ProtectionClaimStatus; limit?: number }) {
  const filter: Record<string, unknown> = {};
  if (query?.status) filter.status = query.status;
  const items = await ServiceProtectionClaim.find(filter)
    .sort({ createdAt: -1 })
    .limit(query?.limit ?? 50);
  return items.map(serializeClaim);
}

export async function updateClaimStatus(
  claimId: string,
  adminId: string,
  input: {
    status: ProtectionClaimStatus;
    resolution?: ClaimResolutionType;
    resolutionNotes?: string;
    internalNotes?: string;
  },
) {
  const claim = await ServiceProtectionClaim.findById(claimId);
  if (!claim) throw new AppError('Claim not found.', 404, ErrorCode.NOT_FOUND);

  const before = { status: claim.status, resolution: claim.resolution };
  claim.status = input.status;
  if (input.resolution) claim.resolution = input.resolution;
  if (input.resolutionNotes) claim.resolutionNotes = input.resolutionNotes;
  if (input.internalNotes) claim.internalNotes = input.internalNotes;
  claim.reviewedBy = adminId as never;
  if ([ProtectionClaimStatus.RESOLVED, ProtectionClaimStatus.CLOSED].includes(input.status)) {
    claim.resolvedAt = new Date();
  }
  await claim.save();

  await AdminAuditLog.create({
    adminId,
    action: 'CLAIM_STATUS_UPDATE',
    entityType: 'ServiceProtectionClaim',
    entityId: claim._id,
    before,
    after: { status: claim.status, resolution: claim.resolution },
    reason: input.resolutionNotes ?? 'Claim review action',
  });

  return serializeClaim(claim);
}

export async function providerRespondToClaim(
  providerId: string,
  claimId: string,
  response: string,
) {
  const claim = await ServiceProtectionClaim.findOne({ _id: claimId, providerId });
  if (!claim) throw new AppError('Claim not found.', 404, ErrorCode.NOT_FOUND);

  claim.providerResponse = response;
  if (claim.status === ProtectionClaimStatus.AWAITING_PROVIDER) {
    claim.status = ProtectionClaimStatus.UNDER_REVIEW;
  }
  await claim.save();
  return serializeClaim(claim);
}

function serializeClaim(claim: InstanceType<typeof ServiceProtectionClaim>) {
  return {
    id: claim._id.toString(),
    claimNumber: claim.claimNumber,
    bookingId: claim.bookingId.toString(),
    customerId: claim.customerId.toString(),
    providerId: claim.providerId?.toString(),
    type: claim.type,
    description: claim.description,
    evidence: claim.evidence,
    status: claim.status,
    requestedResolution: claim.requestedResolution,
    resolution: claim.resolution,
    resolutionNotes: claim.resolutionNotes,
    providerResponse: claim.providerResponse,
    repeatIssueDetected: claim.repeatIssueDetected,
    slaDueAt: claim.slaDueAt,
    resolvedAt: claim.resolvedAt,
    createdAt: claim.createdAt,
    updatedAt: claim.updatedAt,
  };
}
