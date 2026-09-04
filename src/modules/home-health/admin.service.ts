import { ErrorCode } from '@ghaarfix/shared-types';
import { AssetType } from '@/models/AssetType.js';
import { MaintenanceTemplate } from '@/models/MaintenanceTemplate.js';
import { AppError } from '@/utils/AppError.js';

export async function listAssetTypesAdmin(query: { activeOnly?: boolean }) {
  const filter = query.activeOnly ? { isActive: true } : {};
  const items = await AssetType.find(filter).sort({ displayOrder: 1, name: 1 });
  return items.map((t) => ({
    id: t._id.toString(),
    slug: t.slug,
    name: t.name,
    icon: t.icon,
    categoryId: t.categoryId?.toString(),
    isActive: t.isActive,
    displayOrder: t.displayOrder,
  }));
}

export async function createAssetType(input: {
  slug: string;
  name: string;
  icon?: string;
  categoryId?: string;
  description?: string;
  displayOrder?: number;
}) {
  const existing = await AssetType.findOne({ slug: input.slug.toLowerCase() });
  if (existing) throw new AppError('Asset type slug already exists.', 409, ErrorCode.CONFLICT);
  const doc = await AssetType.create({
    slug: input.slug.toLowerCase(),
    name: input.name,
    icon: input.icon,
    categoryId: input.categoryId,
    description: input.description,
    displayOrder: input.displayOrder ?? 0,
  });
  return { id: doc._id.toString(), slug: doc.slug, name: doc.name, isActive: doc.isActive };
}

export async function updateAssetType(
  id: string,
  input: Partial<{ name: string; icon: string; description: string; isActive: boolean; displayOrder: number }>,
) {
  const doc = await AssetType.findById(id);
  if (!doc) throw new AppError('Asset type not found.', 404, ErrorCode.NOT_FOUND);
  if (input.name) doc.name = input.name;
  if (input.icon !== undefined) doc.icon = input.icon;
  if (input.description !== undefined) doc.description = input.description;
  if (input.isActive !== undefined) doc.isActive = input.isActive;
  if (input.displayOrder !== undefined) doc.displayOrder = input.displayOrder;
  await doc.save();
  return { id: doc._id.toString(), name: doc.name, isActive: doc.isActive };
}

export async function listMaintenanceTemplatesAdmin() {
  const items = await MaintenanceTemplate.find().sort({ createdAt: -1 });
  return items.map((t) => ({
    id: t._id.toString(),
    assetTypeId: t.assetTypeId.toString(),
    serviceId: t.serviceId.toString(),
    title: t.title,
    intervalDays: t.intervalDays,
    priority: t.priority,
    isActive: t.isActive,
  }));
}

export async function createMaintenanceTemplate(input: {
  assetTypeId: string;
  serviceId: string;
  title: string;
  intervalDays: number;
  priority?: string;
  description?: string;
}) {
  const doc = await MaintenanceTemplate.create(input);
  return { id: doc._id.toString(), title: doc.title, intervalDays: doc.intervalDays };
}

export async function updateMaintenanceTemplate(
  id: string,
  input: Partial<{ title: string; intervalDays: number; isActive: boolean; description: string }>,
) {
  const doc = await MaintenanceTemplate.findById(id);
  if (!doc) throw new AppError('Template not found.', 404, ErrorCode.NOT_FOUND);
  if (input.title) doc.title = input.title;
  if (input.intervalDays) doc.intervalDays = input.intervalDays;
  if (input.isActive !== undefined) doc.isActive = input.isActive;
  if (input.description !== undefined) doc.description = input.description;
  await doc.save();
  return { id: doc._id.toString(), title: doc.title, isActive: doc.isActive };
}

export async function seedDefaultAssetTypes() {
  const defaults = [
    { slug: 'air-conditioner', name: 'Air Conditioner', icon: 'ac' },
    { slug: 'water-purifier', name: 'Water Purifier', icon: 'purifier' },
    { slug: 'washing-machine', name: 'Washing Machine', icon: 'washer' },
    { slug: 'refrigerator', name: 'Refrigerator', icon: 'fridge' },
    { slug: 'geyser', name: 'Geyser', icon: 'geyser' },
    { slug: 'television', name: 'Television', icon: 'tv' },
    { slug: 'chimney', name: 'Kitchen Chimney', icon: 'chimney' },
  ];
  for (const item of defaults) {
    await AssetType.findOneAndUpdate({ slug: item.slug }, { $setOnInsert: item }, { upsert: true });
  }
}
