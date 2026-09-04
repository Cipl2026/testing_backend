import { Router } from 'express';
import { UserRole } from '@ghaarfix/shared-types';
import * as urgentController from '@/modules/urgent/urgent.controller.js';
import { urgentRateLimit } from '@/middleware/urgentRateLimit.js';
import { authenticate, authorize } from '@/middleware/auth.js';
import { validateBody, validateParams } from '@/middleware/validate.js';
import {
  cancelUrgentBodySchema,
  createUrgentRequestBodySchema,
  urgentRequestIdParamSchema,
} from '@/validators/urgent.js';

const router = Router();

router.post(
  '/',
  authenticate,
  authorize(UserRole.CUSTOMER),
  urgentRateLimit,
  validateBody(createUrgentRequestBodySchema),
  urgentController.createUrgentRequest,
);
router.get(
  '/active',
  authenticate,
  authorize(UserRole.CUSTOMER),
  urgentController.getActiveUrgentRequest,
);
router.get(
  '/:urgentRequestId',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateParams(urgentRequestIdParamSchema),
  urgentController.getUrgentRequest,
);
router.post(
  '/:urgentRequestId/cancel',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateParams(urgentRequestIdParamSchema),
  validateBody(cancelUrgentBodySchema),
  urgentController.cancelUrgentRequest,
);

export default router;
