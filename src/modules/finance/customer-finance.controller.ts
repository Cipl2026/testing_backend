import * as customerFinance from '@/modules/finance/customer-finance.service.js';
import { asyncHandler } from '@/utils/asyncHandler.js';
import { sendSuccess } from '@/utils/apiResponse.js';
import { AppError } from '@/utils/AppError.js';
import { ErrorCode } from '@ghaarfix/shared-types';

export const getPaymentHistory = asyncHandler(async (req, res) => {
  const items = await customerFinance.getCustomerPaymentHistory(req.auth!.userId);
  sendSuccess(res, 'Payment history', { items });
});

export const getRefunds = asyncHandler(async (req, res) => {
  const items = await customerFinance.getCustomerRefunds(req.auth!.userId);
  sendSuccess(res, 'Refunds', { items });
});

export const getSubscriptionBilling = asyncHandler(async (req, res) => {
  const items = await customerFinance.getCustomerSubscriptionBilling(req.auth!.userId);
  sendSuccess(res, 'Subscription billing', { items });
});

export const getChargeBreakdown = asyncHandler(async (req, res) => {
  const data = await customerFinance.getCustomerChargeBreakdown(
    String(req.params.bookingId),
    req.auth!.userId,
  );
  if (!data) throw new AppError('Booking not found.', 404, ErrorCode.NOT_FOUND);
  sendSuccess(res, 'Charge breakdown', data);
});
