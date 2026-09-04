import { CoverageOpportunity, ShiftRecommendation } from '@/models/Network.js';
import { analyzeZoneSupplyDemand } from '@/modules/network/supply-demand.service.js';
import { ServiceZone } from '@/models/ServiceZone.js';
import { ServiceZoneAvailability } from '@/models/ServiceZoneAvailability.js';
import { CoverageOpportunityStatus, SupplyDemandStatus } from '@ghaarfix/shared-types';
import { AppError } from '@/utils/AppError.js';
import { ErrorCode } from '@ghaarfix/shared-types';
import { listProviderShifts } from '@/modules/network/shift.service.js';

export async function suggestCoverageOpportunities(providerId: string): Promise<number> {
  const zones = await ServiceZone.find({ isActive: true }).limit(5);
  let created = 0;

  for (let i = 0; i < zones.length - 1; i++) {
    const fromZone = zones[i];
    const toZone = zones[i + 1];
    const serviceIds = await ServiceZoneAvailability.distinct('serviceId', {
      serviceZoneId: toZone._id,
      isAvailable: true,
    });

    for (const serviceId of serviceIds.slice(0, 1)) {
      const analysis = await analyzeZoneSupplyDemand(toZone._id.toString(), serviceId.toString());
      if (analysis.status === SupplyDemandStatus.SURPLUS) continue;

      const existing = await CoverageOpportunity.findOne({
        providerId,
        toZoneId: toZone._id,
        status: CoverageOpportunityStatus.PENDING,
        expiresAt: { $gt: new Date() },
      });
      if (existing) continue;

      await CoverageOpportunity.create({
        providerId,
        fromZoneId: fromZone._id,
        toZoneId: toZone._id,
        reason: `Higher demand in ${toZone.name} — voluntary coverage expansion.`,
        estimatedDemand: analysis.estimatedDemand,
        estimatedTravelMinutes: 25,
        status: CoverageOpportunityStatus.PENDING,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });
      created += 1;
    }
  }

  return created;
}

export async function listProviderOpportunities(providerId: string) {
  const [coverage, shifts, recommendations] = await Promise.all([
    CoverageOpportunity.find({
      providerId,
      status: CoverageOpportunityStatus.PENDING,
      expiresAt: { $gt: new Date() },
    }).sort({ estimatedDemand: -1 }),
    listProviderShifts(providerId),
    ShiftRecommendation.find({
      providerId,
      status: 'PENDING',
      expiresAt: { $gt: new Date() },
    }).sort({ expectedOpportunityScore: -1 }),
  ]);

  return {
    coverageOpportunities: coverage.map((o) => ({
      id: o._id.toString(),
      fromZoneId: o.fromZoneId?.toString(),
      toZoneId: o.toZoneId.toString(),
      reason: o.reason,
      estimatedDemand: o.estimatedDemand,
      estimatedTravelMinutes: o.estimatedTravelMinutes,
      expiresAt: o.expiresAt,
      disclaimer: 'Expected opportunity — earnings are not guaranteed.',
    })),
    shifts,
    shiftRecommendations: recommendations.map((r) => ({
      id: r._id.toString(),
      date: r.date,
      startTime: r.startTime,
      endTime: r.endTime,
      zoneId: r.zoneId.toString(),
      serviceId: r.serviceId?.toString(),
      reason: r.reason,
      expectedOpportunityScore: r.expectedOpportunityScore,
      expiresAt: r.expiresAt,
      disclaimer: 'Suggested shift — you must confirm to activate.',
    })),
  };
}

export async function acceptCoverageOpportunity(providerId: string, opportunityId: string) {
  const opp = await CoverageOpportunity.findOne({
    _id: opportunityId,
    providerId,
    status: CoverageOpportunityStatus.PENDING,
    expiresAt: { $gt: new Date() },
  });
  if (!opp) throw new AppError('Coverage opportunity not found or expired.', 404, ErrorCode.NOT_FOUND);

  opp.status = CoverageOpportunityStatus.ACCEPTED;
  await opp.save();

  return {
    id: opp._id.toString(),
    status: opp.status,
    message: 'Coverage expansion accepted. Update your availability if needed.',
  };
}
