import {
  HomeCarouselActionType,
  HomeCarouselItem,
  HomeCarouselPlacement,
  type IHomeCarouselItem,
} from '@/models/HomeCarouselItem.js';
import { AppError } from '@/utils/AppError.js';
import { ErrorCode } from '@ghaarfix/shared-types';

export type HomeCarouselItemView = {
  id: string;
  placement: HomeCarouselPlacement;
  title: string;
  subtitle?: string;
  imageUrl: string;
  actionType: HomeCarouselActionType;
  actionValue?: string;
  displayOrder: number;
  isActive: boolean;
  validFrom?: string;
  validTo?: string;
};

function serializeItem(item: IHomeCarouselItem): HomeCarouselItemView {
  return {
    id: item._id.toString(),
    placement: item.placement,
    title: item.title,
    subtitle: item.subtitle,
    imageUrl: item.imageUrl,
    actionType: item.actionType,
    actionValue: item.actionValue,
    displayOrder: item.displayOrder,
    isActive: item.isActive,
    validFrom: item.validFrom?.toISOString(),
    validTo: item.validTo?.toISOString(),
  };
}

function activeNowFilter() {
  const now = new Date();
  return {
    isActive: true,
    $and: [
      { $or: [{ validFrom: { $exists: false } }, { validFrom: null }, { validFrom: { $lte: now } }] },
      { $or: [{ validTo: { $exists: false } }, { validTo: null }, { validTo: { $gte: now } }] },
    ],
  };
}

export async function listActiveHomeCarousel() {
  const items = await HomeCarouselItem.find(activeNowFilter())
    .sort({ placement: 1, displayOrder: 1, createdAt: -1 })
    .lean();

  const grouped = {
    banners: [] as HomeCarouselItemView[],
    urgentFix: null as HomeCarouselItemView | null,
    pickedForYou: [] as HomeCarouselItemView[],
    recommendedForYou: [] as HomeCarouselItemView[],
  };

  for (const item of items) {
    const view = serializeItem(item as unknown as IHomeCarouselItem);
    if (item.placement === HomeCarouselPlacement.BANNER) grouped.banners.push(view);
    if (item.placement === HomeCarouselPlacement.URGENT_FIX && !grouped.urgentFix) {
      grouped.urgentFix = view;
    }
    if (item.placement === HomeCarouselPlacement.PICKED_FOR_YOU) grouped.pickedForYou.push(view);
    if (item.placement === HomeCarouselPlacement.RECOMMENDED_FOR_YOU) {
      grouped.recommendedForYou.push(view);
    }
  }

  return grouped;
}

export async function listAdminHomeCarousel(placement?: HomeCarouselPlacement) {
  const query = placement ? { placement } : {};
  const items = await HomeCarouselItem.find(query).sort({ placement: 1, displayOrder: 1, createdAt: -1 });
  return items.map(serializeItem);
}

export async function createHomeCarouselItem(input: {
  placement: HomeCarouselPlacement;
  title: string;
  subtitle?: string;
  imageUrl: string;
  actionType?: HomeCarouselActionType;
  actionValue?: string;
  displayOrder?: number;
  isActive?: boolean;
  validFrom?: string;
  validTo?: string;
}) {
  const item = await HomeCarouselItem.create({
    placement: input.placement,
    title: input.title,
    subtitle: input.subtitle,
    imageUrl: input.imageUrl,
    actionType: input.actionType ?? HomeCarouselActionType.NONE,
    actionValue: input.actionValue,
    displayOrder: input.displayOrder ?? 0,
    isActive: input.isActive ?? true,
    validFrom: input.validFrom ? new Date(input.validFrom) : undefined,
    validTo: input.validTo ? new Date(input.validTo) : undefined,
  });
  return serializeItem(item);
}

export async function updateHomeCarouselItem(
  id: string,
  input: Partial<{
    placement: HomeCarouselPlacement;
    title: string;
    subtitle?: string;
    imageUrl: string;
    actionType: HomeCarouselActionType;
    actionValue?: string;
    displayOrder: number;
    isActive: boolean;
    validFrom?: string;
    validTo?: string;
  }>,
) {
  const item = await HomeCarouselItem.findByIdAndUpdate(
    id,
    {
      ...(input.placement !== undefined ? { placement: input.placement } : {}),
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.subtitle !== undefined ? { subtitle: input.subtitle } : {}),
      ...(input.imageUrl !== undefined ? { imageUrl: input.imageUrl } : {}),
      ...(input.actionType !== undefined ? { actionType: input.actionType } : {}),
      ...(input.actionValue !== undefined ? { actionValue: input.actionValue } : {}),
      ...(input.displayOrder !== undefined ? { displayOrder: input.displayOrder } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      ...(input.validFrom !== undefined
        ? { validFrom: input.validFrom ? new Date(input.validFrom) : null }
        : {}),
      ...(input.validTo !== undefined ? { validTo: input.validTo ? new Date(input.validTo) : null } : {}),
    },
    { new: true },
  );
  if (!item) throw new AppError('Home carousel item not found.', 404, ErrorCode.NOT_FOUND);
  return serializeItem(item);
}

export async function deleteHomeCarouselItem(id: string) {
  const deleted = await HomeCarouselItem.findByIdAndDelete(id);
  if (!deleted) throw new AppError('Home carousel item not found.', 404, ErrorCode.NOT_FOUND);
}
