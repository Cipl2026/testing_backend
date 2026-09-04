import type { Request, Response } from 'express';
import { HomeCarouselPlacement } from '@/models/HomeCarouselItem.js';
import * as homeCarouselService from '@/modules/home-carousel/home-carousel.service.js';
import { asyncHandler } from '@/utils/asyncHandler.js';
import { sendSuccess } from '@/utils/apiResponse.js';

export const listHomeCarouselItems = asyncHandler(async (req: Request, res: Response) => {
  const placement =
    typeof req.query.placement === 'string'
      ? (req.query.placement as HomeCarouselPlacement)
      : undefined;
  const items = await homeCarouselService.listAdminHomeCarousel(placement);
  sendSuccess(res, 'Home carousel items fetched successfully', { items });
});

export const createHomeCarouselItem = asyncHandler(async (req: Request, res: Response) => {
  const item = await homeCarouselService.createHomeCarouselItem(req.body);
  sendSuccess(res, 'Home carousel item created successfully', item, 201);
});

export const updateHomeCarouselItem = asyncHandler(async (req: Request, res: Response) => {
  const item = await homeCarouselService.updateHomeCarouselItem(String(req.params.id), req.body);
  sendSuccess(res, 'Home carousel item updated successfully', item);
});

export const deleteHomeCarouselItem = asyncHandler(async (req: Request, res: Response) => {
  await homeCarouselService.deleteHomeCarouselItem(String(req.params.id));
  sendSuccess(res, 'Home carousel item deleted successfully', null);
});
