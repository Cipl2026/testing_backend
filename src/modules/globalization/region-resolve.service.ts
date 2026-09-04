import { Region, ServiceArea } from '@/models/Globalization.js';
import { RegionType } from '@ghaarfix/shared-types';
import { resolveAddressToZone } from '@/modules/operations/zone-resolution.service.js';
import { resolveRegionalPolicies } from '@/modules/globalization/regional-config.service.js';
import { AppError } from '@/utils/AppError.js';
import { ErrorCode } from '@ghaarfix/shared-types';

export interface RegionResolveResult {
  supported: boolean;
  region: {
    id: string;
    code: string;
    name: string;
    type: string;
    currency: string;
    timezone: string;
    defaultLocale: string;
    supportedLocales: string[];
  } | null;
  serviceArea: { id: string; name: string } | null;
  zone: { id: string; name: string } | null;
  city: { id: string; name: string } | null;
  paymentMethods: string[];
  message?: string;
}

export async function resolveRegionFromLocation(input: {
  latitude?: number;
  longitude?: number;
  city?: string;
  state?: string;
  countryCode?: string;
  postalCode?: string;
}): Promise<RegionResolveResult> {
  const zoneResult = await resolveAddressToZone({
    city: input.city,
    postalCode: input.postalCode,
    location:
      input.latitude != null && input.longitude != null
        ? { latitude: input.latitude, longitude: input.longitude }
        : undefined,
  });

  let region = null as InstanceType<typeof Region> | null;
  let serviceArea = null;

  if (input.latitude != null && input.longitude != null) {
    const areas = await ServiceArea.find({ isActive: true }).sort({ priority: -1 });
    for (const area of areas) {
      if (area.postalCodes?.length && input.postalCode && area.postalCodes.includes(input.postalCode)) {
        serviceArea = area;
        break;
      }
      if (area.radiusMeters && area.center) {
        const dist = haversineMeters(
          input.latitude,
          input.longitude,
          area.center.latitude,
          area.center.longitude,
        );
        if (dist <= area.radiusMeters) {
          serviceArea = area;
          break;
        }
      }
    }
    if (serviceArea) {
      region = await Region.findById(serviceArea.regionId);
    }
  }

  if (!region && zoneResult.zone) {
    region = await Region.findOne({
      serviceZoneId: zoneResult.zone.id,
      isActive: true,
    });
  }

  if (!region && zoneResult.city) {
    region = await Region.findOne({
      cityId: zoneResult.city.id,
      type: RegionType.CITY,
      isActive: true,
    });
  }

  if (!region && input.countryCode) {
    region = await Region.findOne({
      countryCode: input.countryCode.toUpperCase(),
      type: RegionType.COUNTRY,
    });
  }

  if (!region && !input.countryCode) {
    region = await Region.findOne({ code: 'IN', isActive: true });
  }

  if (region && input.countryCode && !region.isActive) {
    return {
      supported: false,
      region: {
        id: region._id.toString(),
        code: region.code,
        name: region.name,
        type: region.type,
        currency: region.currencyCode,
        timezone: region.timezone,
        defaultLocale: region.locale,
        supportedLocales: [region.locale],
      },
      serviceArea: serviceArea ? { id: serviceArea._id.toString(), name: serviceArea.name } : null,
      zone: zoneResult.zone,
      city: zoneResult.city,
      paymentMethods: [],
      message: 'Service not available in this region yet.',
    };
  }

  if (!region || !region.isActive || !region.serviceAvailability) {
    return {
      supported: false,
      region: region ? await serializeResolvedRegion(region) : null,
      serviceArea: serviceArea ? { id: serviceArea._id.toString(), name: serviceArea.name } : null,
      zone: zoneResult.zone,
      city: zoneResult.city,
      paymentMethods: [],
      message: region
        ? 'Service not available in this region yet.'
        : 'Unable to determine service region. Please verify your location.',
    };
  }

  const policies = await resolveRegionalPolicies(region._id.toString());

  return {
    supported: true,
    region: {
      id: region._id.toString(),
      code: region.code,
      name: region.name,
      type: region.type,
      currency: policies.currency,
      timezone: policies.timezone,
      defaultLocale: policies.defaultLocale,
      supportedLocales: policies.supportedLocales,
    },
    serviceArea: serviceArea ? { id: serviceArea._id.toString(), name: serviceArea.name } : null,
    zone: zoneResult.zone,
    city: zoneResult.city,
    paymentMethods: policies.paymentMethods,
  };
}

async function serializeResolvedRegion(region: InstanceType<typeof Region>) {
  const policies = await resolveRegionalPolicies(region._id.toString());
  return {
    id: region._id.toString(),
    code: region.code,
    name: region.name,
    type: region.type,
    currency: policies.currency,
    timezone: policies.timezone,
    defaultLocale: policies.defaultLocale,
    supportedLocales: policies.supportedLocales,
  };
}

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export async function assertRegionSupported(regionId: string): Promise<void> {
  const region = await Region.findById(regionId);
  if (!region?.isActive || !region.serviceAvailability) {
    throw new AppError('Service not available in this region.', 403, ErrorCode.FORBIDDEN);
  }
}
