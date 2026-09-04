import { Router } from 'express';
import { UserRole } from '@ghaarfix/shared-types';
import * as postServiceController from '@/modules/post-service/post-service.controller.js';
import { authenticate, authorize } from '@/middleware/auth.js';
import { validateBody, validateParams } from '@/middleware/validate.js';
import { bookingIdParamSchema } from '@/validators/booking.js';
import {
  completionSummaryBodySchema,
  evidenceUploadBodySchema,
  locationUpdateBodySchema,
} from '@/validators/post-service.js';
import { uploadMiddleware } from '@/middleware/upload.js';

const router = Router();

router.post(
  '/bookings/:bookingId/location',
  authenticate,
  authorize(UserRole.PROVIDER),
  validateParams(bookingIdParamSchema),
  validateBody(locationUpdateBodySchema),
  postServiceController.postProviderLocation,
);

router.post(
  '/bookings/:bookingId/evidence',
  authenticate,
  authorize(UserRole.PROVIDER),
  validateParams(bookingIdParamSchema),
  uploadMiddleware.single('file'),
  validateBody(evidenceUploadBodySchema),
  postServiceController.uploadEvidence,
);

router.post(
  '/bookings/:bookingId/completion-summary',
  authenticate,
  authorize(UserRole.PROVIDER),
  validateParams(bookingIdParamSchema),
  validateBody(completionSummaryBodySchema),
  postServiceController.submitCompletionSummary,
);

export default router;
