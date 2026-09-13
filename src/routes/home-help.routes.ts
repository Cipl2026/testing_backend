import { Router } from 'express';
import { UserRole } from '@ghaarfix/shared-types';
import { authenticate, authorize } from '@/middleware/auth.js';
import { validateBody, validateQuery } from '@/middleware/validate.js';
import * as homeHelpController from '@/modules/home-help/home-help.controller.js';
import {
  homeHelpQuoteBodySchema,
  homeHelpReservationBodySchema,
  homeHelpInstantBodySchema,
  homeHelpProvidersQuerySchema,
} from '@/validators/home-help.js';

const router = Router();

router.get('/catalog', homeHelpController.getCatalog);
router.get(
  '/providers',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateQuery(homeHelpProvidersQuerySchema),
  homeHelpController.getProviders,
);
router.post(
  '/quote',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateBody(homeHelpQuoteBodySchema),
  homeHelpController.postQuote,
);
router.post(
  '/reservations',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateBody(homeHelpReservationBodySchema),
  homeHelpController.postReservation,
);
router.post(
  '/instant',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateBody(homeHelpInstantBodySchema),
  homeHelpController.postInstant,
);

export default router;
