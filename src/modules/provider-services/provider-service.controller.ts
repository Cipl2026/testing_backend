import * as providerServiceModule from '@/modules/provider-services/provider-service.service.js';
import { asyncHandler } from '@/utils/asyncHandler.js';
import { sendSuccess } from '@/utils/apiResponse.js';

export const listMyServices = asyncHandler(async (req, res) => {
  const items = await providerServiceModule.listProviderServices(req.auth!.userId);
  sendSuccess(res, 'Provider services fetched successfully', { items });
});

export const createMyService = asyncHandler(async (req, res) => {
  const record = await providerServiceModule.createProviderService(req.auth!.userId, req.body);
  sendSuccess(res, 'Service request submitted successfully', record, 201);
});

export const updateMyService = asyncHandler(async (req, res) => {
  const record = await providerServiceModule.updateProviderService(
    req.auth!.userId,
    String(req.params.id),
    req.body,
  );
  sendSuccess(res, 'Provider service updated successfully', record);
});

export const removeMyService = asyncHandler(async (req, res) => {
  await providerServiceModule.removeProviderService(req.auth!.userId, String(req.params.id));
  sendSuccess(res, 'Provider service removed successfully', null);
});
