import * as opportunityService from '@/modules/network/coverage-opportunity.service.js';
import * as shiftService from '@/modules/network/shift.service.js';
import { asyncHandler } from '@/utils/asyncHandler.js';
import { sendSuccess } from '@/utils/apiResponse.js';

export const getOpportunities = asyncHandler(async (req, res) => {
  const data = await opportunityService.listProviderOpportunities(req.auth!.userId);
  sendSuccess(res, 'Network opportunities', data);
});

export const listShifts = asyncHandler(async (req, res) => {
  const data = await shiftService.listProviderShifts(req.auth!.userId, {
    date: req.query.date as string | undefined,
  });
  sendSuccess(res, 'Provider shifts', { items: data });
});

export const createShift = asyncHandler(async (req, res) => {
  const data = await shiftService.createProviderShift(req.auth!.userId, req.body);
  sendSuccess(res, 'Shift created', data, 201);
});

export const updateShift = asyncHandler(async (req, res) => {
  const data = await shiftService.updateProviderShift(req.auth!.userId, String(req.params.id), req.body);
  sendSuccess(res, 'Shift updated', data);
});

export const acceptCoverageOpportunity = asyncHandler(async (req, res) => {
  const data = await opportunityService.acceptCoverageOpportunity(req.auth!.userId, String(req.params.id));
  sendSuccess(res, 'Coverage opportunity accepted', data);
});
