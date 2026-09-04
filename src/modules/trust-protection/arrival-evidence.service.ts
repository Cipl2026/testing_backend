import { ArrivalVerificationResult } from '@ghaarfix/shared-types';
import { ServiceArrivalEvidence } from '@/models/TrustProtection.js';
import { Booking } from '@/models/Booking.js';
import { distanceKm } from '@/utils/intervals.js';

const GEOFENCE_METERS = 200;

export async function recordArrivalEvidence(input: {
  bookingId: string;
  providerId: string;
  providerLat?: number;
  providerLon?: number;
  customerConfirmed?: boolean;
  otpVerified?: boolean;
}) {
  const booking = await Booking.findOne({ _id: input.bookingId, providerId: input.providerId });
  if (!booking) return null;

  let result = ArrivalVerificationResult.INDETERMINATE;
  let proximityMeters: number | undefined;

  const loc = booking.addressSnapshot.location;
  if (input.providerLat !== undefined && input.providerLon !== undefined && loc) {
    const distKm = distanceKm(input.providerLat, input.providerLon, loc.latitude, loc.longitude);
    proximityMeters = Math.round(distKm * 1000);
    result =
      proximityMeters <= GEOFENCE_METERS
        ? ArrivalVerificationResult.ARRIVED
        : ArrivalVerificationResult.NOT_ARRIVED;
  } else if (input.customerConfirmed || input.otpVerified) {
    result = ArrivalVerificationResult.ARRIVED;
  }

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  return ServiceArrivalEvidence.create({
    bookingId: input.bookingId,
    providerId: input.providerId,
    result,
    proximityMeters,
    customerConfirmed: input.customerConfirmed ?? false,
    otpVerified: input.otpVerified ?? false,
    verifiedAt: new Date(),
    expiresAt,
  });
}

export async function getArrivalEvidence(bookingId: string) {
  return ServiceArrivalEvidence.findOne({ bookingId }).sort({ createdAt: -1 });
}
