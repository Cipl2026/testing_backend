import { Router } from 'express';
import { UserRole } from '@ghaarfix/shared-types';
import * as paymentController from '@/modules/payments/payment.controller.js';
import { authenticate, authorize } from '@/middleware/auth.js';
import { validateBody, validateParams } from '@/middleware/validate.js';
import { bookingIdParamSchema, confirmPaymentBodySchema } from '@/validators/booking.js';

const router = Router();

router.get(
  '/payments/config',
  authenticate,
  authorize(UserRole.CUSTOMER),
  paymentController.getPaymentConfig,
);

router.post(
  '/bookings/:bookingId/initiate-payment',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateParams(bookingIdParamSchema),
  paymentController.initiateBookingPayment,
);

router.post(
  '/bookings/:bookingId/confirm-payment',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateParams(bookingIdParamSchema),
  validateBody(confirmPaymentBodySchema),
  paymentController.confirmBookingPayment,
);

router.post(
  '/bookings/:bookingId/confirm-cash-payment',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateParams(bookingIdParamSchema),
  paymentController.confirmCashPayment,
);

export default router;
