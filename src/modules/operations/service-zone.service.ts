import { ServiceZoneType } from '@ghaarfix/shared-types';
import { ErrorCode } from '@ghaarfix/shared-types';
import { City } from '@/models/City.js';
import { ServiceZone, type IServiceZone } from '@/models/ServiceZone.js';
import { cacheDel, cacheGetOrSet, CacheCatalog } from '@/infra/cache.service.js';
import { slugify } from '@/utils/catalog.js';
import { AppError } from '@/utils/AppError.js';

function serializeZone(zone: IServiceZone) {
  return {
    id: zone._id.toString(),
    name: zone.name,
    slug: zone.slug,
    type: zone.type,
    cityId: zone.cityId.toString(),
    postalCodes: zone.postalCodes,
    priority: zone.priority,
    isActive: zone.isActive,
    hasBoundary: Boolean(zone.boundary),
  };
}

export async function listServiceZones(filters?: { cityId?: string; activeOnly?: boolean }) {
  const cacheKey = `${CacheCatalog.SERVICE_ZONES}:${filters?.cityId ?? 'all'}:${filters?.activeOnly ?? true}`;
  return cacheGetOrSet(cacheKey, async () => {
    const query: Record<string, unknown> = {};
    if (filters?.cityId) query.cityId = filters.cityId;
    if (filters?.activeOnly !== false) query.isActive = true;
    const zones = await ServiceZone.find(query).sort({ priority: -1, name: 1 });
    return zones.map(serializeZone);
  });
}

export async function getServiceZoneById(id: string) {
  const zone = await ServiceZone.findById(id);
  if (!zone) throw new AppError('Service zone not found.', 404, ErrorCode.NOT_FOUND);
  return serializeZone(zone);
}

export async function createServiceZone(input: {
  name: string;
  type: ServiceZoneType;
  cityId: string;
  boundary?: IServiceZone['boundary'];
  postalCodes?: string[];
  priority?: number;
  isActive?: boolean;
}) {
  const city = await City.findById(input.cityId);
  if (!city) throw new AppError('City not found.', 404, ErrorCode.NOT_FOUND);
  const slug = slugify(`${city.slug}-${input.name}`);
  const zone = await ServiceZone.create({
    name: input.name,
    slug,
    type: input.type,
    cityId: input.cityId,
    boundary: input.boundary,
    postalCodes: input.postalCodes ?? [],
    priority: input.priority ?? 0,
    isActive: input.isActive ?? true,
  });
  await cacheDel(`${CacheCatalog.SERVICE_ZONES}:all:true`);
  return serializeZone(zone);
}

export async function updateServiceZone(
  id: string,
  input: Partial<{
    name: string;
    type: ServiceZoneType;
    boundary: IServiceZone['boundary'];
    postalCodes: string[];
    priority: number;
    isActive: boolean;
  }>,
) {
  const zone = await ServiceZone.findById(id);
  if (!zone) throw new AppError('Service zone not found.', 404, ErrorCode.NOT_FOUND);
  if (input.name !== undefined) zone.name = input.name;
  if (input.type !== undefined) zone.type = input.type;
  if (input.boundary !== undefined) zone.boundary = input.boundary;
  if (input.postalCodes !== undefined) zone.postalCodes = input.postalCodes;
  if (input.priority !== undefined) zone.priority = input.priority;
  if (input.isActive !== undefined) zone.isActive = input.isActive;
  await zone.save();
  await cacheDel(`${CacheCatalog.SERVICE_ZONES}:all:true`);
  return serializeZone(zone);
}

export async function deleteServiceZone(id: string) {
  const zone = await ServiceZone.findByIdAndDelete(id);
  if (!zone) throw new AppError('Service zone not found.', 404, ErrorCode.NOT_FOUND);
  await cacheDel(`${CacheCatalog.SERVICE_ZONES}:all:true`);
}

export async function resolveZoneByPoint(
  longitude: number,
  latitude: number,
  postalCode?: string,
): Promise<IServiceZone | null> {
  if (postalCode) {
    const pincodeZone = await ServiceZone.findOne({
      isActive: true,
      type: { $in: [ServiceZoneType.PINCODE, ServiceZoneType.CUSTOM] },
      postalCodes: postalCode,
    }).sort({ priority: -1 });
    if (pincodeZone) return pincodeZone;
  }

  const polygonZone = await ServiceZone.findOne({
    isActive: true,
    type: ServiceZoneType.POLYGON,
    boundary: {
      $geoIntersects: {
        $geometry: { type: 'Point', coordinates: [longitude, latitude] },
      },
    },
  }).sort({ priority: -1 });

  if (polygonZone) return polygonZone;

  if (postalCode) {
    const cityWide = await ServiceZone.findOne({
      isActive: true,
      type: ServiceZoneType.CITY_WIDE,
    }).sort({ priority: -1 });
    if (cityWide) return cityWide;
  }

  return null;
}

export async function resolveZoneByPostalCode(postalCode: string): Promise<IServiceZone | null> {
  return ServiceZone.findOne({
    isActive: true,
    postalCodes: postalCode,
  }).sort({ priority: -1 });
}
