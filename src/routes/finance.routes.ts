import { Router } from 'express';
import { UserRole } from '@ghaarfix/shared-types';
import { authenticate, authorize } from '@/middleware/auth.js';
import { validateParams } from '@/middleware/validate.js';
import * as customerFinanceController from '@/modules/finance/customer-finance.controller.js';
import { bookingIdParamSchema } from '@/validators/booking.js';

const router = Router();

router.get(
  '/payments/history',
  authenticate,
  authorize(UserRole.CUSTOMER),
  customerFinanceController.getPaymentHistory,
);

router.get(
  '/refunds',
  authenticate,
  authorize(UserRole.CUSTOMER),
  customerFinanceController.getRefunds,
);

router.get(
  '/subscriptions/billing',
  authenticate,
  authorize(UserRole.CUSTOMER),
  customerFinanceController.getSubscriptionBilling,
);

router.get(
  '/bookings/:bookingId/charge-breakdown',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateParams(bookingIdParamSchema),
  customerFinanceController.getChargeBreakdown,
);

export default router;
