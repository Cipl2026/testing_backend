import { ErrorCode, ProviderShiftStatus, ProviderSkillStatus, SupplyDemandStatus } from '@ghaarfix/shared-types';
import { ProviderShift, ShiftRecommendation } from '@/models/Network.js';
import { AppError } from '@/utils/AppError.js';
import { localDateString, shiftsOverlap } from '@/modules/network/time-bucket.util.js';
import { analyzeZoneSupplyDemand } from '@/modules/network/supply-demand.service.js';
import { ProviderSkill } from '@/models/ProviderSkill.js';
import { ServiceZone } from '@/models/ServiceZone.js';

export async function listProviderShifts(providerId: string, query?: { date?: string }) {
  const filter: Record<string, unknown> = { providerId };
  if (query?.date) filter.date = query.date;

  const items = await ProviderShift.find(filter).sort({ date: 1, startTime: 1 });
  return items.map(serializeShift);
}

export async function createProviderShift(
  providerId: string,
  input: {
    date: string;
    startTime: string;
    endTime: string;
    preferredZones?: string[];
    capacityLimit?: number;
    confirm?: boolean;
  },
) {
  const existing = await ProviderShift.find({
    providerId,
    date: input.date,
    status: { $ne: ProviderShiftStatus.CANCELLED },
  });

  for (const shift of existing) {
    if (shiftsOverlap(shift, input)) {
      throw new AppError('Shift overlaps with an existing shift.', 409, ErrorCode.CONFLICT);
    }
  }

  const shift = await ProviderShift.create({
    providerId,
    date: input.date,
    startTime: input.startTime,
    endTime: input.endTime,
    preferredZones: input.preferredZones ?? [],
    capacityLimit: input.capacityLimit ?? 8,
    status: ProviderShiftStatus.PLANNED,
    confirmedByProvider: input.confirm ?? true,
  });

  return serializeShift(shift);
}

export async function updateProviderShift(
  providerId: string,
  shiftId: string,
  input: Partial<{
    startTime: string;
    endTime: string;
    preferredZones: string[];
    capacityLimit: number;
    status: ProviderShiftStatus;
    confirm: boolean;
  }>,
) {
  const shift = await ProviderShift.findOne({ _id: shiftId, providerId });
  if (!shift) throw new AppError('Shift not found.', 404, ErrorCode.NOT_FOUND);

  if (input.startTime) shift.startTime = input.startTime;
  if (input.endTime) shift.endTime = input.endTime;
  if (input.preferredZones) shift.preferredZones = input.preferredZones as never;
  if (input.capacityLimit !== undefined) shift.capacityLimit = input.capacityLimit;
  if (input.status) shift.status = input.status;
  if (input.confirm) shift.confirmedByProvider = true;

  const siblings = await ProviderShift.find({
    providerId,
    date: shift.date,
    _id: { $ne: shift._id },
    status: { $ne: ProviderShiftStatus.CANCELLED },
  });
  for (const s of siblings) {
    if (shiftsOverlap(s, shift)) {
      throw new AppError('Updated shift would overlap.', 409, ErrorCode.CONFLICT);
    }
  }

  await shift.save();
  return serializeShift(shift);
}

export async function generateShiftRecommendations(providerId: string): Promise<number> {
  const skills = await ProviderSkill.find({
    providerId,
    status: ProviderSkillStatus.VERIFIED,
  }).limit(5);

  let created = 0;
  const tomorrow = localDateString(new Date(Date.now() + 86400000));

  for (const skill of skills) {
    const zones = await ServiceZone.find({ isActive: true }).limit(3);

    for (const zone of zones) {
      const analysis = await analyzeZoneSupplyDemand(zone._id.toString(), skill.skillId.toString());
      if (analysis.status === SupplyDemandStatus.SURPLUS || analysis.status === SupplyDemandStatus.BALANCED) continue;

      const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
      const existing = await ShiftRecommendation.findOne({
        providerId,
        zoneId: zone._id,
        date: tomorrow,
        status: 'PENDING',
      });
      if (existing) continue;

      await ShiftRecommendation.create({
        providerId,
        date: tomorrow,
        startTime: '14:00',
        endTime: '18:00',
        zoneId: zone._id,
        serviceId: skill.skillId,
        reason: `High demand expected — ${analysis.explanation}`,
        expectedOpportunityScore: Math.round((1 / Math.max(analysis.supplyDemandRatio, 0.1)) * 10),
        expiresAt,
      });
      created += 1;
    }
  }

  return created;
}

function serializeShift(shift: InstanceType<typeof ProviderShift>) {
  return {
    id: shift._id.toString(),
    providerId: shift.providerId.toString(),
    date: shift.date,
    startTime: shift.startTime,
    endTime: shift.endTime,
    preferredZones: shift.preferredZones.map((z) => z.toString()),
    status: shift.status,
    capacityLimit: shift.capacityLimit,
    confirmedByProvider: shift.confirmedByProvider,
    createdAt: shift.createdAt,
  };
}
