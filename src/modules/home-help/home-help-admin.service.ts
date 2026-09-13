import { HomeHelpDurationPackage } from '@/models/HomeHelpDurationPackage.js';
import { AppError } from '@/utils/AppError.js';
import { ErrorCode } from '@ghaarfix/shared-types';
import { buildPaginationMeta } from '@/utils/catalog.js';

function serializePackage(doc: InstanceType<typeof HomeHelpDurationPackage>) {
  return {
    id: doc._id.toString(),
    label: doc.label,
    durationMinutes: doc.durationMinutes,
    basePrice: doc.basePrice,
    currency: doc.currency,
    isActive: doc.isActive,
    displayOrder: doc.displayOrder,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export async function listDurationPackages(query: { page: number; limit: number; activeOnly?: boolean }) {
  const filter: Record<string, unknown> = {};
  if (query.activeOnly) filter.isActive = true;
  const total = await HomeHelpDurationPackage.countDocuments(filter);
  const items = await HomeHelpDurationPackage.find(filter)
    .sort({ displayOrder: 1, durationMinutes: 1 })
    .skip((query.page - 1) * query.limit)
    .limit(query.limit);
  return {
    items: items.map(serializePackage),
    meta: buildPaginationMeta(query.page, query.limit, total),
  };
}

export async function createDurationPackage(input: {
  label: string;
  durationMinutes: number;
  basePrice: number;
  currency?: string;
  isActive?: boolean;
  displayOrder?: number;
}) {
  const doc = await HomeHelpDurationPackage.create({
    label: input.label,
    durationMinutes: input.durationMinutes,
    basePrice: input.basePrice,
    currency: input.currency ?? 'INR',
    isActive: input.isActive ?? true,
    displayOrder: input.displayOrder ?? 0,
  });
  return serializePackage(doc);
}

export async function updateDurationPackage(
  packageId: string,
  input: Partial<{
    label: string;
    durationMinutes: number;
    basePrice: number;
    currency: string;
    isActive: boolean;
    displayOrder: number;
  }>,
) {
  const doc = await HomeHelpDurationPackage.findByIdAndUpdate(packageId, { $set: input }, { new: true });
  if (!doc) throw new AppError('Duration package not found.', 404, ErrorCode.NOT_FOUND);
  return serializePackage(doc);
}

export async function deleteDurationPackage(packageId: string) {
  const doc = await HomeHelpDurationPackage.findByIdAndUpdate(
    packageId,
    { $set: { isActive: false } },
    { new: true },
  );
  if (!doc) throw new AppError('Duration package not found.', 404, ErrorCode.NOT_FOUND);
  return serializePackage(doc);
}
