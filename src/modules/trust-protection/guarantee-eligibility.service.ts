import { ErrorCode, ProtectionClaimType } from '@ghaarfix/shared-types';
import { Booking } from '@/models/Booking.js';
import { BookingStatus } from '@ghaarfix/shared-types';
import { GuaranteeSnapshot, ServiceProtectionClaim } from '@/models/TrustProtection.js';
import { AppError } from '@/utils/AppError.js';

export interface EligibilityResult {
  eligible: boolean;
  reasons: string[];
}

export async function checkGuaranteeEligibility(
  bookingId: string,
  customerId: string,
  claimType: ProtectionClaimType,
): Promise<EligibilityResult> {
  const reasons: string[] = [];

  const booking = await Booking.findOne({ _id: bookingId, customerId });
  if (!booking) {
    return { eligible: false, reasons: ['Booking not found.'] };
  }

  if (booking.status !== BookingStatus.COMPLETED) {
    reasons.push('Booking must be completed.');
  }

  const snapshot = await GuaranteeSnapshot.findOne({ bookingId });
  if (!snapshot) {
    reasons.push('No guarantee snapshot for this booking.');
    return { eligible: false, reasons };
  }

  if (snapshot.coverageEndsAt < new Date()) {
    reasons.push('Guarantee coverage period has expired.');
  }

  if (!snapshot.coveredIssueTypes.includes(claimType)) {
    reasons.push(`Issue type ${claimType} is not covered.`);
  }

  const priorClaims = await ServiceProtectionClaim.countDocuments({
    bookingId,
    status: { $nin: ['REJECTED', 'CLOSED'] },
  });
  if (priorClaims >= snapshot.maxClaims) {
    reasons.push('Maximum claims for this booking reached.');
  }

  return { eligible: reasons.length === 0, reasons };
}

export async function assertClaimEligible(
  bookingId: string,
  customerId: string,
  claimType: ProtectionClaimType,
) {
  const result = await checkGuaranteeEligibility(bookingId, customerId, claimType);
  if (!result.eligible) {
    throw new AppError(result.reasons.join(' '), 400, ErrorCode.VALIDATION_ERROR);
  }
  return result;
}
