import * as settlementService from '@/modules/settlements/provider-settlement.service.js';
import { asyncHandler } from '@/utils/asyncHandler.js';
import { sendSuccess } from '@/utils/apiResponse.js';

export const listMySettlements = asyncHandler(async (req, res) => {
  const result = await settlementService.listProviderSettlements(req.auth!.userId, {
    page: Number(req.query.page) || 1,
    limit: Number(req.query.limit) || 30,
    status: req.query.status as never,
  });
  sendSuccess(res, 'Your settlements', result, 200, {
    page: result.page,
    limit: result.limit,
    total: result.total,
  });
});

export const getMySettlementSummary = asyncHandler(async (req, res) => {
  const summary = await settlementService.getProviderSettlementSummary(req.auth!.userId);
  sendSuccess(res, 'Settlement summary', summary);
});

export const confirmCashReceived = asyncHandler(async (req, res) => {
  const result = await settlementService.confirmCashReceivedByProvider(
    req.auth!.userId,
    String(req.params.bookingId),
  );
  sendSuccess(res, 'Cash payment recorded', result);
});
