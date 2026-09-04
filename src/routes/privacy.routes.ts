import { Router } from 'express';
import { UserRole } from '@ghaarfix/shared-types';
import { authenticate, authorize } from '@/middleware/auth.js';
import { validateBody, validateParams } from '@/middleware/validate.js';
import * as controller from '@/modules/security/security.controller.js';
import {
  consentUpdateSchema,
  deletionRequestSchema,
  exportIdParamSchema,
} from '@/validators/phase22.js';

const router = Router();

router.get('/consent', authenticate, authorize(UserRole.CUSTOMER), controller.getPrivacyConsent);
router.patch(
  '/consent',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateBody(consentUpdateSchema),
  controller.updatePrivacyConsent,
);
router.post('/export', authenticate, authorize(UserRole.CUSTOMER), controller.requestDataExport);
router.get(
  '/export/:id',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateParams(exportIdParamSchema),
  controller.getDataExport,
);
router.get(
  '/export/:id/download',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateParams(exportIdParamSchema),
  controller.downloadDataExport,
);
router.post(
  '/delete-account',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateBody(deletionRequestSchema),
  controller.requestAccountDeletion,
);
router.get(
  '/delete-account/:id',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateParams(exportIdParamSchema),
  controller.getAccountDeletion,
);

export default router;
