import type { Request, Response } from 'express';
import * as homeCarouselService from '@/modules/home-carousel/home-carousel.service.js';
import { asyncHandler } from '@/utils/asyncHandler.js';
import { sendSuccess } from '@/utils/apiResponse.js';

export const getHomeCarousel = asyncHandler(async (_req: Request, res: Response) => {
  const data = await homeCarouselService.listActiveHomeCarousel();
  sendSuccess(res, 'Home carousel fetched successfully', data);
});
