import type { Request, Response } from 'express';
import * as providerService from '@/modules/providers/provider.service.js';
import * as providerFinanceService from '@/modules/finance/provider-finance.service.js';
import { getProviderOnboardingStatus } from '@/modules/providers/provider-onboarding.service.js';
import { storeImage } from '@/modules/storage/storage.service.js';
import { asyncHandler } from '@/utils/asyncHandler.js';
import { sendSuccess } from '@/utils/apiResponse.js';
import { AppError } from '@/utils/AppError.js';
import { ErrorCode } from '@ghaarfix/shared-types';

export const updateProfile = asyncHandler(async (req: Request, res: Response) => {
  const user = await providerService.updateProviderProfile(req.auth!.userId, req.body);
  const profile = await providerService.getProviderProfile(req.auth!.userId);
  sendSuccess(res, 'Profile updated successfully', { user, profile });
});

export const getProfile = asyncHandler(async (req: Request, res: Response) => {
  const profile = await providerService.getProviderProfile(req.auth!.userId);
  sendSuccess(res, 'Profile fetched successfully', profile);
});

export const uploadProfileImage = asyncHandler(async (req: Request, res: Response) => {
  const file = req.file;
  if (!file) {
    throw new AppError('Image file is required.', 400, ErrorCode.VALIDATION_ERROR);
  }
  const stored = await storeImage(file.buffer, file.mimetype, 'providers/profile');
  const user = await providerService.updateProviderProfile(req.auth!.userId, {
    profileImage: stored.fileUrl,
  });
  sendSuccess(res, 'Profile image updated successfully', { user });
});

export const getEarnings = asyncHandler(async (req: Request, res: Response) => {
  const data = await providerFinanceService.getProviderFinanceEarnings(req.auth!.userId);
  sendSuccess(res, 'Earnings fetched successfully', data);
});

export const getOnboardingStatus = asyncHandler(async (req: Request, res: Response) => {
  const data = await getProviderOnboardingStatus(req.auth!.userId);
  sendSuccess(res, 'Onboarding status fetched successfully', data);
});
