import { ProtectionClaimStatus } from '@ghaarfix/shared-types';
import { ServiceProtectionClaim } from '@/models/TrustProtection.js';
import { captureGuaranteeSnapshot } from '@/modules/trust-protection/guarantee-snapshot.service.js';
import { calculateAllProviderScores } from '@/modules/trust-protection/provider-quality-score.service.js';
import { expireCertifications } from '@/modules/trust-protection/certification.service.js';
import { expireStalePartApprovals } from '@/modules/trust-protection/part-approval.service.js';
import { GuaranteeSnapshot } from '@/models/TrustProtection.js';
import { Booking } from '@/models/Booking.js';
import { BookingStatus } from '@ghaarfix/shared-types';
import { detectRepeatIssue } from '@/modules/trust-protection/repeat-issue.service.js';
import { logger } from '@/utils/logger.js';

export async function expireGuaranteeSnapshots(): Promise<number> {
  const expired = await GuaranteeSnapshot.countDocuments({ coverageEndsAt: { $lt: new Date() } });
  return expired;
}

export async function monitorClaimSla(): Promise<number> {
  const breached = await ServiceProtectionClaim.find({
    slaDueAt: { $lt: new Date() },
    status: {
      $in: [
        ProtectionClaimStatus.SUBMITTED,
        ProtectionClaimStatus.UNDER_REVIEW,
        ProtectionClaimStatus.AWAITING_CUSTOMER,
        ProtectionClaimStatus.AWAITING_PROVIDER,
      ],
    },
  });

  for (const claim of breached) {
    claim.internalNotes = `${claim.internalNotes ?? ''}\nSLA breach flagged ${new Date().toISOString()}`;
    await claim.save();
  }

  return breached.length;
}

export async function backfillGuaranteeSnapshots(): Promise<number> {
  const completed = await Booking.find({ status: BookingStatus.COMPLETED }).limit(20);
  let count = 0;
  for (const booking of completed) {
    const snap = await captureGuaranteeSnapshot(booking._id.toString());
    if (snap) count += 1;
  }
  return count;
}

export async function runPhase18Jobs() {
  const results = await Promise.allSettled([
    expireGuaranteeSnapshots(),
    monitorClaimSla(),
    calculateAllProviderScores(),
    expireCertifications(),
    expireStalePartApprovals(),
    backfillGuaranteeSnapshots(),
  ]);

  const summary = {
    expiredGuarantees: results[0].status === 'fulfilled' ? results[0].value : 0,
    slaBreaches: results[1].status === 'fulfilled' ? results[1].value : 0,
    qualityScores: results[2].status === 'fulfilled' ? results[2].value : 0,
    expiredCerts: results[3].status === 'fulfilled' ? results[3].value : 0,
    expiredParts: results[4].status === 'fulfilled' ? results[4].value : 0,
    guaranteeSnapshots: results[5].status === 'fulfilled' ? results[5].value : 0,
  };

  if (Object.values(summary).some((v) => v > 0)) {
    logger.info('Ran Phase 18 trust protection jobs', summary);
  }

  return summary;
}

export { detectRepeatIssue };
