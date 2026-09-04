import { ErrorCode } from '@ghaarfix/shared-types';
import { Category } from '@/models/Category.js';
import { Subcategory } from '@/models/Subcategory.js';
import { AppError } from '@/utils/AppError.js';
import { buildPaginationMeta, slugify } from '@/utils/catalog.js';
import { serializeCategory, serializeSubcategory } from '@/utils/catalogSerializers.js';
import type { AdminListQuery } from '@/validators/catalog.js';
import { cacheGetOrSet, CacheCatalog } from '@/infra/cache.service.js';

async function ensureUniqueCategorySlug(base: string, excludeId?: string) {
  let slug = base;
  let counter = 1;
  while (true) {
    const existing = await Category.findOne({ slug, ...(excludeId ? { _id: { $ne: excludeId } } : {}) });
    if (!existing) return slug;
    slug = `${base}-${counter++}`;
  }
}

export async function listPublicCategories() {
  return cacheGetOrSet(CacheCatalog.CATALOG_CATEGORIES, async () => {
    const items = await Category.find({ isActive: true }).sort({ displayOrder: 1, name: 1 });
    return items.map(serializeCategory);
  }, 300);
}

export async function getPublicCategory(categoryId: string) {
  const category = await Category.findOne({ _id: categoryId, isActive: true });
  if (!category) throw new AppError('Category not found.', 404, ErrorCode.NOT_FOUND);
  return serializeCategory(category);
}

export async function listPublicSubcategories(categoryId: string) {
  const category = await Category.findOne({ _id: categoryId, isActive: true });
  if (!category) throw new AppError('Category not found.', 404, ErrorCode.NOT_FOUND);
  const items = await Subcategory.find({ categoryId, isActive: true }).sort({ displayOrder: 1, name: 1 });
  return items.map((item) => serializeSubcategory(item, category));
}

export async function adminListCategories(query: AdminListQuery) {
  const filter: Record<string, unknown> = {};
  if (query.search) filter.name = { $regex: query.search, $options: 'i' };
  const total = await Category.countDocuments(filter);
  const items = await Category.find(filter)
    .sort({ displayOrder: 1, name: 1 })
    .skip((query.page - 1) * query.limit)
    .limit(query.limit);
  return { items: items.map(serializeCategory), meta: buildPaginationMeta(query.page, query.limit, total) };
}

export async function adminCreateCategory(input: {
  name: string;
  slug?: string;
  description?: string;
  image?: string;
  icon?: string;
  isActive?: boolean;
  displayOrder?: number;
}) {
  const baseSlug = slugify(input.slug ?? input.name);
  if (input.slug) {
    const existing = await Category.findOne({ slug: baseSlug });
    if (existing) {
      throw new AppError('Category slug already exists.', 409, ErrorCode.CONFLICT);
    }
  }
  const slug = input.slug ? baseSlug : await ensureUniqueCategorySlug(baseSlug);
  try {
    const category = await Category.create({
      ...input,
      slug,
      image: input.image || undefined,
    });
    return serializeCategory(category);
  } catch {
    throw new AppError('Category slug already exists.', 409, ErrorCode.CONFLICT);
  }
}

export async function adminUpdateCategory(
  id: string,
  input: Partial<{
    name: string;
    slug: string;
    description: string;
    image: string;
    icon: string;
    isActive: boolean;
    displayOrder: number;
  }>,
) {
  const category = await Category.findById(id);
  if (!category) throw new AppError('Category not found.', 404, ErrorCode.NOT_FOUND);
  if (input.name) category.name = input.name;
  if (input.slug) category.slug = await ensureUniqueCategorySlug(slugify(input.slug), id);
  if (input.description !== undefined) category.description = input.description;
  if (input.image !== undefined) category.image = input.image || undefined;
  if (input.icon !== undefined) category.icon = input.icon;
  if (input.isActive !== undefined) category.isActive = input.isActive;
  if (input.displayOrder !== undefined) category.displayOrder = input.displayOrder;
  await category.save();
  return serializeCategory(category);
}

export async function adminDeleteCategory(id: string) {
  const inUse = await Subcategory.exists({ categoryId: id });
  if (inUse) throw new AppError('Category has subcategories and cannot be deleted.', 409, ErrorCode.CONFLICT);
  const deleted = await Category.findByIdAndDelete(id);
  if (!deleted) throw new AppError('Category not found.', 404, ErrorCode.NOT_FOUND);
}

export async function adminListSubcategories(query: AdminListQuery) {
  const filter: Record<string, unknown> = {};
  if (query.categoryId) filter.categoryId = query.categoryId;
  if (query.search) filter.name = { $regex: query.search, $options: 'i' };
  const total = await Subcategory.countDocuments(filter);
  const items = await Subcategory.find(filter)
    .sort({ displayOrder: 1, name: 1 })
    .skip((query.page - 1) * query.limit)
    .limit(query.limit);
  const categories = await Category.find({ _id: { $in: items.map((i) => i.categoryId) } });
  const categoryMap = new Map(categories.map((c) => [c._id.toString(), c]));
  return {
    items: items.map((item) => serializeSubcategory(item, categoryMap.get(item.categoryId.toString()))),
    meta: buildPaginationMeta(query.page, query.limit, total),
  };
}

export async function adminCreateSubcategory(input: {
  categoryId: string;
  name: string;
  slug?: string;
  description?: string;
  image?: string;
  isActive?: boolean;
  displayOrder?: number;
}) {
  const category = await Category.findById(input.categoryId);
  if (!category) throw new AppError('Category not found.', 404, ErrorCode.NOT_FOUND);
  const baseSlug = slugify(input.slug ?? input.name);
  let slug = baseSlug;
  let counter = 1;
  while (await Subcategory.exists({ categoryId: input.categoryId, slug })) {
    slug = `${baseSlug}-${counter++}`;
  }
  const subcategory = await Subcategory.create({ ...input, slug, image: input.image || undefined });
  return serializeSubcategory(subcategory, category);
}

export async function adminUpdateSubcategory(
  id: string,
  input: Partial<{
    categoryId: string;
    name: string;
    slug: string;
    description: string;
    image: string;
    isActive: boolean;
    displayOrder: number;
  }>,
) {
  const subcategory = await Subcategory.findById(id);
  if (!subcategory) throw new AppError('Subcategory not found.', 404, ErrorCode.NOT_FOUND);
  if (input.categoryId) {
    const category = await Category.findById(input.categoryId);
    if (!category) throw new AppError('Category not found.', 404, ErrorCode.NOT_FOUND);
    subcategory.categoryId = category._id;
  }
  if (input.name) subcategory.name = input.name;
  if (input.slug) subcategory.slug = slugify(input.slug);
  if (input.description !== undefined) subcategory.description = input.description;
  if (input.image !== undefined) subcategory.image = input.image || undefined;
  if (input.isActive !== undefined) subcategory.isActive = input.isActive;
  if (input.displayOrder !== undefined) subcategory.displayOrder = input.displayOrder;
  await subcategory.save();
  const category = await Category.findById(subcategory.categoryId);
  return serializeSubcategory(subcategory, category ?? undefined);
}
