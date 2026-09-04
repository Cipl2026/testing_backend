import mongoose from 'mongoose';
import { ServiceArea } from '@/models/Globalization.js';
import { RegionServiceAreaType } from '@ghaarfix/shared-types';
import { AppError } from '@/utils/AppError.js';
import { ErrorCode } from '@ghaarfix/shared-types';

export async function listServiceAreas(regionId?: string) {
  const query = regionId ? { regionId } : {};
  return ServiceArea.find(query).sort({ priority: -1, name: 1 });
}

export async function createServiceArea(input: {
  regionId: string;
  name: string;
  type: RegionServiceAreaType;
  priority?: number;
  postalCodes?: string[];
  center?: { latitude: number; longitude: number };
  radiusMeters?: number;
  serviceZoneId?: string;
}) {
  return ServiceArea.create({
    ...input,
    regionId: new mongoose.Types.ObjectId(input.regionId),
    serviceZoneId: input.serviceZoneId && mongoose.Types.ObjectId.isValid(input.serviceZoneId)
      ? new mongoose.Types.ObjectId(input.serviceZoneId)
      : undefined,
    isActive: true,
  });
}

export async function updateServiceArea(
  id: string,
  input: Partial<{
    name: string;
    isActive: boolean;
    priority: number;
    postalCodes: string[];
    radiusMeters: number;
  }>,
) {
  const area = await ServiceArea.findByIdAndUpdate(id, input, { new: true });
  if (!area) throw new AppError('Service area not found.', 404, ErrorCode.NOT_FOUND);
  return area;
}
