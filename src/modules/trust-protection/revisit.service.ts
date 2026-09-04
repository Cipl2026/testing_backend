import {
  BookingSource,
  BookingStatus,
  BookingType,
  ErrorCode,
  PaymentMethod,
  PaymentStatus,
  ProtectionClaimType,
  ProviderRequestStatus,
  RevisitReason,
} from '@ghaarfix/shared-types';
import { randomBytes } from 'node:crypto';
import { Booking } from '@/models/Booking.js';
import { GuaranteeSnapshot, RevisitBookingContext } from '@/models/TrustProtection.js';
import { AppError } from '@/utils/AppError.js';
import { checkGuaranteeEligibility } from '@/modules/trust-protection/guarantee-eligibility.service.js';

function bookingNumber(): string {
  return `GF-${Date.now().toString(36).toUpperCase()}-${randomBytes(2).toString('hex').toUpperCase()}`;
}

export async function requestRevisit(
  customerId: string,
  originalBookingId: string,
  input: {
    reason?: RevisitReason;
    claimId?: string;
    preferOriginalProvider?: boolean;
  },
) {
  const existing = await RevisitBookingContext.findOne({ originalBookingId });
  if (existing?.revisitBookingId) {
    return {
      revisitContextId: existing._id.toString(),
      revisitBookingId: existing.revisitBookingId.toString(),
      existing: true,
    };
  }

  const original = await Booking.findOne({ _id: originalBookingId, customerId });
  if (!original) throw new AppError('Booking not found.', 404, ErrorCode.NOT_FOUND);
  if (original.status !== BookingStatus.COMPLETED) {
    throw new AppError('Revisit only available for completed bookings.', 400, ErrorCode.VALIDATION_ERROR);
  }

  const eligibility = await checkGuaranteeEligibility(
    originalBookingId,
    customerId,
    ProtectionClaimType.REPEAT_ISSUE,
  );
  if (!eligibility.eligible && !input.claimId) {
    throw new AppError(eligibility.reasons.join(' '), 400, ErrorCode.VALIDATION_ERROR);
  }

  const snapshot = await GuaranteeSnapshot.findOne({ bookingId: originalBookingId });
  const preferOriginal = input.preferOriginalProvider !== false;
  const providerId =
    preferOriginal && original.providerId ? original.providerId : original.providerId;

  const scheduledStart = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const scheduledEnd = new Date(scheduledStart.getTime() + original.durationMinutes * 60000);

  const revisitBooking = await Booking.create({
    bookingNumber: bookingNumber(),
    bookingType: BookingType.SCHEDULED,
    source: BookingSource.SLOT_RESERVATION,
    customerId: original.customerId,
    providerId,
    serviceId: original.serviceId,
    providerServiceId: original.providerServiceId,
    homeId: original.homeId,
    assetId: original.assetId,
    bookingContextType: original.bookingContextType,
    addressSnapshot: original.addressSnapshot,
    serviceSnapshot: original.serviceSnapshot,
    providerSnapshot: original.providerSnapshot,
    serviceZoneId: original.serviceZoneId,
    serviceZoneSnapshot: original.serviceZoneSnapshot,
    status: BookingStatus.PENDING_PROVIDER,
    providerRequestStatus: ProviderRequestStatus.PENDING,
    scheduledStart,
    scheduledEnd,
    timezone: original.timezone,
    durationMinutes: original.durationMinutes,
    price: { estimatedAmount: 0, finalAmount: 0, currency: original.price.currency },
    payment: {
      method: PaymentMethod.PAY_ON_SERVICE,
      status: PaymentStatus.PAID,
    },
    customerNotes: `Revisit for booking ${original.bookingNumber}`,
  });

  const context = await RevisitBookingContext.create({
    originalBookingId: original._id,
    revisitBookingId: revisitBooking._id,
    claimId: input.claimId,
    reason: input.reason ?? RevisitReason.GUARANTEE,
    guaranteeSnapshotId: snapshot?._id,
    preferOriginalProvider: preferOriginal,
    assignedOriginalProvider: preferOriginal,
  });

  return {
    revisitContextId: context._id.toString(),
    revisitBookingId: revisitBooking._id.toString(),
    preferOriginalProvider: preferOriginal,
    message: 'Free revisit scheduled. Provider assignment pending confirmation.',
  };
}

export async function getRevisitContext(originalBookingId: string) {
  return RevisitBookingContext.findOne({ originalBookingId });
}
