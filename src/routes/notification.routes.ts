import { Router } from 'express';
import { UserRole } from '@ghaarfix/shared-types';
import { objectIdSchema } from '@ghaarfix/validation';
import { z } from 'zod';
import * as controller from '@/modules/notifications/notification.controller.js';
import { authenticate, authorize } from '@/middleware/auth.js';
import { validateBody, validateParams } from '@/middleware/validate.js';

const router = Router();

const notificationIdParamSchema = z.object({ id: objectIdSchema });
const notificationIdsBodySchema = z.object({
  ids: z.array(objectIdSchema).min(1),
});
const clearNotificationsBodySchema = z.object({
  ids: z.array(objectIdSchema).optional(),
});

router.get(
  '/',
  authenticate,
  authorize(UserRole.CUSTOMER, UserRole.PROVIDER),
  controller.listNotifications,
);
router.post(
  '/read-all',
  authenticate,
  authorize(UserRole.CUSTOMER, UserRole.PROVIDER),
  controller.markAllRead,
);
router.post(
  '/read-batch',
  authenticate,
  authorize(UserRole.CUSTOMER, UserRole.PROVIDER),
  validateBody(notificationIdsBodySchema),
  controller.markReadBatch,
);
router.post(
  '/clear',
  authenticate,
  authorize(UserRole.CUSTOMER, UserRole.PROVIDER),
  validateBody(clearNotificationsBodySchema),
  controller.clearNotifications,
);
router.patch(
  '/:id/read',
  authenticate,
  authorize(UserRole.CUSTOMER, UserRole.PROVIDER),
  validateParams(notificationIdParamSchema),
  controller.markRead,
);

export default router;
