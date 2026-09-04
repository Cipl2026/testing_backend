import { DateTime } from 'luxon';
import { ZoneDemandMetric } from '@/models/ZoneDemandMetric.js';
import { ServiceWaitlist } from '@/models/ServiceWaitlist.js';
import { SlotReservation } from '@/models/SlotReservation.js';
import { SlotReservationStatus } from '@ghaarfix/shared-types';
import * as waitlistService from '@/modules/operations/waitlist.service.js';
import * as providerCapacityService from '@/modules/operations/provider-capacity.service.js';
import { logger } from '@/utils/logger.js';

export async function runWaitlistMatchingJob(): Promise<number> {
  const zones = await ServiceWaitlist.distinct('serviceZoneId', { status: 'PENDING' });
  let total = 0;
  for (const zoneId of zones) {
    const serviceIds = await ServiceWaitlist.distinct('serviceId', {
      serviceZoneId: zoneId,
      status: 'PENDING',
    });
    for (const serviceId of serviceIds) {
      total += await waitlistService.matchWaitlistOnCapacityIncrease(
        zoneId.toString(),
        serviceId.toString(),
      );
    }
  }
  return total;
}

export async function runCapacityRollupJob(): Promise<number> {
  return providerCapacityService.rollupDailyCapacity();
}

export async function cleanupExpiredReservations(): Promise<number> {
  const result = await SlotReservation.updateMany(
    {
      status: SlotReservationStatus.HELD,
      expiresAt: { $lte: new Date() },
    },
    { $set: { status: SlotReservationStatus.EXPIRED } },
  );
  return result.modifiedCount;
}

export async function aggregateZoneDemand(): Promise<number> {
  const now = DateTime.now().setZone('Asia/Kolkata');
  const date = now.toISODate()!;
  const hour = now.hour;

  const waitlistByZone = await ServiceWaitlist.aggregate([
    { $match: { status: 'PENDING' } },
    { $group: { _id: { zone: '$serviceZoneId', service: '$serviceId' }, count: { $sum: 1 } } },
  ]);

  let upserted = 0;
  for (const row of waitlistByZone) {
    await ZoneDemandMetric.findOneAndUpdate(
      {
        serviceZoneId: row._id.zone,
        serviceId: row._id.service,
        date,
        hour,
      },
      {
        $set: { waitlistCount: row.count },
        $inc: { requestCount: 0 },
      },
      { upsert: true },
    );
    upserted += 1;
  }
  return upserted;
}

export async function runPhase11Jobs() {
  const results = await Promise.allSettled([
    runWaitlistMatchingJob(),
    runCapacityRollupJob(),
    cleanupExpiredReservations(),
    aggregateZoneDemand(),
    waitlistService.expireStaleWaitlist(),
  ]);

  const summary = {
    waitlistMatched: results[0].status === 'fulfilled' ? results[0].value : 0,
    capacityRollup: results[1].status === 'fulfilled' ? results[1].value : 0,
    reservationsCleaned: results[2].status === 'fulfilled' ? results[2].value : 0,
    zoneDemandRows: results[3].status === 'fulfilled' ? results[3].value : 0,
    waitlistExpired: results[4].status === 'fulfilled' ? results[4].value : 0,
  };

  if (Object.values(summary).some((v) => v > 0)) {
    logger.info('Ran Phase 11 operations jobs', summary);
  }
  return summary;
}
