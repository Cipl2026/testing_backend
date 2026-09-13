import { Router } from 'express';
import { UserRole } from '@ghaarfix/shared-types';
import * as bookingController from '@/modules/bookings/booking.controller.js';
import * as providerController from '@/modules/providers/provider.controller.js';
import * as providerFinanceController from '@/modules/finance/provider-finance.controller.js';
import { authenticate, authorize } from '@/middleware/auth.js';
import { validateBody, validateParams, validateQuery } from '@/middleware/validate.js';
import { objectIdParamSchema } from '@/validators/catalog.js';
import {
  bookingIdParamSchema,
  bookingListQuerySchema,
  cancelBookingBodySchema,
  completeServiceBodySchema,
  priceChangeRequestBodySchema,
  rejectBookingBodySchema,
  rescheduleRequestBodySchema,
  startServiceBodySchema,
} from '@/validators/booking.js';
import * as recurringController from '@/modules/home-help/home-help-recurring.controller.js';
import { paginationQuerySchema } from '@ghaarfix/validation';

const router = Router();

router.get(
  '/payouts',
  authenticate,
  authorize(UserRole.PROVIDER),
  providerFinanceController.listPayouts,
);
router.get(
  '/payouts/:id',
  authenticate,
  authorize(UserRole.PROVIDER),
  validateParams(objectIdParamSchema),
  providerFinanceController.getPayoutDetail,
);

router.get(
  '/earnings',
  authenticate,
  authorize(UserRole.PROVIDER),
  providerController.getEarnings,
);

router.get(
  '/recurring-plans',
  authenticate,
  authorize(UserRole.PROVIDER),
  validateQuery(paginationQuerySchema),
  recurringController.listProviderPlans,
);

router.get(
  '/bookings',
  authenticate,
  authorize(UserRole.PROVIDER),
  validateQuery(bookingListQuerySchema),
  bookingController.listProviderBookings,
);
router.get(
  '/bookings/:bookingId',
  authenticate,
  authorize(UserRole.PROVIDER),
  validateParams(bookingIdParamSchema),
  bookingController.getProviderBooking,
);
router.post(
  '/bookings/:bookingId/accept',
  authenticate,
  authorize(UserRole.PROVIDER),
  validateParams(bookingIdParamSchema),
  bookingController.acceptBooking,
);
router.post(
  '/bookings/:bookingId/reject',
  authenticate,
  authorize(UserRole.PROVIDER),
  validateParams(bookingIdParamSchema),
  validateBody(rejectBookingBodySchema),
  bookingController.rejectBooking,
);
router.post(
  '/bookings/:bookingId/cancel',
  authenticate,
  authorize(UserRole.PROVIDER),
  validateParams(bookingIdParamSchema),
  validateBody(cancelBookingBodySchema),
  bookingController.cancelProviderBooking,
);
router.post(
  '/bookings/:bookingId/en-route',
  authenticate,
  authorize(UserRole.PROVIDER),
  validateParams(bookingIdParamSchema),
  bookingController.enRoute,
);
router.post(
  '/bookings/:bookingId/arrive',
  authenticate,
  authorize(UserRole.PROVIDER),
  validateParams(bookingIdParamSchema),
  bookingController.arrive,
);
router.post(
  '/bookings/:bookingId/reconfirm',
  authenticate,
  authorize(UserRole.PROVIDER),
  validateParams(bookingIdParamSchema),
  bookingController.confirmProviderBookingAction,
);
router.post(
  '/bookings/:bookingId/start',
  authenticate,
  authorize(UserRole.PROVIDER),
  validateParams(bookingIdParamSchema),
  validateBody(startServiceBodySchema),
  bookingController.startService,
);
router.post(
  '/bookings/:bookingId/complete',
  authenticate,
  authorize(UserRole.PROVIDER),
  validateParams(bookingIdParamSchema),
  validateBody(completeServiceBodySchema),
  bookingController.completeService,
);
router.post(
  '/bookings/:bookingId/reschedule',
  authenticate,
  authorize(UserRole.PROVIDER),
  validateParams(bookingIdParamSchema),
  validateBody(rescheduleRequestBodySchema),
  bookingController.requestReschedule,
);
router.post(
  '/bookings/:bookingId/price-change',
  authenticate,
  authorize(UserRole.PROVIDER),
  validateParams(bookingIdParamSchema),
  validateBody(priceChangeRequestBodySchema),
  bookingController.requestPriceChange,
);

export default router;
