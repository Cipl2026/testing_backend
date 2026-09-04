import {
  WaitTimeConfidence,
  type WaitTimeEstimate,
  BookingStatus,
} from '@ghaarfix/shared-types';
import { Booking } from '@/models/Booking.js';
import { analyzeZoneSupplyDemand } from '@/modules/network/supply-demand.service.js';

const MIN_HISTORICAL_SAMPLES = 5;

export async function estimateWaitTime(input: {
  zoneId: string;
  serviceId: string;
  distanceKm?: number;
  isUrgent?: boolean;
  at?: Date;
}): Promise<WaitTimeEstimate> {
  const analysis = await analyzeZoneSupplyDemand(input.zoneId, input.serviceId, input.at);
  const travelMinutes = input.distanceKm
    ? Math.max(5, Math.round((input.distanceKm / 25) * 60))
    : 20;

  const historical = await countHistoricalArrivals(input.zoneId, input.serviceId);
  const baseMinutes = historical.avgMinutes ?? 30;
  const loadFactor = Math.max(0.5, 2 - analysis.supplyDemandRatio);

  let minMinutes = Math.round(baseMinutes * loadFactor + (input.distanceKm ?? 3));
  let maxMinutes = Math.round(minMinutes * 1.4 + travelMinutes * 0.3);

  if (input.isUrgent) {
    minMinutes = Math.max(15, minMinutes - 10);
    maxMinutes = Math.max(minMinutes + 10, maxMinutes - 5);
  }

  const confidence = resolveConfidence(historical.sampleSize, analysis.supplyDemandRatio);

  const label =
    confidence === WaitTimeConfidence.LOW
      ? 'Availability may vary'
      : `${minMinutes}–${maxMinutes} minutes`;

  return {
    minMinutes,
    maxMinutes,
    confidence,
    label,
    disclaimer:
      confidence === WaitTimeConfidence.LOW
        ? 'Estimate based on limited data. Arrival is not guaranteed.'
        : 'Estimated arrival window — not a guaranteed time.',
  };
}

async function countHistoricalArrivals(zoneId: string, serviceId: string) {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const bookings = await Booking.find({
    serviceZoneId: zoneId,
    serviceId,
    status: BookingStatus.COMPLETED,
    scheduledStart: { $gte: since },
  })
    .select('scheduledStart updatedAt')
    .limit(200);

  if (bookings.length < MIN_HISTORICAL_SAMPLES) {
    return { sampleSize: bookings.length, avgMinutes: null as number | null };
  }

  const deltas = bookings
    .map((b) => {
      if (!b.scheduledStart || !b.updatedAt) return null;
      return Math.max(0, (b.updatedAt.getTime() - b.scheduledStart.getTime()) / 60000);
    })
    .filter((v): v is number => v !== null && v < 240);

  const avgMinutes = deltas.length
    ? deltas.reduce((a, b) => a + b, 0) / deltas.length
    : null;

  return { sampleSize: deltas.length, avgMinutes };
}

function resolveConfidence(sampleSize: number, ratio: number): WaitTimeConfidence {
  if (sampleSize >= MIN_HISTORICAL_SAMPLES && ratio >= 0.8) return WaitTimeConfidence.HIGH;
  if (sampleSize >= 3 || ratio >= 0.5) return WaitTimeConfidence.MEDIUM;
  return WaitTimeConfidence.LOW;
}
