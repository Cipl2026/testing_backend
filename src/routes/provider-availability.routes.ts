import { Router } from 'express';
import { UserRole } from '@ghaarfix/shared-types';
import * as availabilityController from '@/modules/provider-availability/availability.controller.js';
import { authenticate, authorize } from '@/middleware/auth.js';
import { validateBody, validateParams } from '@/middleware/validate.js';
import { objectIdParamSchema } from '@/validators/catalog.js';
import {
  scheduleBodySchema,
  serviceAreaBodySchema,
  serviceAreaUpdateSchema,
  timeOffBodySchema,
  timeOffUpdateSchema,
} from '@/validators/availability.js';

const router = Router();

router.get(
  '/me/service-areas',
  authenticate,
  authorize(UserRole.PROVIDER),
  availabilityController.listServiceAreas,
);
router.post(
  '/me/service-areas',
  authenticate,
  authorize(UserRole.PROVIDER),
  validateBody(serviceAreaBodySchema),
  availabilityController.createServiceArea,
);
router.patch(
  '/me/service-areas/:id',
  authenticate,
  authorize(UserRole.PROVIDER),
  validateParams(objectIdParamSchema),
  validateBody(serviceAreaUpdateSchema),
  availabilityController.updateServiceArea,
);
router.delete(
  '/me/service-areas/:id',
  authenticate,
  authorize(UserRole.PROVIDER),
  validateParams(objectIdParamSchema),
  availabilityController.deleteServiceArea,
);

router.get(
  '/me/schedule',
  authenticate,
  authorize(UserRole.PROVIDER),
  availabilityController.getSchedule,
);
router.put(
  '/me/schedule',
  authenticate,
  authorize(UserRole.PROVIDER),
  validateBody(scheduleBodySchema),
  availabilityController.upsertSchedule,
);

router.get(
  '/me/time-off',
  authenticate,
  authorize(UserRole.PROVIDER),
  availabilityController.listTimeOff,
);
router.post(
  '/me/time-off',
  authenticate,
  authorize(UserRole.PROVIDER),
  validateBody(timeOffBodySchema),
  availabilityController.createTimeOff,
);
router.patch(
  '/me/time-off/:id',
  authenticate,
  authorize(UserRole.PROVIDER),
  validateParams(objectIdParamSchema),
  validateBody(timeOffUpdateSchema),
  availabilityController.updateTimeOff,
);
router.delete(
  '/me/time-off/:id',
  authenticate,
  authorize(UserRole.PROVIDER),
  validateParams(objectIdParamSchema),
  availabilityController.deleteTimeOff,
);

export default router;
