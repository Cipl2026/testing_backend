import { CityLaunchReadinessStatus } from '@ghaarfix/shared-types';
import { CityLaunchReadiness } from '@/models/Network.js';
import { City } from '@/models/City.js';
import { ServiceZone } from '@/models/ServiceZone.js';
import { ServiceZoneAvailability } from '@/models/ServiceZoneAvailability.js';
import { ProviderSkill } from '@/models/ProviderSkill.js';
import { ProviderSkillStatus } from '@ghaarfix/shared-types';
import { analyzeZoneSupplyDemand } from '@/modules/network/supply-demand.service.js';

const CHECKLIST_ITEMS = [
  'Service zones configured',
  'Providers verified',
  'Pricing configured',
  'Payment available',
  'Support coverage ready',
  'Minimum provider supply',
  'Urgent Fix policy configured',
] as const;

export async function computeCityLaunchReadiness(cityId: string, serviceId: string) {
  const city = await City.findById(cityId);
  if (!city) return null;

  const zones = await ServiceZone.find({ cityId, isActive: true });
  const zonesConfigured = zones.length > 0;

  const zoneAvailability = await ServiceZoneAvailability.findOne({
    serviceZoneId: { $in: zones.map((z) => z._id) },
    serviceId,
    isAvailable: true,
  });
  const serviceInZone = !!zoneAvailability;

  const verifiedProviders = await ProviderSkill.countDocuments({
    skillId: serviceId,
    status: ProviderSkillStatus.VERIFIED,
  });

  let bestSupplyScore = 0;
  for (const zone of zones.slice(0, 5)) {
    const analysis = await analyzeZoneSupplyDemand(zone._id.toString(), serviceId);
    bestSupplyScore = Math.max(bestSupplyScore, analysis.supplyDemandRatio);
  }

  const providerSupplyScore = Math.min(100, verifiedProviders * 5 + bestSupplyScore * 20);
  const expectedDemandScore = serviceInZone ? 70 : 30;
  const qualityReadiness = verifiedProviders >= 3 ? 80 : 40;
  const paymentReadiness = 85;
  const supportReadiness = city.isActive ? 75 : 40;

  const checklist = [
    { item: CHECKLIST_ITEMS[0], passed: zonesConfigured },
    { item: CHECKLIST_ITEMS[1], passed: verifiedProviders >= 3 },
    { item: CHECKLIST_ITEMS[2], passed: serviceInZone },
    { item: CHECKLIST_ITEMS[3], passed: paymentReadiness >= 70 },
    { item: CHECKLIST_ITEMS[4], passed: supportReadiness >= 70 },
    { item: CHECKLIST_ITEMS[5], passed: verifiedProviders >= 5 },
    { item: CHECKLIST_ITEMS[6], passed: zonesConfigured },
  ];

  const passedCount = checklist.filter((c) => c.passed).length;
  const overallScore =
    (providerSupplyScore + expectedDemandScore + qualityReadiness + paymentReadiness + supportReadiness) / 5;

  let overallStatus: CityLaunchReadinessStatus;
  if (passedCount >= 6 && overallScore >= 75) {
    overallStatus = CityLaunchReadinessStatus.READY;
  } else if (passedCount >= 4 && overallScore >= 50) {
    overallStatus = CityLaunchReadinessStatus.LIMITED_LAUNCH;
  } else {
    overallStatus = CityLaunchReadinessStatus.NOT_READY;
  }

  return CityLaunchReadiness.findOneAndUpdate(
    { cityId, serviceId },
    {
      $set: {
        providerSupplyScore,
        expectedDemandScore,
        qualityReadiness,
        paymentReadiness,
        supportReadiness,
        overallStatus,
        checklist,
      },
    },
    { upsert: true, new: true },
  );
}

export async function computeAllLaunchReadiness(): Promise<number> {
  const cities = await City.find({ isActive: true });
  let count = 0;
  for (const city of cities) {
    const serviceIds = await ServiceZoneAvailability.distinct('serviceId', {
      serviceZoneId: { $in: await ServiceZone.find({ cityId: city._id }).distinct('_id') },
    });
    for (const serviceId of serviceIds) {
      await computeCityLaunchReadiness(city._id.toString(), serviceId.toString());
      count += 1;
    }
  }
  return count;
}

export async function listLaunchReadiness(query: { cityId?: string; limit?: number }) {
  const filter: Record<string, unknown> = {};
  if (query.cityId) filter.cityId = query.cityId;

  const items = await CityLaunchReadiness.find(filter)
    .sort({ updatedAt: -1 })
    .limit(query.limit ?? 50);

  return items.map((r) => ({
    id: r._id.toString(),
    cityId: r.cityId.toString(),
    serviceId: r.serviceId.toString(),
    providerSupplyScore: r.providerSupplyScore,
    expectedDemandScore: r.expectedDemandScore,
    qualityReadiness: r.qualityReadiness,
    paymentReadiness: r.paymentReadiness,
    supportReadiness: r.supportReadiness,
    overallStatus: r.overallStatus,
    checklist: r.checklist,
    updatedAt: r.updatedAt,
  }));
}

export async function createLaunchPlan(
  adminId: string,
  input: { cityId: string; serviceId: string; notes?: string },
) {
  const readiness = await computeCityLaunchReadiness(input.cityId, input.serviceId);
  return {
    cityId: input.cityId,
    serviceId: input.serviceId,
    status: readiness?.overallStatus,
    checklist: readiness?.checklist,
    createdBy: adminId,
    notes: input.notes,
    advisory: 'Launch plan is advisory — city activation requires admin approval.',
  };
}
