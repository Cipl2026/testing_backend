import {
  CoverageGapSeverity,
  CoverageGapStatus,
  SupplyDemandStatus,
} from '@ghaarfix/shared-types';
import { CoverageGap } from '@/models/Network.js';
import { ServiceZone } from '@/models/ServiceZone.js';
import { analyzeZoneSupplyDemand } from '@/modules/network/supply-demand.service.js';
import { DateTime } from 'luxon';
import { ServiceZoneAvailability } from '@/models/ServiceZoneAvailability.js';
import { DEFAULT_TIMEZONE } from '@/modules/network/time-bucket.util.js';

function severityFromStatus(status: SupplyDemandStatus, demand: number, supply: number): CoverageGapSeverity {
  const gap = demand - supply;
  if (status === SupplyDemandStatus.CRITICAL || gap >= 20) return CoverageGapSeverity.CRITICAL;
  if (status === SupplyDemandStatus.CONSTRAINED || gap >= 10) return CoverageGapSeverity.HIGH;
  if (gap >= 5) return CoverageGapSeverity.MEDIUM;
  return CoverageGapSeverity.LOW;
}

function buildDedupeKey(zoneId: string, serviceId: string, hourStart: Date): string {
  return `${zoneId}:${serviceId}:${hourStart.toISOString()}`;
}

export async function detectCoverageGap(
  zoneId: string,
  serviceId: string,
  at = new Date(),
) {
  const analysis = await analyzeZoneSupplyDemand(zoneId, serviceId, at);
  if (
    analysis.status !== SupplyDemandStatus.CONSTRAINED &&
    analysis.status !== SupplyDemandStatus.CRITICAL
  ) {
    return null;
  }

  const hourStart = DateTime.fromJSDate(at, { zone: DEFAULT_TIMEZONE }).startOf('hour').toUTC().toJSDate();
  const hourEnd = DateTime.fromJSDate(hourStart, { zone: 'utc' }).plus({ hours: 1 }).toJSDate();
  const dedupeKey = buildDedupeKey(zoneId, serviceId, hourStart);

  const existing = await CoverageGap.findOne({
    dedupeKey,
    status: { $in: [CoverageGapStatus.OPEN, CoverageGapStatus.ACKNOWLEDGED] },
  });
  if (existing) return existing;

  const zone = await ServiceZone.findById(zoneId);
  const supply = analysis.availableProviders + (analysis.scheduledCapacity ?? 0);
  const demand = analysis.estimatedDemand;
  const severity = severityFromStatus(analysis.status, demand, supply);

  const serviceLabel = 'service';
  const recommendation =
    severity === CoverageGapSeverity.CRITICAL
      ? `Prioritize ${serviceLabel} onboarding in this zone.`
      : `Consider extending shifts or recruiting providers for ${serviceLabel}.`;

  return CoverageGap.create({
    cityId: zone?.cityId,
    serviceZoneId: zoneId,
    serviceId,
    timeRangeStart: hourStart,
    timeRangeEnd: hourEnd,
    severity,
    demandEstimate: demand,
    supplyEstimate: supply,
    recommendation,
    status: CoverageGapStatus.OPEN,
    dedupeKey,
  });
}

export async function detectAllCoverageGaps(at = new Date()): Promise<number> {
  const zones = await ServiceZone.find({ isActive: true });
  let created = 0;
  for (const zone of zones) {
    const serviceIds = await ServiceZoneAvailability.distinct('serviceId', {
      serviceZoneId: zone._id,
      isAvailable: true,
    });
    for (const serviceId of serviceIds) {
      const gap = await detectCoverageGap(zone._id.toString(), serviceId.toString(), at);
      if (gap?.createdAt && gap.createdAt.getTime() > at.getTime() - 5000) created += 1;
    }
  }
  return created;
}

export async function listCoverageGaps(query: {
  zoneId?: string;
  serviceId?: string;
  status?: CoverageGapStatus;
  limit?: number;
}) {
  const filter: Record<string, unknown> = {};
  if (query.zoneId) filter.serviceZoneId = query.zoneId;
  if (query.serviceId) filter.serviceId = query.serviceId;
  if (query.status) filter.status = query.status;

  const items = await CoverageGap.find(filter).sort({ createdAt: -1 }).limit(query.limit ?? 50);
  return items.map((g) => ({
    id: g._id.toString(),
    cityId: g.cityId?.toString(),
    serviceZoneId: g.serviceZoneId.toString(),
    serviceId: g.serviceId.toString(),
    timeRangeStart: g.timeRangeStart,
    timeRangeEnd: g.timeRangeEnd,
    severity: g.severity,
    demandEstimate: g.demandEstimate,
    supplyEstimate: g.supplyEstimate,
    recommendation: g.recommendation,
    status: g.status,
    createdAt: g.createdAt,
  }));
}

export async function acknowledgeCoverageGap(gapId: string) {
  return CoverageGap.findByIdAndUpdate(
    gapId,
    { $set: { status: CoverageGapStatus.ACKNOWLEDGED } },
    { new: true },
  );
}
