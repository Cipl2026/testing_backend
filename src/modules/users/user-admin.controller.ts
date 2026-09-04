import type { Request, Response } from 'express';
import * as userAdminService from '@/modules/users/user-admin.service.js';
import { asyncHandler } from '@/utils/asyncHandler.js';
import { sendSuccess } from '@/utils/apiResponse.js';

export const listCustomers = asyncHandler(async (req: Request, res: Response) => {
  const result = await userAdminService.adminListCustomers(req.query as never);
  sendSuccess(res, 'Customers fetched successfully', { items: result.items }, 200, result.meta);
});

export const listProviders = asyncHandler(async (req: Request, res: Response) => {
  const result = await userAdminService.adminListProviders(req.query as never);
  sendSuccess(res, 'Providers fetched successfully', { items: result.items }, 200, result.meta);
});

export const getCustomer = asyncHandler(async (req: Request, res: Response) => {
  const data = await userAdminService.adminGetCustomer(String(req.params.userId));
  sendSuccess(res, 'Customer fetched successfully', data);
});

export const updateCustomerStatus = asyncHandler(async (req: Request, res: Response) => {
  const data = await userAdminService.adminUpdateCustomerStatus(
    req.auth!.userId,
    String(req.params.userId),
    req.body.status,
    req.body.reason,
  );
  sendSuccess(res, 'Customer status updated successfully', data);
});

export const getProvider = asyncHandler(async (req: Request, res: Response) => {
  const data = await userAdminService.adminGetProvider(String(req.params.providerId));
  sendSuccess(res, 'Provider fetched successfully', data);
});

export const updateProviderStatus = asyncHandler(async (req: Request, res: Response) => {
  const data = await userAdminService.adminUpdateProviderStatus(
    req.auth!.userId,
    String(req.params.providerId),
    req.body.status,
    req.body.reason,
  );
  sendSuccess(res, 'Provider status updated successfully', data);
});
