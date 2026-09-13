import { Router } from 'express';
import { UserRole } from '@ghaarfix/shared-types';
import { authenticate, authorize } from '@/middleware/auth.js';
import { validateBody, validateQuery, validateParams } from '@/middleware/validate.js';
import * as homeHelpController from '@/modules/home-help/home-help.controller.js';
import {
  homeHelpQuoteBodySchema,
  homeHelpReservationBodySchema,
  homeHelpInstantBodySchema,
  homeHelpProvidersQuerySchema,
} from '@/validators/home-help.js';
import {
  cancelRecurringPlanBodySchema,
  recurringPlanIdParamSchema,
} from '@/validators/home-help-recurring.js';
import * as recurringController from '@/modules/home-help/home-help-recurring.controller.js';

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

router.get(
  '/recurring-plans',
  authenticate,
  authorize(UserRole.CUSTOMER),
  recurringController.listCustomerPlans,
);
router.get(
  '/recurring-plans/:planId',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateParams(recurringPlanIdParamSchema),
  recurringController.getCustomerPlan,
);
router.post(
  '/recurring-plans/:planId/cancel',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateParams(recurringPlanIdParamSchema),
  validateBody(cancelRecurringPlanBodySchema),
  recurringController.cancelCustomerPlan,
);
router.post(
  '/recurring-plans/:planId/pause',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateParams(recurringPlanIdParamSchema),
  recurringController.pauseCustomerPlan,
);
router.post(
  '/recurring-plans/:planId/resume',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateParams(recurringPlanIdParamSchema),
  recurringController.resumeCustomerPlan,
);

export default router;
