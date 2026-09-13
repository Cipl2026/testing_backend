import { Router } from 'express';
import { UserRole } from '@ghaarfix/shared-types';
import * as customerController from '@/modules/users/customer.controller.js';
import { authenticate, authorize } from '@/middleware/auth.js';
import { validateBody } from '@/middleware/validate.js';
import { uploadMiddleware } from '@/middleware/upload.js';
import { customerProfileSchema } from '@/validators/auth.js';
import { pushTokenBodySchema } from '@/validators/urgent.js';

const router = Router();

router.patch(
  '/profile',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateBody(customerProfileSchema),
  customerController.updateProfile,
);

router.post(
  '/profile-image',
  authenticate,
  authorize(UserRole.CUSTOMER),
  uploadMiddleware.single('file'),
  customerController.uploadProfileImage,
);

router.post(
  '/issue-photos',
  authenticate,
  authorize(UserRole.CUSTOMER),
  uploadMiddleware.single('file'),
  customerController.uploadIssuePhoto,
);

router.post(
  '/push-token',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateBody(pushTokenBodySchema),
  customerController.registerPushToken,
);

export default router;
