import {
  BookingStatus,
  PerformancePeriod,
  ProviderQualityStatus,
  ProviderRequestStatus,
  ReviewStatus,
} from '@ghaarfix/shared-types';
import { Booking } from '@/models/Booking.js';
import { PriceChangeRequest } from '@/models/PriceChangeRequest.js';
import { ProviderPerformanceMetric } from '@/models/ProviderPerformanceMetric.js';
import { Review } from '@/models/Review.js';
import { SupportTicket } from '@/models/SupportTicket.js';

function periodWindow(period: PerformancePeriod): { start: Date; end: Date } {
  const end = new Date();
  if (period === PerformancePeriod.SEVEN_DAYS) {
    return { start: new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000), end };
  }
  if (period === PerformancePeriod.THIRTY_DAYS) {
    return { start: new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000), end };
  }
  if (period === PerformancePeriod.NINETY_DAYS) {
    return { start: new Date(end.getTime() - 90 * 24 * 60 * 60 * 1000), end };
  }
  return { start: new Date(0), end };
}

function computeQualityStatus(input: {
  averageRating: number;
  completionRate: number;
  cancelledByProvider: number;
  customerComplaints: number;
}): { status: ProviderQualityStatus; alerts: string[] } {
  const alerts: string[] = [];
  if (input.averageRating > 0 && input.averageRating < 3.5) {
    alerts.push('Your average rating is below the recommended level.');
  }
  if (input.completionRate < 0.8 && input.completionRate > 0) {
    alerts.push('Your completion rate is below the recommended level.');
  }
  if (input.cancelledByProvider >= 3) {
    alerts.push('Your cancellation rate is above the recommended level.');
  }
  if (input.customerComplaints >= 2) {
    alerts.push('Customers recently reported concerns about your service.');
  }

  let status = ProviderQualityStatus.GOOD;
  if (alerts.length >= 2 || input.averageRating < 3.2) {
    status = ProviderQualityStatus.NEEDS_ATTENTION;
  } else if (input.averageRating >= 4.5 && input.completionRate >= 0.9) {
    status = ProviderQualityStatus.EXCELLENT;
  }
  return { status, alerts };
}

export async function aggregateProviderPerformance(
  providerId: string,
  period: PerformancePeriod = PerformancePeriod.THIRTY_DAYS,
) {
  const { start, end } = periodWindow(period);

  const [accepted, completed, cancelledByProvider, reviews, complaints] = await Promise.all([
    Booking.countDocuments({
      providerId,
      createdAt: { $gte: start, $lte: end },
      providerRequestStatus: { $in: [ProviderRequestStatus.ACCEPTED, ProviderRequestStatus.REJECTED] },
    }),
    Booking.countDocuments({
      providerId,
      status: BookingStatus.COMPLETED,
      updatedAt: { $gte: start, $lte: end },
    }),
    Booking.countDocuments({
      providerId,
      status: BookingStatus.CANCELLED,
      'cancellation.actorRole': 'PROVIDER',
      updatedAt: { $gte: start, $lte: end },
    }),
    Review.find({ providerId, status: ReviewStatus.PUBLISHED, createdAt: { $gte: start, $lte: end } }),
    SupportTicket.countDocuments({ providerId, createdAt: { $gte: start, $lte: end } }),
  ]);

  const reviewCount = reviews.length;
  const averageRating =
    reviewCount > 0 ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviewCount : 0;
  const acceptedCount = await Booking.countDocuments({
    providerId,
    providerRequestStatus: ProviderRequestStatus.ACCEPTED,
    createdAt: { $gte: start, $lte: end },
  });
  const completionRate = acceptedCount > 0 ? completed / acceptedCount : 0;
  const acceptanceRate = accepted > 0 ? acceptedCount / accepted : 0;

  const { status, alerts } = computeQualityStatus({
    averageRating,
    completionRate,
    cancelledByProvider,
    customerComplaints: complaints,
  });

  const metric = await ProviderPerformanceMetric.findOneAndUpdate(
    { providerId, period, periodStart: start },
    {
      $set: {
        periodEnd: end,
        completedJobs: completed,
        cancelledByProvider,
        lateArrivals: 0,
        onTimeArrivals: completed,
        averageRating: Math.round(averageRating * 10) / 10,
        reviewCount,
        repeatedCustomers: 0,
        customerComplaints: complaints,
        completionRate: Math.round(completionRate * 100) / 100,
        acceptanceRate: Math.round(acceptanceRate * 100) / 100,
        qualityStatus: status,
        alerts,
        lastCalculatedAt: new Date(),
      },
    },
    { upsert: true, new: true },
  );

  return {
    period,
    completedJobs: metric.completedJobs,
    averageRating: metric.averageRating,
    onTimePercentage: metric.onTimeArrivals > 0 ? 100 : 0,
    completionRate: metric.completionRate,
    qualityStatus: metric.qualityStatus,
    alerts: metric.alerts,
    lastCalculatedAt: metric.lastCalculatedAt.toISOString(),
  };
}

export async function getProviderPerformanceDashboard(providerId: string) {
  const [month, allTime] = await Promise.all([
    aggregateProviderPerformance(providerId, PerformancePeriod.THIRTY_DAYS),
    aggregateProviderPerformance(providerId, PerformancePeriod.ALL_TIME),
  ]);
  return { thisMonth: month, allTime };
}

export async function aggregateAllProviderPerformance(): Promise<number> {
  const providers = await Booking.distinct('providerId');
  let count = 0;
  for (const providerId of providers) {
    await aggregateProviderPerformance(providerId.toString(), PerformancePeriod.THIRTY_DAYS);
    count += 1;
  }
  return count;
}

export async function adminGetProviderPerformance(providerId: string) {
  return getProviderPerformanceDashboard(providerId);
}

export async function getServiceQualityAnalytics(query: { days?: number }) {
  const days = query.days ?? 30;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const reviews = await Review.find({ createdAt: { $gte: since }, status: ReviewStatus.PUBLISHED });
  const complaints = await SupportTicket.countDocuments({ createdAt: { $gte: since } });
  const cancellations = await Booking.countDocuments({
    status: BookingStatus.CANCELLED,
    updatedAt: { $gte: since },
  });
  const priceChanges = await PriceChangeRequest.countDocuments({ createdAt: { $gte: since } });

  const avgRating =
    reviews.length > 0 ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;

  return {
    periodDays: days,
    averageRating: Math.round(avgRating * 10) / 10,
    reviewCount: reviews.length,
    complaintCount: complaints,
    cancellationCount: cancellations,
    priceChangeRequestCount: priceChanges,
  };
}
