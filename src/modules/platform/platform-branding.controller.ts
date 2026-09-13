import type { Request, Response } from 'express';
import { asyncHandler } from '@/utils/asyncHandler.js';
import { sendSuccess } from '@/utils/apiResponse.js';
import {
  getPlatformBranding,
  updatePlatformBranding,
} from '@/modules/platform/platform-branding.service.js';

export const getPublicBranding = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getPlatformBranding();
  sendSuccess(res, 'Platform branding loaded.', data);
});

export const getAdminBranding = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getPlatformBranding();
  sendSuccess(res, 'Platform branding loaded.', data);
});

export const updateAdminBranding = asyncHandler(async (req: Request, res: Response) => {
  const data = await updatePlatformBranding(req.body);
  sendSuccess(res, 'Platform branding updated.', data);
});
