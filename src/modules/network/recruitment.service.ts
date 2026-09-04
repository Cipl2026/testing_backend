import { RecruitmentSignalStatus, SupplyDemandStatus } from '@ghaarfix/shared-types';
import { ProviderRecruitmentSignal } from '@/models/Network.js';
import { ServiceZone } from '@/models/ServiceZone.js';
import { ServiceZoneAvailability } from '@/models/ServiceZoneAvailability.js';
import { analyzeZoneSupplyDemand } from '@/modules/network/supply-demand.service.js';

function buildDedupeKey(zoneId: string, serviceId: string): string {
  return `recruit:${zoneId}:${serviceId}`;
}

export async function generateRecruitmentSignal(zoneId: string, serviceId: string) {
  const analysis = await analyzeZoneSupplyDemand(zoneId, serviceId);
  if (
    analysis.status !== SupplyDemandStatus.CONSTRAINED &&
    analysis.status !== SupplyDemandStatus.CRITICAL
  ) {
    return null;
  }

  const gap = Math.max(0, analysis.estimatedDemand - analysis.availableProviders);
  const recommendedProviderCount = Math.ceil(gap);
  const priorityScore =
    analysis.status === SupplyDemandStatus.CRITICAL
      ? 90 + Math.min(10, gap)
      : 60 + Math.min(30, gap * 2);

  const dedupeKey = buildDedupeKey(zoneId, serviceId);
  const existing = await ProviderRecruitmentSignal.findOne({
    dedupeKey,
    status: { $in: [RecruitmentSignalStatus.OPEN, RecruitmentSignalStatus.ACKNOWLEDGED] },
  });
  if (existing) {
    existing.priorityScore = priorityScore;
    existing.recommendedProviderCount = recommendedProviderCount;
    existing.reason = `Demand ${analysis.estimatedDemand.toFixed(1)} vs supply ${analysis.availableProviders}`;
    await existing.save();
    return existing;
  }

  const zone = await ServiceZone.findById(zoneId);
  return ProviderRecruitmentSignal.create({
    cityId: zone?.cityId,
    zoneId,
    serviceId,
    priorityScore,
    reason: `Supply-demand ratio ${analysis.supplyDemandRatio} — ${analysis.explanation}`,
    recommendedProviderCount,
    status: RecruitmentSignalStatus.OPEN,
    dedupeKey,
  });
}

export async function generateAllRecruitmentSignals(): Promise<number> {
  const zones = await ServiceZone.find({ isActive: true });
  let upserted = 0;
  for (const zone of zones) {
    const serviceIds = await ServiceZoneAvailability.distinct('serviceId', {
      serviceZoneId: zone._id,
      isAvailable: true,
    });
    for (const serviceId of serviceIds) {
      const signal = await generateRecruitmentSignal(zone._id.toString(), serviceId.toString());
      if (signal) upserted += 1;
    }
  }
  return upserted;
}

export async function listRecruitmentSignals(query: { cityId?: string; limit?: number }) {
  const filter: Record<string, unknown> = {
    status: { $in: [RecruitmentSignalStatus.OPEN, RecruitmentSignalStatus.ACKNOWLEDGED] },
  };
  if (query.cityId) filter.cityId = query.cityId;

  const items = await ProviderRecruitmentSignal.find(filter)
    .sort({ priorityScore: -1 })
    .limit(query.limit ?? 50);

  return items.map((s) => ({
    id: s._id.toString(),
    cityId: s.cityId?.toString(),
    zoneId: s.zoneId.toString(),
    serviceId: s.serviceId.toString(),
    priorityScore: s.priorityScore,
    reason: s.reason,
    recommendedProviderCount: s.recommendedProviderCount,
    status: s.status,
  }));
}
