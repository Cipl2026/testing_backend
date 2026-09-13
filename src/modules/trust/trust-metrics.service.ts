import { BookingStatus, ProviderBadge, ReviewStatus } from '@ghaarfix/shared-types';
import { Booking } from '@/models/Booking.js';
import { BookingTimelineEvent } from '@/models/BookingTimelineEvent.js';
import { ProviderProfile } from '@/models/ProviderProfile.js';
import { ProviderTrustMetrics } from '@/models/ProviderTrustMetrics.js';
import { Review } from '@/models/Review.js';
import { TimelineEventType } from '@ghaarfix/shared-types';

const ON_TIME_GRACE_MINUTES = 15;

function computeTrustScore(input: {
  averageRating: number;
  reviewCount: number;
  completedJobs: number;
  cancelledJobs: number;
  onTimePercentage: number;
  isVerified: boolean;
}): number {
  const completionTotal = input.completedJobs + input.cancelledJobs;
  const completionRate =
    completionTotal > 0 ? (input.completedJobs / completionTotal) * 100 : 100;
  const cancellationRate =
    completionTotal > 0 ? (input.cancelledJobs / completionTotal) * 100 : 0;
  const ratingScore = input.reviewCount > 0 ? (input.averageRating / 5) * 100 : 70;
  const volumeBoost = Math.min(input.completedJobs / 100, 1) * 5;
  const verificationBoost = input.isVerified ? 5 : 0;

  const score =
    ratingScore * 0.35 +
    input.onTimePercentage * 0.25 +
    completionRate * 0.25 +
    Math.max(0, 100 - cancellationRate * 4) * 0.1 +
    volumeBoost +
    verificationBoost;

  return Math.max(0, Math.min(100, Math.round(score)));
}

async function calculateOnTimePercentage(providerId: string): Promise<number> {
  const completedBookings = await Booking.find({
    providerId,
    status: BookingStatus.COMPLETED,
  })
    .select('_id scheduledStart')
    .limit(200)
    .sort({ scheduledStart: -1 });

  if (!completedBookings.length) return 100;

  const bookingIds = completedBookings.map((booking) => booking._id);
  const arrivalEvents = await BookingTimelineEvent.find({
    bookingId: { $in: bookingIds },
    type: TimelineEventType.PROVIDER_ARRIVED,
  }).select('bookingId timestamp');

  const arrivalByBooking = new Map(
    arrivalEvents.map((event) => [event.bookingId.toString(), event.timestamp]),
  );

  let onTimeCount = 0;
  let measuredCount = 0;

  for (const booking of completedBookings) {
    const arrivedAt = arrivalByBooking.get(booking._id.toString());
    if (!arrivedAt) continue;
    measuredCount += 1;
    const delayMinutes =
      (arrivedAt.getTime() - booking.scheduledStart.getTime()) / (60 * 1000);
    if (delayMinutes <= ON_TIME_GRACE_MINUTES) onTimeCount += 1;
  }

  if (!measuredCount) return 100;
  return Math.round((onTimeCount / measuredCount) * 100);
}

export async function recalculateTrustMetrics(providerId: string) {
  const completedJobs = await Booking.countDocuments({
    providerId,
    status: BookingStatus.COMPLETED,
  });
  const cancelledJobs = await Booking.countDocuments({
    providerId,
    status: BookingStatus.CANCELLED,
  });

  const reviews = await Review.find({ providerId, status: ReviewStatus.PUBLISHED });
  const reviewCount = reviews.length;
  const averageRating =
    reviewCount > 0 ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviewCount : 0;

  const profile = await ProviderProfile.findOne({ userId: providerId });
  const onTimePercentage = await calculateOnTimePercentage(providerId);
  const badges: ProviderBadge[] = [];
  if (profile?.isVerified) badges.push(ProviderBadge.IDENTITY_VERIFIED);
  if (completedJobs >= 50 && averageRating >= 4.5) badges.push(ProviderBadge.TOP_PROFESSIONAL);
  if (completedJobs >= 10) badges.push(ProviderBadge.SKILL_VERIFIED);
  if (onTimePercentage >= 90 && completedJobs >= 5) badges.push(ProviderBadge.HIGHLY_RELIABLE);

  const completionTotal = completedJobs + cancelledJobs;
  const cancellationRate =
    completionTotal > 0 ? Math.round((cancelledJobs / completionTotal) * 1000) / 10 : 0;
  const trustScore = computeTrustScore({
    averageRating,
    reviewCount,
    completedJobs,
    cancelledJobs,
    onTimePercentage,
    isVerified: profile?.isVerified ?? false,
  });

  await ProviderTrustMetrics.findOneAndUpdate(
    { providerId },
    {
      completedJobs,
      cancelledJobs,
      averageRating: Math.round(averageRating * 10) / 10,
      reviewCount,
      onTimePercentage,
      trustScore,
      cancellationRate,
      badges,
      lastCalculatedAt: new Date(),
    },
    { upsert: true, new: true },
  );
}

export async function getProviderTrustMetrics(providerId: string) {
  let metrics = await ProviderTrustMetrics.findOne({ providerId });
  if (!metrics) {
    await recalculateTrustMetrics(providerId);
    metrics = await ProviderTrustMetrics.findOne({ providerId });
  }

  const profile = await ProviderProfile.findOne({ userId: providerId });

  const completionTotal = (metrics?.completedJobs ?? 0) + (metrics?.cancelledJobs ?? 0);
  const cancellationRate =
    metrics?.cancellationRate ??
    (completionTotal > 0
      ? Math.round(((metrics?.cancelledJobs ?? 0) / completionTotal) * 1000) / 10
      : 0);
  const trustScore =
    metrics?.trustScore ??
    computeTrustScore({
      averageRating: metrics?.averageRating ?? 0,
      reviewCount: metrics?.reviewCount ?? 0,
      completedJobs: metrics?.completedJobs ?? 0,
      cancelledJobs: metrics?.cancelledJobs ?? 0,
      onTimePercentage: metrics?.onTimePercentage ?? 100,
      isVerified: profile?.isVerified ?? false,
    });

  return {
    providerId,
    completedJobs: metrics?.completedJobs ?? 0,
    cancelledJobs: metrics?.cancelledJobs ?? 0,
    averageRating: metrics?.averageRating ?? 0,
    reviewCount: metrics?.reviewCount ?? 0,
    onTimePercentage: metrics?.onTimePercentage ?? 100,
    cancellationRate,
    trustScore,
    badges: metrics?.badges ?? [],
    isVerified: profile?.isVerified ?? false,
    experienceYears: profile?.experienceYears,
    fullName: profile?.fullName,
    profileImage: profile?.profileImage,
    lastCalculatedAt: metrics?.lastCalculatedAt?.toISOString(),
  };
}
