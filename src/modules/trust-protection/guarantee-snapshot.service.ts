import { BookingStatus } from '@ghaarfix/shared-types';
import { Booking } from '@/models/Booking.js';
import { GuaranteeSnapshot } from '@/models/TrustProtection.js';
import { findActivePolicyForService } from '@/modules/trust-protection/guarantee-policy.service.js';
import { Service } from '@/models/Service.js';

export async function captureGuaranteeSnapshot(bookingId: string) {
  const existing = await GuaranteeSnapshot.findOne({ bookingId });
  if (existing) return existing;

  const booking = await Booking.findById(bookingId);
  if (!booking || booking.status !== BookingStatus.COMPLETED) return null;

  const service = await Service.findById(booking.serviceId);
  const policy = await findActivePolicyForService(
    booking.serviceId.toString(),
    service?.categoryId?.toString(),
  );
  if (!policy) return null;

  const completedAt = booking.updatedAt ?? new Date();
  const coverageEndsAt = new Date(completedAt.getTime() + policy.coverageDays * 24 * 60 * 60 * 1000);

  return GuaranteeSnapshot.create({
    bookingId,
    policyId: policy._id,
    policyVersion: policy.version,
    coverageDays: policy.coverageDays,
    coveredIssueTypes: policy.coveredIssueTypes,
    exclusions: policy.exclusions,
    maxClaims: policy.maxClaims,
    resolutionOptions: policy.resolutionOptions,
    coverageEndsAt,
  });
}

export async function getBookingGuarantee(bookingId: string, customerId?: string) {
  const filter: Record<string, unknown> = { _id: bookingId };
  if (customerId) filter.customerId = customerId;

  const booking = await Booking.findOne(filter);
  if (!booking) return null;

  const snapshot = await GuaranteeSnapshot.findOne({ bookingId });
  if (!snapshot) {
    return {
      bookingId,
      eligible: false,
      message: 'No service guarantee applies to this booking.',
    };
  }

  const now = new Date();
  const active = snapshot.coverageEndsAt > now;

  return {
    bookingId,
    eligible: active,
    policyVersion: snapshot.policyVersion,
    coverageDays: snapshot.coverageDays,
    coverageEndsAt: snapshot.coverageEndsAt,
    coveredIssueTypes: snapshot.coveredIssueTypes,
    exclusions: snapshot.exclusions,
    maxClaims: snapshot.maxClaims,
    resolutionOptions: snapshot.resolutionOptions,
    expired: !active,
    message: active
      ? `Service guarantee active until ${snapshot.coverageEndsAt.toISOString().slice(0, 10)}`
      : 'Service guarantee period has ended.',
  };
}
