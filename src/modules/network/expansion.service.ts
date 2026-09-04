import {
  ExpansionRecommendationStatus,
  ExpansionTargetType,
} from '@ghaarfix/shared-types';
import { ExpansionRecommendation } from '@/models/Network.js';
import { ServiceZone } from '@/models/ServiceZone.js';
import { City } from '@/models/City.js';
import { analyzeZoneSupplyDemand } from '@/modules/network/supply-demand.service.js';
import { listCoverageGaps } from '@/modules/network/coverage-gap.service.js';

export async function analyzeExpansionOpportunities(): Promise<number> {
  let created = 0;
  const gaps = await listCoverageGaps({ limit: 20 });

  for (const gap of gaps) {
    const analysis = await analyzeZoneSupplyDemand(gap.serviceZoneId, gap.serviceId);
    const score = Math.min(100, Math.round((1 / Math.max(analysis.supplyDemandRatio, 0.1)) * 30 + gap.demandEstimate));

    const existing = await ExpansionRecommendation.findOne({
      targetType: ExpansionTargetType.ZONE,
      targetId: gap.serviceZoneId,
      status: { $in: [ExpansionRecommendationStatus.PENDING, ExpansionRecommendationStatus.ACKNOWLEDGED] },
    });
    if (existing) continue;

    await ExpansionRecommendation.create({
      targetType: ExpansionTargetType.ZONE,
      targetId: gap.serviceZoneId,
      score,
      reasons: [
        `Coverage gap severity: ${gap.severity}`,
        gap.recommendation,
        `Supply-demand ratio: ${analysis.supplyDemandRatio}`,
      ],
      confidence: 0.6,
      status: ExpansionRecommendationStatus.PENDING,
    });
    created += 1;
  }

  const cities = await City.find({ isActive: true }).limit(10);
  for (const city of cities) {
    const zoneCount = await ServiceZone.countDocuments({ cityId: city._id, isActive: true });
    if (zoneCount >= 3) continue;

    const existing = await ExpansionRecommendation.findOne({
      targetType: ExpansionTargetType.CITY,
      targetId: city._id,
      status: ExpansionRecommendationStatus.PENDING,
    });
    if (existing) continue;

    await ExpansionRecommendation.create({
      targetType: ExpansionTargetType.CITY,
      targetId: city._id,
      score: 50 + (3 - zoneCount) * 15,
      reasons: [`Only ${zoneCount} active zones — expansion may improve coverage`],
      confidence: 0.5,
      status: ExpansionRecommendationStatus.PENDING,
    });
    created += 1;
  }

  return created;
}

export async function listExpansionRecommendations(query: {
  status?: ExpansionRecommendationStatus;
  limit?: number;
}) {
  const filter: Record<string, unknown> = {};
  if (query.status) filter.status = query.status;

  const items = await ExpansionRecommendation.find(filter)
    .sort({ score: -1 })
    .limit(query.limit ?? 50);

  return items.map((r) => ({
    id: r._id.toString(),
    targetType: r.targetType,
    targetId: r.targetId.toString(),
    score: r.score,
    reasons: r.reasons,
    confidence: r.confidence,
    status: r.status,
    createdAt: r.createdAt,
  }));
}

export async function acknowledgeExpansion(id: string) {
  return ExpansionRecommendation.findByIdAndUpdate(
    id,
    { $set: { status: ExpansionRecommendationStatus.ACKNOWLEDGED } },
    { new: true },
  );
}
