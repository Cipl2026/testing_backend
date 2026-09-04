import {
  AssetCondition,
  AssetHealthStatus,
  ErrorCode,
  MaintenanceScheduleStatus,
  RoomType,
  WarrantyStatus,
} from '@ghaarfix/shared-types';
import { AssetServiceRecord } from '@/models/AssetServiceRecord.js';
import { AssetType } from '@/models/AssetType.js';
import { HomeAsset } from '@/models/HomeAsset.js';
import { MaintenanceSchedule } from '@/models/MaintenanceSchedule.js';
import { Room } from '@/models/Room.js';
import { Warranty } from '@/models/Warranty.js';
import { getOwnedAsset, getOwnedHome } from '@/modules/home-health/helpers.js';
import { generateMaintenanceSchedulesForAsset } from '@/modules/home-health/maintenance.service.js';
import { AppError } from '@/utils/AppError.js';

function serializeAsset(
  asset: InstanceType<typeof HomeAsset>,
  extras?: {
    assetTypeName?: string;
    assetTypeSlug?: string;
    roomName?: string;
    healthStatus?: AssetHealthStatus;
    healthReason?: string;
  },
) {
  return {
    id: asset._id.toString(),
    homeId: asset.homeId.toString(),
    roomId: asset.roomId?.toString(),
    assetTypeId: asset.assetTypeId.toString(),
    assetTypeName: extras?.assetTypeName,
    assetTypeSlug: extras?.assetTypeSlug,
    roomName: extras?.roomName,
    name: asset.name,
    brand: asset.brand,
    model: asset.model,
    serialNumber: asset.serialNumber,
    purchaseDate: asset.purchaseDate?.toISOString(),
    purchasePrice: asset.purchasePrice,
    installedAt: asset.installedAt?.toISOString(),
    condition: asset.condition,
    photoUrl: asset.photoUrl,
    healthStatus: extras?.healthStatus ?? AssetHealthStatus.UNKNOWN,
    healthReason: extras?.healthReason,
    createdAt: asset.createdAt.toISOString(),
  };
}

