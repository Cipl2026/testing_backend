import { City } from '@/models/City.js';
import type { IServiceZone } from '@/models/ServiceZone.js';
import type { ServiceZoneSnapshot } from '@/models/Booking.js';
import * as serviceZoneService from '@/modules/operations/service-zone.service.js';

export interface ZoneResolutionInput {
  city?: string;
  postalCode?: string;
  location?: { latitude: number; longitude: number };
}

export interface ZoneResolutionResult {
  city: { id: string; name: string; slug: string } | null;
  zone: { id: string; name: string; type: string } | null;
  snapshot: ServiceZoneSnapshot | null;
}

async function resolveCityByName(cityName?: string) {
  if (!cityName) return null;
  const city = await City.findOne({
    isActive: true,
    name: new RegExp(`^${cityName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
  });
  if (!city) return null;
  return { id: city._id.toString(), name: city.name, slug: city.slug };
}

function buildSnapshot(zone: IServiceZone, cityName: string): ServiceZoneSnapshot {
  return {
    zoneId: zone._id.toString(),
    zoneName: zone.name,
    zoneType: zone.type,
    cityId: zone.cityId.toString(),
    cityName,
  };
}

export async function resolveAddressToZone(
  input: ZoneResolutionInput,
): Promise<ZoneResolutionResult> {
  const city = await resolveCityByName(input.city);
  let zone: IServiceZone | null = null;

  if (input.location) {
    zone = await serviceZoneService.resolveZoneByPoint(
      input.location.longitude,
      input.location.latitude,
      input.postalCode,
    );
  } else if (input.postalCode) {
    zone = await serviceZoneService.resolveZoneByPostalCode(input.postalCode);
  }

  if (!zone) {
    return { city, zone: null, snapshot: null };
  }

  const zoneCity = await City.findById(zone.cityId);
  const cityName = zoneCity?.name ?? input.city ?? 'Unknown';

  return {
    city: city ?? (zoneCity ? { id: zoneCity._id.toString(), name: zoneCity.name, slug: zoneCity.slug } : null),
    zone: { id: zone._id.toString(), name: zone.name, type: zone.type },
    snapshot: buildSnapshot(zone, cityName),
  };
}

export async function persistZoneSnapshotForBooking(
  bookingId: string,
  snapshot: ServiceZoneSnapshot,
  serviceZoneId: string,
): Promise<void> {
  const { Booking } = await import('@/models/Booking.js');
  await Booking.findByIdAndUpdate(bookingId, {
    $set: { serviceZoneId, serviceZoneSnapshot: snapshot },
  });
}
