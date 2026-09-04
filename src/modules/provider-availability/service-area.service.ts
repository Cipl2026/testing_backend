import { ErrorCode, ServiceAreaType } from '@ghaarfix/shared-types';
import { ProviderServiceArea } from '@/models/ProviderServiceArea.js';
import { AppError } from '@/utils/AppError.js';
import { distanceKm, normalizePostalCode } from '@/utils/intervals.js';
import { serializeServiceArea } from '@/utils/availabilitySerializers.js';
import type { ServiceAreaBody } from '@/validators/availability.js';
import type { ICustomerAddress } from '@/models/CustomerAddress.js';

export async function listServiceAreas(providerId: string) {
  const items = await ProviderServiceArea.find({ providerId }).sort({ createdAt: -1 });
  return items.map(serializeServiceArea);
}

export async function createServiceArea(providerId: string, input: ServiceAreaBody) {
  try {
    const area = await ProviderServiceArea.create({
      providerId,
      name: input.name,
      type: input.type,
      center: { latitude: input.latitude, longitude: input.longitude },
      radiusKm: input.type === ServiceAreaType.RADIUS ? input.radiusKm! : 0,
      postalCodes:
        input.type === ServiceAreaType.POSTAL_CODES
          ? (input.postalCodes ?? []).map(normalizePostalCode)
          : [],
      isActive: input.isActive ?? true,
    });
    return serializeServiceArea(area);
  } catch {
    throw new AppError('Service area with this name already exists.', 409, ErrorCode.CONFLICT);
  }
}

export async function updateServiceArea(
  providerId: string,
  areaId: string,
  input: Partial<ServiceAreaBody>,
) {
  const area = await ProviderServiceArea.findOne({ _id: areaId, providerId });
  if (!area) throw new AppError('Service area not found.', 404, ErrorCode.NOT_FOUND);

  if (input.name) area.name = input.name;
  if (input.type) area.type = input.type;
  if (input.latitude !== undefined && input.longitude !== undefined) {
    area.center = { latitude: input.latitude, longitude: input.longitude };
  }
  if (input.radiusKm !== undefined) area.radiusKm = input.radiusKm;
  if (input.postalCodes) area.postalCodes = input.postalCodes.map(normalizePostalCode);
  if (input.isActive !== undefined) area.isActive = input.isActive;

  await area.save();
  return serializeServiceArea(area);
}

export async function deleteServiceArea(providerId: string, areaId: string) {
  const deleted = await ProviderServiceArea.findOneAndDelete({ _id: areaId, providerId });
  if (!deleted) throw new AppError('Service area not found.', 404, ErrorCode.NOT_FOUND);
}

export function addressMatchesServiceArea(
  address: ICustomerAddress,
  area: { type: ServiceAreaType; center: { latitude: number; longitude: number }; radiusKm: number; postalCodes: string[] },
): boolean {
  if (area.type === ServiceAreaType.POSTAL_CODES) {
    const normalized = normalizePostalCode(address.postalCode);
    return area.postalCodes.some((code) => normalizePostalCode(code) === normalized);
  }

  const [lon, lat] = address.location.coordinates;
  const dist = distanceKm(lat, lon, area.center.latitude, area.center.longitude);
  return dist <= area.radiusKm;
}

export async function providerMatchesAddress(providerId: string, address: ICustomerAddress): Promise<boolean> {
  const areas = await ProviderServiceArea.find({ providerId, isActive: true });
  if (areas.length === 0) return false;
  return areas.some((area) => addressMatchesServiceArea(address, area));
}

export async function adminListProviderServiceAreas(providerId: string) {
  return listServiceAreas(providerId);
}