export async function computeAssetHealth(assetId: string): Promise<{ status: AssetHealthStatus; reason?: string }> {
  const now = new Date();
  const [overdueSchedule, expiringWarranty, lastRecord] = await Promise.all([
    MaintenanceSchedule.findOne({
      assetId,
      status: { $in: [MaintenanceScheduleStatus.DUE, MaintenanceScheduleStatus.OVERDUE] },
    }).sort({ nextDueAt: 1 }),
    Warranty.findOne({
      assetId,
      status: { $in: [WarrantyStatus.ACTIVE, WarrantyStatus.EXPIRING] },
      endDate: { $lte: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000), $gte: now },
    }),
    AssetServiceRecord.findOne({ assetId }).sort({ performedAt: -1 }),
  ]);

  if (overdueSchedule?.status === MaintenanceScheduleStatus.OVERDUE) {
    return { status: AssetHealthStatus.MAINTENANCE_DUE, reason: 'Maintenance is overdue.' };
  }
  if (overdueSchedule?.status === MaintenanceScheduleStatus.DUE) {
    return { status: AssetHealthStatus.MAINTENANCE_DUE, reason: 'Maintenance is due.' };
  }
  if (expiringWarranty) {
    const days = Math.ceil((expiringWarranty.endDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
    return { status: AssetHealthStatus.WARRANTY_EXPIRING, reason: `Warranty expires in ${days} days.` };
  }
  if (lastRecord) {
    const monthsSince =
      (now.getTime() - lastRecord.performedAt.getTime()) / (30 * 24 * 60 * 60 * 1000);
    if (monthsSince > 8) {
      return { status: AssetHealthStatus.ATTENTION_NEEDED, reason: 'Not serviced in over 8 months.' };
    }
  }
  return { status: AssetHealthStatus.GOOD, reason: 'Everything looks good.' };
}

export async function listHomeAssets(customerId: string, homeId: string) {
  await getOwnedHome(customerId, homeId);
  const assets = await HomeAsset.find({ homeId, archivedAt: null }).sort({ name: 1 });
  const items = [];
  for (const asset of assets) {
    const [assetType, room, health] = await Promise.all([
      AssetType.findById(asset.assetTypeId),
      asset.roomId ? Room.findById(asset.roomId) : null,
      computeAssetHealth(asset._id.toString()),
    ]);
    items.push(
      serializeAsset(asset, {
        assetTypeName: assetType?.name,
        assetTypeSlug: assetType?.slug,
        roomName: room?.name,
        healthStatus: health.status,
        healthReason: health.reason,
      }),
    );
  }
  return items;
}

export async function createAsset(
  customerId: string,
  homeId: string,
  input: {
    assetTypeId: string;
    name: string;
    roomId?: string;
    brand?: string;
    model?: string;
    serialNumber?: string;
    purchaseDate?: string;
    purchasePrice?: number;
    installedAt?: string;
    condition?: AssetCondition;
  },
) {
  await getOwnedHome(customerId, homeId);
  const assetType = await AssetType.findOne({ _id: input.assetTypeId, isActive: true });
  if (!assetType) throw new AppError('Asset type not found.', 404, ErrorCode.NOT_FOUND);

  if (input.roomId) {
    const room = await Room.findOne({ _id: input.roomId, homeId, isDeleted: false });
    if (!room) throw new AppError('Room not found.', 404, ErrorCode.NOT_FOUND);
  }

  const asset = await HomeAsset.create({
    homeId,
    customerId,
    roomId: input.roomId,
    assetTypeId: input.assetTypeId,
    name: input.name,
    brand: input.brand,
    model: input.model,
    serialNumber: input.serialNumber,
    purchaseDate: input.purchaseDate ? new Date(input.purchaseDate) : undefined,
    purchasePrice: input.purchasePrice,
    installedAt: input.installedAt ? new Date(input.installedAt) : undefined,
    condition: input.condition ?? AssetCondition.UNKNOWN,
  });

  await generateMaintenanceSchedulesForAsset(asset);
  const health = await computeAssetHealth(asset._id.toString());
  return serializeAsset(asset, {
    assetTypeName: assetType.name,
    assetTypeSlug: assetType.slug,
    healthStatus: health.status,
    healthReason: health.reason,
  });
}

export async function getAsset(customerId: string, assetId: string) {
  const asset = await getOwnedAsset(customerId, assetId);
  const [assetType, room, health, records, warranties] = await Promise.all([
    AssetType.findById(asset.assetTypeId),
    asset.roomId ? Room.findById(asset.roomId) : null,
    computeAssetHealth(assetId),
    AssetServiceRecord.find({ assetId }).sort({ performedAt: -1 }).limit(5),
    Warranty.find({ assetId }).sort({ endDate: -1 }),
  ]);

  const totalCost = await AssetServiceRecord.aggregate([
    { $match: { assetId: asset._id } },
    { $group: { _id: null, total: { $sum: '$cost' } } },
  ]);

  return {
    ...serializeAsset(asset, {
      assetTypeName: assetType?.name,
      assetTypeSlug: assetType?.slug,
      roomName: room?.name,
      healthStatus: health.status,
      healthReason: health.reason,
    }),
    totalServiceCost: totalCost[0]?.total ?? 0,
    recentServices: records.map((r) => ({
      id: r._id.toString(),
      bookingId: r.bookingId.toString(),
      summary: r.summary,
      cost: r.cost,
      performedAt: r.performedAt.toISOString(),
    })),
    warranties: warranties.map((w) => ({
      id: w._id.toString(),
      provider: w.provider,
      endDate: w.endDate.toISOString(),
      status: w.status,
    })),
  };
}

export async function updateAsset(
  customerId: string,
  assetId: string,
  input: Partial<{
    name: string;
    roomId: string;
    brand: string;
    model: string;
    serialNumber: string;
    purchaseDate: string;
    purchasePrice: number;
    condition: AssetCondition;
  }>,
) {
  const asset = await getOwnedAsset(customerId, assetId);
  if (input.name) asset.name = input.name;
  if (input.brand !== undefined) asset.brand = input.brand;
  if (input.model !== undefined) asset.set('model', input.model);
  if (input.serialNumber !== undefined) asset.serialNumber = input.serialNumber;
  if (input.purchaseDate) asset.purchaseDate = new Date(input.purchaseDate);
  if (input.purchasePrice !== undefined) asset.purchasePrice = input.purchasePrice;
  if (input.condition) asset.condition = input.condition;
  if (input.roomId) {
    const room = await Room.findOne({ _id: input.roomId, homeId: asset.homeId, isDeleted: false });
    if (!room) throw new AppError('Room not found.', 404, ErrorCode.NOT_FOUND);
    asset.roomId = room._id;
  }
  await asset.save();
  return getAsset(customerId, assetId);
}

export async function archiveAsset(customerId: string, assetId: string) {
  const asset = await getOwnedAsset(customerId, assetId);
  asset.archivedAt = new Date();
  await asset.save();
  return { id: asset._id.toString(), archivedAt: asset.archivedAt.toISOString() };
}

export async function getAssetHistory(customerId: string, assetId: string) {
  await getOwnedAsset(customerId, assetId);
  const records = await AssetServiceRecord.find({ assetId }).sort({ performedAt: -1 });
  return records.map((r) => ({
    id: r._id.toString(),
    bookingId: r.bookingId.toString(),
    serviceType: r.serviceType,
    summary: r.summary,
    parts: r.parts,
    cost: r.cost,
    performedAt: r.performedAt.toISOString(),
    nextMaintenanceDate: r.nextMaintenanceDate?.toISOString(),
  }));
}

export async function getProviderAssetContext(providerId: string, bookingId: string) {
  const { Booking } = await import('@/models/Booking.js');
  const booking = await Booking.findOne({ _id: bookingId, providerId });
  if (!booking) throw new AppError('Booking not found.', 404, ErrorCode.NOT_FOUND);
  if (!booking.assetId) return null;

  const asset = await HomeAsset.findById(booking.assetId);
  if (!asset) return null;

  const records = await AssetServiceRecord.find({ assetId: asset._id })
    .sort({ performedAt: -1 })
    .limit(3);

  return {
    name: booking.assetSnapshot?.name ?? asset.name,
    assetTypeName: booking.assetSnapshot?.assetTypeName,
    brand: booking.assetSnapshot?.brand ?? asset.brand,
    model: booking.assetSnapshot?.model ?? asset.model,
    roomName: booking.assetSnapshot?.roomName,
    recentServices: records.map((r) => ({
      summary: r.summary,
      performedAt: r.performedAt.toISOString(),
    })),
  };
}

// Rooms
export async function listRooms(customerId: string, homeId: string) {
  await getOwnedHome(customerId, homeId);
  const rooms = await Room.find({ homeId, isDeleted: false }).sort({ name: 1 });
  return rooms.map((r) => ({
    id: r._id.toString(),
    name: r.name,
    roomType: r.roomType,
    floor: r.floor,
  }));
}

export async function createRoom(
  customerId: string,
  homeId: string,
  input: { name: string; roomType?: RoomType; floor?: string },
) {
  await getOwnedHome(customerId, homeId);
  const room = await Room.create({
    homeId,
    name: input.name,
    roomType: input.roomType ?? RoomType.OTHER,
    floor: input.floor,
  });
  return { id: room._id.toString(), name: room.name, roomType: room.roomType, floor: room.floor };
}

export async function updateRoom(customerId: string, roomId: string, input: { name?: string; roomType?: RoomType; floor?: string }) {
  const room = await Room.findById(roomId);
  if (!room || room.isDeleted) throw new AppError('Room not found.', 404, ErrorCode.NOT_FOUND);
  await getOwnedHome(customerId, room.homeId.toString());
  if (input.name) room.name = input.name;
  if (input.roomType) room.roomType = input.roomType;
  if (input.floor !== undefined) room.floor = input.floor;
  await room.save();
  return { id: room._id.toString(), name: room.name, roomType: room.roomType, floor: room.floor };
}

export async function deleteRoom(customerId: string, roomId: string) {
  const room = await Room.findById(roomId);
  if (!room) throw new AppError('Room not found.', 404, ErrorCode.NOT_FOUND);
  await getOwnedHome(customerId, room.homeId.toString());
  room.isDeleted = true;
  await room.save();
  return { id: room._id.toString(), deleted: true };
}

export async function listAssetTypes() {
  const types = await AssetType.find({ isActive: true }).sort({ displayOrder: 1, name: 1 });
  return types.map((t) => ({
    id: t._id.toString(),
    slug: t.slug,
    name: t.name,
    icon: t.icon,
    categoryId: t.categoryId?.toString(),
  }));
}
