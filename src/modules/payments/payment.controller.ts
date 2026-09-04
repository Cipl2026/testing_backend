import * as paymentService from '@/modules/payments/payment.service.js';
import { env } from '@/config/env.js';
import { asyncHandler } from '@/utils/asyncHandler.js';
import { sendSuccess } from '@/utils/apiResponse.js';

export const getPaymentConfig = asyncHandler(async (_req, res) => {
  const enabled = Boolean(env.razorpay.keyId && env.razorpay.keySecret);
  sendSuccess(res, 'Payment config', {
    provider: enabled ? 'razorpay' : 'dev',
    keyId: enabled ? env.razorpay.keyId : null,
    enabled,
  });
});

export const confirmBookingPayment = asyncHandler(async (req, res) => {
  const booking = await paymentService.confirmBookingPayment(
    req.auth!.userId,
    String(req.params.bookingId),
    req.body,
  );
  sendSuccess(res, 'Payment confirmed successfully', booking);
});

export const initiateBookingPayment = asyncHandler(async (req, res) => {
  const order = await paymentService.initiateBookingPayment(
    req.auth!.userId,
    String(req.params.bookingId),
  );
  sendSuccess(res, 'Payment initiated successfully', order);
});

export const confirmCashPayment = asyncHandler(async (req, res) => {
  const booking = await paymentService.confirmCashPayment(
    req.auth!.userId,
    String(req.params.bookingId),
  );
  sendSuccess(res, 'Cash payment recorded successfully', booking);
});

export const paymentWebhook = asyncHandler(async (req, res) => {
  const signature = String(req.headers['x-razorpay-signature'] ?? '');
  const payload =
    typeof req.body === 'string'
      ? (JSON.parse(req.body) as Record<string, unknown>)
      : (req.body as Record<string, unknown>);
  const result = await paymentService.handlePaymentWebhook(payload, signature);
  sendSuccess(res, 'Webhook processed', result);
});
