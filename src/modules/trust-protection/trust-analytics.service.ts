import {
  ProtectionClaimStatus,
  QualityInspectionResult,
} from '@ghaarfix/shared-types';
import {
  GuaranteeSnapshot,
  PartApproval,
  ProviderQualityScore,
  QualityInspection,
  RevisitBookingContext,
  ServiceProtectionClaim,
} from '@/models/TrustProtection.js';
import { PartApprovalStatus } from '@ghaarfix/shared-types';

export async function getTrustOverview() {
  const [
    openClaims,
    resolvedClaims,
    activeGuarantees,
    revisits,
    inspections,
    atRiskProviders,
  ] = await Promise.all([
    ServiceProtectionClaim.countDocuments({
      status: { $in: [ProtectionClaimStatus.SUBMITTED, ProtectionClaimStatus.UNDER_REVIEW] },
    }),
    ServiceProtectionClaim.countDocuments({ status: ProtectionClaimStatus.RESOLVED }),
    GuaranteeSnapshot.countDocuments({ coverageEndsAt: { $gte: new Date() } }),
    RevisitBookingContext.countDocuments({}),
    QualityInspection.countDocuments({ status: 'COMPLETED' }),
    ProviderQualityScore.countDocuments({ status: { $in: ['AT_RISK', 'RESTRICTED'] } }),
  ]);

  return {
    openClaims,
    resolvedClaims,
    activeGuarantees,
    revisitRequests: revisits,
    completedInspections: inspections,
    atRiskProviders,
  };
}

export async function getTrustAnalytics() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [
    claimsTotal,
    repeatIssueClaims,
    revisits,
    refunds,
    inspections,
    inspectionPasses,
    partApprovals,
    partApproved,
    slaBreaches,
  ] = await Promise.all([
    ServiceProtectionClaim.countDocuments({ createdAt: { $gte: thirtyDaysAgo } }),
    ServiceProtectionClaim.countDocuments({
      createdAt: { $gte: thirtyDaysAgo },
      repeatIssueDetected: true,
    }),
    RevisitBookingContext.countDocuments({ createdAt: { $gte: thirtyDaysAgo } }),
    ServiceProtectionClaim.countDocuments({
      createdAt: { $gte: thirtyDaysAgo },
      resolution: { $in: ['REFUND', 'PARTIAL_REFUND'] },
    }),
    QualityInspection.countDocuments({ createdAt: { $gte: thirtyDaysAgo } }),
    QualityInspection.countDocuments({
      createdAt: { $gte: thirtyDaysAgo },
      result: QualityInspectionResult.PASS,
    }),
    PartApproval.countDocuments({ createdAt: { $gte: thirtyDaysAgo } }),
    PartApproval.countDocuments({
      createdAt: { $gte: thirtyDaysAgo },
      status: PartApprovalStatus.APPROVED,
    }),
    ServiceProtectionClaim.countDocuments({
      slaDueAt: { $lt: new Date() },
      status: { $nin: [ProtectionClaimStatus.RESOLVED, ProtectionClaimStatus.CLOSED, ProtectionClaimStatus.REJECTED] },
    }),
  ]);

  const qualityDistribution = await ProviderQualityScore.aggregate([
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ]);

  return {
    periodDays: 30,
    claimRate: claimsTotal,
    repeatIssueRate: repeatIssueClaims,
    revisitRate: revisits,
    refundRate: refunds,
    inspectionPassRate: inspections > 0 ? inspectionPasses / inspections : null,
    partApprovalRate: partApprovals > 0 ? partApproved / partApprovals : null,
    slaBreaches,
    providerQualityDistribution: qualityDistribution,
  };
}

export async function listProviderQualityScores(limit = 50) {
  const items = await ProviderQualityScore.find().sort({ overallScore: -1 }).limit(limit);
  return items.map((s) => ({
    providerId: s.providerId.toString(),
    overallScore: s.overallScore,
    status: s.status,
    sampleSize: s.sampleSize,
    recommendedActions: s.recommendedActions,
    dimensions: {
      reliability: s.reliabilityScore,
      quality: s.qualityScore,
      compliance: s.complianceScore,
      customerProtection: s.customerProtectionScore,
    },
  }));
}
