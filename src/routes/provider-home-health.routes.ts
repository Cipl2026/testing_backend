import { Router } from 'express';
import { UserRole } from '@ghaarfix/shared-types';
import * as controller from '@/modules/home-health/home-health.controller.js';
import { authenticate, authorize } from '@/middleware/auth.js';
import { validateParams } from '@/middleware/validate.js';
import { bookingIdParamSchema } from '@/validators/booking.js';

const router = Router();

router.get(
  '/bookings/:bookingId/asset-context',
  authenticate,
  authorize(UserRole.PROVIDER),
  validateParams(bookingIdParamSchema),
  controller.getProviderAssetContext,
);

export default router;
