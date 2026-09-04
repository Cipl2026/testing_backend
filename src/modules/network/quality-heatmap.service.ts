import { ZoneQualityStatus } from '@ghaarfix/shared-types';
import { ZoneQualityMetric } from '@/models/Network.js';
import { ServiceZone } from '@/models/ServiceZone.js';
import { Booking } from '@/models/Booking.js';
import { BookingStatus } from '@ghaarfix/shared-types';
import { Review } from '@/models/Review.js';

export const MIN_QUALITY_SAMPLE = 5;

export function classifyQualityStatus(input: {
  averageRating: number;
  cancellationRate: number;
  slaBreachRate: number;
  sampleSize: number;
}): ZoneQualityStatus | 'INSUFFICIENT_DATA' {
  if (input.sampleSize < MIN_QUALITY_SAMPLE) return 'INSUFFICIENT_DATA';
  if (input.averageRating >= 4.5 && input.cancellationRate < 0.05 && input.slaBreachRate < 0.05) {
    return ZoneQualityStatus.EXCELLENT;
  }
  if (input.averageRating >= 4.0 && input.cancellationRate < 0.1) {
    return ZoneQualityStatus.GOOD;
  }
  if (input.averageRating >= 3.5 && input.cancellationRate < 0.15) {
    return ZoneQualityStatus.NEEDS_ATTENTION;
  }
  return ZoneQualityStatus.CRITICAL;
}

export async function aggregateZoneQuality(zoneId: string, serviceId?: string) {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const match: Record<string, unknown> = {
    serviceZoneId: zoneId,
    createdAt: { $gte: since },
  };
  if (serviceId) match.serviceId = serviceId;

  const bookings = await Booking.find(match).select('_id status').limit(500);
  const sampleSize = bookings.length;

  const cancelled = bookings.filter((b) => b.status === BookingStatus.CANCELLED).length;
  const cancellationRate = sampleSize ? cancelled / sampleSize : 0;

  const bookingIds = bookings.map((b) => b._id);
  const reviews = await Review.find({ bookingId: { $in: bookingIds } }).select('rating');
  const averageRating = reviews.length
    ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
    : 0;

  const slaBreachRate = 0;
  const noShowRate = 0;

  const qualityStatus = classifyQualityStatus({
    averageRating,
    cancellationRate,
    slaBreachRate,
    sampleSize,
  });

  const periodEnd = new Date();
  const periodStart = since;

  if (qualityStatus === 'INSUFFICIENT_DATA') {
    return {
      zoneId,
      serviceId,
      sampleSize,
      qualityStatus: 'INSUFFICIENT_DATA' as const,
      message: 'Aggregated metrics hidden — insufficient sample size.',
    };
  }

  await ZoneQualityMetric.findOneAndUpdate(
    { zoneId, serviceId: serviceId ?? null, periodStart },
    {
      $set: {
        sampleSize,
        averageRating,
        cancellationRate,
        noShowRate,
        slaBreachRate,
        qualityStatus,
        periodEnd,
      },
    },
    { upsert: true },
  );

  return {
    zoneId,
    serviceId,
    sampleSize,
    averageRating: Math.round(averageRating * 100) / 100,
    cancellationRate: Math.round(cancellationRate * 1000) / 1000,
    noShowRate,
    slaBreachRate,
    qualityStatus,
  };
}

export async function listQualityHeatmap(query: { zoneId?: string; limit?: number }) {
  const filter: Record<string, unknown> = {};
  if (query.zoneId) filter.zoneId = query.zoneId;

  const items = await ZoneQualityMetric.find(filter)
    .sort({ updatedAt: -1 })
    .limit(query.limit ?? 100);

  return items
    .filter((m) => m.sampleSize >= MIN_QUALITY_SAMPLE)
    .map((m) => ({
      zoneId: m.zoneId.toString(),
      serviceId: m.serviceId?.toString(),
      sampleSize: m.sampleSize,
      averageRating: m.averageRating,
      cancellationRate: m.cancellationRate,
      qualityStatus: m.qualityStatus,
      periodStart: m.periodStart,
      periodEnd: m.periodEnd,
    }));
}

export async function aggregateAllZoneQuality(): Promise<number> {
  const zones = await ServiceZone.find({ isActive: true });
  let count = 0;
  for (const zone of zones) {
    await aggregateZoneQuality(zone._id.toString());
    count += 1;
  }
  return count;
}
