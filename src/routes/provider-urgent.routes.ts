import { Router } from 'express';
import { UserRole } from '@ghaarfix/shared-types';
import * as urgentProviderController from '@/modules/urgent/urgent-provider.controller.js';
import { authenticate, authorize } from '@/middleware/auth.js';
import { validateBody, validateParams } from '@/middleware/validate.js';
import {
  presenceHeartbeatBodySchema,
  pushTokenBodySchema,
  rejectUrgentBodySchema,
  urgentRequestIdParamSchema,
} from '@/validators/urgent.js';

const router = Router();

router.get(
  '/urgent-requests',
  authenticate,
  authorize(UserRole.PROVIDER),
  urgentProviderController.listProviderUrgentRequests,
);
router.get(
  '/urgent-requests/:urgentRequestId',
  authenticate,
  authorize(UserRole.PROVIDER),
  validateParams(urgentRequestIdParamSchema),
  urgentProviderController.getProviderUrgentRequest,
);
router.post(
  '/urgent-requests/:urgentRequestId/accept',
  authenticate,
  authorize(UserRole.PROVIDER),
  validateParams(urgentRequestIdParamSchema),
  urgentProviderController.acceptUrgentRequest,
);
router.post(
  '/urgent-requests/:urgentRequestId/reject',
  authenticate,
  authorize(UserRole.PROVIDER),
  validateParams(urgentRequestIdParamSchema),
  validateBody(rejectUrgentBodySchema),
  urgentProviderController.rejectUrgentRequest,
);

router.post(
  '/presence/online',
  authenticate,
  authorize(UserRole.PROVIDER),
  urgentProviderController.setOnline,
);
router.post(
  '/presence/offline',
  authenticate,
  authorize(UserRole.PROVIDER),
  urgentProviderController.setOffline,
);
router.post(
  '/presence/heartbeat',
  authenticate,
  authorize(UserRole.PROVIDER),
  validateBody(presenceHeartbeatBodySchema),
  urgentProviderController.heartbeat,
);
router.get(
  '/presence',
  authenticate,
  authorize(UserRole.PROVIDER),
  urgentProviderController.getPresence,
);
router.post(
  '/push-token',
  authenticate,
  authorize(UserRole.PROVIDER),
  validateBody(pushTokenBodySchema),
  urgentProviderController.registerPushToken,
);

export default router;
