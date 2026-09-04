import { Router } from 'express';
import { UserRole } from '@ghaarfix/shared-types';
import * as controller from '@/modules/home-health/home-health.controller.js';
import { authenticate, authorize } from '@/middleware/auth.js';
import { validateBody, validateParams } from '@/middleware/validate.js';
import {
  scheduleIdParamSchema,
  skipMaintenanceBodySchema,
  snoozeBodySchema,
} from '@/validators/home-health.js';

const router = Router();

router.post('/:scheduleId/snooze', authenticate, authorize(UserRole.CUSTOMER), validateParams(scheduleIdParamSchema), validateBody(snoozeBodySchema), controller.snoozeMaintenance);
router.post('/:scheduleId/skip', authenticate, authorize(UserRole.CUSTOMER), validateParams(scheduleIdParamSchema), validateBody(skipMaintenanceBodySchema), controller.skipMaintenance);
router.post('/:scheduleId/complete', authenticate, authorize(UserRole.CUSTOMER), validateParams(scheduleIdParamSchema), controller.completeMaintenance);

export default router;
