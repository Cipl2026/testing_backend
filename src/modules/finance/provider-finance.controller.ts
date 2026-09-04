import * as providerFinance from '@/modules/finance/provider-finance.service.js';
import { asyncHandler } from '@/utils/asyncHandler.js';
import { sendSuccess } from '@/utils/apiResponse.js';
import { AppError } from '@/utils/AppError.js';
import { ErrorCode } from '@ghaarfix/shared-types';

export const getEarnings = asyncHandler(async (req, res) => {
  const data = await providerFinance.getProviderFinanceEarnings(req.auth!.userId);
  sendSuccess(res, 'Provider earnings', data);
});

export const listPayouts = asyncHandler(async (req, res) => {
  const data = await providerFinance.getProviderPayouts(req.auth!.userId);
  sendSuccess(res, 'Payout history', { items: data });
});

export const getPayoutDetail = asyncHandler(async (req, res) => {
  const data = await providerFinance.getProviderPayoutDetail(
    req.auth!.userId,
    String(req.params.id),
  );
  if (!data) throw new AppError('Payout not found.', 404, ErrorCode.NOT_FOUND);
  sendSuccess(res, 'Payout detail', data);
});
