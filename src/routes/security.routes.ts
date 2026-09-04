import { Router } from 'express';
import { UserRole } from '@ghaarfix/shared-types';
import { authenticate, authorize } from '@/middleware/auth.js';
import { validateBody, validateParams } from '@/middleware/validate.js';
import * as controller from '@/modules/security/security.controller.js';
import {
  stepUpInitSchema,
  stepUpVerifySchema,
  sessionIdParamSchema,
} from '@/validators/phase22.js';

const router = Router();

router.get('/sessions', authenticate, authorize(UserRole.CUSTOMER, UserRole.PROVIDER), controller.listSessions);
router.delete(
  '/sessions/:id',
  authenticate,
  authorize(UserRole.CUSTOMER, UserRole.PROVIDER),
  validateParams(sessionIdParamSchema),
  controller.revokeSession,
);
router.post(
  '/revoke-other-sessions',
  authenticate,
  authorize(UserRole.CUSTOMER, UserRole.PROVIDER),
  controller.revokeOtherSessions,
);
router.post('/step-up', authenticate, validateBody(stepUpInitSchema), controller.initiateStepUp);
router.post('/step-up/verify', authenticate, validateBody(stepUpVerifySchema), controller.verifyStepUp);

export default router;
