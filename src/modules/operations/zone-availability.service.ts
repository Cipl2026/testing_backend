import { ServiceZoneAvailability } from '@/models/ServiceZoneAvailability.js';
import { Service } from '@/models/Service.js';
import { cacheGetOrSet, CacheCatalog } from '@/infra/cache.service.js';

export async function listZoneAvailability(serviceZoneId: string) {
  const cacheKey = `${CacheCatalog.ZONE_AVAILABILITY}:${serviceZoneId}`;
  return cacheGetOrSet(cacheKey, async () => {
    const rows = await ServiceZoneAvailability.find({ serviceZoneId, isAvailable: true });
    return rows.map((r) => ({
      serviceId: r.serviceId.toString(),
      isAvailable: r.isAvailable,
      capacityHint: r.capacityHint,
    }));
  });
}

export async function isServiceAvailableInZone(
  serviceZoneId: string,
  serviceId: string,
): Promise<boolean> {
  const row = await ServiceZoneAvailability.findOne({ serviceZoneId, serviceId });
  return row ? row.isAvailable : true;
}

export async function filterServiceIdsByZone(
  serviceZoneId: string,
  serviceIds: string[],
): Promise<string[]> {
  if (!serviceIds.length) return [];
  const unavailable = await ServiceZoneAvailability.find({
    serviceZoneId,
    serviceId: { $in: serviceIds },
    isAvailable: false,
  }).select('serviceId');
  const blocked = new Set(unavailable.map((r) => r.serviceId.toString()));
  return serviceIds.filter((id) => !blocked.has(id));
}

export async function filterCatalogByZone(serviceZoneId?: string) {
  if (!serviceZoneId) {
    const services = await Service.find({ isActive: true }).select('_id');
    return services.map((s) => s._id.toString());
  }
  const allActive = await Service.find({ isActive: true }).select('_id');
  const allIds = allActive.map((s) => s._id.toString());
  return filterServiceIdsByZone(serviceZoneId, allIds);
}

export async function upsertZoneAvailability(input: {
  serviceZoneId: string;
  serviceId: string;
  isAvailable: boolean;
  capacityHint?: number;
  notes?: string;
}) {
  const row = await ServiceZoneAvailability.findOneAndUpdate(
    { serviceZoneId: input.serviceZoneId, serviceId: input.serviceId },
    {
      $set: {
        isAvailable: input.isAvailable,
        capacityHint: input.capacityHint,
        notes: input.notes,
      },
    },
    { upsert: true, new: true },
  );
  return {
    serviceZoneId: row.serviceZoneId.toString(),
    serviceId: row.serviceId.toString(),
    isAvailable: row.isAvailable,
    capacityHint: row.capacityHint,
  };
}

export async function removeZoneAvailability(serviceZoneId: string, serviceId: string) {
  await ServiceZoneAvailability.deleteOne({ serviceZoneId, serviceId });
}
