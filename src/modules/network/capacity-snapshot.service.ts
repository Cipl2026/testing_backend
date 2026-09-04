import { ZoneCapacitySnapshot } from '@/models/Network.js';
import { ServiceZone } from '@/models/ServiceZone.js';
import { ServiceZoneAvailability } from '@/models/ServiceZoneAvailability.js';
import { countZoneSupply } from '@/modules/network/provider-supply.service.js';
import {
  analyzeZoneSupplyDemand,
  estimateDemandForZone,
} from '@/modules/network/supply-demand.service.js';
import { floorToBucket } from '@/modules/network/time-bucket.util.js';

export async function captureZoneCapacitySnapshot(
  zoneId: string,
  serviceId: string,
  at = new Date(),
) {
  const bucket = floorToBucket(at);
  const supply = await countZoneSupply(zoneId, serviceId, bucket);
  const demand = await estimateDemandForZone(zoneId, serviceId, bucket);
  const analysis = await analyzeZoneSupplyDemand(zoneId, serviceId, at);

  return ZoneCapacitySnapshot.findOneAndUpdate(
    { zoneId, serviceId, timeBucket: bucket },
    {
      $set: {
        availableProviders: supply.availableProviders,
        activeProviders: supply.onlineProviders,
        scheduledCapacity: supply.scheduledCapacity,
        bookedCapacity: supply.bookedCapacity,
        estimatedDemand: demand,
        supplyDemandRatio: analysis.supplyDemandRatio,
        supplyStatus: analysis.status,
      },
    },
    { upsert: true, new: true },
  );
}

export async function captureAllZoneSnapshots(at = new Date()): Promise<number> {
  const zones = await ServiceZone.find({ isActive: true }).select('_id');
  let count = 0;

  for (const zone of zones) {
    const services = await ServiceZoneAvailability.find({
      serviceZoneId: zone._id,
      isAvailable: true,
    }).select('serviceId');

    const serviceIds =
      services.length > 0
        ? services.map((s) => s.serviceId.toString())
        : (
            await ServiceZoneAvailability.distinct('serviceId', { serviceZoneId: zone._id })
          ).map(String);

    if (!serviceIds.length) continue;

    for (const serviceId of serviceIds) {
      await captureZoneCapacitySnapshot(zone._id.toString(), serviceId, at);
      count += 1;
    }
  }

  return count;
}

export async function listCapacitySnapshots(query: {
  zoneId?: string;
  serviceId?: string;
  limit?: number;
}) {
  const filter: Record<string, unknown> = {};
  if (query.zoneId) filter.zoneId = query.zoneId;
  if (query.serviceId) filter.serviceId = query.serviceId;

  const items = await ZoneCapacitySnapshot.find(filter)
    .sort({ timeBucket: -1 })
    .limit(query.limit ?? 100);

  return items.map((s) => ({
    id: s._id.toString(),
    zoneId: s.zoneId.toString(),
    serviceId: s.serviceId.toString(),
    timeBucket: s.timeBucket,
    availableProviders: s.availableProviders,
    activeProviders: s.activeProviders,
    scheduledCapacity: s.scheduledCapacity,
    bookedCapacity: s.bookedCapacity,
    estimatedDemand: s.estimatedDemand,
    supplyDemandRatio: s.supplyDemandRatio,
    supplyStatus: s.supplyStatus,
    createdAt: s.createdAt,
  }));
}
