import { BookingStatus } from '@ghaarfix/shared-types';
import { Booking } from '@/models/Booking.js';
import { ServiceProtectionClaim } from '@/models/TrustProtection.js';
import type { RepeatIssueSignal } from '@ghaarfix/shared-types';

const REPEAT_WINDOW_DAYS = 30;

export async function detectRepeatIssue(input: {
  bookingId: string;
  customerId: string;
  description: string;
  assetId?: string;
}): Promise<RepeatIssueSignal> {
  const booking = await Booking.findOne({ _id: input.bookingId, customerId: input.customerId });
  if (!booking) {
    return { detected: false, confidence: 0, reasons: [], advisoryOnly: true };
  }

  const since = new Date(Date.now() - REPEAT_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const reasons: string[] = [];
  let score = 0;

  const priorBookings = await Booking.find({
    customerId: input.customerId,
    serviceId: booking.serviceId,
    status: BookingStatus.COMPLETED,
    _id: { $ne: booking._id },
    updatedAt: { $gte: since },
  }).limit(5);

  if (priorBookings.length > 0) {
    score += 0.3;
    reasons.push('Recent completed booking for same service.');
  }

  if (input.assetId && booking.assetId?.toString() === input.assetId) {
    score += 0.35;
    reasons.push('Same home asset as prior service.');
  }

  const priorClaims = await ServiceProtectionClaim.countDocuments({
    customerId: input.customerId,
    bookingId: { $in: priorBookings.map((b) => b._id) },
    type: 'REPEAT_ISSUE',
  });
  if (priorClaims > 0) {
    score += 0.2;
    reasons.push('Prior repeat-issue claim on related booking.');
  }

  const desc = input.description.toLowerCase();
  const keywords = ['again', 'returned', 'same issue', 'not fixed', 'still'];
  if (keywords.some((k) => desc.includes(k))) {
    score += 0.15;
    reasons.push('Description suggests recurring problem.');
  }

  const detected = score >= 0.4;

  return {
    detected,
    confidence: Math.min(0.95, score),
    reasons,
    advisoryOnly: true,
  };
}
