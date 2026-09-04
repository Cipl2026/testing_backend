import * as addressService from '@/modules/addresses/address.service.js';
import { asyncHandler } from '@/utils/asyncHandler.js';
import { sendSuccess } from '@/utils/apiResponse.js';

export const listAddresses = asyncHandler(async (req, res) => {
  const items = await addressService.listAddresses(req.auth!.userId);
  sendSuccess(res, 'Addresses fetched successfully', { items });
});

export const createAddress = asyncHandler(async (req, res) => {
  const address = await addressService.createAddress(req.auth!.userId, req.body);
  sendSuccess(res, 'Address created successfully', address, 201);
});

export const updateAddress = asyncHandler(async (req, res) => {
  const address = await addressService.updateAddress(
    req.auth!.userId,
    String(req.params.id),
    req.body,
  );
  sendSuccess(res, 'Address updated successfully', address);
});

export const deleteAddress = asyncHandler(async (req, res) => {
  await addressService.deleteAddress(req.auth!.userId, String(req.params.id));
  sendSuccess(res, 'Address deleted successfully', null);
});

export const setDefaultAddress = asyncHandler(async (req, res) => {
  const address = await addressService.setDefaultAddress(
    req.auth!.userId,
    String(req.params.id),
  );
  sendSuccess(res, 'Default address updated successfully', address);
});
