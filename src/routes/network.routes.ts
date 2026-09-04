import { Router } from 'express';
import { UserRole } from '@ghaarfix/shared-types';
import * as customerController from '@/modules/network/network.controller.js';
import * as providerController from '@/modules/network/network-provider.controller.js';
import { authenticate, authorize } from '@/middleware/auth.js';
import { validateBody, validateParams, validateQuery } from '@/middleware/validate.js';
import {
  availabilityQuerySchema,
  createShiftBodySchema,
  opportunityIdParamSchema,
  serviceIdParamSchema,
  shiftIdParamSchema,
  updateShiftBodySchema,
  waitTimeQuerySchema,
} from '@/validators/phase17.js';

const router = Router();

router.get(
  '/availability/:serviceId',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateParams(serviceIdParamSchema),
  validateQuery(availabilityQuerySchema),
  customerController.getServiceAvailability,
);

router.get(
  '/availability/:serviceId/wait-time',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateParams(serviceIdParamSchema),
  validateQuery(waitTimeQuerySchema),
  customerController.getWaitTime,
);

router.get(
  '/provider/network/opportunities',
  authenticate,
  authorize(UserRole.PROVIDER),
  providerController.getOpportunities,
);

router.get(
  '/provider/shifts',
  authenticate,
  authorize(UserRole.PROVIDER),
  providerController.listShifts,
);

router.post(
  '/provider/shifts',
  authenticate,
  authorize(UserRole.PROVIDER),
  validateBody(createShiftBodySchema),
  providerController.createShift,
);

router.patch(
  '/provider/shifts/:id',
  authenticate,
  authorize(UserRole.PROVIDER),
  validateParams(shiftIdParamSchema),
  validateBody(updateShiftBodySchema),
  providerController.updateShift,
);

router.post(
  '/provider/coverage-opportunities/:id/accept',
  authenticate,
  authorize(UserRole.PROVIDER),
  validateParams(opportunityIdParamSchema),
  providerController.acceptCoverageOpportunity,
);

export default router;
