import { BookingStatus, ProviderBadge, ReviewStatus } from '@ghaarfix/shared-types';
import { Booking } from '@/models/Booking.js';
import { ProviderProfile } from '@/models/ProviderProfile.js';
import { ProviderTrustMetrics } from '@/models/ProviderTrustMetrics.js';
import { Review } from '@/models/Review.js';

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
  const badges: ProviderBadge[] = [];
  if (profile?.isVerified) badges.push(ProviderBadge.IDENTITY_VERIFIED);
  if (completedJobs >= 50 && averageRating >= 4.5) badges.push(ProviderBadge.TOP_PROFESSIONAL);
  if (completedJobs >= 10) badges.push(ProviderBadge.SKILL_VERIFIED);

  await ProviderTrustMetrics.findOneAndUpdate(
    { providerId },
    {
      completedJobs,
      cancelledJobs,
      averageRating: Math.round(averageRating * 10) / 10,
      reviewCount,
      onTimePercentage: 100,
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

  return {
    providerId,
    completedJobs: metrics?.completedJobs ?? 0,
    cancelledJobs: metrics?.cancelledJobs ?? 0,
    averageRating: metrics?.averageRating ?? 0,
    reviewCount: metrics?.reviewCount ?? 0,
    onTimePercentage: metrics?.onTimePercentage ?? 100,
    badges: metrics?.badges ?? [],
    isVerified: profile?.isVerified ?? false,
    experienceYears: profile?.experienceYears,
    fullName: profile?.fullName,
    profileImage: profile?.profileImage,
    lastCalculatedAt: metrics?.lastCalculatedAt?.toISOString(),
  };
}
