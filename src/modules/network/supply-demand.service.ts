import {
  SupplyDemandStatus,
  type SupplyDemandResult,
} from '@ghaarfix/shared-types';
import { ZoneDemandMetric } from '@/models/ZoneDemandMetric.js';
import { DemandForecast } from '@/models/Intelligence.js';
import { DateTime } from 'luxon';
import { countZoneSupply } from '@/modules/network/provider-supply.service.js';
import { floorToBucket, localDateString, DEFAULT_TIMEZONE } from '@/modules/network/time-bucket.util.js';

export function classifySupplyDemand(supply: number, demand: number): SupplyDemandResult {
  const estimatedDemand = Math.max(demand, 0.1);
  const supplyDemandRatio = supply / estimatedDemand;

  let status: SupplyDemandStatus;
  let explanation: string;

  if (supplyDemandRatio >= 1.5) {
    status = SupplyDemandStatus.SURPLUS;
    explanation = 'Supply exceeds forecasted demand.';
  } else if (supplyDemandRatio >= 0.8) {
    status = SupplyDemandStatus.BALANCED;
    explanation = 'Supply and demand are in balance.';
  } else if (supplyDemandRatio >= 0.5) {
    status = SupplyDemandStatus.CONSTRAINED;
    explanation = 'Demand is outpacing available provider capacity.';
  } else {
    status = SupplyDemandStatus.CRITICAL;
    explanation = 'Critical supply shortage — recruitment or shift extension recommended.';
  }

  return {
    status,
    supplyDemandRatio: Math.round(supplyDemandRatio * 100) / 100,
    availableProviders: Math.round(supply),
    estimatedDemand: Math.round(estimatedDemand * 10) / 10,
    explanation,
  };
}

export async function estimateDemandForZone(
  zoneId: string,
  serviceId: string,
  timeBucket: Date,
): Promise<number> {
  const dt = DateTime.fromJSDate(timeBucket, { zone: DEFAULT_TIMEZONE });
  const date = localDateString(timeBucket);
  const hour = dt.hour;

  const metric = await ZoneDemandMetric.findOne({
    serviceZoneId: zoneId,
    serviceId,
    date,
    hour,
  });

  if (metric) {
    return Math.max(metric.requestCount + metric.waitlistCount, metric.bookingCount);
  }

  const forecast = await DemandForecast.findOne({
    serviceId,
    $or: [{ serviceZoneId: zoneId }, { serviceZoneId: { $exists: false } }],
    forecastStart: { $lte: timeBucket },
    forecastEnd: { $gte: timeBucket },
  }).sort({ confidence: -1 });

  if (forecast?.expectedBookings) {
    return forecast.expectedBookings / 168;
  }

  return 1;
}

export async function analyzeZoneSupplyDemand(
  zoneId: string,
  serviceId: string,
  at = new Date(),
): Promise<SupplyDemandResult & { scheduledCapacity: number; bookedCapacity: number }> {
  const bucket = floorToBucket(at);
  const supply = await countZoneSupply(zoneId, serviceId, bucket);
  const demand = await estimateDemandForZone(zoneId, serviceId, bucket);

  const effectiveSupply =
    supply.availableProviders + supply.scheduledCapacity * 0.5 - supply.bookedCapacity * 0.25;

  const result = classifySupplyDemand(Math.max(effectiveSupply, 0), demand);
  return {
    ...result,
    scheduledCapacity: supply.scheduledCapacity,
    bookedCapacity: supply.bookedCapacity,
  };
}
