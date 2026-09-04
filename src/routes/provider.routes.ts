import { Router } from 'express';
import { UserRole } from '@ghaarfix/shared-types';
import * as providerController from '@/modules/providers/provider.controller.js';
import * as providerServiceController from '@/modules/provider-services/provider-service.controller.js';
import { authenticate, authorize } from '@/middleware/auth.js';
import { uploadMiddleware } from '@/middleware/upload.js';
import { validateBody, validateParams } from '@/middleware/validate.js';
import { providerProfileSchema } from '@/validators/auth.js';
import { objectIdParamSchema, providerServiceBodySchema, providerServiceUpdateSchema } from '@/validators/catalog.js';
import { providerIdParamSchema } from '@/validators/post-service.js';
import * as postServiceController from '@/modules/post-service/post-service.controller.js';
import { validateQuery } from '@/middleware/validate.js';
import { paginationQuerySchema } from '@ghaarfix/validation';

const router = Router();

router.patch(
  '/profile',
  authenticate,
  authorize(UserRole.PROVIDER),
  validateBody(providerProfileSchema),
  providerController.updateProfile,
);

router.post(
  '/profile-image',
  authenticate,
  authorize(UserRole.PROVIDER),
  uploadMiddleware.single('file'),
  providerController.uploadProfileImage,
);

router.get(
  '/me/services',
  authenticate,
  authorize(UserRole.PROVIDER),
  providerServiceController.listMyServices,
);
router.post(
  '/me/services',
  authenticate,
  authorize(UserRole.PROVIDER),
  validateBody(providerServiceBodySchema),
  providerServiceController.createMyService,
);
router.patch(
  '/me/services/:id',
  authenticate,
  authorize(UserRole.PROVIDER),
  validateParams(objectIdParamSchema),
  validateBody(providerServiceUpdateSchema),
  providerServiceController.updateMyService,
);
router.delete(
  '/me/services/:id',
  authenticate,
  authorize(UserRole.PROVIDER),
  validateParams(objectIdParamSchema),
  providerServiceController.removeMyService,
);

router.get(
  '/:providerId/reviews',
  validateParams(providerIdParamSchema),
  validateQuery(paginationQuerySchema),
  postServiceController.listProviderReviews,
);
router.get(
  '/:providerId/trust',
  validateParams(providerIdParamSchema),
  postServiceController.getProviderTrust,
);

export default router;
