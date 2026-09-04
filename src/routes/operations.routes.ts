import { Router } from 'express';
import { UserRole } from '@ghaarfix/shared-types';
import * as controller from '@/modules/operations/operations.controller.js';
import { authenticate, authorize } from '@/middleware/auth.js';
import { validateBody, validateParams, validateQuery } from '@/middleware/validate.js';
import {
  serviceAvailabilityQuerySchema,
  serviceZoneQuerySchema,
  waitlistBodySchema,
  waitlistIdParamSchema,
  zoneResolveQuerySchema,
} from '@/validators/phase11.js';

const router = Router();

router.get('/cities', controller.listCities);
router.get('/service-zones/resolve', validateQuery(zoneResolveQuerySchema), controller.resolveServiceZone);
router.get('/service-zones', validateQuery(serviceZoneQuerySchema), controller.listServiceZones);
router.get(
  '/service-availability',
  validateQuery(serviceAvailabilityQuerySchema),
  controller.getServiceAvailability,
);

router.post(
  '/waitlist',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateBody(waitlistBodySchema),
  controller.createWaitlist,
);
router.get(
  '/waitlist',
  authenticate,
  authorize(UserRole.CUSTOMER),
  controller.listWaitlist,
);
router.delete(
  '/waitlist/:id',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateParams(waitlistIdParamSchema),
  controller.deleteWaitlist,
);

export default router;
