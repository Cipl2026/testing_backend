import { ErrorCode, WarrantyStatus, WarrantyType } from '@ghaarfix/shared-types';
import { Warranty } from '@/models/Warranty.js';
import { getOwnedAsset } from '@/modules/home-health/helpers.js';
import { storeFile } from '@/modules/storage/storage.service.js';
import { AppError } from '@/utils/AppError.js';

function computeWarrantyStatus(endDate: Date): WarrantyStatus {
  const now = new Date();
  const days = Math.ceil((endDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
  if (days < 0) return WarrantyStatus.EXPIRED;
  if (days <= 30) return WarrantyStatus.EXPIRING;
  return WarrantyStatus.ACTIVE;
}

function serializeWarranty(doc: InstanceType<typeof Warranty>) {
  const daysRemaining = Math.ceil((doc.endDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
  return {
    id: doc._id.toString(),
    assetId: doc.assetId.toString(),
    provider: doc.provider,
    warrantyType: doc.warrantyType,
    startDate: doc.startDate.toISOString(),
    endDate: doc.endDate.toISOString(),
    coverage: doc.coverage,
    documentUrl: doc.documentUrl,
    notes: doc.notes,
    status: doc.status,
    daysRemaining,
  };
}

export async function listAssetWarranties(customerId: string, assetId: string) {
  await getOwnedAsset(customerId, assetId);
  const items = await Warranty.find({ assetId }).sort({ endDate: -1 });
  return items.map(serializeWarranty);
}

export async function createWarranty(
  customerId: string,
  assetId: string,
  input: {
    provider: string;
    warrantyType?: WarrantyType;
    startDate: string;
    endDate: string;
    coverage?: string;
    notes?: string;
  },
) {
  await getOwnedAsset(customerId, assetId);
  const endDate = new Date(input.endDate);
  const warranty = await Warranty.create({
    assetId,
    customerId,
    provider: input.provider,
    warrantyType: input.warrantyType ?? WarrantyType.MANUFACTURER,
    startDate: new Date(input.startDate),
    endDate,
    coverage: input.coverage,
    notes: input.notes,
    status: computeWarrantyStatus(endDate),
  });
  return serializeWarranty(warranty);
}

export async function updateWarranty(
  customerId: string,
  warrantyId: string,
  input: Partial<{
    provider: string;
    startDate: string;
    endDate: string;
    coverage: string;
    notes: string;
    status: WarrantyStatus;
  }>,
) {
  const warranty = await Warranty.findOne({ _id: warrantyId, customerId });
  if (!warranty) throw new AppError('Warranty not found.', 404, ErrorCode.NOT_FOUND);
  if (input.provider) warranty.provider = input.provider;
  if (input.startDate) warranty.startDate = new Date(input.startDate);
  if (input.endDate) {
    warranty.endDate = new Date(input.endDate);
    warranty.status = computeWarrantyStatus(warranty.endDate);
  }
  if (input.coverage !== undefined) warranty.coverage = input.coverage;
  if (input.notes !== undefined) warranty.notes = input.notes;
  if (input.status) warranty.status = input.status;
  await warranty.save();
  return serializeWarranty(warranty);
}

export async function deleteWarranty(customerId: string, warrantyId: string) {
  const warranty = await Warranty.findOne({ _id: warrantyId, customerId });
  if (!warranty) throw new AppError('Warranty not found.', 404, ErrorCode.NOT_FOUND);
  warranty.status = WarrantyStatus.VOID;
  await warranty.save();
  return { id: warranty._id.toString(), status: warranty.status };
}

export async function uploadWarrantyDocument(
  customerId: string,
  warrantyId: string,
  buffer: Buffer,
  mimeType: string,
) {
  const warranty = await Warranty.findOne({ _id: warrantyId, customerId });
  if (!warranty) throw new AppError('Warranty not found.', 404, ErrorCode.NOT_FOUND);
  const stored = await storeFile(buffer, mimeType, `warranties/${warrantyId}`);
  warranty.documentUrl = stored.fileUrl;
  warranty.documentKey = stored.fileKey;
  await warranty.save();
  return serializeWarranty(warranty);
}
