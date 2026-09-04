import type { Request, Response } from 'express';
import * as customerService from '@/modules/users/customer.service.js';
import * as presenceService from '@/modules/presence/presence.service.js';
import { storeImage } from '@/modules/storage/storage.service.js';
import { asyncHandler } from '@/utils/asyncHandler.js';
import { sendSuccess } from '@/utils/apiResponse.js';
import { AppError } from '@/utils/AppError.js';
import { ErrorCode } from '@ghaarfix/shared-types';

export const updateProfile = asyncHandler(async (req: Request, res: Response) => {
  const user = await customerService.updateCustomerProfile(req.auth!.userId, req.body);
  sendSuccess(res, 'Profile updated successfully', { user });
});

export const registerPushToken = asyncHandler(async (req: Request, res: Response) => {
  const data = await presenceService.registerCustomerPushToken(
    req.auth!.userId,
    req.body.token,
    req.body.platform,
    req.body.deviceId,
  );
  sendSuccess(res, 'Push token registered.', data);
});

export const uploadProfileImage = asyncHandler(async (req: Request, res: Response) => {
  const file = req.file;
  if (!file) {
    throw new AppError('Image file is required.', 400, ErrorCode.VALIDATION_ERROR);
  }
  const stored = await storeImage(file.buffer, file.mimetype, 'customers/profile');
  const user = await customerService.updateCustomerProfile(req.auth!.userId, {
    profileImage: stored.fileUrl,
  });
  sendSuccess(res, 'Profile image updated successfully', { user });
});
