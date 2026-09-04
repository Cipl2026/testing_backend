import {
  ServiceGuaranteePolicy,
  GuaranteeSnapshot,
  ServiceProtectionClaim,
  ServiceArrivalEvidence,
  ServiceQualityChecklist,
  ChecklistSnapshot,
  PartApproval,
  DamageAssessment,
  QualityInspection,
  ProviderQualityScore,
  ProviderQualityImprovementPlan,
  ProviderServiceCertification,
  RevisitBookingContext,
  BookingRefund,
} from '@/models/TrustProtection.js';
import { FeatureFlag } from '@/models/FeatureFlag.js';
import { FeatureFlagKey } from '@ghaarfix/shared-types';
import {
  ClaimResolutionType,
  GuaranteePolicyStatus,
  ProtectionClaimType,
} from '@ghaarfix/shared-types';
import { logger } from '@/utils/logger.js';

export async function runPhase18Migrations() {
  await Promise.all([
    ServiceGuaranteePolicy.syncIndexes(),
    GuaranteeSnapshot.syncIndexes(),
    ServiceProtectionClaim.syncIndexes(),
    ServiceArrivalEvidence.syncIndexes(),
    ServiceQualityChecklist.syncIndexes(),
    ChecklistSnapshot.syncIndexes(),
    PartApproval.syncIndexes(),
    DamageAssessment.syncIndexes(),
    QualityInspection.syncIndexes(),
    ProviderQualityScore.syncIndexes(),
    ProviderQualityImprovementPlan.syncIndexes(),
    ProviderServiceCertification.syncIndexes(),
    RevisitBookingContext.syncIndexes(),
    BookingRefund.syncIndexes(),
  ]);

  const policyCount = await ServiceGuaranteePolicy.countDocuments();
  if (policyCount === 0) {
    await ServiceGuaranteePolicy.create({
      version: 1,
      coverageDays: 30,
      coveredIssueTypes: [
        ProtectionClaimType.REPEAT_ISSUE,
        ProtectionClaimType.POOR_QUALITY,
        ProtectionClaimType.PART_FAILURE,
      ],
      exclusions: ['customer misuse', 'pre-existing damage', 'unauthorized modifications'],
      maxClaims: 2,
      resolutionOptions: [
        ClaimResolutionType.FREE_REVISIT,
        ClaimResolutionType.REWORK,
        ClaimResolutionType.PARTIAL_REFUND,
      ],
      status: GuaranteePolicyStatus.ACTIVE,
    });
    logger.info('Phase 18 default guarantee policy seeded');
  }

  await FeatureFlag.findOneAndUpdate(
    { key: FeatureFlagKey.ENABLE_TRUST_PROTECTION },
    { key: FeatureFlagKey.ENABLE_TRUST_PROTECTION, enabled: true, rules: [{ type: 'global' }] },
    { upsert: true },
  );

  logger.info('Phase 18 trust protection indexes ensured');
}
