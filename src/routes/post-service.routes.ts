import { Router } from 'express';
import { UserRole } from '@ghaarfix/shared-types';
import * as postServiceController from '@/modules/post-service/post-service.controller.js';
import { authenticate, authorize } from '@/middleware/auth.js';
import { validateBody, validateParams } from '@/middleware/validate.js';
import { bookingIdParamSchema } from '@/validators/booking.js';
import {
  createReviewBodySchema,
  createSupportTicketBodySchema,
} from '@/validators/post-service.js';

const router = Router();

router.get(
  '/:bookingId/tracking',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateParams(bookingIdParamSchema),
  postServiceController.getBookingTracking,
);
router.get(
  '/:bookingId/eta',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateParams(bookingIdParamSchema),
  postServiceController.getBookingEta,
);
router.get(
  '/:bookingId/evidence',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateParams(bookingIdParamSchema),
  postServiceController.getBookingEvidence,
);
router.get(
  '/:bookingId/completion',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateParams(bookingIdParamSchema),
  postServiceController.getCompletionSummary,
);
router.post(
  '/:bookingId/confirm-completion',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateParams(bookingIdParamSchema),
  postServiceController.confirmCompletion,
);
router.get(
  '/:bookingId/invoice',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateParams(bookingIdParamSchema),
  postServiceController.getBookingInvoice,
);
router.post(
  '/:bookingId/review',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateParams(bookingIdParamSchema),
  validateBody(createReviewBodySchema),
  postServiceController.createReview,
);
router.post(
  '/:bookingId/support-tickets',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateParams(bookingIdParamSchema),
  validateBody(createSupportTicketBodySchema),
  postServiceController.createSupportTicket,
);

export default router;
