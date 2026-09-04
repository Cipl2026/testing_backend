import { ErrorCode, HomeCapability } from '@ghaarfix/shared-types';
import { Home } from '@/models/Home.js';
import { HomeAsset } from '@/models/HomeAsset.js';
import { AssetType } from '@/models/AssetType.js';
import { Room } from '@/models/Room.js';
import { Service } from '@/models/Service.js';
import {
  assertHomeCapability,
  getActiveHomeMembership,
} from '@/modules/home-members/home-permission.service.js';
import { AppError } from '@/utils/AppError.js';
import type { AssetSnapshot } from '@ghaarfix/shared-types';

export async function getAccessibleHome(customerId: string, homeId: string) {
  await assertHomeCapability(customerId, homeId, HomeCapability.HOME_VIEW);
  const home = await Home.findOne({ _id: homeId, isArchived: false });
  if (!home) throw new AppError('Home not found.', 404, ErrorCode.NOT_FOUND);
  return home;
}

/** @deprecated use getAccessibleHome — kept for internal callers expecting ownership semantics */
export async function getOwnedHome(customerId: string, homeId: string) {
  return getAccessibleHome(customerId, homeId);
}

export async function getOwnedAsset(customerId: string, assetId: string) {
  const asset = await HomeAsset.findOne({ _id: assetId, archivedAt: null });
  if (!asset) throw new AppError('Asset not found.', 404, ErrorCode.NOT_FOUND);
  await assertHomeCapability(customerId, asset.homeId.toString(), HomeCapability.ASSET_VIEW);
  return asset;
}

export async function validateAssetForService(
  customerId: string,
  serviceId: string,
  assetId: string,
  homeId?: string,
) {
  const [asset, service] = await Promise.all([
    getOwnedAsset(customerId, assetId),
    Service.findById(serviceId),
  ]);
  if (!service) throw new AppError('Service not found.', 404, ErrorCode.NOT_FOUND);

  if (homeId && asset.homeId.toString() !== homeId) {
    throw new AppError('Asset does not belong to this home.', 409, ErrorCode.CONFLICT);
  }

  await assertHomeCapability(customerId, asset.homeId.toString(), HomeCapability.BOOKING_CREATE);

  const supported = service.supportedAssetTypeIds ?? [];
  if (supported.length > 0 && !supported.some((id) => id.toString() === asset.assetTypeId.toString())) {
    throw new AppError('This service is not compatible with the selected asset.', 409, ErrorCode.CONFLICT);
  }

  return asset;
}

export async function buildAssetSnapshot(assetId: string): Promise<AssetSnapshot> {
  const asset = await HomeAsset.findById(assetId);
  if (!asset) throw new AppError('Asset not found.', 404, ErrorCode.NOT_FOUND);

  const [assetType, room] = await Promise.all([
    AssetType.findById(asset.assetTypeId),
    asset.roomId ? Room.findById(asset.roomId) : null,
  ]);

  return {
    name: asset.name,
    assetTypeName: assetType?.name ?? 'Asset',
    brand: asset.brand,
    model: asset.model,
    serialNumber: asset.serialNumber,
    roomName: room?.name,
  };
}

export function serviceRequiresAsset(service: { supportedAssetTypeIds?: unknown[] }): boolean {
  return (service.supportedAssetTypeIds?.length ?? 0) > 0;
}

export async function getHomeMembership(customerId: string, homeId: string) {
  return getActiveHomeMembership(homeId, customerId);
}
