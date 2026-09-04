import { BookingStatus, DemandForecastLevel } from '@ghaarfix/shared-types';
import { DateTime } from 'luxon';
import { Booking } from '@/models/Booking.js';
import { DemandForecast } from '@/models/Intelligence.js';

const MODEL_VERSION = 'demand-forecast-rules-v1';

function levelFromCount(count: number, baseline: number): DemandForecastLevel {
  const ratio = baseline > 0 ? count / baseline : count;
  if (ratio >= 2) return DemandForecastLevel.VERY_HIGH;
  if (ratio >= 1.4) return DemandForecastLevel.HIGH;
  if (ratio >= 0.8) return DemandForecastLevel.NORMAL;
  return DemandForecastLevel.LOW;
}

export async function generateDemandForecasts() {
  const now = DateTime.now();
  const weekStart = now.startOf('week');
  const historicalStart = weekStart.minus({ weeks: 8 }).toJSDate();
  const historicalEnd = weekStart.toJSDate();

  const historical = await Booking.aggregate([
    {
      $match: {
        status: { $in: [BookingStatus.COMPLETED, BookingStatus.CONFIRMED, BookingStatus.IN_PROGRESS] },
        createdAt: { $gte: historicalStart, $lt: historicalEnd },
      },
    },
    {
      $group: {
        _id: {
          serviceId: '$serviceId',
          dayOfWeek: { $dayOfWeek: '$scheduledStart' },
          hour: { $hour: '$scheduledStart' },
        },
        count: { $sum: 1 },
      },
    },
  ]);

  const baselineByService = new Map<string, number>();
  for (const row of historical) {
    const sid = row._id.serviceId?.toString() ?? 'unknown';
    baselineByService.set(sid, (baselineByService.get(sid) ?? 0) + row.count);
  }

  let created = 0;
  const forecastStart = weekStart.plus({ weeks: 1 }).toJSDate();
  const forecastEnd = weekStart.plus({ weeks: 2 }).toJSDate();

  for (const [serviceId, total] of baselineByService) {
    const baseline = total / 8;
    const expected = Math.round(baseline * 1.1);
    const level = levelFromCount(expected, baseline);

    const existing = await DemandForecast.findOne({
      serviceId,
      forecastStart,
      modelVersion: MODEL_VERSION,
    });
    if (existing) continue;

    await DemandForecast.create({
      serviceId,
      forecastStart,
      forecastEnd,
      level,
      expectedBookings: expected,
      confidence: 0.65,
      modelVersion: MODEL_VERSION,
      metadata: { baselineWeekly: baseline },
    });
    created += 1;
  }

  return created;
}

export async function listDemandForecasts(query: {
  cityId?: string;
  serviceZoneId?: string;
  serviceId?: string;
  limit?: number;
}) {
  const filter: Record<string, unknown> = {
    forecastStart: { $gte: new Date() },
  };
  if (query.cityId) filter.cityId = query.cityId;
  if (query.serviceZoneId) filter.serviceZoneId = query.serviceZoneId;
  if (query.serviceId) filter.serviceId = query.serviceId;

  const items = await DemandForecast.find(filter)
    .sort({ forecastStart: 1 })
    .limit(query.limit ?? 50);

  return items.map((f) => ({
    id: f._id.toString(),
    serviceId: f.serviceId?.toString(),
    cityId: f.cityId?.toString(),
    serviceZoneId: f.serviceZoneId?.toString(),
    forecastStart: f.forecastStart,
    forecastEnd: f.forecastEnd,
    level: f.level,
    expectedBookings: f.expectedBookings,
    confidence: f.confidence,
    modelVersion: f.modelVersion,
  }));
}
